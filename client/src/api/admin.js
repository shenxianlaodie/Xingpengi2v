import api from './index'

export function getOverview() {
  return api.get('/admin/dashboard/overview')
}

export function getUsers(params) {
  return api.get('/admin/users', { params })
}

export function getUserDetail(id) {
  return api.get(`/admin/users/${id}`)
}

export function updateUserQuota(id, quota_total, daily_limit) {
  return api.put(`/admin/users/${id}/quota`, { quota_total, daily_limit })
}

export function updateUserStatus(id, status) {
  return api.put(`/admin/users/${id}/status`, { status })
}

export function deleteUser(id) {
  return api.delete(`/admin/users/${id}`)
}

export function getUsageLogs(params) {
  return api.get('/admin/usage/logs', { params })
}

export function getUsageStats(days = 30) {
  return api.get('/admin/usage/stats', { params: { days } })
}

export function exportUsage(params) {
  return api.get('/admin/usage/export', { params, responseType: 'blob' })
}

export function getAdmins() {
  return api.get('/admin/admins')
}

export function createAdmin(data) {
  return api.post('/admin/admins', data)
}

export function updateAdmin(id, data) {
  return api.put(`/admin/admins/${id}`, data)
}

export function deleteAdmin(id) {
  return api.delete(`/admin/admins/${id}`)
}

export function getSystemConfig() {
  return api.get('/admin/config')
}

export function updateSystemConfig(key, value, description) {
  return api.put('/admin/config', { key, value, description })
}
