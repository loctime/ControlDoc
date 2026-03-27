// ✅ backblazeService.js actualizado
import axios from 'axios';
import crypto from 'crypto';

const DEBUG_MODE = process.env.NODE_ENV === 'development';
let authData = null;

export async function initB2() {
  if (!authData) {
    const basicAuth = Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`).toString('base64');
    const response = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { Authorization: `Basic ${basicAuth}` }
    });
    authData = response.data;
    authData.allowed = authData.allowed || {};
    authData.allowed.bucketId = process.env.B2_BUCKET_ID;
  }
  return authData;
}

export async function getUploadUrl() {
  try {
    const authData = await initB2();
    // LOGS TEMPORALES
    console.log('[Backblaze] Usando bucket ID:', process.env.B2_BUCKET_ID);
    console.log('[Backblaze] Authorization Token:', authData.authorizationToken.slice(0, 10) + '...');
    const response = await axios.post(
      `${authData.apiUrl}/b2api/v2/b2_get_upload_url`,
      { bucketId: authData.allowed.bucketId },
      { headers: { Authorization: authData.authorizationToken } }
    );
    return response.data;
  } catch (error) {
    console.error('[Backblaze] Error getting upload URL:', error.response?.data || error.message);
    throw error;
  }
}

export async function uploadFile(fileBuffer, mimeType, options = {}) {
  try {
    const uploadUrlData = await getUploadUrl();
    const extension = guessExtension(mimeType);
    let fileNameWithExt = options.fileName;
    if (!fileNameWithExt) {
      fileNameWithExt = generateSafeFileName(extension);
    } else if (!fileNameWithExt.endsWith(extension)) {
      fileNameWithExt += extension; // Asegura que tenga la extensión correcta
    }
    const finalPath = `${options.folder || 'documentExamples'}/${fileNameWithExt}`.replace(/\s/g, '_');

    const sha1 = crypto.createHash('sha1').update(fileBuffer).digest('hex');

    const response = await axios({
      method: 'post',
      url: uploadUrlData.uploadUrl,
      headers: {
        Authorization: uploadUrlData.authorizationToken,
        'X-Bz-File-Name': finalPath,
        'Content-Type': mimeType,
        'X-Bz-Content-Sha1': sha1
      },
      data: fileBuffer
    });

    const cdnDomain = 'cdn.controldoc.app';

    return {
      url: `https://${cdnDomain}/file/${process.env.B2_BUCKET_NAME}/${finalPath}`,
      fileId: response.data.fileId,
      fileName: fileNameWithExt
    };
  } catch (error) {
    console.error('[Backblaze] Error:', error.response?.data || error.message);
    throw new Error(`Backblaze error ${error.response?.status || ''}: ${error.response?.data?.message || error.message}`);
  }
}

function generateSafeFileName(extension) {
  const random = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}_${random}${extension || '.bin'}`.replace(/\s/g, '_');
}

function guessExtension(mimeType) {
  switch (mimeType) {
    case 'image/jpeg': return '.jpg';
    case 'image/png': return '.png';
    case 'image/gif': return '.gif';
    case 'application/pdf': return '.pdf';
    case 'text/plain': return '.txt';
    case 'application/zip': return '.zip';
    case 'application/msword': return '.doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return '.docx';
    default: return '.bin';
  }
}
