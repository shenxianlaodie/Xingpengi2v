const fs = require('fs');
const path = require('path');
const TuziClient = require('./tuziClient');
const UsageLog = require('../models/UsageLog');
const User = require('../models/User');
const GeneratedAsset = require('../models/GeneratedAsset');
const { calculate } = require('./costCalculator');
const { processGenerationResult } = require('./assetService');
const config = require('../config');

function isUpstreamError(response) {
  if (!response || typeof response !== 'object') return false;
  if (response.error) return true;
  if (response.code !== undefined && response.code !== 0 && response.code !== 200) return true;
  return false;
}

function resolveImageSource(imageUrl) {
  if (!imageUrl) return { imageSource: null, imageUrl: null };
  let pathname = '';
  try {
    pathname = new URL(imageUrl, 'http://localhost').pathname;
  } catch {
    return { imageSource: null, imageUrl };
  }
  const idx = pathname.toLowerCase().indexOf('/uploads/');
  if (idx === -1) return { imageSource: null, imageUrl };
  const relativePath = pathname.slice(idx + '/uploads/'.length).replace(/^\/+/, '');
  if (!relativePath) return { imageSource: null, imageUrl };
  const absolutePath = path.join(config.uploadDir, relativePath);
  if (fs.existsSync(absolutePath)) {
    return { imageSource: absolutePath, imageUrl: null };
  }
  return { imageSource: null, imageUrl };
}

async function embedLocalUploadAsDataUrl(val) {
  if (val == null) return val;
  if (Array.isArray(val)) {
    return Promise.all(val.map((x) => embedLocalUploadAsDataUrl(x)));
  }
  const s = String(val);
  if (!s || s.startsWith('data:')) return val;
  const { imageSource } = resolveImageSource(s);
  if (!imageSource) return val;
  const buf = await fs.promises.readFile(imageSource);
  const ext = (path.extname(imageSource).replace('.', '') || 'png').toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'webp' ? 'image/webp'
      : ext === 'gif' ? 'image/gif'
        : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function normalizeImageBodyForUpstream(body) {
  const upstreamBody = { ...body };
  if (upstreamBody.image !== undefined && upstreamBody.image !== null) {
    upstreamBody.image = await embedLocalUploadAsDataUrl(upstreamBody.image);
  }
  if (upstreamBody.images !== undefined && upstreamBody.images !== null) {
    upstreamBody.images = await embedLocalUploadAsDataUrl(upstreamBody.images);
  }
  return upstreamBody;
}

function buildUsageLogParams({ userId, apiKeyId, endpoint, model, requestType, usageMetadata, status, errorMessage, cost, tuziTaskId, tuziRequestId, ip, userAgent }) {
  return {
    userId, apiKeyId, endpoint, model, requestType,
    ...(usageMetadata || {}),
    status, errorMessage: errorMessage || null, cost, tuziTaskId: tuziTaskId || null, tuziRequestId: tuziRequestId || null,
    ipAddress: ip, userAgent,
  };
}

async function handleSyncRequest({ userId, isAdmin, apiKeyId, endpoint, requestType, body, ip, userAgent }) {
  let tuziResponse;

  switch (endpoint) {
    case '/v1/images/generations': {
      const upstreamBody = await normalizeImageBodyForUpstream(body);
      tuziResponse = await TuziClient.imageGenerations(upstreamBody);
      break;
    }
    case '/v1/chat/completions':
      tuziResponse = await TuziClient.chatCompletions(body);
      break;
    default:
      throw new Error(`Unknown endpoint: ${endpoint}`);
  }

  if (isUpstreamError(tuziResponse)) {
    const usageLog = UsageLog.create(buildUsageLogParams({
      userId, apiKeyId, endpoint, model: body.model, requestType,
      status: 'failed', errorMessage: tuziResponse.message || tuziResponse.error?.message || 'Upstream error',
      cost: 0, ip, userAgent,
    }));
    if (!isAdmin) User.incrementQuota(userId);
    return { usageLog, assets: [], tuziResponse };
  }

  const usageMetadata = buildUsageMetadata(requestType, body, tuziResponse);
  const cost = calculate({ ...usageMetadata, requestType, model: body.model });

  const usageLog = UsageLog.create(buildUsageLogParams({
    userId, apiKeyId, endpoint, model: body.model, requestType, usageMetadata,
    status: 'success', cost, tuziRequestId: tuziResponse.request_id || tuziResponse.id,
    ip, userAgent,
  }));

  if (!isAdmin) User.incrementQuota(userId);

  let assets = [];
  try {
    assets = await processGenerationResult(usageLog.id, userId, requestType, body.prompt, tuziResponse);
  } catch (err) {
    console.error('[proxy] Asset caching failed:', err.message);
  }

  return { usageLog, assets, tuziResponse };
}

async function handleAsyncRequest({ userId, isAdmin, apiKeyId, endpoint, requestType, body, ip, userAgent }) {
  let tuziResponse;

  switch (endpoint) {
    case '/v1/video/generations': {
      const resolved = resolveImageSource(body.image_url);
      tuziResponse = await TuziClient.videoGenerations({
        model: body.model,
        prompt: body.prompt,
        imageSource: resolved.imageSource,
        imageUrl: resolved.imageUrl,
        seconds: body.seconds,
        size: body.size,
      });
      break;
    }
    default:
      throw new Error(`Unknown async endpoint: ${endpoint}`);
  }

  if (isUpstreamError(tuziResponse)) {
    const usageLog = UsageLog.create(buildUsageLogParams({
      userId, apiKeyId, endpoint, model: body.model, requestType,
      status: 'failed', errorMessage: tuziResponse.message || tuziResponse.error?.message || 'Upstream error',
      cost: 0, ip, userAgent,
    }));
    if (!isAdmin) User.incrementQuota(userId);
    return { usageLog, assets: [], tuziResponse };
  }

  const taskId = tuziResponse.id;
  const usageMetadata = buildUsageMetadata(requestType, body, tuziResponse);
  const cost = calculate({ ...usageMetadata, requestType, model: body.model });

  const usageLog = UsageLog.create(buildUsageLogParams({
    userId, apiKeyId, endpoint, model: body.model, requestType, usageMetadata,
    status: 'pending', cost, tuziTaskId: taskId, tuziRequestId: tuziResponse.id,
    ip, userAgent,
  }));

  if (!isAdmin) User.incrementQuota(userId);

  try {
    GeneratedAsset.create({
      userId,
      usageLogId: usageLog.id,
      assetType: 'video',
      prompt: body.prompt,
      sourceUrl: body.image_url,
      status: 'pending',
    });
  } catch (err) {
    console.error('[proxy] Failed to create pending asset:', err.message);
  }

  return { usageLog, assets: [], tuziResponse: { ...tuziResponse, task_id: taskId } };
}

function buildUsageMetadata(requestType, body, response) {
  const meta = { promptTokens: 0, completionTokens: 0, imageCount: 0, videoDuration: 0 };

  if (response.usage) {
    meta.promptTokens = response.usage.prompt_tokens || 0;
    meta.completionTokens = response.usage.completion_tokens || 0;
  }

  if (requestType === 'image') {
    const data = response.data || response;
    const results = Array.isArray(data) ? data : (data.results || data.images || []);
    meta.imageCount = results.length || 1;
  }

  if (requestType === 'video') {
    meta.videoDuration = body.duration || body.seconds || 5;
  }

  return meta;
}

module.exports = { handleSyncRequest, handleAsyncRequest };
