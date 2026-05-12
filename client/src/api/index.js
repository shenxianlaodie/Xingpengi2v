import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const path = error.config?.url || ''
    const skipRefresh = /(^|\/)auth\/(login|register|refresh)(\?|$)/.test(path)

    if (error.response?.status === 401 && !error.config._retry && !skipRefresh) {
      error.config._retry = true
      const auth = useAuthStore()
      const refreshed = await auth.tryRefresh()
      if (refreshed) {
        return api(error.config)
      }
      auth.clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
