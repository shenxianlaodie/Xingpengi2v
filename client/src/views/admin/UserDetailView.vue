<template>
  <div>
    <el-button text @click="$router.push('/admin/users')"><el-icon><ArrowLeft /></el-icon> 返回用户列表</el-button>
    <h2 style="margin-top:12px">{{ user.username }} 的详情</h2>
    <el-row :gutter="20" style="margin-top:16px">
      <el-col :span="12">
        <el-card>
          <template #header>基本信息</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="ID">{{ user.id }}</el-descriptions-item>
            <el-descriptions-item label="用户名">{{ user.username }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ user.email }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="user.status === 'active' ? 'success' : 'danger'">{{ user.status === 'active' ? '正常' : '禁用' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="配额">{{ user.quota_used }} / {{ user.quota_total }}</el-descriptions-item>
            <el-descriptions-item label="日限额">{{ user.daily_limit }}</el-descriptions-item>
            <el-descriptions-item label="最后登录IP">{{ user.last_login_ip || '暂无' }}</el-descriptions-item>
            <el-descriptions-item label="最后登录时间">{{ user.last_login_at || '暂无' }}</el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ user.created_at }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>最近作品</template>
          <div v-if="!user.recentAssets?.length" style="color:#ccc;text-align:center;padding:40px">暂无作品</div>
          <div v-else class="mini-grid">
            <div v-for="a in user.recentAssets" :key="a.id" class="mini-item">
              <img v-if="a.asset_type === 'image'" :src="a.cached_path ? '/api/assets/'+a.id+'/file' : a.source_url" />
              <video v-else :src="a.cached_path ? '/api/assets/'+a.id+'/file' : a.source_url" />
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getUserDetail } from '@/api/admin'

const route = useRoute()
const user = ref({})

onMounted(async () => {
  try {
    const res = await getUserDetail(route.params.id)
    user.value = res.data
  } catch { }
})
</script>

<style scoped>
.mini-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.mini-item img, .mini-item video { width: 100%; height: 100px; object-fit: cover; border-radius: 4px; }
</style>
