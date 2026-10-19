import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const svg = await readFile(path.join(here, "icon.svg"));
const sizes = [16, 20, 24, 32, 40, 48, 64, 256];
const pngs = await Promise.all(
  sizes.map((size) =>
    sharp(svg)
      .resize(size, size, { fit: "contain" })
      .png()
      .toBuffer(),
  ),
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);

const entries = Buffer.alloc(sizes.length * 16);
let offset = header.length + entries.length;

pngs.forEach((png, index) => {
  const size = sizes[index];
  const entry = index * 16;
  entries.writeUInt8(size === 256 ? 0 : size, entry);
  entries.writeUInt8(size === 256 ? 0 : size, entry + 1);
  entries.writeUInt8(0, entry + 2);
  entries.writeUInt8(0, entry + 3);
  entries.writeUInt16LE(1, entry + 4);
  entries.writeUInt16LE(32, entry + 6);
  entries.writeUInt32LE(png.length, entry + 8);
  entries.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});

await writeFile(path.join(here, "icon.ico"), Buffer.concat([header, entries, ...pngs]));
await sharp(svg).resize(512, 512).png().toFile(path.join(process.env.TEMP, "dial-icon-preview.png"));
console.log("Generated build/icon.ico with sizes: " + sizes.join(", "));
