<template>
  <div>
    <h2>图生图</h2>
    <p class="desc">模型列表来自兔子 API <code>GET /v1/models</code>（与后台密钥一致）；参考图须公网 URL 或先本地上传。</p>
    <el-alert v-if="error" type="warning" :closable="false" :title="error" style="margin-bottom:12px" />
    <el-alert
      v-else-if="!loading && !imageModels.length && allCount > 0"
      type="info"
      :closable="false"
      title="上游返回了模型列表，但未匹配到图片类模型 id；可在 server/src/utils/tuziModels.js 补充分类规则。"
      style="margin-bottom:12px"
    />
    <el-row :gutter="20">
      <el-col :span="10">
        <el-card>
          <template #header>输入</template>
          <el-tabs v-model="imageMode">
            <el-tab-pane label="图片链接" name="url">
              <el-input v-model="imageUrl" placeholder="公网可访问的图片 URL" />
            </el-tab-pane>
            <el-tab-pane label="本地上传" name="upload">
              <el-upload
                class="upload-area"
                drag
                :auto-upload="false"
                :show-file-list="false"
                :on-change="handleImageChange"
                accept="image/*"
              >
                <div v-if="!uploadedImage" class="upload-placeholder">
                  <el-icon size="48"><UploadFilled /></el-icon>
                  <p>点击或拖拽上传</p>
                </div>
                <img v-else :src="uploadedImage" class="preview-img" />
              </el-upload>
              <p class="upload-hint">上传后使用站内 URL 作为参考图</p>
            </el-tab-pane>
          </el-tabs>
          <el-form style="margin-top:16px" label-position="top">
            <el-form-item label="模型">
              <el-select v-model="model" filterable style="width:100%" :loading="loading" placeholder="选择模型">
                <el-option v-for="m in imageModels" :key="m.id" :label="m.id" :value="m.id">
                  <span>{{ m.id }}</span>
                  <span v-if="m.owned_by" class="opt-sub">{{ m.owned_by }}</span>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="提示词" required>
              <el-input v-model="prompt" type="textarea" :rows="3" placeholder="描述希望如何修改参考图" />
            </el-form-item>
            <el-form-item label="尺寸（可选，按模型文档填写）">
              <el-input v-model="size" placeholder="如 1024x1024、2K、16:9" clearable />
            </el-form-item>
            <el-form-item label="生成张数 n（可选）">
              <el-input-number v-model="n" :min="1" :max="10" :step="1" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="submitting" :disabled="!canSubmit" style="width:100%" @click="handleSubmit">
                生成
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card>
          <template #header>结果</template>
          <div v-if="resultUrls.length" class="grid">
            <div v-for="(u, i) in resultUrls" :key="i" class="cell">
              <img :src="u" class="out-img" />
              <el-button size="small" link type="primary" @click="openUrl(u)">打开</el-button>
            </div>
          </div>
          <div v-else class="empty-hint">
            <el-icon size="48"><PictureFilled /></el-icon>
            <p>生成结果将显示在这里</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { imageToImage, uploadImage } from '@/api/generate'
import { useTuziModelLists } from '@/composables/useTuziModelLists'
import { ElMessage } from 'element-plus'

const { imageModels, allCount, loading, error, fetchLists } = useTuziModelLists()

const imageMode = ref('url')
const imageUrl = ref('')
const imageFile = ref(null)
const uploadedImage = ref(null)
const model = ref('')
const prompt = ref('')
const size = ref('')
const n = ref(1)
const submitting = ref(false)
const resultUrls = ref([])

const canSubmit = computed(() => {
  if (!model.value || !prompt.value.trim()) return false
  if (imageMode.value === 'url') return !!imageUrl.value.trim()
  return !!imageFile.value
})

watch(imageModels, (list) => {
  if (!list.length) return
  const ids = list.map((m) => m.id)
  if (!model.value || !ids.includes(model.value)) model.value = ids[0]
}, { immediate: true })

onMounted(() => {
  fetchLists()
})

function handleImageChange(file) {
  imageFile.value = file.raw
  const reader = new FileReader()
  reader.onload = (e) => { uploadedImage.value = e.target.result }
  reader.readAsDataURL(file.raw)
}

function openUrl(u) {
  if (u) window.open(u, '_blank')
}

async function handleSubmit() {
  submitting.value = true
  resultUrls.value = []
  try {
    let refUrl = imageMode.value === 'url' ? imageUrl.value.trim() : null
    if (imageMode.value === 'upload' && imageFile.value) {
      const up = await uploadImage(imageFile.value)
      refUrl = up.data?.url
      if (!refUrl) {
        ElMessage.error('上传失败')
        return
      }
    }
    const body = {
      model: model.value,
      prompt: prompt.value.trim(),
      image: refUrl,
    }
    if (size.value.trim()) body.size = size.value.trim()
    if (n.value >= 1 && n.value <= 10) body.n = n.value
    const res = await imageToImage(body)
    if (res.code !== 0) {
      ElMessage.error(res.message || '失败')
      return
    }
    const assets = res.data?.assets || []
    const urls = []
    for (const a of assets) {
      if (a.localUrl) urls.push(a.localUrl)
    }
    const dataArr = res.data?.data
    if (Array.isArray(dataArr)) {
      for (const row of dataArr) {
        if (row.url) urls.push(row.url)
        if (row.b64_json) urls.push(`data:image/png;base64,${row.b64_json}`)
      }
    }
    resultUrls.value = [...new Set(urls)]
    if (!resultUrls.value.length) ElMessage.warning('未解析到图片地址')
    else ElMessage.success('完成')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.desc { color: #999; margin-bottom: 16px; }
.desc code { font-size: 12px; }
.upload-area { width: 100%; }
.upload-placeholder { padding: 40px 0; text-align: center; color: #999; }
.preview-img { max-width: 100%; max-height: 280px; border-radius: 8px; }
.upload-hint { font-size: 12px; color: #ccc; margin-top: 4px; }
.opt-sub { float: right; color: #aaa; font-size: 12px; max-width: 45%; overflow: hidden; text-overflow: ellipsis; }
.grid { display: flex; flex-wrap: wrap; gap: 12px; }
.cell { text-align: center; }
.out-img { max-width: 100%; max-height: 420px; border-radius: 8px; display: block; margin: 0 auto 4px; }
.empty-hint { text-align: center; padding: 60px 0; color: #ccc; }
</style>
