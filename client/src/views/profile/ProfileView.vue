<template>
  <div>
    <h2>个人中心</h2>
    <el-row :gutter="20" style="margin-top:16px">
      <el-col :span="12">
        <el-card>
          <template #header>基本信息</template>
          <el-form :model="form" label-width="80px">
            <el-form-item label="用户名">
              <el-input v-model="form.username" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="form.email" disabled />
            </el-form-item>
            <el-form-item label="角色">
              <el-tag>{{ auth.user?.role === 'user' ? '普通用户' : auth.user?.role === 'admin' ? '管理员' : '超级管理员' }}</el-tag>
            </el-form-item>
            <el-form-item label="注册时间">
              <span>{{ auth.user?.created_at }}</span>
            </el-form-item>
            <el-form-item label="最后登录IP">
              <span>{{ auth.user?.last_login_ip || '暂无' }}</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSave">保存</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>修改密码</template>
          <el-form :model="pwForm" label-width="100px">
            <el-form-item label="原密码">
              <el-input v-model="pwForm.oldPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="pwForm.newPassword" type="password" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="warning" @click="handleChangePw">修改密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getProfile, updateProfile, changePassword } from '@/api/user'
import { ElMessage } from 'element-plus'

const auth = useAuthStore()
const form = reactive({ username: '', email: '' })
const pwForm = reactive({ oldPassword: '', newPassword: '' })

onMounted(async () => {
  try {
    const res = await getProfile()
    form.username = res.data.username
    form.email = res.data.email
  } catch { }
})

async function handleSave() {
  try {
    await updateProfile({ username: form.username })
    ElMessage.success('保存成功')
  } catch { ElMessage.error('保存失败') }
}

async function handleChangePw() {
  if (!pwForm.newPassword || pwForm.newPassword.length < 6) {
    return ElMessage.warning('新密码至少6位')
  }
  try {
    await changePassword(pwForm.oldPassword, pwForm.newPassword)
    ElMessage.success('密码修改成功')
    pwForm.oldPassword = ''
    pwForm.newPassword = ''
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '修改失败')
  }
}
</script>
