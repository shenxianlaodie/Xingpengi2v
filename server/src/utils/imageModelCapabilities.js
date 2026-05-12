function modelSupportsMultiReferenceImage(modelId) {
  const id = String(modelId || '').toLowerCase();
  if (!id) return false;
  if (id.includes('dall-e') || id.includes('dalle')) return false;
  if (id.includes('gpt-image') || id.includes('gpt-4o-image') || id.includes('gpt_4o_image')) return true;
  if (id.includes('doubao-seedream') || id.includes('seedream')) return true;
  if (id.includes('seededit')) return true;
  if (id.includes('kontext')) return true;
  return false;
}

function imageRefCount(img) {
  if (img == null) return 0;
  if (Array.isArray(img)) {
    return img.filter((x) => x != null && String(x).trim() !== '').length;
  }
  if (typeof img === 'string' && img.trim()) return 1;
  return 0;
}

module.exports = { modelSupportsMultiReferenceImage, imageRefCount };
