const { Router } = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const UsageLog = require('../models/UsageLog');
const GeneratedAsset = require('../models/GeneratedAsset');
const { success, error, paginated } = require('../utils/response');

const router = Router();
router.use(auth);

// GET /api/user/profile
router.get('/profile', (req, res) => {
  const user = User.findById(req.user.userId);
  if (!user) return error(res, '用户不存在', 404);
  return success(res, user);
});

// PUT /api/user/profile
router.put('/profile', (req, res) => {
  const { username, avatar_url } = req.body;
  User.updateProfile(req.user.userId, { username, avatar_url });
  const user = User.findById(req.user.userId);
  return success(res, user, '更新成功');
});

// PUT /api/user/password
router.put('/password', async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return error(res, '新密码至少6位', 400);
  }
  const user = User.findByEmail(User.findById(req.user.userId).email);
  const bcrypt = require('bcryptjs');
  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) return error(res, '原密码错误', 400);

  const { hashPassword } = require('../utils/hash');
  User.changePassword(req.user.userId, await hashPassword(newPassword));
  return success(res, null, '密码修改成功');
});

// GET /api/user/keys
router.get('/keys', (req, res) => {
  const keys = ApiKey.findByUserId(req.user.userId);
  return success(res, keys);
});

// POST /api/user/keys
router.post('/keys', (req, res) => {
  const { name } = req.body;
  const key = ApiKey.create(req.user.userId, name || 'Default');
  return success(res, { ...key, message: '请保存此密钥，仅显示一次' }, '创建成功', 201);
});

// DELETE /api/user/keys/:id
router.delete('/keys/:id', (req, res) => {
  const key = ApiKey.findByIdForUser(req.params.id, req.user.userId);
  if (!key) return error(res, '密钥不存在', 404);
  ApiKey.revoke(req.params.id);
  return success(res, null, '已撤销');
});

// GET /api/user/usage
router.get('/usage', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const stats = UsageLog.getUserStats(req.user.userId, days);
  return success(res, stats);
});

// GET /api/user/assets
router.get('/assets', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const type = req.query.type;
  const result = GeneratedAsset.findByUserId(req.user.userId, {
    page, pageSize, type, role: req.user.role,
  });
  return paginated(res, { ...result, page, pageSize });
});

// GET /api/user/assets/:id
router.get('/assets/:id', (req, res) => {
  const assets = GeneratedAsset.findByUserId(req.user.userId, {
    page: 1, pageSize: 1000, role: req.user.role,
  });
  const asset = assets.list.find(a => a.id === parseInt(req.params.id));
  if (!asset) return error(res, '资源不存在', 404);
  return success(res, asset);
});

// DELETE /api/user/assets/:id
router.delete('/assets/:id', (req, res) => {
  GeneratedAsset.deleteById(req.params.id, req.user.userId, req.user.role);
  return success(res, null, '已删除');
});

module.exports = router;
