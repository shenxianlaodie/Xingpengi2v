const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { buildAuthUrl, exchangeCode, getUserInfo } = require('../services/dingtalk');
const { signAccessToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const config = require('../config');

const router = Router();

/** 钉钉 redirect_uri 必须与授权 URL 一致；PUBLIC_ORIGIN 优先，避免 Vite 反代后 Host 变成 localhost:3002 */
function publicBaseUrl(req) {
  const fromEnv = (config.publicOrigin || '').replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  return `${req.protocol}://${req.get('host')}`.replace(/\/+$/, '');
}

// In-memory state store (keyed by state, value = { status, tokens, createdAt })
const stateStore = new Map();

// Clean expired states every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of stateStore) {
    if (now - val.createdAt > 300000) stateStore.delete(key); // 5 min TTL
  }
}, 60000);

// GET /api/auth/dingtalk/url
router.get('/dingtalk/url', (req, res) => {
  try {
    const state = uuidv4();
    const redirectUri = `${publicBaseUrl(req)}/api/auth/dingtalk/callback`;
    const url = buildAuthUrl(redirectUri, state);

    stateStore.set(state, { status: 'pending', tokens: null, createdAt: Date.now() });

    return success(res, { url, state });
  } catch (err) {
    console.error('[dingtalk] build url error:', err);
    return error(res, err.message || '获取钉钉登录地址失败');
  }
});

// GET /api/auth/dingtalk/status/:state
router.get('/dingtalk/status/:state', (req, res) => {
  const record = stateStore.get(req.params.state);
  if (!record) return error(res, '状态已过期，请重新扫码', 404);

  if (record.status === 'done') {
    stateStore.delete(req.params.state);
    return success(res, record.tokens);
  }

  return success(res, { status: 'pending' });
});

// GET /api/auth/dingtalk/callback
router.get('/dingtalk/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.send(renderPage('登录失败', '缺少授权参数'));
  }

  const record = stateStore.get(state);
  if (!record) {
    return res.send(renderPage('登录失败', '状态已过期，请返回重新扫码'));
  }

  try {
    const accessToken = await exchangeCode(code, buildCallbackUrl(req));
    const dtUser = await getUserInfo(accessToken);

    // Find or create user
    let user = null;
    if (dtUser.unionId) {
      user = User.findByDingtalkUnionId(dtUser.unionId);
    }
    if (!user && dtUser.openId) {
      user = User.findByDingtalkOpenId(dtUser.openId);
    }
    if (!user && dtUser.email) {
      user = User.findByEmail(dtUser.email);
    }

    if (user) {
      // Update DingTalk info
      User.updateDingtalk(user.id, {
        unionId: dtUser.unionId,
        openId: dtUser.openId,
        nick: dtUser.nick,
        avatar: dtUser.avatarUrl,
      });
    } else {
      const username = dtUser.nick || `用户${Date.now().toString(36)}`;
      const email = dtUser.email || `${dtUser.unionId || dtUser.openId}@dingtalk.user`;
      user = User.createFromDingtalk({
        username,
        email,
        unionId: dtUser.unionId,
        openId: dtUser.openId,
        nick: dtUser.nick,
        avatar: dtUser.avatarUrl,
      });
    }

    if (user.status !== 'active') {
      return res.send(renderPage('登录失败', '账号已被禁用'));
    }

    const ip = req.requestInfo?.ip || req.ip;
    User.updateLogin(user.id, ip);

    const { token: refreshToken, family } = RefreshToken.generateAndStore({
      userId: user.id,
      family: uuidv4(),
    });

    const jwtToken = signAccessToken({ userId: user.id, role: user.role });

    const tokens = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        quota_total: user.quota_total,
        quota_used: user.quota_used,
        daily_limit: user.daily_limit,
      },
      accessToken: jwtToken,
    };

    record.status = 'done';
    record.tokens = tokens;

    res.cookie('rt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    return res.send(renderPage('登录成功', '钉钉扫码登录成功，请返回网页继续操作'));
  } catch (err) {
    console.error('[dingtalk] callback error:', err);
    record.status = 'error';
    return res.send(renderPage('登录失败', err.message || '钉钉授权失败'));
  }
});

function buildCallbackUrl(req) {
  return `${publicBaseUrl(req)}/api/auth/dingtalk/callback`;
}

function renderPage(title, message) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>兴鹏API - ${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; }
  .card { background: #fff; border-radius: 12px; padding: 48px 40px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,.3); max-width: 400px; width: 90%; }
  .icon { font-size: 48px; margin-bottom: 16px; }
  h2 { color: #1a1a2e; margin-bottom: 8px; font-size: 20px; }
  p { color: #999; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${title === '登录成功' ? '✅' : '❌'}</div>
    <h2>${title}</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

module.exports = router;
