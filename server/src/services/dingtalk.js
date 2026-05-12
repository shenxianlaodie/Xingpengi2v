const axios = require('axios');
const SystemConfig = require('../models/SystemConfig');

const DINGTALK_AUTH_URL = 'https://login.dingtalk.com/oauth2/auth';
const DINGTALK_TOKEN_URL = 'https://api.dingtalk.com/v1.0/oauth2/userAccessToken';
const DINGTALK_USER_URL = 'https://api.dingtalk.com/v1.0/contact/users/me';

function getCredentials() {
  return {
    appKey: SystemConfig.get('dingtalk_app_key') || process.env.DINGTALK_APP_KEY || '',
    appSecret: SystemConfig.get('dingtalk_app_secret') || process.env.DINGTALK_APP_SECRET || '',
  };
}

function buildAuthUrl(redirectUri, state) {
  const { appKey } = getCredentials();
  if (!appKey) throw new Error('钉钉应用未配置');
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    response_type: 'code',
    client_id: appKey,
    scope: 'openid',
    state,
    prompt: 'consent',
  });
  return `${DINGTALK_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code, redirectUri) {
  const { appKey, appSecret } = getCredentials();
  if (!appKey || !appSecret) throw new Error('钉钉应用未配置');

  const { data } = await axios.post(DINGTALK_TOKEN_URL, {
    clientId: appKey,
    clientSecret: appSecret,
    code,
    grantType: 'authorization_code',
  }, { timeout: 10000 });

  if (!data.accessToken) {
    throw new Error(data.message || '获取钉钉token失败');
  }
  return data.accessToken;
}

async function getUserInfo(accessToken) {
  const { data } = await axios.get(DINGTALK_USER_URL, {
    headers: { 'x-acs-dingtalk-access-token': accessToken },
    timeout: 10000,
  });
  return data;
}

module.exports = { buildAuthUrl, exchangeCode, getUserInfo, getCredentials };
