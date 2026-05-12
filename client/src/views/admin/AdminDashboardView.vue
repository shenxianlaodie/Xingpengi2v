<template>
  <div>
    <h2>管理后台</h2>
    <el-row :gutter="20" style="margin-top:16px">
      <el-col :span="6" v-for="s in statCards" :key="s.label">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" :style="{color:s.color}">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="16">
        <el-card>
          <template #header>近30天调用量</template>
          <div ref="chartRef" style="height:300px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>用量Top10</template>
          <el-table :data="topUsers" size="small">
            <el-table-column prop="username" label="用户" />
            <el-table-column prop="count" label="调用次数" width="80" />
            <el-table-column prop="total_cost" label="费用" width="80">
              <template #default="{ row }">¥{{ row.total_cost?.toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
    <el-card style="margin-top:20px">
      <template #header>最近调用记录</template>
      <el-table :data="recentLogs" size="small" v-loading="loading">
        <el-table-column prop="username" label="用户" width="100" />
        <el-table-column prop="endpoint" label="端点" width="180" />
        <el-table-column prop="request_type" label="类型" width="80" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'success' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="cost" label="费用" width="80">
          <template #default="{ row }">¥{{ row.cost?.toFixed(4) }}</template>
        </el-table-column>
        <el-table-column prop="ip_address" label="IP" width="130" />
        <el-table-column prop="created_at" label="时间" width="160" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { getOverview, getUsageLogs } from '@/api/admin'
import * as echarts from 'echarts'

const overview = ref({ totalUsers: 0, todayCalls: 0, todayCost: 0, pendingTasks: 0, dailyStats: [], topUsers: [] })
const recentLogs = ref([])
const loading = ref(false)
const chartRef = ref(null)

const statCards = computed(() => [
  { label: '总用户数', value: overview.value.totalUsers, color: '#409eff' },
  { label: '今日调用', value: overview.value.todayCalls, color: '#67c23a' },
  { label: '今日费用', value: '¥' + (overview.value.todayCost || 0).toFixed(2), color: '#e6a23c' },
  { label: '处理中任务', value: overview.value.pendingTasks, color: '#f56c6c' },
])

const topUsers = computed(() => overview.value.topUsers || [])

onMounted(async () => {
  try {
    const res = await getOverview()
    overview.value = res.data
    const logs = await getUsageLogs({ page: 1, pageSize: 20 })
    recentLogs.value = logs.data.list
    await nextTick()
    renderChart()
  } catch { }
})

function renderChart() {
  if (!chartRef.value) return
  const chart = echarts.init(chartRef.value)
  const stats = overview.value.dailyStats || []
  const days = [...new Set(stats.map(s => s.day))].sort()
  const types = [...new Set(stats.map(s => s.type))]
  const series = types.map(t => ({
    name: t, type: 'line', smooth: true,
    data: days.map(d => {
      const found = stats.find(s => s.day === d && s.type === t)
      return found ? found.count : 0
    }),
  }))
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: types },
    xAxis: { type: 'category', data: days },
    yAxis: { type: 'value' },
    series,
  })
}
</script>

<style scoped>
.stat-card { text-align: center; padding: 10px 0; }
.stat-value { font-size: 28px; font-weight: bold; }
.stat-label { font-size: 13px; color: #999; margin-top: 4px; }
</style>
