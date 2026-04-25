const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = /^image\/(jpeg|png|gif|webp|svg\+xml)$/i;
const ALLOWED_EXT = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const orig = file.originalname || 'file';
    let ext = (path.extname(orig) || '').toLowerCase();
    if (!ALLOWED_EXT.test(ext)) ext = '.bin';
    const stem = path.basename(orig, ext)
      .replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ_-]/g, '_')
      .slice(0, 40) || 'image';
    const id = crypto.randomBytes(5).toString('hex');
    cb(null, `${Date.now()}_${id}_${stem}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      return cb(new Error('지원하지 않는 파일 형식입니다. (jpg, png, gif, webp, svg만 가능)'));
    }
    cb(null, true);
  },
});

function listUploads() {
  let files;
  try { files = fs.readdirSync(UPLOAD_DIR); }
  catch { return []; }
  return files
    .filter((f) => !f.startsWith('.'))
    .map((f) => {
      const stat = fs.statSync(path.join(UPLOAD_DIR, f));
      return { name: f, url: '/uploads/' + f, size: stat.size, uploadedAt: stat.mtime };
    })
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

// Translate multer's English error codes to Korean messages.
function describeUploadError(err) {
  if (!err) return '';
  if (err.code === 'LIMIT_FILE_SIZE') return '파일이 너무 큽니다. (최대 8 MB)';
  if (err.code === 'LIMIT_FILE_COUNT') return '파일 개수가 너무 많습니다.';
  if (err.code === 'LIMIT_UNEXPECTED_FILE') return '예상치 못한 파일 필드입니다.';
  return err.message || '업로드 중 오류가 발생했습니다.';
}

module.exports = { upload, UPLOAD_DIR, listUploads, formatBytes, describeUploadError };
