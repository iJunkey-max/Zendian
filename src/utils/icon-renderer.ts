import { getIcon, type App } from "obsidian";
import { getPluginDataPath } from "./plugin-paths";
import { normalizeSvgIconColors, parseSafeSvg } from "./safe-svg";

/** Resolve the icon ID format shared by project metadata and the icon system. */
export async function resolveIconSvg(app: App, iconId: string): Promise<SVGElement | null> {
  if (iconId.startsWith("lucide-")) return getIcon(iconId.slice(7));

  const parts = iconId.split("/");
  if (parts.length !== 2 || parts.some((part) => !part || part.includes(".."))) return null;
  const [library, icon] = parts;
  try {
    const path = `${getPluginDataPath(app, "icons")}/${library}/${icon}.svg`;
    const svg = parseSafeSvg(await app.vault.adapter.read(path));
    if (!svg) return null;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    return normalizeSvgIconColors(svg);
  } catch {
    return null;
  }
}
