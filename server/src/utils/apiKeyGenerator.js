const crypto = require('crypto');

function generateApiKey() {
  const random = crypto.randomBytes(24).toString('hex');
  return `sk-${random}`;
}

function extractPrefix(key) {
  return key.substring(0, 11); // "sk-" + 8 chars
}

module.exports = { generateApiKey, extractPrefix };
