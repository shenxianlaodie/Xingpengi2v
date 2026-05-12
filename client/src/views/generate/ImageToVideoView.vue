<template>
  <div>
    <h2>图生视频</h2>
    <p class="desc">单张或链接生成；批量模式按顺序逐张使用同一套提示词与参数生成，完成后可分别下载。</p>
    <el-alert v-if="modelsError" type="warning" :closable="false" :title="modelsError" style="margin-bottom:12px" />
    <el-row :gutter="20">
      <el-col :span="10">
        <el-card>
          <template #header>输入</template>
          <el-tabs v-model="imageMode">
            <el-tab-pane label="图片链接" name="url">
              <el-input v-model="imageUrl" placeholder="输入图片 URL（需公网可访问）" />
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
                  <p>点击或拖拽上传图片</p>
                </div>
                <img v-else :src="uploadedImage" class="preview-img" />
              </el-upload>
              <p class="upload-hint">本地文件将上传至服务器后作为 URL 提交</p>
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
          </el-tabs>
          <el-form style="margin-top:16px" label-position="top">
            <el-form-item label="模型">
              <el-select v-model="model" filterable style="width:100%" :loading="modelsLoading" placeholder="选择模型">
                <el-option v-for="m in videoModels" :key="m.id" :label="m.id" :value="m.id">
                  <span>{{ m.id }}</span>
                  <span v-if="m.owned_by" style="float:right;color:#aaa;font-size:12px">{{ m.owned_by }}</span>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="动作描述（可选）">
              <el-input v-model="prompt" type="textarea" :rows="2" placeholder="描述你希望的运动效果..." />
            </el-form-item>
            <el-form-item label="视频时长（秒）">
              <el-slider v-model="duration" :min="4" :max="12" :step="4" show-input show-stops />
            </el-form-item>
            <el-form-item label="画面比例">
              <el-select v-model="videoAspect" style="width:100%">
                <el-option label="16:9 横屏" value="16:9" />
                <el-option label="9:16 竖屏" value="9:16" />
                <el-option label="4:3" value="4:3" />
                <el-option label="3:4" value="3:4" />
                <el-option label="1:1 正方形" value="1:1" />
                <el-option label="21:9 超宽" value="21:9" />
                <el-option label="与参考图一致（keep_ratio）" value="keep_ratio" />
                <el-option label="自适应（adaptive）" value="adaptive" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button
                v-if="imageMode !== 'batch'"
                type="success"
                :loading="submitting"
                :disabled="!canGenerate"
                @click="handleGenerate"
                style="width:100%"
              >
                {{ submitting ? '提交中...' : '生成视频' }}
              </el-button>
              <el-button
                v-else
                type="success"
                :loading="batchSubmitting"
                :disabled="!canGenerate"
                @click="handleBatchGenerate"
                style="width:100%"
              >
                {{ batchSubmitting ? '批量生成中...' : `批量生成（${batchUploadList.length} 张）` }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card>
          <template #header>生成结果</template>
          <template v-if="imageMode !== 'batch'">
            <div v-if="taskStatus === 'queued' || taskStatus === 'in_progress'" class="loading-area">
              <el-icon class="is-loading" size="48"><Loading /></el-icon>
              <p>视频生成中...</p>
              <el-progress :percentage="pollProgress" :stroke-width="12" />
              <p class="hint">视频生成需要约 1～3 分钟，请耐心等待</p>
            </div>
            <div v-else-if="taskStatus === 'completed' && resultVideo" class="result-area">
              <video :src="resultVideo" controls style="max-width:100%;max-height:400px;border-radius:8px" />
              <el-button style="margin-top:8px" @click="downloadVideo">下载视频</el-button>
            </div>
            <div v-else-if="taskStatus === 'failed'" class="loading-area">
              <el-icon size="48" color="#f56c6c"><CircleCloseFilled /></el-icon>
              <p style="color:#f56c6c">生成失败：{{ errorMessage }}</p>
            </div>
            <div v-else class="empty-hint">
              <el-icon size="48"><VideoCameraFilled /></el-icon>
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
                    <el-button v-if="row.videoUrl" type="primary" link size="small" @click="openUrl(row.videoUrl)">打开</el-button>
                    <span v-else-if="row.error" class="err-cell">{{ row.error }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-if="!batchSubmitting && !batchResults.length" class="empty-hint">
              <el-icon size="48"><VideoCameraFilled /></el-icon>
              <p>批量任务结果将显示在这里</p>
            </div>
          </template>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted, onMounted, watch } from 'vue'
import { imageToVideo, getTaskStatus, uploadImage } from '@/api/generate'
import { useTuziModelLists } from '@/composables/useTuziModelLists'
import { ElMessage } from 'element-plus'

const { videoModels, loading: modelsLoading, error: modelsError, fetchLists } = useTuziModelLists()

const imageMode = ref('url')
const imageUrl = ref('')
const uploadedImage = ref(null)
const imageFile = ref(null)
const batchUploadList = ref([])
const model = ref('doubao-seedance-1-5-pro_720p')
const prompt = ref('')
const duration = ref(8)
const videoAspect = ref('9:16')
const submitting = ref(false)
const taskStatus = ref('')
const taskId = ref('')
const resultVideo = ref(null)
const errorMessage = ref('')
const pollProgress = ref(0)
let pollTimer = null

const batchSubmitting = ref(false)
const batchPhase = ref('')
const batchProgressPct = ref(0)
const batchResults = ref([])

const canGenerate = computed(() => {
  if (imageMode.value === 'url') return !!imageUrl.value
  if (imageMode.value === 'upload') return !!imageFile.value
  return batchUploadList.value.length > 0
})

watch(videoModels, (list) => {
  if (!list.length) return
  const ids = list.map((m) => m.id)
  if (!ids.includes(model.value)) model.value = ids[0]
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

function openUrl(url) {
  if (url) window.open(url, '_blank')
}

function downloadVideo() {
  openUrl(resultVideo.value)
}

async function waitVideoTask(taskId) {
  const started = Date.now()
  const maxMs = 25 * 60 * 1000
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      if (Date.now() - started > maxMs) {
        clearInterval(timer)
        resolve({ ok: false, err: '等待结果超时' })
        return
      }
      try {
        const res = await getTaskStatus(taskId)
        const data = res.data || res
        const st = data.status
        if (st === 'completed') {
          clearInterval(timer)
          resolve({ ok: true, url: data.video_url || data.result?.url })
        } else if (st === 'failed' || st === 'error') {
          clearInterval(timer)
          resolve({ ok: false, err: data.error || data.error_message || '生成失败' })
        }
      } catch {
        /* 继续轮询 */
      }
    }, 3000)
  })
}

async function handleGenerate() {
  submitting.value = true
  taskStatus.value = ''
  try {
    let finalImageUrl = imageMode.value === 'url' ? imageUrl.value : null
    if (imageMode.value === 'upload' && imageFile.value) {
      const uploadRes = await uploadImage(imageFile.value)
      finalImageUrl = uploadRes.data?.url
      if (!finalImageUrl) {
        ElMessage.error('图片上传失败，请使用图片链接')
        return
      }
    }
    const res = await imageToVideo({
      model: model.value,
      prompt: prompt.value || 'make it move',
      image_url: finalImageUrl,
      seconds: duration.value,
      size: videoAspect.value,
    })
    if (res.code === 0 && res.data.task_id) {
      taskId.value = res.data.task_id
      taskStatus.value = 'queued'
      pollProgress.value = 0
      startPolling()
      ElMessage.success('任务已提交')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

function startPolling() {
  let elapsed = 0
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    try {
      elapsed += 3
      const res = await getTaskStatus(taskId.value)
      const data = res.data || res
      const status = data.status
      if (data.progress !== undefined) {
        pollProgress.value = data.progress
      } else {
        pollProgress.value = Math.min(Math.round(elapsed / 120 * 100), 95)
      }
      if (status === 'completed') {
        clearInterval(pollTimer)
        pollTimer = null
        taskStatus.value = 'completed'
        pollProgress.value = 100
        resultVideo.value = data.video_url || data.result?.url
        ElMessage.success('视频生成完成')
      } else if (status === 'failed' || status === 'error') {
        clearInterval(pollTimer)
        pollTimer = null
        taskStatus.value = 'failed'
        errorMessage.value = data.error || data.error_message || '生成失败'
      } else {
        taskStatus.value = status || 'processing'
      }
    } catch {
      /* 继续轮询 */
    }
  }, 3000)
}

async function handleBatchGenerate() {
  const list = batchUploadList.value.map((u) => u.raw).filter(Boolean)
  if (!list.length) return
  batchSubmitting.value = true
  batchResults.value = []
  batchProgressPct.value = 0
  const total = list.length
  const basePrompt = prompt.value || 'make it move'
  try {
    for (let i = 0; i < total; i++) {
      const file = list[i]
      const name = file.name || `图片${i + 1}`
      batchPhase.value = `正在处理 ${i + 1}/${total}：${name}`
      batchProgressPct.value = Math.round((i / total) * 100)
      try {
        const uploadRes = await uploadImage(file)
        const finalImageUrl = uploadRes.data?.url
        if (!finalImageUrl) throw new Error('上传失败')
        const res = await imageToVideo({
          model: model.value,
          prompt: basePrompt,
          image_url: finalImageUrl,
          seconds: duration.value,
          size: videoAspect.value,
        })
        if (res.code !== 0 || !res.data?.task_id) throw new Error(res.message || '提交失败')
        const done = await waitVideoTask(res.data.task_id)
        if (done.ok) {
          batchResults.value.push({
            index: i + 1,
            name,
            status: '完成',
            videoUrl: done.url,
            error: '',
          })
        } else {
          batchResults.value.push({
            index: i + 1,
            name,
            status: '失败',
            videoUrl: '',
            error: done.err || '失败',
          })
        }
      } catch (e) {
        batchResults.value.push({
          index: i + 1,
          name,
          status: '失败',
          videoUrl: '',
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

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.desc { color: #999; margin-bottom: 16px; }
.upload-area { width: 100%; }
.upload-placeholder { padding: 40px 0; text-align: center; color: #999; }
.preview-img { max-width: 100%; max-height: 300px; border-radius: 8px; }
.upload-hint { font-size: 12px; color: #ccc; margin-top: 4px; }
.loading-area { text-align: center; padding: 40px 0; color: #999; }
.hint { font-size: 12px; color: #ccc; margin-top: 8px; }
.result-area { text-align: center; padding: 20px 0; }
.empty-hint { text-align: center; padding: 60px 0; color: #ccc; }
.batch-table-wrap { margin-top: 8px; }
.err-cell { color: #f56c6c; font-size: 12px; }
</style>
