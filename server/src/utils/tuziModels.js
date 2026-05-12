function categoryForModelId(id) {
  if (!id || typeof id !== 'string') return null;
  const s = id.toLowerCase();
  if (s.includes('seedance')) return 'video';
  if (s.includes('kling')) return 'video';
  if (s.includes('minimax') && s.includes('video')) return 'video';
  if (s.includes('seedream')) return 'image';
  if (s.includes('gpt-image') || s.includes('gpt-4o-image')) return 'image';
  if (s.includes('dall-e') || s.includes('dalle')) return 'image';
  if (s.includes('imagen')) return 'image';
  if (s.includes('midjourney') || /^mj[-/]/i.test(id)) return 'image';
  if (s.includes('flux')) return 'image';
  if (s.includes('kontext')) return 'image';
  if (s.includes('wanx') || s.includes('cogview')) return 'image';
  if (s.includes('stable-diffusion') || s.includes('sdxl')) return 'image';
  if (s.includes('sora') && (s.includes('video') || s.includes('2'))) return 'video';
  if (/(^|[-_/])(i2i|image-edit|image_edit|image2image|txt2img|text2img)($|[-_/])/i.test(s)) return 'image';
  if (/-image$|_image$/i.test(s)) return 'image';
  if (s.includes('qwen') && s.includes('image')) return 'image';
  return null;
}

function splitModelsByCategory(data) {
  const list = Array.isArray(data?.data) ? data.data : [];
  const image = [];
  const video = [];
  for (const row of list) {
    if (!row || !row.id) continue;
    const cat = categoryForModelId(row.id);
    if (cat === 'image') image.push(row);
    else if (cat === 'video') video.push(row);
  }
  return { image, video, all: list };
}

module.exports = { categoryForModelId, splitModelsByCategory };
