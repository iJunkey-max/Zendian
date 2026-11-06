import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const placementSource = fs.readFileSync('src/ui/panel-placement.ts', 'utf8');
const placementAst = ts.createSourceFile('placement.ts', placementSource, ts.ScriptTarget.Latest, true);
const placementFn = placementAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'placeNearAnchor');
assert(placementFn);
const placementJS = ts.transpileModule(`${placementFn.getText(placementAst).replace(/^export\s+/, '')}\nreturn placeNearAnchor;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const placeNearAnchor = new Function(placementJS)();
const intersectionFn = placementAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'intersectPanelBounds');
assert(intersectionFn);
const intersectionJS = ts.transpileModule(`${intersectionFn.getText(placementAst).replace(/^export\s+/, '')}\nreturn intersectPanelBounds;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const intersectPanelBounds = new Function(intersectionJS)();
const bounds = { left: -1920, top: 0, width: 1920, height: 1080 };
assert.deepEqual(placeNearAnchor({ x: -1500, y: 300 }, { width: 500, height: 700 }, bounds), { x: -1750, y: 200 });
assert.deepEqual(placeNearAnchor({ x: -10, y: 1050 }, { width: 500, height: 700 }, bounds), { x: -512, y: 368 });
assert.deepEqual(placeNearAnchor({ x: -1915, y: 2 }, { width: 3000, height: 2000 }, bounds), { x: -1908, y: 12 });
assert.deepEqual(intersectPanelBounds(bounds, { left: -1800, top: 100, width: 1000, height: 800 }), { left: -1800, top: 100, width: 1000, height: 800 });
assert.deepEqual(intersectPanelBounds(bounds, { left: -2000, top: -50, width: 1000, height: 600 }), { left: -1920, top: 0, width: 920, height: 550 });
console.log('✓ 面板围绕触发点显示，并限制在屏幕可用范围内');

// Execute the actual view methods without importing Obsidian's DOM runtime.
const source = fs.readFileSync('src/homepage/ProjectConsoleView.ts', 'utf8');
assert(source.includes('private watchedProjectPath = "";'));
assert(source.includes('this.services.fileWatcher.unwatchProject(this.watchedProjectPath || this.projPath'));
assert(source.includes('const projectEpoch = this.fileEpoch;'));
assert(source.includes('this.releaseService.recoverArchive(projectPath, path)'));
assert(source.includes('项目位置已变化，请重新打开交付物面板后再补登记'));
assert(source.includes('taskSyncService.addTask(projectPath, text, { expectedProjectId: projectId })'));
assert(source.includes('const isCurrent = () => projectEpoch === this.fileEpoch && projectPath === this.projPath;'));
assert(source.includes('getActivityTrend(projectPath, 30)'));
assert(source.includes('检查点恢复写入失败'));
assert(source.includes('检查点已恢复，页面刷新失败'));
assert(source.includes('检查点删除写入失败'));
assert(source.includes('任务状态已保存，页面刷新失败'));
assert(source.includes('任务已删除，页面刷新失败'));
const maintenanceSource = fs.readFileSync('src/homepage/ProjectMaintenanceModal.ts', 'utf8');
assert(maintenanceSource.includes('rollbackHistory'));
assert(maintenanceSource.includes('rollbackLinks'));
assert(maintenanceSource.includes('文件改名已确认，但项目重新核对失败'));
const ast = ts.createSourceFile('view.ts', source, ts.ScriptTarget.Latest, true);
const helpers = ['sortPendingProjectTasks', 'latestDeliverable'].map(name => {
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert(fn, `Missing dashboard helper ${name}`);
  return fn.getText(ast);
}).join('\n');
const helperJS = ts.transpileModule(`${helpers}\nreturn {sortPendingProjectTasks, latestDeliverable};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const { sortPendingProjectTasks, latestDeliverable } = new Function(helperJS)();
assert.deepEqual(sortPendingProjectTasks([]), []);
const sampleTasks = [
  { text: '普通', priority: 'P2', completed: false },
  { text: '已完成', priority: 'P0', completed: true },
  { text: '优先且较晚', priority: 'P1', due: '2026-11-09', completed: false },
  { text: '优先且较早', priority: 'P1', due: '2026-11-08', completed: false },
];
assert.deepEqual(sortPendingProjectTasks(sampleTasks).map(x => x.i), [3, 2, 0]);
assert.deepEqual(sortPendingProjectTasks([sampleTasks[0]]).map(x => x.t.text), ['普通']);
assert.equal(latestDeliverable([]), undefined);
assert.equal(latestDeliverable([{ name: '旧' }, { name: '末项' }]).name, '末项');
assert.equal(latestDeliverable([{ name: '新', createdAt: '2026-11-06' }, { name: '旧', createdAt: '2026-01-01' }, { name: '无日期' }]).name, '新');
console.log('✓ 首页摘要复用待办排序，并按有效日期或原记录顺序选择最新交付物');
const view = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'ProjectConsoleView');
assert(view);
const names = ['loadProjectData', 'refreshProjectTabTitle', 'queueProjectPathChange', 'applyProjectPathChange', 'stopProjectWatch', 'openCreateCheckpointPanel', 'matchesTimelineFilter', 'openSubmitDeliverablePanel', 'openAddTaskModal', 'editDescription'];
const methods = names.map(name => {
  const method = view.members.find(node => node.name?.getText(ast) === name);
  assert(method, `Missing view method ${name}`);
  return method.getText(ast);
}).join('\n');
const js = ts.transpileModule(`class Harness { ${methods} }; return Harness;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
class MockFile {}
let checkpointSubmit;
class MockCheckpointModal {
  constructor(app, submit) { checkpointSubmit = submit; }
  open() {}
}
let releaseSubmit;
class MockReleaseModal {
  constructor(app, path, type, service, submit) { releaseSubmit = submit; }
  open() {}
}
let taskSubmit;
class MockTaskModal {
  constructor(app, submit) { taskSubmit = submit; }
  open() {}
}
const Harness = new Function('TFile', 'Notice', 'CreateCheckpointModal', 'SubmitDeliverableModal', 'AddTaskModal', js)(MockFile, class {}, MockCheckpointModal, MockReleaseModal, MockTaskModal);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const h = new Harness();
Object.assign(h, {
  file: new MockFile(), projPath: 'A', fileEpoch: 1, dataLoadGeneration: 0,
  projectPathChangeQueue: Promise.resolve(), toDisplayPriority: value => value,
  taskSyncService: { getTasks: async path => [{ id: path, text: path, completed: false }] },
  services: { projectData: {
    getProjectStatistics: async path => ({ path }), getProjectHealth: async path => ({ path }),
  } },
});
const unwatchCalls=[];
h.services.fileWatcher={unwatchProject:(path,callback)=>unwatchCalls.push([path,callback])};
h.watchedProjectPath='移动前/项目';h.projPath='移动后/项目';h.fileWatcherCallback=()=>{};
h.stopProjectWatch();
assert.equal(unwatchCalls[0][0],'移动前/项目');
assert.equal(h.watchedProjectPath,'');
assert.equal(h.fileWatcherCallback,null);
console.log('✓ 项目控制台关闭时按实际监听路径解除异步移动前的旧监听');
h.services.fileWatcher={};
h.timelineFilter = 'project';
assert.equal(h.matchesTimelineFilter({ type: 'project-moved' }), true);
assert.equal(h.matchesTimelineFilter({ type: 'task-created' }), false);
const oldRead = deferred();
h.services.projectData.getProjectConsoleData = path => path === 'A' ? oldRead.promise : Promise.resolve({ name: path });
const first = h.loadProjectData();
h.projPath = 'B';
await h.loadProjectData();
oldRead.resolve({ name: 'A' });
await first;
assert.equal(h.data.name, 'B');
assert.equal(h.timelineTasks[0].id, 'B');
assert.equal(h.projectStats.path, 'B');
const headerNames=[];
h.leaf={updateHeader(){headerNames.push(h.data.name);}};
h.projPath='新名称';
await h.loadProjectData();
assert.deepEqual(headerNames,['新名称']);
await h.loadProjectData();
assert.deepEqual(headerNames,['新名称']);
h.leaf={};h.refreshProjectTabTitle();
const closingRead = deferred();
h.services.projectData.getProjectConsoleData = () => closingRead.promise;
const closing = h.loadProjectData();
++h.dataLoadGeneration;
h.data = null;
closingRead.resolve({ name: 'closed' });
await closing;
assert.equal(h.data, null);

const firstMigration = deferred();
const moves = [], renders = [];
h.services.rebaseProjectPath = async (from, to) => { moves.push([from, to]); if (from === 'A') await firstMigration.promise; };
h.migrateCustomIconPaths = async () => {};
h.services.projectData.getProjectConsoleData = async path => ({ name: path });
h.render = () => renders.push(h.data.name);
h.projPath = 'A';
h.queueProjectPathChange('A', 'B');
assert.equal(h.projPath, 'B');
await Promise.resolve();
h.queueProjectPathChange('B', 'C');
assert.equal(h.projPath, 'C');
firstMigration.resolve();
await h.projectPathChangeQueue;
assert.deepEqual(moves, [['A', 'B'], ['B', 'C']]);
assert.deepEqual(renders, ['C']);
assert.equal(h.data.name, 'C');
h.queueProjectPathChange('C', 'D');
++h.fileEpoch;
await h.projectPathChangeQueue;
assert.equal(moves.length, 2);
console.log('✓ 控制台延迟读取不覆盖新项目或已卸载页面，连续目录移动按序迁移且仅渲染最终位置');

const created = [], invalidated = [];
h.openProjectPopout = async () => false;
h.services.snapshots = { createCheckpoint: async (path, name) => { created.push([path, name]); } };
h.services.timeline = { clearCache: path => invalidated.push(path) };
const panel = { isConnected: false };
h.projPath = '检查点原项目';
await h.openCreateCheckpointPanel(panel);
h.projPath = '其他项目';
await assert.rejects(() => checkpointSubmit('过期表单'), /项目已切换或移动/);
assert.equal(created.length, 0);
h.projPath = '检查点原项目';
await h.openCreateCheckpointPanel(panel);
await checkpointSubmit('正常提交');
assert.deepEqual(created, [['检查点原项目', '正常提交']]);
assert.deepEqual(invalidated, ['检查点原项目']);
await h.openCreateCheckpointPanel(panel);
++h.fileEpoch;
await assert.rejects(() => checkpointSubmit('重新打开同路径'), /项目已切换或移动/);
assert.equal(created.length, 1);
let checkpointRenders = 0;
h.render = () => { checkpointRenders++; };
await h.openCreateCheckpointPanel({ isConnected: true });
await checkpointSubmit('更新整个视图');
assert.equal(checkpointRenders, 1);
console.log('✓ 检查点表单绑定原项目，切换、移动或重新加载后拒绝提交，正常创建只失效原项目缓存');
h.timelineFilter = 'project';
assert(h.matchesTimelineFilter({ type: 'project-restored' }));
assert(!h.matchesTimelineFilter({ type: 'file-restored' }));
h.timelineFilter = 'files';
assert(!h.matchesTimelineFilter({ type: 'project-restored' }));
assert(h.matchesTimelineFilter({ type: 'file-restored' }));
console.log('✓ 项目主页恢复归入项目事件，文件版本恢复归入文件版本');

const releases = [], releaseCache = [];
const publishGate = deferred();
h.releaseService = { publish: async options => { releases.push(options); await publishGate.promise; return { name: options.releaseName }; } };
h.services.clearProjectCache = path => releaseCache.push(path);
h.projPath = '发布原项目';
await h.openSubmitDeliverablePanel('分类');
h.projPath = '另一项目';
await assert.rejects(() => releaseSubmit('过期', '', []), /项目已切换或移动/);
assert.equal(releases.length, 0);
h.projPath = '发布原项目';
await h.openSubmitDeliverablePanel('分类');
const paths = ['发布原项目/a.md'];
const publishing = releaseSubmit('验收', '', paths);
paths.push('不应进入发布的后续修改');
await assert.rejects(() => releaseSubmit('重复', '', paths), /正在发布/);
h.projPath = '另一项目';
publishGate.resolve();
const renderCountBeforeRelease = checkpointRenders;
await publishing;
assert.equal(releases.length, 1);
assert.equal(releases[0].projectPath, '发布原项目');
assert.deepEqual(releases[0].sourcePaths, ['发布原项目/a.md']);
assert.deepEqual(releaseCache, ['发布原项目']);
assert.equal(checkpointRenders, renderCountBeforeRelease);
h.projPath = '发布原项目';
await h.openSubmitDeliverablePanel('分类');
h.loadProjectData = async () => { throw Error('模拟刷新失败'); };
await releaseSubmit('已发布但刷新失败', '', []);
assert.equal(releases.length, 2);
console.log('✓ 发布表单拒绝过期项目及重复提交，发布期间切换不刷新新项目，成功后刷新失败不误报发布失败');
const taskCreates = [];
h.projPath = '任务原项目';
h.data = {projectId:'task-project-id'};
h.openAddTaskWindow = async () => false;
h.toStoragePriority = value => value;
h.taskSyncService.addTask = async (...args) => { taskCreates.push(args); return false; };
await h.openAddTaskModal();
h.projPath = '另一项目';
await assert.rejects(() => taskSubmit({text:'不应写入'}), /项目已切换或移动/);
assert.equal(taskCreates.length, 0);
h.projPath = '任务原项目';
await h.openAddTaskModal();
await assert.rejects(() => taskSubmit({text:'保存失败'}), /任务未保存/);
assert.equal(taskCreates[0][0], '任务原项目');
assert.equal(taskCreates[0][2].expectedProjectId, 'task-project-id');
h.taskSyncService.addTask = async () => true;
await taskSubmit({text:'保存成功刷新失败'});
console.log('✓ 任务普通弹窗绑定原项目，保存失败向表单传播以保留输入，保存后的刷新失败不重复添加');

const taskView = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'ProjectTaskCreatePopoutView');
assert(taskView);
const taskStateMethods = ['getState','setState'].map(name => taskView.members.find(node => node.name?.getText(ast) === name).getText(ast)).join('\n');
const taskStateJs = ts.transpileModule(`class TaskStateHarness extends Base { ${taskStateMethods} }; return TaskStateHarness;`, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const TaskStateHarness = new Function('Base',taskStateJs)(class { async setState() {} });
const draftView = new TaskStateHarness();
let draftRenders = 0;
draftView.onOpen = async () => { draftRenders++; };
const draft = {projectPath:'原项目',projectId:'stable-id',text:'未提交\n草稿',due:'2026-11-03',dueTime:'18:00',priority:'P1',tags:['计划','复核']};
await draftView.setState(draft,{});
assert.deepEqual(draftView.getState(),draft);
const escapedDraft = draftView.getState(); escapedDraft.tags.push('外部修改');
assert.deepEqual(draftView.getState().tags,['计划','复核']);
await draftView.setState({projectPath:42,projectId:{},text:[],priority:'unknown',tags:['合法',3]},{});
assert.deepEqual(draftView.getState(),{projectPath:'',projectId:null,text:'',due:'',dueTime:'',priority:'P2',tags:['合法']});
draftView.saving = true;
await draftView.setState(draft,{});
assert.equal(draftView.getState().projectPath,'');
assert.equal(draftRenders,2);
console.log('✓ 任务窗口草稿与身份状态可往返，标签不共享数组，异常状态规范化，保存期间不切换归属');

const homepageSource=fs.readFileSync('src/homepage/HomepageView.ts','utf8');
assert(source.includes('DeliverableReleasePendingRecordError'));
assert(source.includes('立即补登记'));
assert(source.includes('this.openRecoverDeliverablePanel(relativePath, projectPath, epoch)'));
assert(source.includes('private openRecoverDeliverablePanel('));
assert(homepageSource.includes('reconcileProjects?: () => Promise<void>'));
assert(homepageSource.includes('await this.dependencies.reconcileProjects?.();'));
assert(homepageSource.includes('if (checkboxEl.dataset.zendianUpdating === "true") return;'));
assert(homepageSource.includes('checkboxEl.setAttribute("aria-busy", "true");'));
assert(homepageSource.includes('private renderGeneration = 0;'));
assert(homepageSource.includes('const generation = ++this.renderGeneration;'));
assert(homepageSource.includes('const openGeneration = ++this.renderGeneration;'));
assert(homepageSource.includes('if (openGeneration !== this.renderGeneration) return;'));
assert(homepageSource.includes('if (generation !== this.renderGeneration || !section.isConnected) return;'));
assert(homepageSource.includes('if (!overlay.isConnected) return;'));
const mainSource=fs.readFileSync('src/main.ts','utf8');
assert(mainSource.includes('reconcileProjects: () => reconciler.reconcile(true)'));
console.log('✓ 首页项目维护入口复用深度身份/文件核对服务，避免只刷新卡片而未更新索引');
const homepageCreateClass = ts.createSourceFile('HomepageView.ts', homepageSource, ts.ScriptTarget.Latest, true);
const homepageViewClass = homepageCreateClass.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'HomepageView');
assert(homepageViewClass);
const toggleTaskMethod = homepageViewClass.members.find(node => node.name?.getText(homepageCreateClass) === 'toggleTask');
assert(toggleTaskMethod);
const toggleTaskJs = ts.transpileModule(`class ToggleTaskHarness { ${toggleTaskMethod.getText(homepageCreateClass)} }; return ToggleTaskHarness;`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const ToggleTaskHarness = new Function('Notice', toggleTaskJs)(class {});
const toggleHarness = new ToggleTaskHarness();
let toggleCalls = 0;
const toggleGate = deferred();
toggleHarness.dependencies = { taskSyncService: { toggleTask: async () => { toggleCalls++; await toggleGate.promise; return true; } } };
toggleHarness.loadTodos = () => {};
const toggleText = { classList: { add() {}, remove() {} }, addClass() {}, removeClass() {} };
const toggleItem = { querySelector: () => toggleText };
const toggleCheckbox = {
  dataset: {}, attrs: new Map(), classList: { toggle() {} },
  createDiv: () => ({}), querySelector: () => null, closest: () => toggleItem,
  setAttribute(name, value) { this.attrs.set(name, value); },
  removeAttribute(name) { this.attrs.delete(name); }, isConnected: true,
};
const toggleTask = { projectPath: '原项目', line: 1, raw: '- [ ] 并发点击', completed: false, projectId: 'stable' };
const firstToggle = toggleHarness.toggleTask(toggleTask, toggleCheckbox);
const secondToggle = toggleHarness.toggleTask(toggleTask, toggleCheckbox);
await secondToggle;
assert.equal(toggleCalls, 1);
toggleGate.resolve();
await firstToggle;
assert.equal(toggleCheckbox.dataset.zendianUpdating, undefined);
assert.equal(toggleCheckbox.attrs.has('aria-busy'), false);
console.log('✓ 首页待办同一行重复点击只保留一个在途写入，完成后解除忙碌状态');
const projectCreateView = homepageCreateClass.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'ProjectCreatePopoutView');
assert(projectCreateView);
const projectCreateStateMethods = ['getState','setState'].map(name => projectCreateView.members.find(node => node.name?.getText(homepageCreateClass) === name).getText(homepageCreateClass)).join('\n');
const projectCreateStateJs = ts.transpileModule(`class ProjectCreateStateHarness extends Base { ${projectCreateStateMethods} }; return ProjectCreateStateHarness;`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const ProjectCreateStateHarness = new Function('Base', projectCreateStateJs)(class { async setState() {} });
const projectDraftView = new ProjectCreateStateHarness();
let projectDraftRenders = 0;
projectDraftView.onOpen = async () => { projectDraftRenders++; };
const projectDraft = { version: 1, selectedIcon: 'lucide-book-open', name: '未提交项目', number: '1103', description: '保留简介', typeFolder: '课程', parentPath: '工作/2026' };
await projectDraftView.setState(projectDraft, {});
assert.deepEqual(projectDraftView.getState(), projectDraft);
const projectDraftCopy = projectDraftView.getState();
projectDraftCopy.name = '外部副本修改';
assert.equal(projectDraftView.getState().name, '未提交项目');
await projectDraftView.setState({ selectedIcon: 42, name: [], number: {}, description: null, typeFolder: [], parentPath: 9 }, {});
assert.deepEqual(projectDraftView.getState(), { version: 1, selectedIcon: 'lucide-folder', name: '', number: '', description: '', typeFolder: '', parentPath: '' });
assert.equal(projectDraftRenders, 2);

const homepageTaskView = homepageCreateClass.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'HomepageTaskCreatePopoutView');
assert(homepageTaskView);
const homepageTaskStateMethods = ['getState','setState'].map(name => homepageTaskView.members.find(node => node.name?.getText(homepageCreateClass) === name).getText(homepageCreateClass)).join('\n');
const homepageTaskStateJs = ts.transpileModule(`class HomepageTaskStateHarness extends Base { ${homepageTaskStateMethods} }; return HomepageTaskStateHarness;`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const HomepageTaskStateHarness = new Function('Base', homepageTaskStateJs)(class { async setState() {} });
const homepageTaskDraftView = new HomepageTaskStateHarness();
let homepageTaskDraftRenders = 0;
homepageTaskDraftView.onOpen = async () => { homepageTaskDraftRenders++; };
const homepageTaskDraft = { version: 1, projectPath: '原项目', projectId: 'stable-id', text: '首页草稿', due: '2026-11-03', dueTime: '18:00', priority: 'high' };
await homepageTaskDraftView.setState(homepageTaskDraft, {});
assert.deepEqual(homepageTaskDraftView.getState(), homepageTaskDraft);
homepageTaskDraftView.saving = true;
await homepageTaskDraftView.setState({ projectPath: '不应切换', projectId: 'other', text: '覆盖', due: '', dueTime: '', priority: 'low' }, {});
assert.equal(homepageTaskDraftView.getState().projectPath, '原项目');
assert.equal(homepageTaskDraftRenders, 1);
console.log('✓ 新建项目与首页待办独立窗口草稿可往返，异常状态规范化，保存期间不切换归属');

function descriptionContainer() {
  const handlers=new Map();
  const input={value:'',disabled:false,focus(){},select(){},addEventListener:(type,fn)=>handlers.set(type,fn)};
  const buttons=[];
  const actions={createEl:(tag,options={})=>{const button={textContent:options.text||'',disabled:false,handlers:new Map(),addEventListener(type,fn){this.handlers.set(type,fn);},click(){return this.handlers.get('click')?.();}};buttons.push(button);return button;}};
  let current=null;
  return {input,handlers,buttons,querySelector:selector=>selector==='textarea'?current:null,classList:{add(){}},empty:()=>{current=null;},createDiv:()=>actions,createEl:tag=>{if(tag!=='textarea')throw new Error(`Unexpected element ${tag}`);current=input;return input;}};
}
h.projPath='简介项目';h.data={projectId:'desc-id',description:'旧简介'};
let descriptionWrites=0;
h.services.projectData.mutateProjectConsoleData=async()=>{descriptionWrites++;return false;};
const cancelledDescription=descriptionContainer();
h.render=()=>cancelledDescription.handlers.get('blur')?.();
h.editDescription(cancelledDescription);
cancelledDescription.input.value='不应保存';
cancelledDescription.handlers.get('keydown')({key:'Escape',preventDefault(){}});
await new Promise(setImmediate);
assert.equal(descriptionWrites,0);
assert.equal(cancelledDescription.handlers.has('blur'),false);
const cancelButton=cancelledDescription.buttons.find(button=>button.textContent==='取消');
await cancelButton.click();
assert.equal(descriptionWrites,0);
const failedDescription=descriptionContainer();
h.render=()=>{};
h.editDescription(failedDescription);
failedDescription.input.value='保留草稿';
h.editDescription(failedDescription);
assert.equal(failedDescription.input.value,'保留草稿');
const saveButton=failedDescription.buttons.find(button=>button.textContent==='保存简介');
await saveButton.click();
await new Promise(setImmediate);
assert.equal(descriptionWrites,1);
assert.equal(failedDescription.input.disabled,false);
assert.equal(failedDescription.input.value,'保留草稿');
assert.equal(saveButton.disabled,false);
assert.equal(h.data.description,'旧简介');
let latestDescription={projectId:'desc-id',description:'其他窗口的新简介'};
h.services.projectData.mutateProjectConsoleData=async(path,mutator)=>mutator(latestDescription)!==false;
await saveButton.click();
await new Promise(setImmediate);
assert.equal(latestDescription.description,'其他窗口的新简介');
latestDescription={projectId:'desc-id',description:'旧简介'};
h.loadProjectData=async()=>{};
await saveButton.click();
await new Promise(setImmediate);
assert.equal(latestDescription.description,'保留草稿');
const thrownDescription=descriptionContainer();
h.services.projectData.mutateProjectConsoleData=async()=>{throw new Error('模拟磁盘拒绝写入');};
h.editDescription(thrownDescription);
thrownDescription.input.value='失败后仍可修改';
await thrownDescription.buttons.find(button=>button.textContent==='保存简介').click();
await new Promise(setImmediate);
assert.equal(thrownDescription.input.disabled,false);
assert.equal(thrownDescription.buttons.find(button=>button.textContent==='保存简介').disabled,false);
assert.equal(thrownDescription.input.value,'失败后仍可修改');
console.log('✓ 简介提供显式保存和取消，Escape 与按钮取消均不写入；失败可重试、拒绝覆盖其他窗口简介，成功后刷新');
const homepageAst=ts.createSourceFile('HomepageView.ts',homepageSource,ts.ScriptTarget.Latest,true);
const homepageClass=homepageAst.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='HomepageView');
const openProjectMethod=homepageClass.members.find(node=>node.name?.getText(homepageAst)==='openProjectInNewTab').getText(homepageAst);
let discoveredProjects=[],openedHome=null;
const homeNotices=[];
const openJs=ts.transpileModule(`class HomeHarness { ${openProjectMethod} }; return HomeHarness;`,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const HomeHarness=new Function('TFile','ProjectRegistry','Notice',openJs)(MockFile,class {async discover(){return {projects:discoveredProjects};}},class {constructor(message){homeNotices.push(message);}});
const homepage=new HomeHarness();
homepage.app={vault:{getAbstractFileByPath:path=>Object.assign(new MockFile(),{path})},workspace:{getLeaf:()=>({openFile:async file=>{openedHome=file.path;}})}};
homepage.projectScanService={markDirty(){}};
discoveredProjects=[{projectId:'original-id',state:'ready',folderPath:'新位置',homePath:'新位置/项目.home'}];
await homepage.openProjectInNewTab('旧位置','original-id');
assert.equal(openedHome,'新位置/项目.home');
openedHome=null;
discoveredProjects=[{projectId:'copy-id',state:'ready',folderPath:'旧位置',homePath:'旧位置/副本.home'}];
await homepage.openProjectInNewTab('旧位置','original-id');
await homepage.openProjectInNewTab('旧位置',null);
assert.equal(openedHome,null);
discoveredProjects=[{projectId:'original-id',state:'duplicate',folderPath:'旧位置',homePath:'旧位置/副本.home'}];
await homepage.openProjectInNewTab('旧位置','original-id');
assert.equal(openedHome,null);
assert.equal(homeNotices.length,3);
console.log('✓ 首页按身份打开移动后的项目，原路径被副本占用或身份冲突时不误打开');
