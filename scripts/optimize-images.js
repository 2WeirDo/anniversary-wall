/**
 * 图片优化脚本（增量模式）
 * 只处理新增或修改过的照片，跳过已优化的
 */
import sharp from 'sharp';
import { readdir, mkdir, stat, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PHOTOS_DIR = join(import.meta.dirname, '../public/photos');
const OUTPUT_DIR = join(import.meta.dirname, '../public/photos-optimized');

const SIZES = [
  { name: 'thumb', width: 200 },
  { name: 'small', width: 400 },
  { name: 'medium', width: 800 },
  { name: 'large', width: 1200 },
];

const WEBP_VARIANTS = [...SIZES.map(s => s.name), ''];

/**
 * 检查某张照片的所有 webp 变体是否都已存在且比源文件新
 */
async function needsRegenerate(inputPath, baseName) {
  try {
    const srcStat = await stat(inputPath);
    // 逐一检查每个变体
    for (const suffix of WEBP_VARIANTS) {
      const variantName = suffix ? `${baseName}-${suffix}.webp` : `${baseName}.webp`;
      const variantPath = join(OUTPUT_DIR, variantName);
      try {
        const webpStat = await stat(variantPath);
        // 如果 webp 比源文件旧，需要重新生成
        if (webpStat.mtimeMs < srcStat.mtimeMs) return true;
      } catch {
        // 文件不存在
        return true;
      }
    }
    return false; // 全部存在且都是最新的
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
    process.stdout.write(`${file} (${(originalSize / 1024).toFixed(1)}KB) → `);

    // 生成不同尺寸的 WebP
    for (const { name, width } of SIZES) {
      await sharp(inputPath)
        .resize(width, undefined, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(join(OUTPUT_DIR, `${baseName}-${name}.webp`));
    }

    // 保留原始尺寸的 WebP（高质量）
    await sharp(inputPath)
      .webp({ quality: 85 })
      .toFile(join(OUTPUT_DIR, `${baseName}.webp`));

    const { size: optimizedSize } = await stat(join(OUTPUT_DIR, `${baseName}.webp`));
    const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
    console.log(`${savings}% smaller`);
  }

  console.log(`\n${processed} processed, ${skipped} skipped (already optimized)`);

  // 清理孤立 webp：源照片已删除但 webp 还残留
  const sourceBases = new Set(files.map(f => f.replace(extname(f), '')));
  const webpFiles = (await readdir(OUTPUT_DIR)).filter(f => f.endsWith('.webp'));
  let cleaned = 0;

  for (const webp of webpFiles) {
    // 提取 webp 的基础名（去掉尺寸后缀和扩展名）
    // 例如: "photo1-large.webp" → "photo1", "photo1.webp" → "photo1"
    const base = webp.replace(/-(?:thumb|small|medium|large)\.webp$/, '').replace(/\.webp$/, '');
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
