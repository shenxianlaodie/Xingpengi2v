import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, register as registerApi, refresh as refreshApi, logout as logoutApi } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const accessToken = ref(null)

  const isLoggedIn = computed(() => !!accessToken.value)
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin')
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

  async function login(email, password) {
    const res = await loginApi(email, password)
    user.value = res.data.user
    accessToken.value = res.data.accessToken
    return res.data
  }

  async function register(username, email, password) {
    const res = await registerApi(username, email, password)
    user.value = res.data.user
    accessToken.value = res.data.accessToken
    return res.data
  }

  async function tryRefresh() {
    try {
      const res = await refreshApi()
      accessToken.value = res.data.accessToken
      if (res.data.user) {
        user.value = res.data.user
      }
      return true
    } catch {
      return false
    }
  }

  async function logout() {
    try { await logoutApi() } catch {}
    clearAuth()
  }

  function clearAuth() {
    user.value = null
    accessToken.value = null
  }

  function applyLoginData(data) {
    user.value = data.user
    accessToken.value = data.accessToken
  }

  function setUser(u) {
    user.value = u
  }

  return { user, accessToken, isLoggedIn, isAdmin, isSuperAdmin, login, register, applyLoginData, tryRefresh, logout, clearAuth, setUser }
})
