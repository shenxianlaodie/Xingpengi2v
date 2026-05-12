const axios = require('axios');
const fs = require('fs');
const path = require('path');
const SystemConfig = require('../models/SystemConfig');

function getClient(contentType = 'application/json') {
  const config = require('../config');
  const baseURL = SystemConfig.get('tuzi_base_url') || config.tuziBaseUrl;
  const apiKey = SystemConfig.get('tuzi_api_key') || config.tuziApiKey;

  return axios.create({
    baseURL,
    timeout: config.tuziHttpTimeoutMs,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': contentType,
    },
  });
}

/** Official POST /v1/videos: size 为比例枚举；时长用 4/8/12 秒档位，避免非法 duration — https://tuzi-api.apifox.cn/408441203e0 */
function normalizeSeedanceSeconds(seconds) {
  const allowed = [4, 8, 12];
  const n = Number(seconds);
  if (!Number.isFinite(n)) return 8;
  return allowed.reduce((pick, a) => (Math.abs(n - a) < Math.abs(n - pick) ? a : pick), 8);
}

function videoFormSize(size) {
  const s = `${size || ''}`;
  const allowed = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9', 'keep_ratio', 'adaptive'];
  if (allowed.includes(s)) return s;
  if (!s || s === '1280x720') return '16:9';
  if (s === '720x1280') return '9:16';
  if (s === '720x720' || s === '1080x1080') return '1:1';
  return '16:9';
}

function normalizeVideoCreateResponse(data) {
  const id = data?.id ?? data?.task_id
    ?? (data?.data && !Array.isArray(data.data) ? data.data.id : undefined)
    ?? (Array.isArray(data?.data) ? (data.data[0]?.task_id || data.data[0]?.id) : undefined);
  if (id != null && data.id == null) return { ...data, id };
  return data;
}

async function loadFirstFrameBinary(imageSource, imageUrl) {
  if (typeof imageSource === 'string' && fs.existsSync(imageSource)) {
    const buf = await fs.promises.readFile(imageSource);
    const name = path.basename(imageSource) || 'frame.png';
    const ext = (path.extname(name).replace('.', '') || 'png').toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext === 'jpeg' ? 'jpeg' : ext}`;
    return { buffer: buf, filename: name, contentType: mime };
  }
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  if (imageUrl.startsWith('data:')) {
    const m = /^data:([^;,]+)[;,]base64,(.+)$/is.exec(imageUrl.replace(/\s/g, ''));
    if (!m) return null;
    const contentType = (m[1] || 'image/png').split(';')[0].trim();
    const buffer = Buffer.from(m[2], 'base64');
    const sub = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    return { buffer, filename: `frame.${sub}`, contentType };
  }
  if (/^https?:\/\//i.test(imageUrl)) {
    const r = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxContentLength: 20 * 1024 * 1024,
    });
    const ct = r.headers['content-type']?.split(';')[0]?.trim() || 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    return { buffer: Buffer.from(r.data), filename: `frame.${ext}`, contentType: ct };
  }
  return null;
}

const TuziClient = {
  async listModels() {
    const res = await getClient().get('/v1/models');
    return res.data;
  },

  async imageGenerations(body) {
    const res = await getClient().post('/v1/images/generations', body);
    return res.data;
  },

  /**
   * POST /v1/videos — multipart/form-data per official doc:
   * model, prompt (required), size (aspect enum), first_frame_image (binary).
   * seconds 仅传 4/8/12，与模型支持档位对齐（文档曾提示 seconds 有 bug，非法默认值会报 InvalidParameter）。
   * @see https://tuzi-api.apifox.cn/408441203e0
   */
  async videoGenerations({ model, prompt, imageSource, imageUrl, seconds, size }) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('model', model || 'doubao-seedance-1-5-pro_720p');
    const p = prompt != null && String(prompt).trim() !== '' ? String(prompt) : ' ';
    form.append('prompt', p);
    form.append('size', videoFormSize(size));
    form.append('seconds', String(normalizeSeedanceSeconds(seconds)));

    const frame = await loadFirstFrameBinary(imageSource, imageUrl);
    if (frame) {
      form.append('first_frame_image', frame.buffer, {
        filename: frame.filename,
        contentType: frame.contentType,
      });
    }

    const res = await getClient().post('/v1/videos', form, {
      headers: form.getHeaders(),
    });
    return normalizeVideoCreateResponse(res.data);
  },

  async getVideoStatus(videoId) {
    const res = await getClient().get(`/v1/videos/${videoId}`);
    return res.data;
  },

  async chatCompletions(body) {
    const res = await getClient().post('/v1/chat/completions', body);
    return res.data;
  },
};

module.exports = TuziClient;
