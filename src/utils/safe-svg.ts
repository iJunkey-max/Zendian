const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "defs", "lineargradient", "radialgradient", "stop", "clippath", "mask", "title", "desc", "use",
]);

const ALLOWED_ATTRIBUTES = new Set([
  "xmlns", "viewbox", "preserveaspectratio", "fill", "fill-opacity", "fill-rule",
  "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit", "opacity", "transform",
  "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "points", "offset", "stop-color", "stop-opacity",
  "gradientunits", "gradienttransform", "spreadmethod", "id", "clip-path", "mask",
  "href", "xlink:href", "role", "aria-hidden", "focusable",
]);

const SAFE_STYLE_ATTRIBUTES = new Map([
  ["fill", "fill"],
  ["fill-opacity", "fill-opacity"],
  ["fill-rule", "fill-rule"],
  ["stroke", "stroke"],
  ["stroke-width", "stroke-width"],
  ["stroke-opacity", "stroke-opacity"],
  ["stroke-linecap", "stroke-linecap"],
  ["stroke-linejoin", "stroke-linejoin"],
  ["stroke-dasharray", "stroke-dasharray"],
  ["stroke-dashoffset", "stroke-dashoffset"],
  ["stroke-miterlimit", "stroke-miterlimit"],
  ["opacity", "opacity"],
  ["stop-color", "stop-color"],
  ["stop-opacity", "stop-opacity"],
]);

function hasSafeUrlValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("#")) return true;
  const urls = [...trimmed.matchAll(/url\((.*?)\)/gi)];
  return urls.length > 0
    && urls.every((match) => match[1].trim().replace(/^['"]|['"]$/g, "").startsWith("#"));
}

export function parseSafeSvg(svgText: string): SVGElement | null {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const svg = doc.documentElement;
  if (svg.localName.toLowerCase() !== "svg") return null;

  const sanitizeAttributes = (element: Element): void => {
    const style = element.getAttribute("style");
    if (style) {
      for (const declaration of style.split(";")) {
        const separator = declaration.indexOf(":");
        if (separator <= 0) continue;
        const property = declaration.slice(0, separator).trim().toLowerCase();
        const value = declaration.slice(separator + 1).trim();
        const attribute = SAFE_STYLE_ATTRIBUTES.get(property);
        if (!attribute || !value || value.toLowerCase().includes("expression(")) continue;
        if (value.includes("url(") && !hasSafeUrlValue(value)) continue;
        if (!element.hasAttribute(attribute)) element.setAttribute(attribute, value);
      }
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (
        name.startsWith("on")
        || name === "style"
        || !ALLOWED_ATTRIBUTES.has(name)
        || ((name === "href" || name === "xlink:href" || value.includes("url(")) && !hasSafeUrlValue(value))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  };

  sanitizeAttributes(svg);
  for (const element of Array.from(svg.querySelectorAll("*"))) {
    if (!ALLOWED_ELEMENTS.has(element.localName.toLowerCase())) {
      element.remove();
      continue;
    }
    sanitizeAttributes(element);
  }
  return svg as unknown as SVGElement;
}

function parseNeutralColor(value: string): { r: number; g: number; b: number } | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized === "black") return { r: 0, g: 0, b: 0 };
  if (normalized === "white") return { r: 255, g: 255, b: 255 };

  const shortHex = normalized.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])(?:[0-9a-f])?$/i);
  if (shortHex) {
    return {
      r: parseInt(shortHex[1] + shortHex[1], 16),
      g: parseInt(shortHex[2] + shortHex[2], 16),
      b: parseInt(shortHex[3] + shortHex[3], 16),
    };
  }
  const longHex = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i);
  if (longHex) {
    return {
      r: parseInt(longHex[1], 16),
      g: parseInt(longHex[2], 16),
      b: parseInt(longHex[3], 16),
    };
  }
  const rgb = normalized.match(/^rgba?\((\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)(?:,[\d.]+)?\)$/);
  if (!rgb) return null;
  return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
}

function isNeutralPaint(value: string): boolean {
  const color = parseNeutralColor(value);
  if (!color) return false;
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return max <= 72 || max - min <= 10;
}

/** 让第三方单色图标继承宿主文本颜色，同时保留彩色与渐变绘制。 */
export function normalizeSvgIconColors(svg: SVGElement): SVGElement {
  const elements: Element[] = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const fixedPaints = new Set<string>();
  for (const element of elements) {
    for (const attribute of ["fill", "stroke", "stop-color"]) {
      const value = element.getAttribute(attribute)?.trim().toLowerCase();
      if (!value || ["none", "transparent", "currentcolor", "inherit"].includes(value) || value.startsWith("url(")) continue;
      fixedPaints.add(value.replace(/\s+/g, ""));
    }
  }
  const isSingleColorIcon = fixedPaints.size === 1;
  for (const element of elements) {
    for (const attribute of ["fill", "stroke", "stop-color"]) {
      const value = element.getAttribute(attribute);
      if (value && (isSingleColorIcon || isNeutralPaint(value))) element.setAttribute(attribute, "currentColor");
    }
  }

  const descendants = elements.slice(1);
  const hasVisibleStroke = elements.some((element) => {
    const stroke = element.getAttribute("stroke")?.trim().toLowerCase();
    return Boolean(stroke && stroke !== "none" && stroke !== "transparent");
  });
  const hasVisibleFill = descendants.some((element) => {
    const fill = element.getAttribute("fill")?.trim().toLowerCase();
    return Boolean(fill && fill !== "none" && fill !== "transparent");
  });
  if (!svg.hasAttribute("fill")) {
    svg.setAttribute("fill", hasVisibleStroke && !hasVisibleFill ? "none" : "currentColor");
  }
  svg.setAttribute("color", "currentColor");
  return svg;
}
