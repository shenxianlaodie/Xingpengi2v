import api from './index'

export function listTuziModels() {
  return api.get('/v1/tuzi/models')
}

export function imageToImage(body) {
  return api.post('/v1/image/image-to-image', body)
}

export function imageToVideo(data) {
  return api.post('/v1/video/generations', data)
}

export function getTaskStatus(taskId) {
  return api.get(`/v1/tasks/${taskId}`)
}

export function uploadImage(file) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
