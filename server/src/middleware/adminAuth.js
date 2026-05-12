const { getDb } = require('../config/database');

function adminAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ code: -1, message: '未认证', data: null });
  }

  const admin = getDb().get(
    'SELECT * FROM admin_users WHERE id = ? AND status = ?',
    [req.user.userId, 'active']
  );

  if (!admin) {
    return res.status(403).json({ code: -1, message: '无管理员权限', data: null });
  }

  req.admin = admin;
  req.user.role = admin.role;
  req.user.permissions = JSON.parse(admin.permissions || '{}');
  next();
}

function superAdminOnly(req, res, next) {
  if (!req.admin || req.admin.role !== 'super_admin') {
    return res.status(403).json({ code: -1, message: '需要超级管理员权限', data: null });
  }
  next();
}

module.exports = { adminAuth, superAdminOnly };
