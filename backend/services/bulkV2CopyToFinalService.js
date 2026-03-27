/**
 * Bulk Upload V2 — Copy file from staging to final path in B2 and delete staging after commit.
 */
import axios from 'axios';
import { uploadFile as uploadToB2 } from './backblazeService.js';
import { initB2 } from './backblazeService.js';
import { cleanFileName } from '../../src/utils/cleanFileName.js';

/**
 * Copy file from staging URL to final path in B2.
 * Destination: companyDocuments/{companyId}/vehicle/{vehicleId}/{requiredId}/{timestamp}-{cleanFileName}
 * @returns { Promise<{ finalUrl: string, fileName: string }> }
 */
export async function copyStagingToFinal(stagingUrl, companyId, vehicleId, requiredId, originalName, mimeType) {
  const res = await axios.get(stagingUrl, { responseType: 'arraybuffer', timeout: 120000 });
  const buffer = Buffer.from(res.data);
  const timestamp = Date.now();
  const ext = originalName?.includes('.') ? originalName.slice(originalName.lastIndexOf('.')) : '.bin';
  const baseName = (originalName && cleanFileName(originalName)) || `file_${timestamp}${ext}`;
  const finalFileName = `${timestamp}-${baseName}`.replace(/\s/g, '_');
  const folder = `companyDocuments/${companyId}/vehicle/${vehicleId}/${requiredId}`;
  const result = await uploadToB2(buffer, mimeType || 'application/octet-stream', {
    folder,
    fileName: finalFileName
  });
  return { finalUrl: result.url, fileName: result.fileName };
}

/**
 * Delete a file in B2 by its CDN URL (e.g. staging URL).
 */
export async function deleteStagingFile(stagingUrl) {
  const regex = /\/file\/(.+?)\/(.+)/;
  const match = String(stagingUrl || '').match(regex);
  if (!match || match.length < 3) return;
  const fileName = match[2];
  const authData = await initB2();
  const findRes = await axios.post(
    `${authData.apiUrl}/b2api/v2/b2_list_file_names`,
    { bucketId: authData.allowed.bucketId, prefix: fileName, maxFileCount: 1 },
    { headers: { Authorization: authData.authorizationToken } }
  );
  const file = findRes.data.files?.[0];
  if (!file) return;
  await axios.post(
    `${authData.apiUrl}/b2api/v2/b2_delete_file_version`,
    { fileName: file.fileName, fileId: file.fileId },
    { headers: { Authorization: authData.authorizationToken } }
  );
}
