/**
 * 生成社交分享封面图 (1200×630)
 * 使用 sharp 从照片中生成 OG 封面
 */
import sharp from 'sharp';
import { join } from 'node:path';

const PHOTOS_DIR = join(import.meta.dirname, '../public/photos');
const OUTPUT = join(import.meta.dirname, '../public/og-cover.jpg');

// 使用一张合适的照片作为封面底图
const SOURCE_PHOTO = join(PHOTOS_DIR, 'photo5.jpg');

async function generate() {
  // 获取原图元数据
  const meta = await sharp(SOURCE_PHOTO).metadata();

  // 计算裁剪区域（中心裁剪到 1200:630 = 40:21 比例）
  const targetRatio = 1200 / 630;
  const srcRatio = meta.width / meta.height;

  let extractWidth, extractHeight, extractLeft, extractTop;

  if (srcRatio > targetRatio) {
    // 原图更宽，裁左右
    extractHeight = meta.height;
    extractWidth = Math.round(meta.height * targetRatio);
    extractLeft = Math.round((meta.width - extractWidth) / 2);
    extractTop = 0;
  } else {
    // 原图更高，裁上下
    extractWidth = meta.width;
    extractHeight = Math.round(meta.width / targetRatio);
    extractLeft = 0;
    extractTop = Math.round((meta.height - extractHeight) / 2);
  }

  await sharp(SOURCE_PHOTO)
    .extract({ left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight })
    .resize(1200, 630, { fit: 'cover' })
    // 柔光效果：叠加一层暖色
    .modulate({ brightness: 0.9, saturation: 1.1 })
    .jpeg({ quality: 85 })
    .toFile(OUTPUT);

  console.log(`✅ OG cover generated: ${OUTPUT} (1200×630)`);
}

generate().catch(console.error);
