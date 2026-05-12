import api from './index'

export function getProfile() {
  return api.get('/user/profile')
}

export function updateProfile(data) {
  return api.put('/user/profile', data)
}

export function changePassword(oldPassword, newPassword) {
  return api.put('/user/password', { oldPassword, newPassword })
}

export function getApiKeys() {
  return api.get('/user/keys')
}

export function createApiKey(name) {
  return api.post('/user/keys', { name })
}

export function deleteApiKey(id) {
  return api.delete(`/user/keys/${id}`)
}

export function getUserUsage(days = 30) {
  return api.get('/user/usage', { params: { days } })
}

export function getUserAssets(page = 1, pageSize = 20, type) {
  return api.get('/user/assets', { params: { page, pageSize, type } })
}

export function deleteAsset(id) {
  return api.delete(`/user/assets/${id}`)
}
