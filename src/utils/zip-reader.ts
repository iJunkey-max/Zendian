import { crc32 } from "./zip-writer";

/** Reads the uncompressed ZIP format produced by project exports. */
export function readStoreZip(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length > 512 * 1024 * 1024) throw new Error("项目包超过导入大小限制");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = new Map<string, Uint8Array>();
  const names = new Set<string>();
  const headers = new Map<number, { name: string; checksum: number; size: number; flags: number }>();
  let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    if (offset + 30 > bytes.length) throw new Error("项目包头不完整");
    const flags = view.getUint16(offset + 6, true), method = view.getUint16(offset + 8, true);
    if (flags & 9 || method !== 0) throw new Error("仅支持 ZENdian 导出的未压缩、未加密项目包");
    const checksum = view.getUint32(offset + 14, true), size = view.getUint32(offset + 18, true);
    if (size !== view.getUint32(offset + 22, true)) throw new Error("项目包文件长度不一致");
    const nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
    const start = offset + 30 + nameLength + extraLength, end = start + size;
    if (end > bytes.length) throw new Error("项目包内容不完整");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    if (!name || /[\\:\x00-\x1f]/.test(name) || name.startsWith("/") || name.split("/").some(part => !part || part === "." || part === ".." || /[. ]$/.test(part))) throw new Error("项目包包含无效路径");
    const key = name.normalize("NFC").toLocaleLowerCase();
    if (names.has(key)) throw new Error("项目包包含重复路径");
    names.add(key);
    const data = bytes.slice(start, end);
    if (crc32(data) !== checksum) throw new Error(`项目包校验失败：${name}`);
    entries.set(name, data);
    headers.set(offset, { name, checksum, size, flags });
    if (entries.size > 20000) throw new Error("项目包文件数量超过限制");
    offset = end;
  }
  if (!entries.size || offset + 4 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error("项目包目录结构无效");
  const directoryStart = offset;
  const referenced = new Set<number>();
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x02014b50) {
    if (offset + 46 > bytes.length) throw new Error("项目包目录不完整");
    const nameLength = view.getUint16(offset + 28, true);
    const end = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    if (end > bytes.length) throw new Error("项目包目录不完整");
    const localOffset = view.getUint32(offset + 42, true);
    const header = headers.get(localOffset);
    const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (!header || referenced.has(localOffset) || header.name !== name ||
        header.flags !== view.getUint16(offset + 8, true) || view.getUint16(offset + 10, true) !== 0 ||
        header.checksum !== view.getUint32(offset + 16, true) || header.size !== view.getUint32(offset + 20, true) ||
        header.size !== view.getUint32(offset + 24, true) || view.getUint16(offset + 34, true) !== 0) {
      throw new Error("项目包目录与文件内容不一致");
    }
    referenced.add(localOffset);
    offset = end;
  }
  const directorySize = offset - directoryStart;
  if (offset + 22 > bytes.length || view.getUint32(offset, true) !== 0x06054b50 ||
      view.getUint16(offset + 4, true) !== 0 || view.getUint16(offset + 6, true) !== 0 ||
      referenced.size !== entries.size || view.getUint16(offset + 8, true) !== entries.size ||
      view.getUint16(offset + 10, true) !== entries.size || view.getUint32(offset + 12, true) !== directorySize ||
      view.getUint32(offset + 16, true) !== directoryStart || offset + 22 + view.getUint16(offset + 20, true) !== bytes.length) {
    throw new Error("项目包结束记录无效或不完整");
  }
  return entries;
}
