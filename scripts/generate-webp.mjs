import sharp from "sharp";
import { readdirSync, statSync } from "fs";
import { resolve, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const ORIGINALS_DIR = resolve(ROOT, "photos-originals");
const OPTIMIZED_DIR = resolve(ROOT, "public", "photos-optimized");

const existing = new Set(readdirSync(OPTIMIZED_DIR).filter(f => f.endsWith("-small.webp")));
const jpgs = readdirSync(ORIGINALS_DIR)
  .filter(f => /\.jpe?g$/i.test(f))
  .sort();

let processed = 0;
let totalOrig = 0;
let totalWebp = 0;

for (const jpg of jpgs) {
  const base = basename(jpg, extname(jpg));
  const webpName = `${base}-small.webp`;

  if (existing.has(webpName)) continue;

  const inputPath = resolve(ORIGINALS_DIR, jpg);
  const outputPath = resolve(OPTIMIZED_DIR, webpName);

  await sharp(inputPath)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(outputPath);

  const origSize = statSync(inputPath).size;
  const webpSize = statSync(outputPath).size;
  totalOrig += origSize;
  totalWebp += webpSize;
  processed++;

  const ratio = ((1 - webpSize / origSize) * 100).toFixed(1);
  console.log(`  ✅ ${jpg} → ${webpName}  (${(origSize/1024/1024).toFixed(1)}MB → ${(webpSize/1024).toFixed(0)}KB, -${ratio}%)`);
}

if (processed === 0) {
  console.log("  All photos already optimized, nothing to do.");
} else {
  const totalRatio = ((1 - totalWebp / totalOrig) * 100).toFixed(1);
  console.log(`\n📸 ${processed} photos processed | ${(totalOrig/1024/1024).toFixed(1)}MB → ${(totalWebp/1024).toFixed(0)}KB (-${totalRatio}%)`);
}
