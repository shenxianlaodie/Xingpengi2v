import api from './index'

export function imageToImage(formData) {
  return api.post('/v1/image/image-to-image', formData)
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
