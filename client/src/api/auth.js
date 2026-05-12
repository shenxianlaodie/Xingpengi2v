import api from './index'

export function login(email, password) {
  return api.post('/auth/login', { email, password })
}

export function register(username, email, password) {
  return api.post('/auth/register', { username, email, password })
}

export function refresh() {
  return api.post('/auth/refresh')
}

export function logout() {
  return api.post('/auth/logout')
}

export function getDingtalkUrl() {
  return api.get('/auth/dingtalk/url')
}

export function checkDingtalkStatus(state) {
  return api.get(`/auth/dingtalk/status/${state}`)
}
