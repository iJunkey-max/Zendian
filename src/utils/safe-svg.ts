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
