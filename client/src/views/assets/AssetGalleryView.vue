<template>
  <div>
    <h2>作品库</h2>
    <el-radio-group v-model="filterType" style="margin:16px 0" @change="loadAssets">
      <el-radio-button value="">全部</el-radio-button>
      <el-radio-button value="image">图片</el-radio-button>
      <el-radio-button value="video">视频</el-radio-button>
    </el-radio-group>
    <div v-if="loading" style="text-align:center;padding:60px 0">
      <el-icon class="is-loading" size="32"><Loading /></el-icon>
    </div>
    <div v-else-if="assets.length === 0" style="text-align:center;padding:60px 0;color:#ccc">
      <el-icon size="48"><FolderOpened /></el-icon>
      <p>暂无作品，去生成一些吧</p>
    </div>
    <div v-else class="gallery-grid">
      <div v-for="asset in assets" :key="asset.id" class="asset-card">
        <img v-if="asset.asset_type === 'image'" :src="getAssetUrl(asset)" />
        <video v-else :src="getAssetUrl(asset)" controls />
        <div class="asset-info">
          <span>{{ asset.asset_type === 'video' ? '视频' : '图片' }}</span>
          <span>{{ asset.created_at?.slice(0, 10) }}</span>
        </div>
        <div class="asset-actions">
          <el-button size="small" circle @click="downloadAsset(asset)"><el-icon><Download /></el-icon></el-button>
          <el-button size="small" circle type="danger" @click="handleDelete(asset.id)"><el-icon><Delete /></el-icon></el-button>
        </div>
      </div>
    </div>
    <el-pagination
      v-if="total > pageSize"
      style="margin-top:20px;justify-content:center"
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="prev, pager, next"
      @current-change="(p) => { page = p; loadAssets() }"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getUserAssets, deleteAsset } from '@/api/user'
import { ElMessage, ElMessageBox } from 'element-plus'

const assets = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filterType = ref('')

onMounted(() => loadAssets())

async function loadAssets() {
  loading.value = true
  try {
    const res = await getUserAssets(page.value, pageSize.value, filterType.value || undefined)
    assets.value = res.data.list
    total.value = res.data.total
  } catch { } finally { loading.value = false }
}

function getAssetUrl(asset) {
  if (asset.cached_path) return `/api/assets/${asset.id}/file`
  return asset.source_url || ''
}

function downloadAsset(asset) {
  window.open(getAssetUrl(asset), '_blank')
}

async function handleDelete(id) {
  try {
    await ElMessageBox.confirm('确定删除该作品吗？', '提示', { type: 'warning' })
    await deleteAsset(id)
    ElMessage.success('已删除')
    loadAssets()
  } catch { }
}
</script>

<style scoped>
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.asset-card { background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); position: relative; }
.asset-card img, .asset-card video { width: 100%; height: 200px; object-fit: cover; }
.asset-info { padding: 8px 12px; display: flex; justify-content: space-between; font-size: 12px; color: #999; }
.asset-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity .2s; }
.asset-card:hover .asset-actions { opacity: 1; }
</style>
