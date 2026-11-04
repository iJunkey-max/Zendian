/** Portable, visible paths that can be represented by a Vault on Windows too. */
export function isPortableProjectPath(path: string): boolean {
  return typeof path === "string" && !!path && path.split("/").every(part =>
    !!part && !part.startsWith(".") && !/[\\:*?"<>|\x00-\x1f]/.test(part) &&
    !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}

/** Display names are unrestricted metadata, never filesystem paths. */
export function projectFileStem(name: string): string {
  let stem = Array.from(name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim()).slice(0, 50).join("");
  stem = stem.replace(/^\.+/, "").replace(/[. ]+$/, "");
  if (!stem) stem = "项目";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = "_" + stem;
  return stem;
}
