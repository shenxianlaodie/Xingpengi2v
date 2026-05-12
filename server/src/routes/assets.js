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
  if (!asset || !asset.cached_path) {
    return error(res, '文件不存在', 404);
  }

  const fullPath = path.join(config.uploadDir, asset.cached_path);
  if (!fs.existsSync(fullPath)) {
    return error(res, '文件不存在', 404);
  }

  const mime = asset.mime_type || (asset.asset_type === 'video' ? 'video/mp4' : 'image/png');
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);

  const stream = fs.createReadStream(fullPath);
  stream.pipe(res);
});

module.exports = router;
