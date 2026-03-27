/**
 * Bulk Upload V2 — Staging service: upload files to B2 in bulk-staging folder.
 * Path: bulk-staging/{tenantId}/{jobId}/{fileId}[.ext]
 */
import { uploadFile as uploadToB2 } from './backblazeService.js';

const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 400 * 1024 * 1024; // 400 MB, aligned with upload.js

function getExtension(mime) {
  const map = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png'
  };
  return map[mime] || '.bin';
}

/**
 * Upload a file to B2 staging. Path: bulk-staging/{tenantId}/{jobId}/{fileId}{.ext}
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {{ tenantId: string, jobId: string, fileId: string }} options
 * @returns {Promise<{ bucket: string, path: string, url: string }>}
 */
export async function uploadToStaging(fileBuffer, mimeType, { tenantId, jobId, fileId }) {
  if (!fileBuffer?.length) throw new Error('No se recibió contenido del archivo');
  if (fileBuffer.length > MAX_SIZE_BYTES) {
    throw new Error(`El archivo supera el límite de ${MAX_SIZE_BYTES / 1024 / 1024}MB`);
  }
  const ext = getExtension(mimeType);
  const safeName = `${fileId}${ext}`;
  const folder = `bulk-staging/${tenantId}/${jobId}`;

  const result = await uploadToB2(fileBuffer, mimeType, {
    folder,
    fileName: safeName
  });

  const path = `${folder}/${safeName}`;
  return {
    bucket: process.env.B2_BUCKET_NAME || 'bucket',
    path,
    url: result.url
  };
}
