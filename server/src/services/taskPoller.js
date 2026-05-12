const UsageLog = require('../models/UsageLog');
const GeneratedAsset = require('../models/GeneratedAsset');
const TuziClient = require('./tuziClient');

let intervalId = null;

async function pollOneTask(log) {
  try {
    const result = await TuziClient.getVideoStatus(log.tuzi_task_id);
    if (!result || result.error) return;

    if (result.status === 'completed') {
      await handleCompleted(log, result);
      return;
    }

    if (result.status === 'failed' || result.status === 'error') {
      UsageLog.updateStatus(log.id, 'failed', result.error || 'Task failed');
      const assets = GeneratedAsset.findByTuziTaskId(log.tuzi_task_id);
      for (const asset of assets) {
        GeneratedAsset.updateStatus(asset.id, 'failed', null);
      }
    }
  } catch (err) {
    console.error(`[poller] Error polling task ${log.tuzi_task_id}:`, err.message);
  }
}

async function pollPendingTasks() {
  try {
    const pending = UsageLog.findPendingAsync();
    await Promise.all(pending.map(log => pollOneTask(log)));
  } catch (err) {
    console.error('[poller] Error in poll cycle:', err.message);
  }
}

async function handleCompleted(log, taskData) {
  const videoUrl = taskData.video_url;
  const assets = GeneratedAsset.findByTuziTaskId(log.tuzi_task_id);

  if (assets.length === 0) {
    UsageLog.updateStatus(log.id, 'success');
    return;
  }

  if (!videoUrl) {
    UsageLog.updateStatus(log.id, 'success');
    return;
  }

  GeneratedAsset.setRemoteSourceAndComplete(assets[0].id, videoUrl, {
    duration: log.video_duration,
    mimeType: 'video/mp4',
  });
  UsageLog.updateStatus(log.id, 'success');
}

function start(intervalMs = 10000) {
  if (intervalId) return;
  intervalId = setInterval(pollPendingTasks, intervalMs);
  console.log(`[poller] Started with interval ${intervalMs}ms`);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { start, stop, pollPendingTasks };
