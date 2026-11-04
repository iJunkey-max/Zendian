/**
 * Missing-project relink must not reuse an identity when its last known
 * directory has already been claimed by another project.  The old location
 * is part of the identity's audit trail; silently accepting an occupied path
 * can merge two unrelated histories even when the selected target is legacy.
 */
export interface RelinkProjectEntry {
  projectId: string | null;
  folderPath: string;
  name: string;
}

export function assertMissingProjectRelinkSafe(
  originalPath: string,
  projectId: string,
  projects: ReadonlyArray<RelinkProjectEntry>,
): void {
  const existingIdentity = projects.find((project) => project.projectId === projectId);
  if (existingIdentity) throw new Error("原身份已在知识库中出现，请重新检查重复项目");

  const occupant = projects.find((project) => project.folderPath === originalPath);
  if (occupant) {
    throw new Error(`原位置 ${originalPath} 已被项目“${occupant.name}”占用，未恢复身份；请先处理目录冲突`);
  }
}
