// Convierte las ilustraciones SVG de design/ilustraciones/ en WebP para public/images/.
// Uso: npm run ilustraciones (sharp viene instalado con Next.js).
import { readdir } from "node:fs/promises";
import sharp from "sharp";

const SOURCES = { "hero.svg": { out: "hero-editorial.webp", width: 1200, height: 1500 } };

for (const file of await readdir("design/ilustraciones")) {
  const target = SOURCES[file];
  if (!target) continue;
  const info = await sharp(`design/ilustraciones/${file}`)
    .resize(target.width, target.height)
    .flatten({ background: "#fcf6ee" })
    .webp({ quality: 82 })
    .toFile(`public/images/${target.out}`);
  process.stdout.write(`${target.out}: ${Math.round(info.size / 1024)} KB\n`);
}
