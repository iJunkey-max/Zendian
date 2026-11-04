import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { ProjectRegistry, type RegisteredProject } from "./services/ProjectRegistry";
import { mutateProjectHome } from "./services/ProjectHomeStore";
import { getPluginDataPath } from "../utils/plugin-paths";
import { ProjectFileInventory, type DiscoveredChange } from "./services/ProjectFileInventory";
import { getServiceManager } from "./services";
import { TaskFileLinkService } from "./services/TaskFileLinkService";
import { assertMissingProjectRelinkSafe } from "./services/project-relink";

/** Explicit, reviewable maintenance; discovery itself never modifies project content. */
export class ProjectMaintenanceModal extends Modal {
  private static active?: ProjectMaintenanceModal;
  private generation = 0;
  private busy = false;
  constructor(app: App, private onChanged: () => Promise<void>) { super(app); }

  open(): void {
    if (ProjectMaintenanceModal.active && ProjectMaintenanceModal.active !== this) {
      ProjectMaintenanceModal.active.close();
    }
    ProjectMaintenanceModal.active = this;
    super.open();
  }

  onOpen(): void {
    this.modalEl.addClass("zendian-shared-modal");
    void this.refresh();
  }
  onClose(): void {
    this.generation++;
    if (ProjectMaintenanceModal.active === this) ProjectMaintenanceModal.active = undefined;
  }

  private async refresh(): Promise<void> {
    try { await this.render(); }
    catch (error) { new Notice(`项目检查失败，原数据已保留：${String(error)}`); }
  }

  private async notifyChanged(): Promise<void> {
    try { await this.onChanged(); }
    catch (error) { console.error("[ProjectMaintenance] 身份已保存，重新核对失败", error); new Notice("项目身份已保存，但重新核对失败；请点击重新扫描"); }
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    const generation = ++this.generation;
    contentEl.empty();
    contentEl.createEl("h2", { text: "项目检查与关联" });
    contentEl.createEl("p", { text: "扫描知识库中的项目主页。建立身份前保存原始备份；项目目录和旧笔记会保留。重复副本可生成独立身份，其历史不会自动合并。" });
    new Setting(contentEl).setName("重新核对本地目录").setDesc("移动或恢复文件、等待同步完成后，可在这里重新扫描。").addButton(button => button.setButtonText("重新扫描").onClick(async () => {
      if (this.busy) return;
      button.setDisabled(true);
      try { await this.onChanged(); await this.refresh(); }
      catch (error) { new Notice(`重新核对失败：${String(error)}`); button.setDisabled(false); }
    }));
    const result = await new ProjectRegistry(this.app).discover();
    if (generation !== this.generation) return;
    const locationsPath = getPluginDataPath(this.app, "project-locations.json");
    if (await this.app.vault.adapter.exists(locationsPath)) {
      try {
        const stored = JSON.parse(await this.app.vault.adapter.read(locationsPath));
        if (generation !== this.generation) return;
        for (const entry of Object.values(stored.locations || {}) as Array<{ projectId: string; name: string; path: string; missing: boolean; conflict?: string }>) {
          if (!entry.missing) continue;
          const row = new Setting(contentEl).setName(`${entry.name} · 位置不可用`).setDesc(`上次位置：${entry.path}。选择无身份的项目主页可恢复原身份；不会按名称自动合并。`);
          if (entry.conflict) row.setDesc(entry.conflict + ` 原记录位置：${entry.path}`);
          const candidates = result.projects.filter(project => project.state === "legacy");
          if (!candidates.length) contentEl.createEl("p", { text: "没有可关联的无身份项目。请先确认目录和项目主页是否已完成同步；项目主页丢失时，应从备份或历史恢复，避免为缺失项目误建新身份。" });
          let selected = "";
          if (candidates.length) {
            row.addDropdown(input => {
              input.addOption("", "选择要关联的项目主页");
              for (const project of candidates) input.addOption(project.homePath, `${project.name} · ${project.folderPath}`);
              input.onChange(value => { selected = value; });
            });
            row.addButton(button => button.setButtonText("预览关联").onClick(() => {
              const target = candidates.find(project => project.homePath === selected);
              if (!target) { new Notice("请先选择项目主页"); return; }
              const confirmation = new Modal(this.app);
              confirmation.modalEl.addClass("zendian-shared-modal");
              confirmation.contentEl.createEl("h2", { text: "确认项目关联" });
              confirmation.contentEl.createEl("p", { text: `将“${target.name}”（${target.folderPath}）关联为“${entry.name}”（原位置 ${entry.path}）。原历史将跟随此身份，目录和任务不合并。` });
              new Setting(confirmation.contentEl).addButton(cancel => cancel.setButtonText("取消").onClick(() => confirmation.close())).addButton(confirm => confirm.setButtonText("确认关联").setCta().onClick(async () => {
                confirm.setDisabled(true);
                if (await this.relink(target, entry.projectId, entry.path)) { confirmation.close(); await this.refresh(); }
                else confirm.setDisabled(false);
              }));
              confirmation.open();
            }));
          }
        }
      } catch { contentEl.createEl("p", { text: "项目位置索引无法读取，原数据已保留。" }); }
    }
    for (const project of result.projects) {
      const labels = { ready: "已登记", legacy: "尚未建立身份", duplicate: "身份或目录冲突", nested: "嵌套项目，需调整目录", root: "位于知识库根目录，需移入独立文件夹" };
      const row = new Setting(contentEl).setName(project.name).setDesc(`${labels[project.state]} · ${project.homePath}`);
      if (project.state === "legacy") row.addButton(button => button.setButtonText("建立身份").onClick(() => { void this.assign(project, false); }));
      if (project.state === "duplicate" && project.projectId && result.projects.filter(other => other.folderPath === project.folderPath).length === 1) {
        row.addButton(button => button.setButtonText("将此副本设为独立项目").onClick(() => { void this.assign(project, true); }));
      }
    }
    for (const path of result.errors) contentEl.createEl("p", { text: `无法读取，已保留原文：${path}` });
    if (!result.projects.length) contentEl.createEl("p", { text: "尚未发现项目主页。可从首页创建项目。" });
    const inventoryPath = getPluginDataPath(this.app, "project-file-inventory.json");
    if (await this.app.vault.adapter.exists(inventoryPath)) {
      try {
        const stored = JSON.parse(await this.app.vault.adapter.read(inventoryPath));
        if (generation !== this.generation) return;
        contentEl.createEl("h3", { text: "文件核对记录" });
        contentEl.createEl("p", { text: "以下是扫描发现的状态差异，时间为发现时间。可读取的小文件结合内容指纹核对，大附件依据大小和修改时间；缺失也可能来自移动或同步，不代表删除事实。" });
        const labels: Record<string, string> = { added: "发现新增", changed: "检测到文件变化", missing: "原位置未找到" };
        for (const change of (stored.changes || []).slice(-50).reverse()) {
          const project = result.projects.find(entry => entry.projectId === change.projectId);
          const candidate = change.kind === "added" && change.possiblePreviousPath && !change.resolution
            ? change
            : null;
          if (candidate) {
            const fromPath = project ? `${project.folderPath}/${candidate.possiblePreviousPath}` : "";
            const toPath = project ? `${project.folderPath}/${candidate.path}` : "";
            const fromExists = !!fromPath && !!this.app.vault.getAbstractFileByPath(fromPath);
            const toFile = toPath ? this.app.vault.getAbstractFileByPath(toPath) : null;
            const missingPair = (stored.changes || []).find((entry: DiscoveredChange) => entry.projectId === candidate.projectId && entry.kind === "missing" && entry.path === candidate.possiblePreviousPath && entry.discoveredAt === candidate.discoveredAt && !entry.resolution);
            const fingerprintChanged = !candidate.hash || !missingPair?.hash || candidate.hash.toLowerCase() !== missingPair.hash.toLowerCase() || !stored.projects?.[candidate.projectId]?.[candidate.path]?.hash || stored.projects[candidate.projectId][candidate.path].hash!.toLowerCase() !== candidate.hash.toLowerCase();
            const stale = !project?.projectId || fromExists || !(toFile instanceof TFile) || fingerprintChanged;
            const row = new Setting(contentEl)
              .setName(`${project?.name || change.projectId} · 可能改名：${candidate.possiblePreviousPath} → ${candidate.path}`)
              .setDesc(stale
                ? `${new Date(candidate.discoveredAt).toLocaleString()} · 候选已变化（路径或内容指纹已变化），请重新扫描后再确认。`
                : `${new Date(candidate.discoveredAt).toLocaleString()} · 内容指纹一致。确认后会迁移文件历史和项目内任务关联；不会删除任何文件。`);
            if (stale) continue;
            row.addButton(button => button.setButtonText("确认同一文件").onClick(async () => {
              if (this.busy) return;
              const confirmation = new Modal(this.app);
              confirmation.modalEl.addClass("zendian-shared-modal");
              confirmation.contentEl.createEl("h2", { text: "确认文件改名" });
              confirmation.contentEl.createEl("p", { text: `将“${candidate.possiblePreviousPath}”确认改名为“${candidate.path}”。` });
              confirmation.contentEl.createEl("p", { text: "确认后会把历史版本、检查点和项目内任务关联迁移到新路径；原文件不会被删除。" });
              new Setting(confirmation.contentEl)
                .addButton(cancel => cancel.setButtonText("取消").onClick(() => confirmation.close()))
                .addButton(confirm => confirm.setButtonText("确认并迁移").setCta().onClick(async () => {
                  confirm.setDisabled(true);
                  try {
                    await this.confirmOfflineRename(candidate, project, generation);
                    confirmation.close();
                  } catch (error) {
                    new Notice(`文件改名确认失败：${String(error)}`);
                    confirm.setDisabled(false);
                  }
                }));
              confirmation.open();
            }));
          } else if (!change.resolution) {
            contentEl.createEl("p", { text: `${new Date(change.discoveredAt).toLocaleString()} · ${project?.name || change.projectId} · ${labels[change.kind] || change.kind}：${change.path}` });
          }
        }
      } catch { contentEl.createEl("p", { text: "文件核对记录无法读取，原数据已保留。" }); }
    }
  }

  private async relink(project: RegisteredProject, projectId: string, originalPath: string): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      const latest = await new ProjectRegistry(this.app).discover();
      assertMissingProjectRelinkSafe(originalPath, projectId, latest.projects);
      const target = latest.projects.find(entry => entry.homePath === project.homePath && entry.state === "legacy");
      if (!target) throw new Error("目标项目已变化，请重新检查");
      const file = this.app.vault.getAbstractFileByPath(target.homePath);
      if (!(file instanceof TFile)) return false;
      await this.app.vault.adapter.write(getPluginDataPath(this.app, `project-backup-${globalThis.crypto.randomUUID()}.json`), await this.app.vault.read(file));
      const saved = await mutateProjectHome(this.app, target.folderPath, data => {
        if (data.projectId) return false;
        data.projectId = projectId;
      });
      if (!saved) throw new Error("关联未保存，请刷新重试");
      await this.notifyChanged();
      new Notice("原项目身份已恢复");
      return true;
    } catch (error) { new Notice(String(error)); return false; }
    finally { this.busy = false; }
  }

  private async confirmOfflineRename(change: DiscoveredChange, project: RegisteredProject | undefined, generation: number): Promise<void> {
    if (!project?.projectId || !change.possiblePreviousPath || project.projectId !== change.projectId) throw new Error("项目身份已变化，请重新扫描");
    if (generation !== this.generation) throw new Error("项目检查界面已刷新，请重新打开");
    const fromRelative = change.possiblePreviousPath;
    const toRelative = change.path;
    const fromPath = `${project.folderPath}/${fromRelative}`;
    const toPath = `${project.folderPath}/${toRelative}`;
    const toFile = this.app.vault.getAbstractFileByPath(toPath);
    if (this.app.vault.getAbstractFileByPath(fromPath) || !(toFile instanceof TFile)) throw new Error("文件位置已变化，请先重新扫描");
    const inventory = new ProjectFileInventory(this.app);
    if (!await inventory.getRenameCandidate(project.projectId, fromRelative, toRelative)) throw new Error("改名候选已变化，请先重新扫描");

    this.busy = true;
    try {
      const rollbackHistory = await getServiceManager(this.app).rebaseFilePath(project.folderPath, fromPath, toPath);
      let rollbackLinks: (() => Promise<void>) | undefined;
      try {
        rollbackLinks = await new TaskFileLinkService(this.app, () => generation === this.generation).rename(fromPath, toPath);
        if (!await inventory.confirmRename(project.projectId, fromRelative, toRelative)) throw new Error("文件核对记录已变化，未确认改名");
      } catch (error) {
        try { await rollbackLinks?.(); } catch (rollbackError) { throw new Error(`${String(error)}；任务关联回滚失败：${String(rollbackError)}`); }
        try { await rollbackHistory(); } catch (rollbackError) { throw new Error(`${String(error)}；历史回滚失败：${String(rollbackError)}`); }
        throw error;
      }
      try {
        await this.onChanged();
      } catch (error) {
        console.error("[ProjectMaintenance] 文件改名已确认，但重新核对失败", error);
        new Notice("文件改名已确认，但项目重新核对失败；请稍后点击重新扫描");
        return;
      }
      await this.refresh();
      new Notice("已确认文件改名，历史和任务关联已迁移");
    } finally {
      this.busy = false;
    }
  }

  private async assign(project: RegisteredProject, independent: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const file = this.app.vault.getAbstractFileByPath(project.homePath);
      if (!(file instanceof TFile)) throw new Error("项目文件已移动，请重新检查");
      const original = await this.app.vault.read(file);
      const latestData = JSON.parse(original) as { projectId?: unknown };
      const latestProjectId = typeof latestData.projectId === "string" && latestData.projectId.trim()
        ? latestData.projectId
        : null;
      if (latestProjectId !== project.projectId) throw new Error("项目发生变化，请重新检查后再建立身份");
      const backup = getPluginDataPath(this.app, `project-backup-${globalThis.crypto.randomUUID()}.json`);
      await this.app.vault.adapter.write(backup, original);
      const success = await mutateProjectHome(this.app, project.folderPath, data => {
        if (data.projectId !== project.projectId && (data.projectId || project.projectId)) return false;
        if (independent) data.projectId = globalThis.crypto.randomUUID();
      });
      if (!success) throw new Error("项目发生变化，未更新；请刷新重试");
      await this.notifyChanged();
      new Notice("项目身份已保存，原始数据已备份");
      await this.refresh();
    } catch (error) { new Notice(String(error)); }
    finally { this.busy = false; }
  }
}
