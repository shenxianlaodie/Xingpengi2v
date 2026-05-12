const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const auth = require('./middleware/auth');

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(config.uploadDir, 'images'),
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  },
});

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const proxyRoutes = require('./routes/proxy');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhook');
const dingtalkRoutes = require('./routes/dingtalk');
const assetRoutes = require('./routes/assets');

const app = express();

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('short'));
}
app.use(requestLogger);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { uptime: process.uptime() } });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', dingtalkRoutes);  // /api/auth/dingtalk/*
app.use('/api/user', userRoutes);
app.use('/api', proxyRoutes);  // /api/v1/... proxy routes
app.use('/api/admin', adminRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/assets', assetRoutes);

// Image upload for video/image generation
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: -1, message: '请选择文件', data: null });
  }
  const url = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;
  res.json({ code: 0, message: 'ok', data: { url, filename: req.file.filename } });
});

// Serve uploaded files
app.use('/uploads', express.static(config.uploadDir));

// Error handling
app.use(errorHandler);

module.exports = app;
