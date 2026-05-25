<template>
  <div class="auth-page">
    <div class="auth-card">
      <img src="/logo.png" alt="兴鹏API" class="logo-img" />
      <h1>兴鹏API</h1>
      <p class="subtitle">AI视频生成平台</p>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleLogin">
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" native-type="submit" style="width:100%">登录</el-button>
        </el-form-item>
      </el-form>

      <div class="divider">
        <span>其他登录方式</span>
      </div>

      <div class="social-login">
        <el-button class="dingtalk-btn" @click="startDingtalkLogin">
          <svg class="dingtalk-icon" viewBox="0 0 24 24" width="20" height="20" fill="#1677ff">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.49 7.11l-3.14 4.16c-.23.3-.59.45-.97.38-.23-.04-.43-.18-.57-.38l-1.45-1.92c-.1-.13-.26-.2-.43-.17-.24.05-.4.26-.4.51v2.27c0 .28-.22.5-.5.5s-.5-.22-.5-.5V9.85c0-.37.29-.67.65-.67.27 0 .5.16.6.4l1.55 2.03c.07.1.21.1.28 0l3.14-4.16c.1-.13.26-.2.43-.17.24.05.4.26.4.51v3.1c0 .28-.22.5-.5.5s-.5-.22-.5-.5V7.3c0-.37.29-.67.65-.67.27 0 .5.16.6.4z"/>
          </svg>
          钉钉扫码登录
        </el-button>
      </div>

          </div>

    <!-- QR Code Dialog -->
    <el-dialog v-model="qrVisible" title="钉钉扫码登录" width="360px" :close-on-click-modal="false" center>
      <div class="qr-wrapper">
        <div v-if="qrPolling" class="qr-loading">
          <canvas ref="qrCanvas" class="qr-canvas"></canvas>
          <p class="qr-tip">请使用钉钉扫描二维码</p>
        </div>
        <div v-else-if="qrSuccess" class="qr-success">
          <p class="qr-success-icon">✅</p>
          <p>登录成功，正在跳转...</p>
        </div>
        <div v-else class="qr-error">
          <p class="qr-error-icon">❌</p>
          <p>{{ qrError }}</p>
          <el-button size="small" @click="startDingtalkLogin">重新获取</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { getDingtalkUrl, checkDingtalkStatus } from '@/api/auth'
import QRCode from 'qrcode'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const formRef = ref(null)
const form = reactive({ email: '', password: '' })
const rules = {
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const data = await auth.login(form.email, form.password)
    ElMessage.success('登录成功')
    redirectAfterLogin(data.user)
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '登录失败')
  } finally {
    loading.value = false
  }
}

function redirectAfterLogin(user) {
  if (user.role === 'admin' || user.role === 'super_admin') {
    router.push('/admin/dashboard')
  } else {
    router.push('/dashboard')
  }
}

// DingTalk QR login
const qrVisible = ref(false)
const qrCanvas = ref(null)
const qrPolling = ref(false)
const qrSuccess = ref(false)
const qrError = ref('')
let pollTimer = null

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

async function startDingtalkLogin() {
  qrVisible.value = true
  qrPolling.value = true
  qrSuccess.value = false
  qrError.value = ''

  try {
    const res = await getDingtalkUrl()
    const state = res.data.state

    await nextTick()
    if (qrCanvas.value) {
      await QRCode.toCanvas(qrCanvas.value, res.data.url, { width: 240 })
    }

    // Poll for completion
    pollTimer = setInterval(async () => {
      try {
        const statusRes = await checkDingtalkStatus(state)
        if (statusRes.data.accessToken) {
          clearInterval(pollTimer)
          pollTimer = null
          qrPolling.value = false
          qrSuccess.value = true
          auth.applyLoginData(statusRes.data)
          setTimeout(() => {
            qrVisible.value = false
            ElMessage.success('登录成功')
            redirectAfterLogin(statusRes.data.user)
          }, 800)
        } else if (statusRes.data.status === 'done') {
          // Should not reach here normally
        }
      } catch {
        // State expired or error — stop polling
        clearInterval(pollTimer)
        pollTimer = null
        qrPolling.value = false
        qrError.value = '二维码已过期，请重新获取'
      }
    }, 2000)
  } catch (err) {
    qrPolling.value = false
    qrError.value = err.response?.data?.message || '获取二维码失败'
  }
}
</script>

<style scoped>
.auth-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); }
.auth-card { width: 400px; padding: 40px; background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.3); }
.logo-img { display: block; width: 64px; height: 64px; margin: 0 auto 12px; border-radius: 12px; }
.auth-card h1 { text-align: center; margin: 0 0 4px; color: #1a1a2e; }
.subtitle { text-align: center; color: #999; margin-bottom: 24px; }

.divider { display: flex; align-items: center; margin: 20px 0; color: #bbb; font-size: 13px; }
.divider::before, .divider::after { content: ''; flex: 1; border-top: 1px solid #eee; }
.divider span { padding: 0 12px; }

.social-login { text-align: center; margin-bottom: 20px; }
.dingtalk-btn {
  width: 100%; height: 44px; font-size: 15px;
  border: 1px solid #d9ecff; background: #f0f7ff; color: #1677ff;
}
.dingtalk-btn:hover { border-color: #1677ff; background: #e6f4ff; }
.dingtalk-icon { margin-right: 6px; vertical-align: middle; }

.link { text-align: center; color: #999; }
.link a { color: #409eff; }

.qr-wrapper { text-align: center; padding: 20px 0; }
.qr-canvas { border: 1px solid #eee; border-radius: 8px; }
.qr-tip { margin-top: 12px; color: #999; font-size: 14px; }
.qr-success, .qr-error { padding: 20px 0; }
.qr-success-icon, .qr-error-icon { font-size: 40px; margin-bottom: 8px; }
.qr-success p, .qr-error p { color: #666; margin-bottom: 12px; }
</style>
