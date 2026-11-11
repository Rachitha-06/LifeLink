const multer = require('multer');

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — medical reports/scans, not video

const upload = multer({
  storage: multer.memoryStorage(), // buffer stays in memory only long enough to stream to Cloudinary
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG, PNG, or WEBP files are allowed.'));
    }
    cb(null, true);
  },
});

module.exports = { upload };
