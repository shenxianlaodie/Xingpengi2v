<template>
  <div>
    <h2>用量日志</h2>
    <el-row :gutter="16" style="margin:16px 0">
      <el-col :span="4">
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" />
      </el-col>
      <el-col :span="3">
        <el-select v-model="typeFilter" placeholder="类型" clearable>
          <el-option label="图片" value="image" />
          <el-option label="视频" value="video" />
          <el-option label="文本" value="text" />
        </el-select>
      </el-col>
      <el-col :span="3">
        <el-select v-model="statusFilter" placeholder="状态" clearable>
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
          <el-option label="处理中" value="pending" />
        </el-select>
      </el-col>
      <el-col :span="3">
        <el-button type="primary" @click="loadLogs">查询</el-button>
      </el-col>
      <el-col :span="3">
        <el-button @click="exportCSV">导出CSV</el-button>
      </el-col>
    </el-row>
    <el-table :data="logs" stripe v-loading="loading" max-height="600">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="用户" width="100" />
      <el-table-column prop="endpoint" label="端点" width="200" />
      <el-table-column prop="request_type" label="类型" width="70" />
      <el-table-column prop="model" label="模型" width="120" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'success' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="费用" width="80">
        <template #default="{ row }">¥{{ row.cost?.toFixed(4) }}</template>
      </el-table-column>
      <el-table-column prop="ip_address" label="IP地址" width="130" />
      <el-table-column prop="created_at" label="时间" width="160" />
    </el-table>
    <el-pagination
      v-if="total > pageSize"
      style="margin-top:16px;justify-content:center"
      :current-page="page" :page-size="pageSize" :total="total"
      layout="total, prev, pager, next" @current-change="(p) => { page = p; loadLogs() }"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getUsageLogs, exportUsage } from '@/api/admin'
import { ElMessage } from 'element-plus'

const logs = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const dateRange = ref(null)
const typeFilter = ref('')
const statusFilter = ref('')

onMounted(loadLogs)

async function loadLogs() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value, requestType: typeFilter.value, status: statusFilter.value }
    if (dateRange.value) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const res = await getUsageLogs(params)
    logs.value = res.data.list
    total.value = res.data.total
  } catch { } finally { loading.value = false }
}

async function exportCSV() {
  try {
    const params = {}
    if (dateRange.value) { params.startDate = dateRange.value[0]; params.endDate = dateRange.value[1] }
    const res = await exportUsage(params)
    const blob = new Blob([res], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'usage_export.csv'; a.click()
    URL.revokeObjectURL(url)
  } catch { ElMessage.error('导出失败') }
}
</script>
