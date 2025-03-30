const multer = require('multer');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    log.info(`Created temp directory: ${tempDir}`);
  } catch (err) {
    log.error(`Error creating temp directory: ${err.message}`);
  }
}

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename to prevent conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure file filter - restrict to .zip files
const fileFilter = (req, file, cb) => {
  log.info(`Received file upload request: ${file.originalname}, mimetype: ${file.mimetype}`);
  
  // Check file extension and mimetype
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.zip') {
    log.info(`Accepted file: ${file.originalname}`);
    cb(null, true);
  } else {
    log.warn(`Rejected file: ${file.originalname} - not a zip file`);
    cb(new Error('Only .zip files are allowed'));
  }
};

// Create multer instance with configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  }
});

// Custom error handler for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    log.error(`Multer error: ${err.code} - ${err.message}`);
    return res.status(400).json({
      success: false,
      error: `File upload error: ${err.message}`
    });
  } else if (err) {
    log.error(`Error in file upload: ${err.message}`);
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
};

module.exports = { upload, handleMulterError }; 