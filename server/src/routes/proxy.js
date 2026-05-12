const { Router } = require('express');
const auth = require('../middleware/auth');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const quotaCheck = require('../middleware/quotaCheck');
const { handleSyncRequest, handleAsyncRequest } = require('../services/proxyService');
const UsageLog = require('../models/UsageLog');
const GeneratedAsset = require('../models/GeneratedAsset');
const TuziClient = require('../services/tuziClient');
const { success, error } = require('../utils/response');
const { splitModelsByCategory } = require('../utils/tuziModels');
const ImageJobStore = require('../services/imageJobStore');
const { modelSupportsMultiReferenceImage, imageRefCount } = require('../utils/imageModelCapabilities');

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

router.get('/v1/tuzi/models', flexibleAuth, async (_req, res) => {
  try {
    const raw = await TuziClient.listModels();
    const { image, video, all } = splitModelsByCategory(raw);
    return success(res, { image_models: image, video_models: video, all_count: all.length });
  } catch (err) {
    console.error('[proxy] list models error:', err);
    return error(res, upstreamMessage(err), upstreamStatus(err));
  }
});

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
    const b = req.body || {};
    const img = b.image != null ? b.image : b.images;
    const nRefs = imageRefCount(img);
    if (nRefs > 1 && !modelSupportsMultiReferenceImage(b.model)) {
      return error(res, '该模型不支持在一次请求中上传多张参考图', 400);
    }
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

router.post('/v1/image/image-to-image', flexibleAuth, quotaCheck, (req, res) => {
  try {
    const b = req.body || {};
    if (!b.model || !String(b.prompt).trim()) {
      return error(res, '请填写模型与提示词', 400);
    }
    const img = b.image != null ? b.image : b.images;
    if (img == null || (typeof img === 'string' && !img.trim()) || (Array.isArray(img) && !img.length)) {
      return error(res, '请提供参考图（上传后 URL 或 image 字段）', 400);
    }
    const body = {
      model: b.model,
      prompt: String(b.prompt).trim(),
      image: img,
      size: b.size,
      n: b.n,
      response_format: b.response_format || 'url',
      quality: b.quality,
      style: b.style,
      seed: b.seed,
      guidance_scale: b.guidance_scale,
      user: b.user,
    };
    Object.keys(body).forEach((k) => {
      if (body[k] === undefined || body[k] === '') delete body[k];
    });
    const nRefs = imageRefCount(body.image);
    if (nRefs > 1 && !modelSupportsMultiReferenceImage(body.model)) {
      return error(res, '该模型不支持在一次请求中上传多张参考图，请改用「生成印花图」模式或更换模型', 400);
    }
    const proxyParams = getProxyParams(req, {
      endpoint: '/v1/images/generations',
      requestType: 'image',
      body,
      prompt: body.prompt,
    });
    const jobId = ImageJobStore.create({ userId: proxyParams.userId });
    setImmediate(async () => {
      ImageJobStore.setRunning(jobId);
      try {
        const result = await handleSyncRequest(proxyParams);
        const tr = result.tuziResponse;
        if (tr && (tr.error || (tr.code !== undefined && tr.code !== 0 && tr.code !== 200))) {
          ImageJobStore.fail(jobId, tr.message || tr.error?.message || '上游错误');
          return;
        }
        ImageJobStore.complete(jobId, {
          assets: result.assets,
          usage: { cost: result.usageLog.cost, id: result.usageLog.id },
          ...result.tuziResponse,
        });
      } catch (err) {
        console.error('[proxy] image-to-image job error:', err);
        ImageJobStore.fail(jobId, upstreamMessage(err));
      }
    });
    return success(res, { job_id: jobId, status: 'queued' });
  } catch (err) {
    console.error('[proxy] image-to-image error:', err);
    return error(res, upstreamMessage(err), upstreamStatus(err));
  }
});

router.get('/v1/image/jobs/:jobId', flexibleAuth, (req, res) => {
  const job = ImageJobStore.get(req.params.jobId);
  if (!job) return error(res, '任务不存在', 404);
  if (!ImageJobStore.canAccess(req, job)) return error(res, '无权查看', 403);
  if (job.status === 'completed') {
    return success(res, { status: job.status, result: job.result });
  }
  if (job.status === 'failed') {
    return success(res, { status: job.status, error: job.error });
  }
  return success(res, { status: job.status });
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
        video_url: asset ? `/api/assets/${asset.id}/file` : null,
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
