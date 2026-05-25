const { Router } = require('express');
const auth = require('../middleware/auth');
const { adminAuth, superAdminOnly } = require('../middleware/adminAuth');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const UsageLog = require('../models/UsageLog');
const GeneratedAsset = require('../models/GeneratedAsset');
const SystemConfig = require('../models/SystemConfig');
const { success, error, paginated } = require('../utils/response');

const router = Router();
router.use(auth);
router.use(adminAuth);

// === Dashboard ===

// GET /api/admin/dashboard/overview
router.get('/dashboard/overview', (req, res) => {
  const stats = User.getStats();
  const dailyStats = UsageLog.getDailyStats(30);
  const topUsers = UsageLog.getTopUsers(10, 30);
  return success(res, { ...stats, dailyStats, topUsers });
});

// === User Management ===

// GET /api/admin/users
router.get('/users', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const search = req.query.search || '';
  const status = req.query.status || '';
  const excludeAdmins = req.query.exclude_admins === 'true';
  const result = User.list({ page, pageSize, search, status, excludeAdmins });
  return paginated(res, { ...result, page, pageSize });
});

// GET /api/admin/users/:id
router.get('/users/:id', (req, res) => {
  const user = User.findById(req.params.id);
  if (!user) return error(res, '用户不存在', 404);
  const stats = UsageLog.getUserStats(req.params.id, 30);
  const assets = GeneratedAsset.findByUserId(req.params.id, { page: 1, pageSize: 10 });
  return success(res, { ...user, stats, recentAssets: assets.list });
});

// PUT /api/admin/users/:id/quota
router.put('/users/:id/quota', (req, res) => {
  const { quota_total, daily_limit } = req.body;
  User.setQuota(req.params.id, quota_total, daily_limit);
  return success(res, User.findById(req.params.id), '配额已更新');
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['active', 'disabled'].includes(status)) {
    return error(res, '无效的状态', 400);
  }
  User.setStatus(req.params.id, status);
  return success(res, null, `用户已${status === 'active' ? '启用' : '禁用'}`);
});

// DELETE /api/admin/users/:id — super_admin only
router.delete('/users/:id', superAdminOnly, (req, res) => {
  User.delete(req.params.id);
  return success(res, null, '用户已删除');
});

// === Usage Logs ===

// GET /api/admin/usage/logs
router.get('/usage/logs', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const { userId, requestType, status, startDate, endDate } = req.query;
  const result = UsageLog.list({ page, pageSize, userId, requestType, status, startDate, endDate });
  return paginated(res, { ...result, page, pageSize });
});

// GET /api/admin/usage/stats
router.get('/usage/stats', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const stats = UsageLog.getDailyStats(days);
  const topUsers = UsageLog.getTopUsers(10, days);
  return success(res, { dailyStats: stats, topUsers });
});

// GET /api/admin/usage/export
router.get('/usage/export', (req, res) => {
  const { startDate, endDate } = req.query;
  const result = UsageLog.list({ page: 1, pageSize: 10000, startDate, endDate });

  let csv = 'ID,用户名,邮箱,端点,模型,类型,状态,费用,IP,时间\n';
  for (const log of result.list) {
    csv += `${log.id},"${log.username}","${log.email}","${log.endpoint}","${log.model || ''}","${log.request_type}","${log.status}","${log.cost}","${log.ip_address || ''}","${log.created_at}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=usage_export.csv');
  return res.send(csv);
});

// === Sub-Admin Management ===

// GET /api/admin/admins
router.get('/admins', superAdminOnly, (req, res) => {
  const admins = AdminUser.list();
  return success(res, admins);
});

// POST /api/admin/admins/promote — promote an existing user to admin
router.post('/admins/promote', superAdminOnly, async (req, res) => {
  try {
    const { userId, password, role } = req.body;
    if (!userId || !password) {
      return error(res, '请选择用户并设置登录密码', 400);
    }
    if (password.length < 6) {
      return error(res, '密码至少6位', 400);
    }

    const user = User.findById(userId);
    if (!user) return error(res, '用户不存在', 404);

    const existing = AdminUser.findByEmail(user.email);
    if (existing) return error(res, '该用户已是管理员', 409);

    const admin = await AdminUser.create({
      username: user.username,
      email: user.email,
      password,
      role: role || 'admin',
      permissions: { manage_users: true, view_logs: true },
      createdBy: req.admin.id,
    });
    return success(res, admin, '已提升为管理员', 201);
  } catch (err) {
    console.error('[admin] promote error:', err);
    return error(res, '操作失败');
  }
});

// PUT /api/admin/admins/:id
router.put('/admins/:id', superAdminOnly, (req, res) => {
  const { username, email, role, permissions, status } = req.body;
  AdminUser.update(req.params.id, { username, email, role, permissions, status });
  return success(res, null, '已更新');
});

// DELETE /api/admin/admins/:id
router.delete('/admins/:id', superAdminOnly, (req, res) => {
  AdminUser.delete(req.params.id);
  return success(res, null, '已删除');
});

// === System Config ===

// GET /api/admin/config
router.get('/config', superAdminOnly, (req, res) => {
  const configs = SystemConfig.getAll();
  return success(res, configs);
});

// PUT /api/admin/config
router.put('/config', superAdminOnly, (req, res) => {
  const { key, value, description } = req.body;
  if (!key) return error(res, '缺少key', 400);
  SystemConfig.set(key, value, description);
  return success(res, null, '配置已保存');
});

// DELETE /api/admin/config/:key
router.delete('/config/:key', superAdminOnly, (req, res) => {
  SystemConfig.delete(req.params.key);
  return success(res, null, '配置已删除');
});

// === Asset Management ===

// GET /api/admin/assets
router.get('/assets', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const { userId, type } = req.query;
  const result = GeneratedAsset.listAll({ page, pageSize, userId, type });
  return paginated(res, { ...result, page, pageSize });
});

// DELETE /api/admin/assets/:id
router.delete('/assets/:id', (req, res) => {
  GeneratedAsset.adminDelete(req.params.id);
  return success(res, null, '已删除');
});

module.exports = router;
