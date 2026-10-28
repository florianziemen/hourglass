// Generates the PNG app icons (hourglass of a down and an up triangle) without external tools.
import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const bg = [13, 17, 23];
  const up = [63, 185, 80];
  const down = [248, 81, 73];
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let c = bg;
      // Hourglass: down triangle on top, up triangle below, tips meeting at the centre.
      const w = Math.abs(v - 0.5) / 0.3; // relative width: 0 at the waist, 1 at top/bottom
      if (v > 0.2 && v < 0.8 && Math.abs(u - 0.5) < w * 0.25)
        c = v < 0.5 ? down : up;
      row.set(c, 1 + x * 3);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512])
  writeFileSync(`public/icon-${size}.png`, png(size));
