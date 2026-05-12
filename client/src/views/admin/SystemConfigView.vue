<template>
  <div>
    <h2>系统设置</h2>
    <el-table :data="configs" stripe style="margin-top:16px">
      <el-table-column prop="key" label="Key" width="200" />
      <el-table-column prop="value" label="Value">
        <template #default="{ row }">
          <template v-if="editingKey === row.key">
            <el-input v-model="editValue" />
            <el-button size="small" type="primary" style="margin-left:8px" @click="saveConfig(row.key)">保存</el-button>
            <el-button size="small" @click="editingKey = ''">取消</el-button>
          </template>
          <template v-else>
            {{ isSensitive(row.key) ? '••••••••' : row.value }}
          </template>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="说明" width="200" />
      <el-table-column prop="updated_at" label="更新时间" width="160" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button size="small" @click="startEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-card style="margin-top:20px">
      <template #header>添加配置</template>
      <el-form :inline="true">
        <el-form-item label="Key"><el-input v-model="newKey" placeholder="配置键" /></el-form-item>
        <el-form-item label="Value"><el-input v-model="newValue" placeholder="配置值" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="newDesc" placeholder="说明" /></el-form-item>
        <el-form-item><el-button type="primary" @click="addConfig">添加</el-button></el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getSystemConfig, updateSystemConfig } from '@/api/admin'
import { ElMessage } from 'element-plus'

const configs = ref([])
const editingKey = ref('')
const editValue = ref('')
const newKey = ref('')
const newValue = ref('')
const newDesc = ref('')

onMounted(loadConfigs)

async function loadConfigs() {
  try { const res = await getSystemConfig(); configs.value = res.data } catch { }
}

function isSensitive(key) {
  return key.includes('key') || key.includes('secret') || key.includes('token')
}

function startEdit(row) {
  editingKey.value = row.key
  editValue.value = row.value
}

async function saveConfig(key) {
  try {
    await updateSystemConfig(key, editValue.value, undefined)
    ElMessage.success('已保存')
    editingKey.value = ''
    loadConfigs()
  } catch { ElMessage.error('保存失败') }
}

async function addConfig() {
  if (!newKey.value) return ElMessage.warning('请输入Key')
  try {
    await updateSystemConfig(newKey.value, newValue.value, newDesc.value)
    ElMessage.success('已添加')
    newKey.value = ''; newValue.value = ''; newDesc.value = ''
    loadConfigs()
  } catch { ElMessage.error('添加失败') }
}
</script>
