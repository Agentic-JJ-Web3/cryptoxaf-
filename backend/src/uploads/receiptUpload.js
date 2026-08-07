const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { InvalidReceiptFileError } = require('../customer/errors');

// Deposit-receipt screenshots (sell flow only — see CLAUDE.md "Sell flow").
// Local disk, gitignored, UUID-named so a filename never reveals the order
// it belongs to. Served back only through an authenticated admin route —
// there is no public static mount for this directory.
const RECEIPTS_DIR = path.join(__dirname, '..', '..', 'uploads', 'receipts');

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — plenty for a phone screenshot

const storage = multer.diskStorage({
  destination: RECEIPTS_DIR,
  filename(req, file, cb) {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, file.mimetype)) {
    return cb(new InvalidReceiptFileError('Attach a JPEG, PNG, or WebP image'));
  }
  cb(null, true);
}

const receiptUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

module.exports = { receiptUpload, RECEIPTS_DIR, ALLOWED_MIME_TYPES, MAX_FILE_BYTES };
