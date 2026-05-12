<template>
  <div>
    <h2>欢迎回来，{{ auth.user?.username }}</h2>
    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="6" v-for="stat in stats" :key="stat.label">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon :size="32" :color="stat.color"><component :is="stat.icon" /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="12">
        <el-card>
          <template #header>快捷操作</template>
          <el-space wrap>
            <el-button type="primary" @click="$router.push('/image-to-image')">
                  <el-icon><PictureFilled /></el-icon> 图生图
                </el-button>
            <el-button type="success" @click="$router.push('/image-to-video')">
              <el-icon><VideoCameraFilled /></el-icon> 图生视频
            </el-button>
            <el-button @click="$router.push('/assets')">
              <el-icon><FolderOpened /></el-icon> 作品库
            </el-button>
            <el-button @click="$router.push('/keys')">
              <el-icon><Key /></el-icon> API密钥
            </el-button>
          </el-space>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>配额信息</template>
          <div class="quota-info">
            <div>已用额度</div>
            <el-progress :percentage="quotaPercent" :status="quotaPercent > 90 ? 'exception' : ''" />
            <div style="margin-top:8px;color:#999">已用 {{ auth.user?.quota_used || 0 }} / 总量 {{ auth.user?.quota_total || 0 }} · 每日上限 {{ auth.user?.daily_limit || 0 }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const quotaPercent = computed(() => {
  if (!auth.user || !auth.user.quota_total) return 0
  return Math.round(auth.user.quota_used / auth.user.quota_total * 100)
})

const stats = computed(() => [
  { icon: 'PictureFilled', value: auth.user?.quota_total || 0, label: '总配额', color: '#409eff' },
  { icon: 'RemoveFilled', value: auth.user?.quota_used || 0, label: '已使用', color: '#e6a23c' },
  { icon: 'Clock', value: auth.user?.daily_limit || 0, label: '日限额', color: '#67c23a' },
  { icon: 'TrendCharts', value: (auth.user?.quota_total || 0) - (auth.user?.quota_used || 0), label: '剩余', color: '#f56c6c' },
])
</script>

<style scoped>
.stat-card { display: flex; align-items: center; gap: 16px; }
.stat-info { flex: 1; }
.stat-value { font-size: 24px; font-weight: bold; }
.stat-label { font-size: 13px; color: #999; margin-top: 4px; }
.quota-info { padding: 10px 0; }
h2 { margin: 0; }
</style>
