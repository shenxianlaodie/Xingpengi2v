const SystemConfig = require('../models/SystemConfig');

const defaults = {
  image: 0.1,
  video: 0.05,
  text_input_per_1k: 0.003,
  text_output_per_1k: 0.015,
};

function calculate({ requestType, promptTokens, completionTokens, imageCount, videoDuration, model }) {
  // Check model-specific rate first
  const modelKey = `cost_model_${model}`;
  const modelRate = SystemConfig.get(modelKey);

  switch (requestType) {
    case 'image':
      return imageCount * (parseFloat(modelRate) || parseFloat(SystemConfig.get('cost_image_per_call')) || defaults.image);
    case 'video':
      return (videoDuration || 0) * (parseFloat(modelRate) || parseFloat(SystemConfig.get('cost_video_per_second')) || defaults.video);
    case 'text':
      return ((promptTokens || 0) / 1000 * defaults.text_input_per_1k) +
             ((completionTokens || 0) / 1000 * defaults.text_output_per_1k);
    default:
      return 0;
  }
}

module.exports = { calculate };
