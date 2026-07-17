import { normalizePath, type App } from "obsidian";

export const PLUGIN_ID = "zendian";

export function getPluginDataRoot(app: App): string {
  return normalizePath(`${app.vault.configDir}/plugins/${PLUGIN_ID}`);
}

export function getPluginDataPath(app: App, relativePath: string): string {
  return normalizePath(`${getPluginDataRoot(app)}/${relativePath.replace(/^\/+/, "")}`);
}
