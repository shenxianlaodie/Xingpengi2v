const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const GeneratedAsset = require('../models/GeneratedAsset');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getExtFromUrl(url) {
  try {
    const u = new URL(url);
    const ext = path.extname(u.pathname);
    return ext || '.png';
  } catch {
    return '.png';
  }
}

async function downloadAndCache(url, type) {
  const dateDir = new Date().toISOString().slice(0, 7);
  const ext = getExtFromUrl(url);
  const filename = `${uuidv4()}${ext}`;
  const dir = path.join(config.uploadDir, type === 'video' ? 'videos' : 'images', dateDir);
  ensureDir(dir);
  const filePath = path.join(dir, filename);

  const axios = require('axios');
  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream',
    timeout: 120000,
    maxContentLength: 100 * 1024 * 1024,
  });

  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      const stats = fs.statSync(filePath);
      resolve({ filePath: filePath.replace(config.uploadDir, '').replace(/\\/g, '/'), size: stats.size });
    });
    writer.on('error', reject);
    response.data.on('error', reject);
  });
}

function extractResultUrl(item) {
  if (typeof item === 'string') return item.trim() || null;
  if (!item || typeof item !== 'object') return null;
  if (item.url && typeof item.url === 'string') return item.url.trim();
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  return null;
}

async function processGenerationResult(usageLogId, userId, requestType, prompt, tuziResponse) {
  const data = tuziResponse.data || tuziResponse;
  let results = Array.isArray(data) ? data : (data.results || data.images || data.videos || []);
  if (!Array.isArray(results)) results = [];

  const seenUrls = new Set();
  results = results.filter((item) => {
    const u = extractResultUrl(item);
    if (!u) return true;
    if (seenUrls.has(u)) return false;
    seenUrls.add(u);
    return true;
  });

  const out = [];
  for (const item of results) {
    const url = extractResultUrl(item);
    if (!url) continue;
    const asset = GeneratedAsset.create({
      userId,
      usageLogId,
      assetType: requestType === 'video' ? 'video' : 'image',
      prompt,
      sourceUrl: url,
      cachedPath: null,
      fileSize: null,
      width: typeof item === 'object' && item ? item.width : null,
      height: typeof item === 'object' && item ? item.height : null,
      duration: typeof item === 'object' && item ? item.duration : null,
      mimeType: requestType === 'video' ? 'video/mp4' : 'image/png',
      status: 'completed',
    });
    out.push({ ...asset, localUrl: `/api/assets/${asset.id}/file` });
  }
  return out;
}

module.exports = { downloadAndCache, processGenerationResult, ensureDir };
