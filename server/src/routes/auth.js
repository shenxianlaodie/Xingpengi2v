const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const RefreshToken = require('../models/RefreshToken');
const { signAccessToken, signRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { hashPassword, comparePassword } = require('../utils/hash');
const SystemConfig = require('../models/SystemConfig');

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    if (SystemConfig.get('registration_open', 'true') !== 'true') {
      return error(res, '注册功能已关闭', 403);
    }

    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return error(res, '请填写所有必填字段', 400);
    }
    if (password.length < 6) {
      return error(res, '密码至少6位', 400);
    }

    const existingEmail = User.findByEmail(email);
    if (existingEmail) return error(res, '邮箱已被注册', 409);

    const existingUser = User.findByUsername(username);
    if (existingUser) return error(res, '用户名已被使用', 409);

    const passwordHash = await hashPassword(password);
    const user = User.create({ username, email, passwordHash });
    User.updateLogin(user.id, req.requestInfo?.ip || req.ip);

    const { token: refreshToken, family } = RefreshToken.generateAndStore({
      userId: user.id,
      family: uuidv4(),
    });

    const accessToken = signAccessToken({ userId: user.id, role: user.role });

    res.cookie('rt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    return success(res, {
      user: { id: user.id, username: user.username, email: user.email, role: user.role,
              quota_total: user.quota_total, quota_used: user.quota_used, daily_limit: user.daily_limit },
      accessToken,
    }, '注册成功', 201);
  } catch (err) {
    console.error('[auth] register error:', err);
    return error(res, '注册失败');
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return error(res, '请输入邮箱和密码', 400);
    }

    // Only admins can login with email/password; regular users must use DingTalk
    let user = AdminUser.findByEmail(email);

    if (!user) {
      // Check if this email belongs to a regular user — reject with hint
      const regularUser = User.findByEmail(email);
      if (regularUser) {
        return error(res, '请使用钉钉扫码登录', 403);
      }
      return error(res, '邮箱或密码错误', 401);
    }

    if (user.status !== 'active') return error(res, '账号已被禁用', 403);

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return error(res, '邮箱或密码错误', 401);

    const ip = req.requestInfo?.ip || req.ip;
    AdminUser.updateLogin(user.id, ip);

    const { token: refreshToken, family } = RefreshToken.generateAndStore({
      adminUserId: user.id,
      family: uuidv4(),
    });

    const accessToken = signAccessToken({ userId: user.id, role: user.role });

    res.cookie('rt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    return success(res, {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: JSON.parse(user.permissions || '{}'),
      },
      accessToken,
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    return error(res, '登录失败');
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.rt;
    if (!token) return error(res, '未提供刷新令牌', 401);

    const stored = RefreshToken.findByHash(token);
    if (!stored || stored.revoked_at) {
      // Token reuse detected -> revoke entire family
      if (stored) {
        RefreshToken.revokeFamily(stored.family);
      }
      res.clearCookie('rt', { path: '/api/auth' });
      return error(res, '令牌已失效', 401);
    }

    // Check expiration
    if (new Date(stored.expires_at) < new Date()) {
      RefreshToken.revoke(stored.id);
      res.clearCookie('rt', { path: '/api/auth' });
      return error(res, '令牌已过期', 401);
    }

    // Rotate: revoke old, issue new
    RefreshToken.revoke(stored.id);

    const tokenPayload = {
      ...(stored.user_id ? { userId: stored.user_id } : {}),
      ...(stored.admin_user_id ? { adminUserId: stored.admin_user_id } : {}),
    };

    const { token: newToken } = RefreshToken.generateAndStore({
      ...(stored.user_id ? { userId: stored.user_id } : {}),
      ...(stored.admin_user_id ? { adminUserId: stored.admin_user_id } : {}),
      family: stored.family, // keep same family for rotation detection
    });

    let role = 'user';
    let user = null;
    if (stored.admin_user_id) {
      const admin = AdminUser.findById(stored.admin_user_id);
      if (admin) { role = admin.role; user = admin; }
    }

    const accessToken = signAccessToken({
      userId: stored.user_id || stored.admin_user_id,
      role,
    });

    res.cookie('rt', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    return success(res, {
      accessToken,
      ...(user && user.role !== 'user' ? {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: JSON.parse(user.permissions || '{}'),
        },
      } : {}),
    });
  } catch (err) {
    console.error('[auth] refresh error:', err);
    return error(res, '刷新失败');
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies?.rt;
  if (token) {
    const stored = RefreshToken.findByHash(token);
    if (stored) {
      RefreshToken.revokeFamily(stored.family);
    }
  }
  res.clearCookie('rt', { path: '/api/auth' });
  return success(res, null, '已退出登录');
});

module.exports = router;
