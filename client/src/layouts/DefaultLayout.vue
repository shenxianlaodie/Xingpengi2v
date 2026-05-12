<template>
  <el-container class="layout">
    <el-aside :width="sidebarCollapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo" @click="$router.push('/dashboard')">
        <img src="/logo.png" alt="兴鹏" class="sidebar-logo-img" />
        <span v-if="!sidebarCollapsed">兴鹏API</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="sidebarCollapsed"
        router
        background-color="#1a1a2e"
        text-color="#a0aec0"
        active-text-color="#409eff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/image-to-image" disabled>
          <el-icon><PictureFilled /></el-icon>
          <span>图生图</span>
        </el-menu-item>
        <el-menu-item index="/image-to-video">
          <el-icon><VideoCameraFilled /></el-icon>
          <span>图生视频</span>
        </el-menu-item>
        <el-menu-item index="/assets">
          <el-icon><FolderOpened /></el-icon>
          <span>作品库</span>
        </el-menu-item>
        <el-menu-item index="/profile">
          <el-icon><UserFilled /></el-icon>
          <span>个人中心</span>
        </el-menu-item>
        <el-menu-item index="/keys">
          <el-icon><Key /></el-icon>
          <span>API 密钥</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isAdmin" index="/admin/dashboard">
          <el-icon><Setting /></el-icon>
          <span>管理后台</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button text @click="app.toggleSidebar()">
            <el-icon size="20"><Fold /></el-icon>
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="route.meta.title">{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <div class="quota-badge">
            <span>{{ auth.user?.quota_used || 0 }} / {{ auth.user?.quota_total || 0 }}</span>
            <el-progress
              :percentage="auth.user ? Math.round(auth.user.quota_used / auth.user.quota_total * 100) : 0"
              :stroke-width="6"
              style="width: 80px"
            />
          </div>
          <el-dropdown @command="handleCommand">
            <span class="user-dropdown">
              {{ auth.user?.username }} <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="admin" v-if="auth.isAdmin">管理后台</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { computed } from 'vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const app = useAppStore()

const sidebarCollapsed = computed(() => app.sidebarCollapsed)

function handleCommand(cmd) {
  if (cmd === 'profile') router.push('/profile')
  else if (cmd === 'admin') router.push('/admin/dashboard')
  else if (cmd === 'logout') {
    auth.logout().then(() => router.push('/login'))
  }
}
</script>

<style scoped>
.layout { height: 100vh; }
.sidebar { background: #1a1a2e; overflow-y: auto; }
.logo { height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #fff; font-size: 20px; font-weight: bold; cursor: pointer; border-bottom: 1px solid #2d2d44; }
.sidebar-logo-img { width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0; }
.el-menu { border-right: none; }
.header { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #e4e7ed; padding: 0 20px; height: 60px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-right { display: flex; align-items: center; gap: 20px; }
.quota-badge { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; }
.user-dropdown { cursor: pointer; color: #333; }
.main-content { background: #f5f7fa; padding: 20px; min-height: calc(100vh - 60px); }
</style>
