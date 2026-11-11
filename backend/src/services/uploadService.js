const env = require('../config/env');

const isConfigured = !!(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

let cloudinary = null;
if (isConfigured) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

/**
 * Uploads a file buffer (from multer's memory storage) and returns its
 * public URL. Falls back to a clearly-labeled mock URL when Cloudinary
 * isn't configured — same pattern as the email/SMS mocking in
 * notificationService.js — so the whole upload flow (form -> backend ->
 * DB column -> displayed link) is exercisable without needing real
 * third-party credentials during development.
 */
function uploadDocument(fileBuffer, { folder, filename }) {
  if (!isConfigured) {
    console.log(`[UPLOAD MOCK] Would upload ${filename} to folder "${folder}"`);
    return Promise.resolve(`https://mock-storage.lifelink.local/${folder}/${Date.now()}-${filename}`);
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `lifelink/${folder}`, resource_type: 'auto', public_id: filename.replace(/\.[^.]+$/, '') },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(fileBuffer);
  });
}

module.exports = { uploadDocument, isConfigured };
