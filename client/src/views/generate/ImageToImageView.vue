<template>
  <div>
    <h2>图生图</h2>
    <p class="desc">模型列表来自兔子 API；单张或批量本地上传的图由<strong>服务端读盘并转成 base64</strong>再发给兔子（兔子服务器拉不到你本机/内网的 http 地址）。图片链接需公网可访问。</p>
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
              <p class="upload-hint">上传文件在服务端转为 base64 参与图生图，无需公网</p>
            </el-tab-pane>
            <el-tab-pane label="批量本地上传" name="batch">
              <el-upload
                class="upload-area"
                drag
                multiple
                :auto-upload="false"
                accept="image/*"
                :on-change="handleBatchChange"
                :on-remove="handleBatchRemove"
              >
                <el-icon class="el-icon--upload" size="48"><UploadFilled /></el-icon>
                <div class="el-upload__text">拖拽多张图片到此处，或点击选择</div>
              </el-upload>
              <p class="upload-hint">按列表顺序逐张生成，共用下方提示词与参数</p>
            </el-tab-pane>
            <el-tab-pane label="图片链接" name="url">
              <el-input v-model="imageUrl" placeholder="公网可访问的图片 URL" />
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
            <el-form-item label="尺寸（可选）">
              <div class="size-chips">
                <el-button size="small" :type="size === '' ? 'primary' : 'default'" @click="size = ''">默认（不传）</el-button>
                <el-button
                  v-for="opt in sizePresetOptions"
                  :key="opt.value"
                  size="small"
                  :type="size === opt.value ? 'primary' : 'default'"
                  @click="size = opt.value"
                >
                  {{ opt.label }}
                </el-button>
              </div>
            </el-form-item>
            <el-form-item label="生成张数 n（可选）">
              <el-input-number v-model="n" :min="1" :max="10" :step="1" />
            </el-form-item>
            <el-form-item>
              <el-button
                v-if="imageMode !== 'batch'"
                type="primary"
                :loading="submitting"
                :disabled="!canSubmit"
                style="width:100%"
                @click="handleSubmit"
              >
                {{ submitting ? '生成中...' : '生成' }}
              </el-button>
              <el-button
                v-else
                type="primary"
                :loading="batchSubmitting"
                :disabled="!canSubmit"
                style="width:100%"
                @click="handleBatchGenerate"
              >
                {{ batchSubmitting ? '批量生成中...' : `批量生成（${batchUploadList.length} 张）` }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card>
          <template #header>结果</template>
          <template v-if="imageMode !== 'batch'">
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
          </template>
          <template v-else>
            <div v-if="batchSubmitting" class="loading-area">
              <el-icon class="is-loading" size="48"><Loading /></el-icon>
              <p>{{ batchPhase }}</p>
              <el-progress :percentage="batchProgressPct" :stroke-width="12" />
            </div>
            <div v-if="batchResults.length" class="batch-table-wrap">
              <el-table :data="batchResults" size="small" border>
                <el-table-column prop="index" label="#" width="48" />
                <el-table-column prop="name" label="文件" min-width="120" show-overflow-tooltip />
                <el-table-column prop="status" label="状态" width="88" />
                <el-table-column label="操作" width="100">
                  <template #default="{ row }">
                    <el-button v-if="row.imageUrl" type="primary" link size="small" @click="openUrl(row.imageUrl)">打开</el-button>
                    <span v-else-if="row.error" class="err-cell">{{ row.error }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-if="!batchSubmitting && !batchResults.length" class="empty-hint">
              <el-icon size="48"><PictureFilled /></el-icon>
              <p>批量任务结果将显示在这里</p>
            </div>
          </template>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { submitImageToImageJob, getImageJob, uploadImage } from '@/api/generate'
import { useTuziModelLists } from '@/composables/useTuziModelLists'
import { getImageGenSizePresets } from '@/utils/imageGenSizePresets'
import { ElMessage } from 'element-plus'

const { imageModels, allCount, loading, error, fetchLists } = useTuziModelLists()

const imageMode = ref('upload')
const imageUrl = ref('')
const imageFile = ref(null)
const uploadedImage = ref(null)
const batchUploadList = ref([])
const model = ref('')
const prompt = ref('')
const size = ref('')

const sizePresetOptions = computed(() => getImageGenSizePresets(model.value))

watch(model, (mid) => {
  const opts = getImageGenSizePresets(mid)
  if (size.value && !opts.some((o) => o.value === size.value)) size.value = ''
})
const n = ref(1)
const submitting = ref(false)
const resultUrls = ref([])

const batchSubmitting = ref(false)
const batchPhase = ref('')
const batchProgressPct = ref(0)
const batchResults = ref([])

const canSubmit = computed(() => {
  if (!model.value || !prompt.value.trim()) return false
  if (imageMode.value === 'url') return !!imageUrl.value.trim()
  if (imageMode.value === 'upload') return !!imageFile.value
  return batchUploadList.value.length > 0
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

function handleBatchChange(_uploadFile, uploadFiles) {
  batchUploadList.value = [...uploadFiles]
}

function handleBatchRemove(_uploadFile, uploadFiles) {
  batchUploadList.value = [...uploadFiles]
}

function openUrl(u) {
  if (u) window.open(u, '_blank')
}

async function waitImageJob(jobId) {
  const deadline = Date.now() + 30 * 60 * 1000
  while (Date.now() < deadline) {
    try {
      const r = await getImageJob(jobId)
      if (r.code !== 0) return { ok: false, err: r.message || '查询失败' }
      const d = r.data
      if (d.status === 'completed' && d.result) return { ok: true, data: d.result }
      if (d.status === 'failed') return { ok: false, err: d.error || '失败' }
    } catch (e) {
      return { ok: false, err: e.response?.data?.message || e.message || '查询失败' }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  return { ok: false, err: '等待结果超时' }
}

function collectUrlsFromRes(res) {
  const urls = []
  if (!res || res.code !== 0) return urls
  const assets = res.data?.assets || []
  const fromAssets = assets.map((a) => a.localUrl).filter(Boolean)
  if (fromAssets.length > 0) {
    return [...new Set(fromAssets)]
  }
  const dataArr = res.data?.data
  if (Array.isArray(dataArr)) {
    const seen = new Set()
    for (const row of dataArr) {
      if (row.url && !seen.has(row.url)) {
        seen.add(row.url)
        urls.push(row.url)
      }
      if (row.b64_json) urls.push(`data:image/png;base64,${row.b64_json}`)
    }
  }
  return [...new Set(urls)]
}

function buildBody(refUrl) {
  const body = {
    model: model.value,
    prompt: prompt.value.trim(),
    image: refUrl,
  }
  if (size.value.trim()) body.size = size.value.trim()
  if (n.value >= 1 && n.value <= 10) body.n = n.value
  return body
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
    const submit = await submitImageToImageJob(buildBody(refUrl))
    if (submit.code !== 0) {
      ElMessage.error(submit.message || '提交失败')
      return
    }
    const jobId = submit.data?.job_id
    if (!jobId) {
      ElMessage.error('未返回任务 id')
      return
    }
    const done = await waitImageJob(jobId)
    if (!done.ok) {
      ElMessage.error(done.err)
      return
    }
    resultUrls.value = collectUrlsFromRes({ code: 0, data: done.data })
    if (!resultUrls.value.length) ElMessage.warning('未解析到图片地址')
    else ElMessage.success('完成')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '失败')
  } finally {
    submitting.value = false
  }
}

async function handleBatchGenerate() {
  const list = batchUploadList.value.map((u) => u.raw).filter(Boolean)
  if (!list.length) return
  batchSubmitting.value = true
  batchResults.value = []
  batchProgressPct.value = 0
  const total = list.length
  try {
    for (let i = 0; i < total; i++) {
      const file = list[i]
      const name = file.name || `图片${i + 1}`
      batchPhase.value = `正在处理 ${i + 1}/${total}：${name}`
      batchProgressPct.value = Math.round((i / total) * 100)
      try {
        const uploadRes = await uploadImage(file)
        const refUrl = uploadRes.data?.url
        if (!refUrl) throw new Error('上传失败')
        const submit = await submitImageToImageJob(buildBody(refUrl))
        if (submit.code !== 0) throw new Error(submit.message || '提交失败')
        const jobId = submit.data?.job_id
        if (!jobId) throw new Error('未返回任务 id')
        const done = await waitImageJob(jobId)
        if (!done.ok) throw new Error(done.err)
        const urls = collectUrlsFromRes({ code: 0, data: done.data })
        if (!urls.length) throw new Error('未解析到图片地址')
        batchResults.value.push({
          index: i + 1,
          name,
          status: '完成',
          imageUrl: urls[0],
          error: '',
        })
      } catch (e) {
        batchResults.value.push({
          index: i + 1,
          name,
          status: '失败',
          imageUrl: '',
          error: e.response?.data?.message || e.message || '错误',
        })
      }
    }
    batchProgressPct.value = 100
    batchPhase.value = '全部结束'
    ElMessage.success('批量任务已结束')
  } finally {
    batchSubmitting.value = false
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
.loading-area { text-align: center; padding: 40px 0; color: #999; }
.batch-table-wrap { margin-top: 8px; }
.err-cell { color: #f56c6c; font-size: 12px; }
.size-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
</style>
