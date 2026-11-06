import { isProjectData } from "./project-validation";
import { App } from "obsidian";
import type { ProjectConsoleData } from "../types";

export interface RegisteredProject {
  projectId: string | null;
  homePath: string;
  folderPath: string;
  name: string;
  data: ProjectConsoleData;
  state: "ready" | "legacy" | "duplicate" | "nested" | "root";
}

/** Read-only discovery. Scanning must never migrate, rename or remove user files. */
export class ProjectRegistry {
  constructor(private app: App) {}

  async discover(): Promise<{ projects: RegisteredProject[]; errors: string[] }> {
    const projects: RegisteredProject[] = [];
    const errors: string[] = [];
    for (const file of this.app.vault.getFiles().filter(file => file.extension === "home" &&
      !/^ZENdian-project-staging-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(file.path))) {
      try {
        const data = JSON.parse(await this.app.vault.read(file)) as ProjectConsoleData;
        if (!isProjectData(data)) {
          errors.push(file.path);
          continue;
        }
        const projectId = typeof data.projectId === "string" && data.projectId.trim() ? data.projectId : null;
        const parent = file.parent;
        const folderPath = parent?.name === "00 控制台" ? parent.parent?.path ?? "" : parent?.path ?? "";
        projects.push({ projectId, homePath: file.path, folderPath, name: data.name, data,
          state: projectId ? "ready" : "legacy" });
      } catch { errors.push(file.path); }
    }
    const counts = new Map<string, number>();
    const folders = new Map<string, number>();
    for (const project of projects) {
      if (project.projectId) counts.set(project.projectId, (counts.get(project.projectId) ?? 0) + 1);
      folders.set(project.folderPath, (folders.get(project.folderPath) ?? 0) + 1);
    }
    for (const project of projects) {
      const ancestors = project.folderPath.split("/").slice(0, -1);
      let ancestor = "", nested = false;
      for (const part of ancestors) {
        ancestor = ancestor ? ancestor + "/" + part : part;
        if (folders.has(ancestor)) { nested = true; break; }
      }
      // A project containing another project is just as ambiguous as the
      // nested child: counting the parent as ready would make its statistics,
      // inventory and snapshots absorb the child's files. Fail closed for both
      // sides and require the user to separate the directories.
      const isAncestor = (parent: string, child: string): boolean => {
        if (parent === child) return false;
        // An empty folderPath represents a project rooted at the vault root;
        // it is an ancestor of every non-root project and must not absorb one.
        return parent === "" ? child !== "" : child.startsWith(`${parent}/`);
      };
      if (projects.some(other => other !== project && (
        isAncestor(project.folderPath, other.folderPath) ||
        isAncestor(other.folderPath, project.folderPath)
      ))) nested = true;
      if (project.folderPath === "") {
        // A vault-root .home would make the project boundary equal to the
        // entire vault, including .obsidian and Zendian's own indexes. The
        // project services deliberately require a real folder boundary, so
        // surface this as an explicit maintenance state instead of exposing a
        // partially working project console.
        project.state = "root";
      } else if ((project.projectId && counts.get(project.projectId)! > 1) || folders.get(project.folderPath)! > 1) {
        project.state = "duplicate";
      } else if (nested) {
        project.state = "nested";
      }
    }
    return { projects, errors };
  }
}
