const { Router } = require('express');
const auth = require('../middleware/auth');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const quotaCheck = require('../middleware/quotaCheck');
const { handleSyncRequest, handleAsyncRequest } = require('../services/proxyService');
const UsageLog = require('../models/UsageLog');
const GeneratedAsset = require('../models/GeneratedAsset');
const TuziClient = require('../services/tuziClient');
const { success, error } = require('../utils/response');

function upstreamMessage(err) {
  const d = err.response?.data;
  if (d == null) return err.message || '请求失败';
  if (typeof d === 'string') return d;
  return d.message || d.error?.message || d.msg || err.message || '请求失败';
}

function upstreamStatus(err) {
  const s = err.response?.status;
  return typeof s === 'number' && s >= 400 && s < 600 ? s : 500;
}

const router = Router();

// Auth middleware: try API key first, then JWT
function flexibleAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer sk-')) {
    return apiKeyAuth(req, res, next);
  }
  return auth(req, res, next);
}

function getProxyParams(req, overrides = {}) {
  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
  return {
    userId: isAdmin ? null : req.user.userId,
    isAdmin,
    apiKeyId: req.user.apiKeyId,
    ip: req.requestInfo?.ip || req.ip,
    userAgent: req.requestInfo?.userAgent,
    ...overrides,
  };
}

router.post('/v1/images/generations', flexibleAuth, quotaCheck, async (req, res) => {
  try {
    const result = await handleSyncRequest(getProxyParams(req, {
      endpoint: '/v1/images/generations',
      requestType: 'image',
      body: req.body,
      prompt: req.body.prompt,
    }));
    return success(res, {
      assets: result.assets,
      usage: { cost: result.usageLog.cost, id: result.usageLog.id },
      ...result.tuziResponse,
    });
  } catch (err) {
    console.error('[proxy] image generation error:', err);
    return error(res, upstreamMessage(err), upstreamStatus(err));
  }
});

router.post('/v1/image/image-to-image', flexibleAuth, (_req, res) => {
  return error(res, '图生图功能暂时不可用', 403);
});

router.post('/v1/video/generations', flexibleAuth, quotaCheck, async (req, res) => {
  try {
    const result = await handleAsyncRequest(getProxyParams(req, {
      endpoint: '/v1/video/generations',
      requestType: 'video',
      body: req.body,
      prompt: req.body.prompt,
      imageUrl: req.body.image_url,
      seconds: req.body.seconds,
      size: req.body.size,
    }));
    return success(res, {
      task_id: result.tuziResponse.task_id,
      status: 'queued',
      usage: { cost: result.usageLog.cost, id: result.usageLog.id },
    });
  } catch (err) {
    console.error('[proxy] video generation error:', err);
    return error(res, upstreamMessage(err), upstreamStatus(err));
  }
});

router.get('/v1/tasks/:taskId', flexibleAuth, async (req, res) => {
  try {
    const log = UsageLog.findByTuziTaskId(req.params.taskId);
    if (!log) return error(res, '任务不存在', 404);

    // If already in terminal state, return cached with local asset URL
    if (log.status === 'success' || log.status === 'failed') {
      const assets = GeneratedAsset.findByTuziTaskId(req.params.taskId);
      const asset = assets.length > 0 ? assets[0] : null;
      return success(res, {
        task_id: req.params.taskId,
        status: log.status === 'success' ? 'completed' : 'failed',
        video_url: asset?.cached_path ? `/api/assets/${asset.id}/file` : null,
        error: log.error_message,
      });
    }

    // Poll upstream for current status (Sora-2 compatible)
    const upstream = await TuziClient.getVideoStatus(req.params.taskId);
    return success(res, {
      task_id: req.params.taskId,
      status: upstream.status,
      progress: upstream.progress,
      video_url: upstream.video_url,
    });
  } catch (err) {
    console.error('[proxy] task status error:', err);
    return error(res, upstreamMessage(err), upstreamStatus(err));
  }
});

module.exports = router;
