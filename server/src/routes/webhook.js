const { Router } = require('express');
const { getDb } = require('../config/database');
const UsageLog = require('../models/UsageLog');
const GeneratedAsset = require('../models/GeneratedAsset');
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
        const row = urls[i];
        const url = typeof row === 'string' ? row : row?.url;
        if (!assets[i] || !url) continue;
        const w = typeof row === 'object' && row ? row.width : null;
        const h = typeof row === 'object' && row ? row.height : null;
        const d = typeof row === 'object' && row ? row.duration : null;
        GeneratedAsset.setRemoteSourceAndComplete(assets[i].id, url, {
          width: w,
          height: h,
          duration: d,
          mimeType: usageLog.request_type === 'video' ? 'video/mp4' : 'image/png',
        });
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
