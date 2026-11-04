import type { App } from "obsidian";
import { ProjectRegistry } from "./ProjectRegistry";
import { mutateProjectHome } from "./ProjectHomeStore";

export function rebaseTaskLink(projectPath: string, linkedFile: string, oldPath: string, newPath: string): string {
  const absolute = projectPath + "/" + linkedFile;
  if (absolute !== oldPath && !absolute.startsWith(oldPath + "/")) return linkedFile;
  const next = newPath + absolute.slice(oldPath.length);
  return next.startsWith(projectPath + "/") ? next.slice(projectPath.length + 1) : linkedFile;
}

/** Only authoritative rename events update references; scan guesses never do. */
export class TaskFileLinkService {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private app: App, private isActive: () => boolean = () => true) {}
  /** Update links and return a guarded rollback for a larger maintenance transaction. */
  rename(oldPath: string, newPath: string): Promise<() => Promise<void>> {
    const operation = this.queue.catch(() => undefined).then(() => this.applyRename(oldPath, newPath));
    this.queue = operation;
    return operation;
  }
  private async applyRename(oldPath: string, newPath: string): Promise<() => Promise<void>> {
    if (!this.isActive()) return async () => undefined;
    const result = await new ProjectRegistry(this.app).discover();
    const changes: Array<{ projectPath: string; before: string; after: string }> = [];
    try {
      for (const project of result.projects) {
        if (!this.isActive()) throw new Error("插件正在关闭，文件关联未完成");
        if (project.state !== "ready" && project.state !== "legacy") continue;
        const changed = project.data.tasks.some(task => task.linkedFile && rebaseTaskLink(project.folderPath, task.linkedFile, oldPath, newPath) !== task.linkedFile);
        if (!changed) continue;
        let before = "";
        let after = "";
        const saved = await mutateProjectHome(this.app, project.folderPath, data => {
          if (!this.isActive()) return false;
          before = JSON.stringify(data.tasks);
          let updated = false;
          for (const task of data.tasks) {
            if (!task.linkedFile) continue;
            const next = rebaseTaskLink(project.folderPath, task.linkedFile, oldPath, newPath);
            if (next !== task.linkedFile) { task.linkedFile = next; updated = true; }
          }
          after = JSON.stringify(data.tasks);
          return updated;
        });
        if (!saved) throw new Error(`项目“${project.name}”任务关联未保存，请刷新后重试`);
        changes.push({ projectPath: project.folderPath, before, after });
      }
    } catch (error) {
      try {
        for (const change of [...changes].reverse()) {
          const restored = await mutateProjectHome(this.app, change.projectPath, data => {
            if (JSON.stringify(data.tasks) !== change.after) return false;
            data.tasks = JSON.parse(change.before);
          });
          if (!restored) throw new Error(`项目“${change.projectPath}”任务关联已被其他修改，无法自动回滚`);
        }
      } catch (rollbackError) {
        throw new Error(`${String(error)}；任务关联回滚失败：${String(rollbackError)}`);
      }
      throw error;
    }
    let rolledBack = false;
    return async () => {
      if (rolledBack || !changes.length) return;
      rolledBack = true;
      for (const change of [...changes].reverse()) {
        const restored = await mutateProjectHome(this.app, change.projectPath, data => {
          if (JSON.stringify(data.tasks) !== change.after) return false;
          data.tasks = JSON.parse(change.before);
        });
        if (!restored) throw new Error(`项目“${change.projectPath}”任务关联已被其他修改，无法自动回滚`);
      }
    };
  }
}
