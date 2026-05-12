export function getImageGenSizePresets(modelId) {
  const id = String(modelId || '').toLowerCase()
  if (!id) return defaultImageSizePresets()

  if (id.includes('seedream') || id.includes('seededit')) {
    return [
      { label: '1K', value: '1K' },
      { label: '2K', value: '2K' },
      { label: '4K', value: '4K' },
      { label: '1024×1024', value: '1024x1024' },
      { label: '1536×1024', value: '1536x1024' },
      { label: '1024×1536', value: '1024x1536' },
      { label: '2048×2048', value: '2048x2048' },
    ]
  }

  if (id.includes('gpt-image') || id.includes('gpt-4o-image') || id.includes('gpt_4o_image')) {
    return [
      { label: '比例 1:1', value: '1:1' },
      { label: '比例 2:3', value: '2:3' },
      { label: '比例 3:2', value: '3:2' },
      { label: '比例 3:4', value: '3:4' },
      { label: '比例 4:3', value: '4:3' },
      { label: '比例 4:5', value: '4:5' },
      { label: '比例 5:4', value: '5:4' },
      { label: '比例 9:16', value: '9:16' },
      { label: '比例 16:9', value: '16:9' },
      { label: '比例 21:9', value: '21:9' },
      { label: '1024×1024', value: '1024x1024' },
      { label: '1536×1024', value: '1536x1024' },
      { label: '1024×1536', value: '1024x1536' },
      { label: '2048×2048', value: '2048x2048' },
      { label: '3840×2160', value: '3840x2160' },
      { label: '2160×3840', value: '2160x3840' },
      { label: 'auto', value: 'auto' },
    ]
  }

  if (id.includes('dall-e') || id.includes('dalle')) {
    return [
      { label: '1024×1024', value: '1024x1024' },
      { label: '1024×1792 竖', value: '1024x1792' },
      { label: '1792×1024 横', value: '1792x1024' },
    ]
  }

  return defaultImageSizePresets()
}

function defaultImageSizePresets() {
  return [
    { label: '1K', value: '1K' },
    { label: '2K', value: '2K' },
    { label: '4K', value: '4K' },
    { label: '1024×1024', value: '1024x1024' },
    { label: '16:9', value: '16:9' },
    { label: '9:16', value: '9:16' },
    { label: '2048×2048', value: '2048x2048' },
  ]
}
