<template>
  <div>
    <h2>API 密钥</h2>
    <p class="desc">管理你的 API 密钥，用于通过 API 接口调用 AI 服务</p>
    <el-button type="primary" style="margin-bottom:16px" @click="showCreateDialog = true">创建新密钥</el-button>
    <el-table :data="keys" stripe>
      <el-table-column prop="key_prefix" label="密钥" width="200">
        <template #default="{ row }">{{ row.key_prefix }}****</template>
      </el-table-column>
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="quota_used" label="已用次数" width="100" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">{{ row.status === 'active' ? '正常' : '已撤销' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button v-if="row.status === 'active'" size="small" type="danger" @click="handleRevoke(row.id)">撤销</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="创建 API 密钥" width="500px">
      <el-form>
        <el-form-item label="密钥名称">
          <el-input v-model="newKeyName" placeholder="给密钥起个名字" />
        </el-form-item>
      </el-form>
      <div v-if="newKey" class="new-key-display">
        <p style="color:#e6a23c;margin-bottom:8px">请立即复制保存此密钥，关闭后无法再次查看！</p>
        <el-input v-model="newKey" readonly>
          <template #append>
            <el-button @click="copyKey">复制</el-button>
          </template>
        </el-input>
      </div>
      <template #footer>
        <el-button v-if="!newKey" type="primary" @click="handleCreate">创建</el-button>
        <el-button v-else @click="showCreateDialog = false; newKey = ''">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getApiKeys, createApiKey, deleteApiKey } from '@/api/user'
import { ElMessage, ElMessageBox } from 'element-plus'

const keys = ref([])
const showCreateDialog = ref(false)
const newKeyName = ref('')
const newKey = ref('')

onMounted(loadKeys)

async function loadKeys() {
  try { const res = await getApiKeys(); keys.value = res.data } catch { }
}

async function handleCreate() {
  try {
    const res = await createApiKey(newKeyName.value || 'Default')
    newKey.value = res.data.rawKey
    loadKeys()
  } catch { ElMessage.error('创建失败') }
}

async function handleRevoke(id) {
  try {
    await ElMessageBox.confirm('确定撤销该密钥吗？撤销后不可恢复。', '提示', { type: 'warning' })
    await deleteApiKey(id)
    ElMessage.success('已撤销')
    loadKeys()
  } catch { }
}

function copyKey() {
  navigator.clipboard.writeText(newKey.value)
  ElMessage.success('已复制到剪贴板')
}
</script>

<style scoped>
.desc { color: #999; margin-bottom: 8px; }
.new-key-display { margin-top: 16px; }
</style>
