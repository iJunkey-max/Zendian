import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createRequire } from 'node:module';

// Real filesystem integration, with a small Vault adapter rather than the app UI.
// The source is read-only; each run creates a new, retained destination.
class TFile {}
class TFolder {}
const require = createRequire(import.meta.url), modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file);
  const module = { exports: {} }; modules.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  new Function('require','module','exports',code)(name => name === 'obsidian'
    ? {TFile,TFolder,normalizePath:value=>value,Events:class{}}
    : name.startsWith('.') ? load(path.resolve(path.dirname(file),name+'.ts')) : require(name),module,module.exports);
  return module.exports;
}
function vaultAt(root, readonly = false) {
  root = path.resolve(root);
  const nodes = new Map();
  const disk = relative => {
    const absolute = path.resolve(root,relative);
    if (absolute !== root && !absolute.startsWith(root+path.sep)) throw Error('Outside integration vault');
    return absolute;
  };
  const writable = () => { if(readonly) throw Error('Source vault is read-only'); };
  function scan(relative = '') {
    const absolute = disk(relative);
    if (!fs.existsSync(absolute)) return null;
    const stat = fs.statSync(absolute), folder = stat.isDirectory();
    let node = nodes.get(relative);
    if (!node) {node = folder ? new TFolder() : new TFile(); nodes.set(relative,node);}
    Object.assign(node,{path:relative,name:path.posix.basename(relative),stat:{size:stat.size,mtime:stat.mtimeMs,ctime:stat.birthtimeMs}});
    if (folder) {
      node.children = fs.readdirSync(absolute).filter(name=>name!=='.obsidian').map(name=>scan(relative?relative+'/'+name:name));
      for(const child of node.children) child.parent = node;
    } else {node.extension=path.extname(relative).slice(1); node.basename=path.basename(relative,path.extname(relative));}
    return node;
  }
  const refresh = () => scan();
  const read = file => fs.readFileSync(disk(file.path),'utf8');
  const vault = {
    configDir:'.obsidian',
    getFiles:()=>{refresh();return [...nodes.values()].filter(node=>node instanceof TFile && fs.existsSync(disk(node.path)));},
    getAbstractFileByPath:relative=>scan(relative),
    read:async file=>read(file),
    readBinary:async file=>{const bytes=fs.readFileSync(disk(file.path));return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);},
    createFolder:async relative=>{writable();fs.mkdirSync(disk(relative));refresh();},
    create:async(relative,text)=>{writable();fs.writeFileSync(disk(relative),text,{flag:'wx'});refresh();return nodes.get(relative);},
    createBinary:async(relative,bytes)=>{writable();fs.writeFileSync(disk(relative),new Uint8Array(bytes),{flag:'wx'});refresh();},
    rename:async(file,newPath)=>{writable();fs.renameSync(disk(file.path),disk(newPath));refresh();},
    delete:async(file)=>{writable();fs.rmSync(disk(file.path),{recursive:true,force:true});refresh();},
    process:async(file,fn)=>{writable();fs.writeFileSync(disk(file.path),fn(read(file)));refresh();},
    trash:async file=>{writable();fs.mkdirSync(disk('.trash'),{recursive:true});fs.renameSync(disk(file.path),disk('.trash/'+crypto.randomUUID()+'-'+file.name));refresh();},
    adapter:{
      exists:async relative=>fs.existsSync(disk(relative)),
      read:async relative=>fs.readFileSync(disk(relative),'utf8'),
      mkdir:async relative=>{writable();fs.mkdirSync(disk(relative),{recursive:true});},
      write:async(relative,text)=>{writable();fs.writeFileSync(disk(relative),text);},
    },
  };
  return {vault,workspace:{trigger:()=>{}},disk};
}
const {ProjectPackageService}=load('src/homepage/services/ProjectPackageService.ts');
const {ProjectSnapshotService}=load('src/homepage/services/ProjectSnapshotService.ts');
const {ProjectReconciler}=load('src/homepage/services/ProjectReconciler.ts');
const {loadProjectHome,mutateProjectHome}=load('src/homepage/services/ProjectHomeStore.ts');
const {TaskSyncService}=load('src/services/TaskSyncService.ts');
const {DeliverableReleaseService}=load('src/homepage/services/DeliverableReleaseService.ts');
const projectPath = process.argv[2] || '外部整理/重命名后的项目';
const source = vaultAt('.codex-test-vault',true);
const run = path.resolve('.codex-package-disk-runs',Date.now()+'-'+crypto.randomUUID().slice(0,8));
fs.mkdirSync(run,{recursive:true});
const target = vaultAt(path.join(run,'vault'));
fs.mkdirSync(target.disk(''));
const bytes = await new ProjectPackageService(source).export(projectPath,true);
fs.writeFileSync(path.join(run,'project.zip'),bytes);
const inspected = new ProjectPackageService(source).inspect(bytes);
assert(inspected.historyIncluded,'Fixture must contain history');
const failedTarget = vaultAt(path.join(run,'failed-vault'));
fs.mkdirSync(failedTarget.disk(''));
const failedImportApp = { ...failedTarget, vault: { ...failedTarget.vault, createBinary: async (relative, data) => {
  if (relative.endsWith('恢复核验.md')) throw Error('模拟导入文件写入失败');
  return failedTarget.vault.createBinary(relative, data);
} } };
await assert.rejects(() => new ProjectPackageService(failedImportApp).import(bytes,'失败导入',true,new ProjectSnapshotService(failedImportApp)), /目标未发布/);
assert(!fs.existsSync(failedTarget.disk('失败导入')));
const stagingRoot = failedTarget.disk('.obsidian/plugins/zendian/import-staging');
assert(fs.existsSync(stagingRoot));
assert.equal(fs.readdirSync(stagingRoot).length,0);
const snapshots = new ProjectSnapshotService(target);
await new ProjectPackageService(target).import(bytes,'导入副本',true,snapshots);
const homeEntry = [...inspected.entries].find(([name])=>name.startsWith('project/')&&name.endsWith('.home'));
const originalHome = JSON.parse(new TextDecoder().decode(homeEntry[1]));
const homePath = '导入副本/'+homeEntry[0].slice(8);
const importedHome = JSON.parse(fs.readFileSync(target.disk(homePath),'utf8'));
assert.notEqual(importedHome.projectId,originalHome.projectId);
assert.deepEqual({...importedHome,projectId:originalHome.projectId},originalHome);
let comparedFiles = 0;
for(const [name,data] of inspected.entries) {
  if(!name.startsWith('project/')||name.endsWith('.home'))continue;
  assert.deepEqual(fs.readFileSync(target.disk('导入副本/'+name.slice(8))),Buffer.from(data));
  comparedFiles++;
}
const importedHistory = await snapshots.exportProjectHistory('导入副本');
const originalHistory = JSON.parse(new TextDecoder().decode(inspected.entries.get('history/project.json')));
assert.equal(importedHistory.project.versions.length,originalHistory.versions.length);
assert.equal(importedHistory.project.checkpoints.length,originalHistory.checkpoints.length);
assert(importedHistory.project.versions.every(version=>version.projectPath==='导入副本'&&version.filePath.startsWith('导入副本/')));
const checkpoint = importedHistory.project.checkpoints.find(item=>item.name==='文本恢复基线-1103');
assert(checkpoint,'Expected runtime checkpoint fixture');
fs.writeFileSync(target.disk('导入副本/恢复核验.md'),'导入后修改');
fs.writeFileSync(target.disk('导入副本/迁移后新增.md'),'迁移后新增保留');
const restored = await snapshots.restoreCheckpoint(checkpoint.id);
assert.equal(restored.failed.length,0);
assert.equal(fs.readFileSync(target.disk('导入副本/恢复核验.md'),'utf8').trim(),'# 恢复核验基线');
assert.equal(fs.readFileSync(target.disk('导入副本/迁移后新增.md'),'utf8'),'迁移后新增保留');
assert.equal(JSON.parse(fs.readFileSync(target.disk(homePath),'utf8')).projectId,importedHome.projectId);
await new ProjectReconciler(target,async()=>{throw Error('Initial discovery must not relocate history');}).reconcile();
const movedPath = '离线整理后的副本';
// Both paths pass the adapter's root containment check. All fixtures stay in this run.
fs.renameSync(target.disk('导入副本'),target.disk(movedPath));
const restarted = vaultAt(path.join(run,'vault'));
const restartedSnapshots = new ProjectSnapshotService(restarted);
const movedCalls = [];
const restartedReconciler = new ProjectReconciler(restarted,async(from,to)=>{
  movedCalls.push([from,to]);
  await restartedSnapshots.rebaseProjectPath(from,to);
});
await restartedReconciler.reconcile();
assert.deepEqual(movedCalls,[['导入副本',movedPath]]);
assert.equal(restartedReconciler.getLocations().find(location=>location.projectId===importedHome.projectId).path,movedPath);
const movedHistory = await restartedSnapshots.exportProjectHistory(movedPath);
assert(movedHistory.project.versions.every(version=>version.filePath.startsWith(movedPath+'/')));
assert(movedHistory.project.checkpoints.every(item=>Object.keys(item.versions).every(file=>file.startsWith(movedPath+'/'))));
const movedCheckpoint = movedHistory.project.checkpoints.find(item=>item.id===checkpoint.id);
assert(movedCheckpoint);
fs.renameSync(restarted.disk(movedPath+'/恢复核验.md'),restarted.disk(movedPath+'/缺失模拟原件备份.md'));
const missingPreview = await restartedSnapshots.previewCheckpoint(movedCheckpoint.id);
assert(missingPreview.create.includes(movedPath+'/恢复核验.md'));
assert(missingPreview.preserve.includes(movedPath+'/缺失模拟原件备份.md'));
const movedRestore = await restartedSnapshots.restoreCheckpoint(movedCheckpoint.id);
assert.equal(movedRestore.failed.length,0);
assert.equal(fs.readFileSync(restarted.disk(movedPath+'/恢复核验.md'),'utf8').trim(),'# 恢复核验基线');
assert(fs.existsSync(restarted.disk(movedPath+'/缺失模拟原件备份.md')));
assert.equal(JSON.parse(fs.readFileSync(restarted.disk(movedPath+'/'+homeEntry[0].slice(8)),'utf8')).projectId,importedHome.projectId);
const legacyPath='旧项目', legacyHomePath=legacyPath+'/00 控制台/旧主页.home';
fs.mkdirSync(restarted.disk(legacyPath+'/00 控制台'),{recursive:true});
const legacyOriginal=JSON.stringify({name:'旧项目',tasks:[{text:'主页已有任务',completed:false}],deliverables:[],customData:{retain:true}});
const legacyOverview='# 旧项目目标\n原笔记应保持原样';
const legacyTimeline='- [ ] 从Timeline迁入任务 @created(2026-11-01) @priority(high) @tags(研究,验收)\n- [x] 已验收阶段 `2026-11-02` (100%)';
fs.writeFileSync(restarted.disk(legacyHomePath),legacyOriginal);
fs.writeFileSync(restarted.disk(legacyPath+'/Overview.md'),legacyOverview);
fs.writeFileSync(restarted.disk(legacyPath+'/Timeline.md'),legacyTimeline);
const backups=()=>fs.readdirSync(restarted.disk('.obsidian/plugins/zendian')).filter(name=>name.startsWith('project-backup-'));
const backupCountBefore=backups().length;
const legacyRead=await loadProjectHome(restarted,legacyPath);
assert.equal(fs.readFileSync(restarted.disk(legacyHomePath),'utf8'),legacyOriginal);
assert.equal(backups().length,backupCountBefore);
assert.equal(legacyRead.data.tasks.length,2);
assert.equal(legacyRead.data.timeline.milestones.length,1);
assert.equal(legacyRead.data.overview.markdown,legacyOverview);
assert(await mutateProjectHome(restarted,legacyPath,data=>{data.description='首次明确修改';}));
const upgraded=JSON.parse(fs.readFileSync(restarted.disk(legacyHomePath),'utf8'));
assert(upgraded.projectId);assert.equal(upgraded.schemaVersion,2);
assert.equal(upgraded.tasks.length,2);assert.equal(upgraded.timeline.milestones.length,1);
assert.deepEqual(upgraded.customData,{retain:true});
assert.equal(backups().length,backupCountBefore+1);
assert(backups().some(name=>fs.readFileSync(restarted.disk('.obsidian/plugins/zendian/'+name),'utf8')===legacyOriginal));
const legacyTasks=new TaskSyncService(restarted);
const migratedTask=(await legacyTasks.getTasks(legacyPath)).find(task=>task.text==='从Timeline迁入任务');
assert(await legacyTasks.deleteTask(legacyPath,migratedTask.line,migratedTask.id,migratedTask.projectId));
const coldLegacy=await loadProjectHome(vaultAt(path.join(run,'vault')),legacyPath);
assert.equal(coldLegacy.data.tasks.length,1);
assert.equal(coldLegacy.data.projectId,upgraded.projectId);
assert.equal(backups().length,backupCountBefore+1);
assert.equal(fs.readFileSync(restarted.disk(legacyPath+'/Overview.md'),'utf8'),legacyOverview);
assert.equal(fs.readFileSync(restarted.disk(legacyPath+'/Timeline.md'),'utf8'),legacyTimeline);
const releaseSettings={getSettings:()=>({homepage:{projectCategories:[{number:'99',name:'新交付分类'}],projectDeliverableFolders:{'99':'新交付目录'}}})};
const movedHomePath=movedPath+'/'+homeEntry[0].slice(8);
const beforeFailedRelease=fs.readFileSync(restarted.disk(movedHomePath),'utf8');
const failingReleaseApp={...restarted,vault:{...restarted.vault,process:async()=>{throw Error('模拟主页登记失败');}}};
await assert.rejects(()=>new DeliverableReleaseService(failingReleaseApp,releaseSettings).publish({projectPath:movedPath,projectType:'未分类',releaseName:'故障后补登记',description:'真实磁盘补登记验证',sourcePaths:[movedPath+'/恢复核验.md']}),/ZIP 已生成/);
assert.equal(fs.readFileSync(restarted.disk(movedHomePath),'utf8'),beforeFailedRelease);
const orphanPath='交付物/故障后补登记.zip';
const orphanHash=crypto.createHash('sha256').update(fs.readFileSync(restarted.disk(movedPath+'/'+orphanPath))).digest('hex');
const releases=new DeliverableReleaseService(restarted,releaseSettings);
const recovered=await releases.recoverArchive(movedPath,orphanPath);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(restarted.disk(movedPath+'/'+orphanPath))).digest('hex'),orphanHash);
assert.equal(JSON.parse(fs.readFileSync(restarted.disk(movedHomePath),'utf8')).deliverables.filter(item=>item.id===recovered.id).length,1);
await assert.rejects(()=>releases.recoverArchive(movedPath,orphanPath),/未重复登记/);
assert(await mutateProjectHome(restarted,movedPath,data=>{data.type='新交付分类';}));
assert.equal(releases.resolveFolder(movedPath,'新交付分类').folderName,'新交付目录');
assert(!releases.listSelectableFiles(movedPath,'新交付分类').some(file=>file.path.endsWith('.zip')));
await releases.deleteArchive(movedPath,'新交付分类',recovered);
assert(!fs.existsSync(restarted.disk(movedPath+'/'+orphanPath)));
assert(fs.readdirSync(restarted.disk('.trash')).some(name=>name.endsWith('故障后补登记.zip')));
assert(await mutateProjectHome(restarted,movedPath,data=>{data.deliverables=data.deliverables.filter(item=>item.id!==recovered.id);}));
const afterReleaseDelete=JSON.parse(fs.readFileSync(restarted.disk(movedHomePath),'utf8'));
assert(afterReleaseDelete.businessEvents.some(event=>event.kind==='deliverable-added'&&event.name===recovered.name));
assert(afterReleaseDelete.businessEvents.some(event=>event.kind==='deliverable-removed'&&event.name===recovered.name));
const report = {scope:'Real filesystem with Vault adapter; not Obsidian UI',sourceProject:projectPath,packageSha256:crypto.createHash('sha256').update(bytes).digest('hex'),comparedFiles,taskCount:importedHome.tasks.length,deliverables:importedHome.deliverables.length,versions:importedHistory.project.versions.length,checkpoints:importedHistory.project.checkpoints.length,independentIdentity:true,restored,offlineMove:{moves:movedCalls,missingPreview,result:movedRestore,identityPreserved:true},legacyUpgrade:{readOnlyUnchanged:true,backupMatchesOriginal:true,initialTasks:2,milestones:1,sourceNotesPreserved:true,coldReloadTasks:1,deletedLegacyTaskNotResurrected:true,identityPreserved:true},releaseRecovery:{orphanZipPreserved:true,recoveredOnce:true,zipUnchanged:true,duplicateRejected:true,oldFolderExcludedAfterCategoryChange:true,oldZipMovedToTrash:true,addAndRemoveEventsPreserved:true},run};
fs.writeFileSync(path.join(run,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
