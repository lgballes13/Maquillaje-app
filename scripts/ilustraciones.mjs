// Convierte las ilustraciones SVG de design/ilustraciones/ en WebP para public/images/.
// Uso: npm run ilustraciones (sharp viene instalado con Next.js).
import sharp from "sharp";

// Archivo SVG → nombre del WebP y tamaño (vertical 4:5 o horizontal 4:3).
const SOURCES = {
  "hero.svg": { out: "hero-editorial.webp", width: 800, height: 1000 },
  "servicio-social.svg": { out: "servicio-social.webp", width: 900, height: 1125 },
  "servicio-novia.svg": { out: "servicio-novia.webp", width: 900, height: 1125 },
  "servicio-asesoria.svg": { out: "servicio-asesoria.webp", width: 900, height: 1125 },
  "modulo-agenda.svg": { out: "modulo-agenda.webp", width: 1200, height: 900 },
  "modulo-tienda.svg": { out: "modulo-tienda.webp", width: 1200, height: 900 },
  "modulo-portafolio.svg": { out: "modulo-portafolio.webp", width: 1200, height: 900 },
};

for (const [file, target] of Object.entries(SOURCES)) {
  const info = await sharp(`design/ilustraciones/${file}`)
    .resize(target.width, target.height)
    .flatten({ background: "#fcf6ee" })
    .webp({ quality: 75 })
    .toFile(`public/images/${target.out}`);
  process.stdout.write(`${target.out}: ${Math.round(info.size / 1024)} KB\n`);
}
