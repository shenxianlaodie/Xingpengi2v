const fs = require('fs');
const path = require('path');
const axios = require('axios');
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
  const dateDir = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const ext = getExtFromUrl(url);
  const filename = `${uuidv4()}${ext}`;
  const dir = path.join(config.uploadDir, type === 'video' ? 'videos' : 'images', dateDir);
  ensureDir(dir);
  const filePath = path.join(dir, filename);

  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream',
    timeout: 120000,
    maxContentLength: 100 * 1024 * 1024, // 100MB
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

async function processGenerationResult(usageLogId, userId, requestType, prompt, tuziResponse) {
  const data = tuziResponse.data || tuziResponse;
  const results = Array.isArray(data) ? data : (data.results || data.images || data.videos || []);

  const downloadResults = await Promise.all(results.map(async (item) => {
    const url = item.url || item;
    try {
      const cached = await downloadAndCache(url, requestType);
      return { item, url, cachedPath: cached.filePath, fileSize: cached.size, error: null };
    } catch (err) {
      console.error(`[asset] Failed to cache ${url}:`, err.message);
      return { item, url, cachedPath: null, fileSize: null, error: err };
    }
  }));

  return downloadResults.map(({ item, url, cachedPath, fileSize }) => {
    const asset = GeneratedAsset.create({
      userId,
      usageLogId,
      assetType: requestType === 'video' ? 'video' : 'image',
      prompt,
      sourceUrl: url,
      cachedPath,
      fileSize,
      width: item.width,
      height: item.height,
      duration: item.duration,
      mimeType: requestType === 'video' ? 'video/mp4' : 'image/png',
      status: cachedPath ? 'completed' : 'pending',
    });
    return { ...asset, localUrl: cachedPath ? `/api/assets/${asset.id}/file` : url };
  });
}

module.exports = { downloadAndCache, processGenerationResult, ensureDir };
