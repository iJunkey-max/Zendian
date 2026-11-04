export interface StoreZipEntry {
  name: string;
  data: Uint8Array;
  modifiedAt?: Date;
}

const encoder = new TextEncoder();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value: Date): { date: number; time: number } {
  const year = Math.max(1980, Math.min(2107, value.getFullYear()));
  return {
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
  };
}

function u16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

/**
 * Creates a standards-compliant ZIP using the Store method (no compression).
 * Zip64 is intentionally unsupported; entries and the final archive must fit in 32-bit offsets.
 */
export function createStoreZip(entries: StoreZipEntry[], options: { allowPaths?: boolean } = {}): Uint8Array {
  if (entries.length > 0xffff) throw new Error("交付文件数量超出 ZIP 格式限制");

  const seen = new Set<string>();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    if (!entry.name || entry.name.includes("\\") || entry.name.startsWith("/") || entry.name.split("/").some(part => !part || part === "." || part === "..") || (!options.allowPaths && entry.name.includes("/"))) {
      throw new Error(`ZIP 条目必须是扁平文件名：${entry.name}`);
    }
    if (seen.has(entry.name)) throw new Error(`ZIP 内存在同名文件：${entry.name}`);
    seen.add(entry.name);
    if (entry.data.byteLength > 0xffffffff) throw new Error(`文件过大，无法写入 ZIP：${entry.name}`);

    const name = encoder.encode(entry.name);
    if (name.byteLength > 0xffff) throw new Error(`文件名过长：${entry.name}`);
    const checksum = crc32(entry.data);
    const stamp = dosDateTime(entry.modifiedAt ?? new Date());

    const localHeader = new Uint8Array(30 + name.byteLength);
    const localView = new DataView(localHeader.buffer);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 6, 0x0800);
    u16(localView, 8, 0);
    u16(localView, 10, stamp.time);
    u16(localView, 12, stamp.date);
    u32(localView, 14, checksum);
    u32(localView, 18, entry.data.byteLength);
    u32(localView, 22, entry.data.byteLength);
    u16(localView, 26, name.byteLength);
    u16(localView, 28, 0);
    localHeader.set(name, 30);
    localParts.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + name.byteLength);
    const centralView = new DataView(centralHeader.buffer);
    u32(centralView, 0, 0x02014b50);
    u16(centralView, 4, 20);
    u16(centralView, 6, 20);
    u16(centralView, 8, 0x0800);
    u16(centralView, 10, 0);
    u16(centralView, 12, stamp.time);
    u16(centralView, 14, stamp.date);
    u32(centralView, 16, checksum);
    u32(centralView, 20, entry.data.byteLength);
    u32(centralView, 24, entry.data.byteLength);
    u16(centralView, 28, name.byteLength);
    u16(centralView, 30, 0);
    u16(centralView, 32, 0);
    u16(centralView, 34, 0);
    u16(centralView, 36, 0);
    u32(centralView, 38, 0);
    u32(centralView, 42, localOffset);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.byteLength + entry.data.byteLength;
    if (localOffset > 0xffffffff) throw new Error("ZIP 文件过大，暂不支持 Zip64");
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
  if (centralSize > 0xffffffff || localOffset + centralSize > 0xffffffff) {
    throw new Error("ZIP 文件过大，暂不支持 Zip64");
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 4, 0);
  u16(endView, 6, 0);
  u16(endView, 8, entries.length);
  u16(endView, 10, entries.length);
  u32(endView, 12, centralSize);
  u32(endView, 16, localOffset);
  u16(endView, 20, 0);

  return concat([...localParts, ...centralParts, end]);
}
