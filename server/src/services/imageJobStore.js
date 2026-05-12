const { v4: uuidv4 } = require('uuid');

const TTL_MS = 60 * 60 * 1000;
const MAX_JOBS = 500;
const jobs = new Map();

function prune() {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.createdAt > TTL_MS) jobs.delete(id);
  }
  while (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) jobs.delete(oldest[0]);
    else break;
  }
}

function create({ userId }) {
  prune();
  const id = uuidv4();
  jobs.set(id, {
    status: 'queued',
    userId: userId ?? null,
    createdAt: Date.now(),
    result: null,
    error: null,
  });
  return id;
}

function get(id) {
  return jobs.get(id) || null;
}

function setRunning(id) {
  const j = jobs.get(id);
  if (j) j.status = 'running';
}

function complete(id, resultPayload) {
  const j = jobs.get(id);
  if (!j) return;
  j.status = 'completed';
  j.result = resultPayload;
}

function fail(id, message) {
  const j = jobs.get(id);
  if (!j) return;
  j.status = 'failed';
  j.error = message || '失败';
}

function canAccess(req, job) {
  if (!job) return false;
  if (req.user.role === 'admin' || req.user.role === 'super_admin') return true;
  return job.userId === req.user.userId;
}

module.exports = { create, get, setRunning, complete, fail, canAccess };
