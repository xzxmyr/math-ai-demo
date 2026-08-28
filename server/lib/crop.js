/**
 * 图片裁剪工具 (可选依赖 sharp)
 * 根据视觉模型返回的归一化 bbox 将原图对应区域裁出，返回 dataURL 供前端预览。
 * 若 sharp 未安装则返回 null(不影响主流程, 前端仍可用原图 + bbox 自行裁剪)。
 */
export async function cropRegionToDataUrl(buffer, mime, bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  const [l, t, r, b] = bbox.map(Number);
  if (![l, t, r, b].every(Number.isFinite)) return null;
  if (l < 0 || t < 0 || r > 1 || b > 1 || r <= l || b <= t) return null;

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return null; // sharp 未安装, 跳过裁剪
  }

  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) return null;

  const left = Math.round(l * meta.width);
  const top = Math.round(t * meta.height);
  const width = Math.max(1, Math.round((r - l) * meta.width));
  const height = Math.max(1, Math.round((b - t) * meta.height));

  const out = await sharp(buffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  return `data:image/png;base64,${out.toString('base64')}`;
}

/** 一次性裁剪多个区域 */
export async function cropRegions(buffer, mime, bboxes) {
  const entries = Object.entries(bboxes || {});
  const results = await Promise.all(
    entries.map(async ([key, bbox]) => [key, await cropRegionToDataUrl(buffer, mime, bbox)])
  );
  return Object.fromEntries(results);
}
