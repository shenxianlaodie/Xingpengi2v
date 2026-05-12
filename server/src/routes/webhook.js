const { Router } = require('express');
const { getDb } = require('../config/database');
const UsageLog = require('../models/UsageLog');
const GeneratedAsset = require('../models/GeneratedAsset');
const { downloadAndCache } = require('../services/assetService');
const { success } = require('../utils/response');

const router = Router();

// POST /api/webhook/tuzi
router.post('/tuzi', async (req, res) => {
  try {
    const body = req.body;
    const taskId = body.task_id || body.id;
    const db = getDb();

    if (!taskId) {
      console.warn('[webhook] No task_id in payload');
      return success(res, null);
    }

    // Idempotency check
    const existing = db.get(
      "SELECT id FROM webhook_logs WHERE tuzi_task_id = ? AND status = 'processed'",
      [taskId]
    );
    if (existing) {
      return success(res, null);
    }

    // Log webhook receipt
    db.run(
      'INSERT INTO webhook_logs (tuzi_task_id, payload) VALUES (?, ?)',
      [taskId, JSON.stringify(body)]
    );

    // Find local usage log
    const usageLog = UsageLog.findByTuziTaskId(taskId);
    if (!usageLog) {
      console.warn(`[webhook] No local usage log for task ${taskId}`);
      return success(res, null);
    }

    const status = body.status || body.data?.status;
    if (status === 'completed' || status === 'succeeded') {
      UsageLog.updateStatus(usageLog.id, 'success');

      const results = body.results || body.data?.results || body.data || [];
      const urls = Array.isArray(results) ? results : (results.urls || results.videos || results.images || []);
      const assets = GeneratedAsset.findByTuziTaskId(taskId);

      for (let i = 0; i < urls.length; i++) {
        const url = typeof urls[i] === 'string' ? urls[i] : urls[i].url;
        if (assets[i] && url) {
          try {
            const cached = await downloadAndCache(url, usageLog.request_type);
            GeneratedAsset.updateStatus(
              assets[i].id, 'completed', cached.filePath, cached.size,
              urls[i].width, urls[i].height, urls[i].duration,
              usageLog.request_type === 'video' ? 'video/mp4' : 'image/png'
            );
          } catch (err) {
            console.error(`[webhook] Download failed for asset ${assets[i].id}:`, err.message);
            GeneratedAsset.updateStatus(assets[i].id, 'failed', null);
          }
        }
      }
    } else if (status === 'failed' || status === 'error') {
      const errorMessage = body.error || body.data?.error || 'Upstream task failed';
      UsageLog.updateStatus(usageLog.id, 'failed', errorMessage);

      const assets = GeneratedAsset.findByTuziTaskId(taskId);
      for (const asset of assets) {
        GeneratedAsset.updateStatus(asset.id, 'failed', null);
      }
    }

    // Mark webhook as processed
    db.run(
      "UPDATE webhook_logs SET status = 'processed', processed_at = datetime('now') WHERE tuzi_task_id = ? AND status = 'received'",
      [taskId]
    );

    return success(res, null);
  } catch (err) {
    console.error('[webhook] Error:', err);
    const db = getDb();
    db.run(
      "INSERT INTO webhook_logs (tuzi_task_id, payload, status, processing_error) VALUES (?, ?, 'failed', ?)",
      [req.body?.task_id || req.body?.id || 'unknown', JSON.stringify(req.body), err.message]
    );
    return success(res, null);
  }
});

module.exports = router;
