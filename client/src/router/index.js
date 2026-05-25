import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    redirect: '/login',
  },
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/DashboardView.vue') },
      { path: 'image-to-image', name: 'ImageToImage', component: () => import('@/views/generate/ImageToImageView.vue') },
      { path: 'image-to-video', name: 'ImageToVideo', component: () => import('@/views/generate/ImageToVideoView.vue') },
      { path: 'assets', name: 'Assets', component: () => import('@/views/assets/AssetGalleryView.vue') },
      { path: 'profile', name: 'Profile', component: () => import('@/views/profile/ProfileView.vue') },
      { path: 'keys', name: 'ApiKeys', component: () => import('@/views/profile/ApiKeysView.vue') },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    redirect: '/admin/dashboard',
    children: [
      { path: 'dashboard', name: 'AdminDashboard', component: () => import('@/views/admin/AdminDashboardView.vue') },
      { path: 'users', name: 'AdminUsers', component: () => import('@/views/admin/UserListView.vue') },
      { path: 'users/:id', name: 'AdminUserDetail', component: () => import('@/views/admin/UserDetailView.vue') },
      { path: 'usage', name: 'AdminUsage', component: () => import('@/views/admin/UsageLogsView.vue') },
      { path: 'admins', name: 'AdminAdmins', component: () => import('@/views/admin/AdminListView.vue'), meta: { requiresSuperAdmin: true } },
      { path: 'config', name: 'AdminConfig', component: () => import('@/views/admin/SystemConfigView.vue'), meta: { requiresSuperAdmin: true } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const { useAuthStore } = await import('@/stores/auth')
  const auth = useAuthStore()

  // Public routes
  if (to.meta.public) return next()

  // Check authentication
  if (!auth.accessToken) {
    const refreshed = await auth.tryRefresh()
    if (!refreshed) return next('/login')
  }

  // Admin route guard
  if (to.meta.requiresAdmin && auth.user?.role === 'user') {
    return next('/dashboard')
  }

  // Super admin guard
  if (to.meta.requiresSuperAdmin && auth.user?.role !== 'super_admin') {
    return next('/admin/dashboard')
  }

  next()
})

export default router
