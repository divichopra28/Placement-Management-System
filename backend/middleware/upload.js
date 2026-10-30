const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config/env');
const { AppError } = require('./errorHandler');

fs.mkdirSync(config.uploadDir, { recursive: true });

const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

// Files are stored under a random server-generated name, never the user's name.
const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `resume_${crypto.randomUUID()}${ext}`);
  },
});

const resumeUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[ext] || !ALLOWED[ext].includes(file.mimetype)) {
      return cb(new AppError(400, 'Only PDF, DOC or DOCX files are allowed.'));
    }
    return cb(null, true);
  },
}).single('resume');

module.exports = { resumeUpload };
