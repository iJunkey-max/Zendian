export interface FocusProjectCandidate {
  projectId: string | null;
  folderPath: string;
  name: string;
  state: string;
}

/**
 * Resolve focus attribution from a stable project identity first, falling
 * back to the active file only when the user has not made an explicit choice.
 * A selected identity that disappeared is an error rather than an implicit
 * unassigned session; this keeps project statistics trustworthy after moves,
 * copies, or conflict scans.
 */
export function resolveFocusProject(
  projects: ReadonlyArray<FocusProjectCandidate>,
  selection: string | null | undefined,
  activeFilePath?: string,
): FocusProjectCandidate | undefined {
  const ready = projects.filter((project) => project.state === "ready" && !!project.projectId);
  if (selection !== undefined) {
    if (selection === null) return undefined;
    const selected = ready.find((project) => project.projectId === selection);
    if (!selected) throw new Error("所选项目已移动、缺失或存在身份冲突，请重新选择项目");
    return selected;
  }
  if (!activeFilePath) return undefined;
  return [...ready]
    .filter((project) => activeFilePath.startsWith(`${project.folderPath}/`))
    .sort((a, b) => b.folderPath.length - a.folderPath.length)[0];
}
