<template>
  <div>
    <h2>用户管理</h2>
    <el-row :gutter="16" style="margin:16px 0">
      <el-col :span="6">
        <el-input v-model="search" placeholder="搜索用户名/邮箱" clearable @clear="loadUsers" @keyup.enter="loadUsers" />
      </el-col>
      <el-col :span="3">
        <el-select v-model="statusFilter" placeholder="状态" clearable @change="loadUsers">
          <el-option label="正常" value="active" />
          <el-option label="禁用" value="disabled" />
        </el-select>
      </el-col>
      <el-col :span="3">
        <el-button type="primary" @click="loadUsers">搜索</el-button>
      </el-col>
    </el-row>
    <el-table :data="users" stripe v-loading="loading">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="email" label="邮箱" width="180" />
      <el-table-column label="配额" width="150">
        <template #default="{ row }">{{ row.quota_used }} / {{ row.quota_total }}</template>
      </el-table-column>
      <el-table-column prop="daily_limit" label="日限额" width="80" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">{{ row.status === 'active' ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="last_login_ip" label="最后登录IP" width="140" />
      <el-table-column prop="last_login_at" label="最后登录" width="160" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/admin/users/${row.id}`)">详情</el-button>
          <el-button size="small" @click="editQuota(row)">配额</el-button>
          <el-button size="small" :type="row.status === 'active' ? 'warning' : 'success'" @click="toggleStatus(row)">
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </el-button>
          <el-button v-if="auth.isSuperAdmin" size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > pageSize"
      style="margin-top:16px;justify-content:center"
      :current-page="page" :page-size="pageSize" :total="total"
      layout="total, prev, pager, next" @current-change="(p) => { page = p; loadUsers() }"
    />

    <el-dialog v-model="quotaDialog" title="编辑配额" width="400px">
      <el-form label-width="100px">
        <el-form-item label="总配额">
          <el-input-number v-model="quotaForm.quota_total" :min="0" />
        </el-form-item>
        <el-form-item label="日限额">
          <el-input-number v-model="quotaForm.daily_limit" :min="1" :max="10000" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quotaDialog = false">取消</el-button>
        <el-button type="primary" @click="saveQuota">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getUsers, updateUserQuota, updateUserStatus, deleteUser } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const auth = useAuthStore()
const users = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(15)
const total = ref(0)
const search = ref('')
const statusFilter = ref('')

const quotaDialog = ref(false)
const quotaForm = ref({ user_id: 0, quota_total: 0, daily_limit: 0 })

onMounted(loadUsers)

async function loadUsers() {
  loading.value = true
  try {
    const res = await getUsers({ page: page.value, pageSize: pageSize.value, search: search.value, status: statusFilter.value })
    users.value = res.data.list
    total.value = res.data.total
  } catch { } finally { loading.value = false }
}

function editQuota(user) {
  quotaForm.value = { user_id: user.id, quota_total: user.quota_total, daily_limit: user.daily_limit }
  quotaDialog.value = true
}

async function saveQuota() {
  try {
    await updateUserQuota(quotaForm.value.user_id, quotaForm.value.quota_total, quotaForm.value.daily_limit)
    ElMessage.success('配额已更新')
    quotaDialog.value = false
    loadUsers()
  } catch { ElMessage.error('更新失败') }
}

async function toggleStatus(user) {
  const newStatus = user.status === 'active' ? 'disabled' : 'active'
  try {
    await updateUserStatus(user.id, newStatus)
    ElMessage.success(newStatus === 'active' ? '已启用' : '已禁用')
    loadUsers()
  } catch { ElMessage.error('操作失败') }
}

async function handleDelete(id) {
  try {
    await ElMessageBox.confirm('确定删除该用户吗？此操作不可恢复。', '警告', { type: 'warning' })
    await deleteUser(id)
    ElMessage.success('已删除')
    loadUsers()
  } catch { }
}
</script>
