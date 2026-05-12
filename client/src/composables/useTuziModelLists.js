import { ref } from 'vue'
import { listTuziModels } from '@/api/generate'

export function useTuziModelLists() {
  const imageModels = ref([])
  const videoModels = ref([])
  const allCount = ref(0)
  const loading = ref(false)
  const error = ref('')

  async function fetchLists() {
    loading.value = true
    error.value = ''
    try {
      const res = await listTuziModels()
      const d = res.data ?? {}
      imageModels.value = d.image_models || []
      videoModels.value = d.video_models || []
      allCount.value = d.all_count || 0
    } catch (e) {
      error.value = e.response?.data?.message || e.message || '拉取模型失败'
    } finally {
      loading.value = false
    }
  }

  return { imageModels, videoModels, allCount, loading, error, fetchLists }
}
