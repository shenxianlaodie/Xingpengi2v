<template>
  <div>
    <h2>子管理员</h2>
    <el-button type="primary" style="margin:16px 0" @click="openPromote">提升用户为管理员</el-button>
    <el-table :data="admins" stripe>
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="email" label="邮箱" width="220" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === 'super_admin' ? 'danger' : 'primary'" size="small">
            {{ row.role === 'super_admin' ? '超级管理员' : '管理员' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="last_login_ip" label="最后登录IP" width="140" />
      <el-table-column prop="last_login_at" label="最后登录" width="160" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">{{ row.status === 'active' ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="editAdmin(row)">编辑</el-button>
          <el-button v-if="row.role !== 'super_admin'" size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Promote Dialog -->
    <el-dialog v-model="showPromote" title="提升用户为管理员" width="640px">
      <el-input v-model="userSearch" placeholder="搜索用户名或邮箱" clearable style="margin-bottom:12px" />
      <el-table :data="filteredUsers" stripe highlight-current-row @current-change="selectUser" max-height="320">
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="email" label="邮箱" show-overflow-tooltip />
        <el-table-column prop="created_at" label="注册时间" width="160" />
      </el-table>
      <el-pagination
        v-if="userTotal > pageSize"
        style="margin-top:12px;justify-content:center"
        background layout="prev,next"
        :total="userTotal" :page-size="pageSize"
        :current-page="userPage" @current-change="loadUsers"
      />
      <el-form v-if="selectedUser" :model="promoteForm" label-width="80px" style="margin-top:16px;border-top:1px solid #eee;padding-top:16px">
        <el-form-item label="选中用户">
          <span>{{ selectedUser.username }} ({{ selectedUser.email }})</span>
        </el-form-item>
        <el-form-item label="管理员密码">
          <el-input v-model="promoteForm.password" type="password" show-password placeholder="为该用户设置登录密码" />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="promoteForm.role">
            <el-radio value="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPromote = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedUser || !promoteForm.password" @click="handlePromote">提升</el-button>
      </template>
    </el-dialog>

    <!-- Edit Dialog -->
    <el-dialog v-model="showEdit" title="编辑管理员" width="480px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="用户名"><el-input v-model="editForm.username" /></el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="editForm.role">
            <el-radio value="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio value="active">正常</el-radio>
            <el-radio value="disabled">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { getAdmins, promoteToAdmin, updateAdmin, deleteAdmin } from '@/api/admin'
import { getUsers } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const admins = ref([])

// Promote
const showPromote = ref(false)
const users = ref([])
const userTotal = ref(0)
const userPage = ref(1)
const pageSize = 20
const userSearch = ref('')
const selectedUser = ref(null)
const promoteForm = reactive({ password: '', role: 'admin' })

const filteredUsers = computed(() => {
  if (!userSearch.value) return users.value
  const kw = userSearch.value.toLowerCase()
  return users.value.filter(u => (u.username || '').toLowerCase().includes(kw) || (u.email || '').toLowerCase().includes(kw))
})

// Edit
const showEdit = ref(false)
const editingId = ref(0)
const editForm = reactive({ username: '', role: 'admin', status: 'active' })

onMounted(() => { loadAdmins() })

async function loadAdmins() {
  try { const res = await getAdmins(); admins.value = res.data } catch { }
}

async function loadUsers(page = 1) {
  userPage.value = page
  try {
    const res = await getUsers({ page, pageSize, exclude_admins: true })
    users.value = res.data.list
    userTotal.value = res.data.total
  } catch { }
}

function openPromote() {
  showPromote.value = true
  selectedUser.value = null
  promoteForm.password = ''
  promoteForm.role = 'admin'
  userSearch.value = ''
  loadUsers(1)
}

function selectUser(user) {
  selectedUser.value = user
}

async function handlePromote() {
  try {
    await promoteToAdmin(selectedUser.value.id, promoteForm.password, promoteForm.role)
    ElMessage.success('已提升为管理员')
    showPromote.value = false
    loadAdmins()
  } catch (err) { ElMessage.error(err.response?.data?.message || '操作失败') }
}

function editAdmin(admin) {
  editingId.value = admin.id
  editForm.username = admin.username
  editForm.role = admin.role === 'super_admin' ? 'super_admin' : 'admin'
  editForm.status = admin.status
  showEdit.value = true
}

async function handleSaveEdit() {
  try {
    await updateAdmin(editingId.value, { username: editForm.username, role: editForm.role, status: editForm.status })
    ElMessage.success('已更新')
    showEdit.value = false
    loadAdmins()
  } catch (err) { ElMessage.error(err.response?.data?.message || '操作失败') }
}

async function handleDelete(id) {
  try {
    await ElMessageBox.confirm('确定删除该管理员吗？', '提示', { type: 'warning' })
    await deleteAdmin(id)
    ElMessage.success('已删除')
    loadAdmins()
  } catch { }
}
</script>
