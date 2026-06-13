/**
 * 图片优化脚本（增量模式）
 * 从 photos-originals 读取源文件，只生成 400px small webp
 * 只处理新增或修改过的照片，跳过已优化的
 */
import sharp from 'sharp';
import { readdir, mkdir, stat, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PHOTOS_DIR = join(import.meta.dirname, '../photos-originals');
const OUTPUT_DIR = join(import.meta.dirname, '../public/photos-optimized');

const SMALL_WIDTH = 400;

/**
 * 检查某张照片的 small webp 是否已存在且比源文件新
 */
async function needsRegenerate(inputPath, baseName) {
  const webpPath = join(OUTPUT_DIR, `${baseName}-small.webp`);
  try {
    const [srcStat, webpStat] = await Promise.all([stat(inputPath), stat(webpPath)]);
    return webpStat.mtimeMs < srcStat.mtimeMs;
  } catch {
    return true;
  }
}

async function optimize() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await readdir(PHOTOS_DIR))
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    .sort();

  let skipped = 0;
  let processed = 0;

  for (const file of files) {
    const inputPath = join(PHOTOS_DIR, file);
    const baseName = file.replace(extname(file), '');

    if (!(await needsRegenerate(inputPath, baseName))) {
      skipped++;
      continue;
    }

    processed++;
    const { size: originalSize } = await stat(inputPath);

    await sharp(inputPath)
      .resize(SMALL_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(join(OUTPUT_DIR, `${baseName}-small.webp`));

    const { size: optimizedSize } = await stat(join(OUTPUT_DIR, `${baseName}-small.webp`));
    const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
    console.log(`${file} (${(originalSize / 1024).toFixed(1)}KB) → ${savings}% smaller`);
  }

  console.log(`\n${processed} processed, ${skipped} skipped (already optimized)`);

  // 清理孤立 webp：源照片已删除但 webp 还残留
  const sourceBases = new Set(files.map(f => f.replace(extname(f), '')));
  const webpFiles = (await readdir(OUTPUT_DIR)).filter(f => f.endsWith('.webp'));
  let cleaned = 0;

  for (const webp of webpFiles) {
    const base = webp.replace(/-small\.webp$/, '').replace(/\.webp$/, '');
    if (!sourceBases.has(base)) {
      await unlink(join(OUTPUT_DIR, webp));
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} orphaned webp file(s)`);
  }

  console.log(`✅ Done! Optimized photos in: ${OUTPUT_DIR}`);
}

optimize().catch(console.error);
