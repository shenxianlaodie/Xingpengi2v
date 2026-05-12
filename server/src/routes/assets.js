const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const GeneratedAsset = require('../models/GeneratedAsset');
const { error } = require('../utils/response');

const router = Router();

// GET /api/assets/:id/file
router.get('/:id/file', (req, res) => {
  const asset = GeneratedAsset.findById(req.params.id);
  if (!asset) return error(res, '文件不存在', 404);

  if (asset.cached_path) {
    const fullPath = path.join(config.uploadDir, asset.cached_path);
    if (!fs.existsSync(fullPath)) return error(res, '文件不存在', 404);
    const mime = asset.mime_type || (asset.asset_type === 'video' ? 'video/mp4' : 'image/png');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
    return fs.createReadStream(fullPath).pipe(res);
  }

  const src = asset.source_url;
  if (src && /^https?:\/\//i.test(String(src))) {
    return res.redirect(302, String(src));
  }
  if (src && String(src).startsWith('data:')) {
    const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(src));
    if (!m) return error(res, '文件不存在', 404);
    const mime = m[1] || (asset.asset_type === 'video' ? 'video/mp4' : 'image/png');
    const body = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(body);
  }

  return error(res, '文件不存在', 404);
});

module.exports = router;
