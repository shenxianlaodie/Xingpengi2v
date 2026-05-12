const jwt = require('jsonwebtoken');
const config = require('../config');

function signAccessToken(payload) {
  return jwt.sign({ ...payload, type: 'access' }, config.accessTokenSecret, {
    expiresIn: config.accessTokenExpires,
  });
}

function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh' }, config.refreshTokenSecret, {
    expiresIn: config.refreshTokenExpires,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.accessTokenSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.refreshTokenSecret);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
