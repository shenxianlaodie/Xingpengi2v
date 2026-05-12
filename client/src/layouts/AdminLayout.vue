<template>
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo" @click="$router.push('/admin/dashboard')">
        <span v-if="!collapsed">管理后台</span>
        <span v-else>A</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="collapsed"
        router
        background-color="#1a1a2e"
        text-color="#a0aec0"
        active-text-color="#409eff"
      >
        <el-menu-item index="/admin/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>概览</span>
        </el-menu-item>
        <el-menu-item index="/admin/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/usage">
          <el-icon><List /></el-icon>
          <span>用量日志</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isSuperAdmin" index="/admin/admins">
          <el-icon><Avatar /></el-icon>
          <span>子管理员</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isSuperAdmin" index="/admin/config">
          <el-icon><Tools /></el-icon>
          <span>系统设置</span>
        </el-menu-item>
        <el-menu-item index="/dashboard">
          <el-icon><Back /></el-icon>
          <span>返回前台</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button text @click="collapsed = !collapsed">
            <el-icon size="20"><Fold /></el-icon>
          </el-button>
        </div>
        <div class="header-right">
          <span>{{ auth.user?.username }}</span>
          <el-button text type="danger" @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const collapsed = ref(false)

function handleLogout() {
  auth.logout().then(() => router.push('/login'))
}
</script>

<style scoped>
.layout { height: 100vh; }
.sidebar { background: #1a1a2e; overflow-y: auto; }
.logo { height: 60px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: bold; cursor: pointer; border-bottom: 1px solid #2d2d44; }
.el-menu { border-right: none; }
.header { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #e4e7ed; padding: 0 20px; height: 60px; }
.header-left { display: flex; align-items: center; }
.header-right { display: flex; align-items: center; gap: 12px; }
.main-content { background: #f5f7fa; padding: 20px; min-height: calc(100vh - 60px); }
</style>
