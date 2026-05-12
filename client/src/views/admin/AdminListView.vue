<template>
  <div>
    <h2>子管理员</h2>
    <el-button type="primary" style="margin:16px 0" @click="showCreate = true">添加管理员</el-button>
    <el-table :data="admins" stripe>
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="email" label="邮箱" width="180" />
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
          <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreate" :title="editingId ? '编辑管理员' : '添加管理员'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
        <el-form-item v-if="!editingId" label="密码"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="form.role">
            <el-radio value="admin">管理员</el-radio>
            <el-radio value="super_admin">超级管理员</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态" v-if="editingId">
          <el-radio-group v-model="form.status">
            <el-radio value="active">正常</el-radio>
            <el-radio value="disabled">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="handleSave">{{ editingId ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { getAdmins, createAdmin, updateAdmin, deleteAdmin } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const admins = ref([])
const showCreate = ref(false)
const editingId = ref(0)
const form = reactive({ username: '', email: '', password: '', role: 'admin', status: 'active' })

onMounted(loadAdmins)

async function loadAdmins() {
  try { const res = await getAdmins(); admins.value = res.data } catch { }
}

function editAdmin(admin) {
  editingId.value = admin.id
  form.username = admin.username
  form.email = admin.email
  form.role = admin.role
  form.status = admin.status
  form.password = ''
  showCreate.value = true
}

async function handleSave() {
  try {
    if (editingId.value) {
      await updateAdmin(editingId.value, { username: form.username, email: form.email, role: form.role, status: form.status })
    } else {
      await createAdmin({ username: form.username, email: form.email, password: form.password, role: form.role })
    }
    ElMessage.success(editingId.value ? '已更新' : '已创建')
    showCreate.value = false
    editingId.value = 0
    form.username = ''; form.email = ''; form.password = ''
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
