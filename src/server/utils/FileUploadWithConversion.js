import { getAuth } from "firebase/auth";
import { PDFDocument } from "pdf-lib";
import { cleanFileName } from '../../utils/cleanFileName';
import { uploadToControlFile, buildControlFilePath } from '../../utils/ControlFileStorage';
import { getCurrentTenantId } from '../../utils/tenantUtils';

const MAX_SIZE_MB = 500;
const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const convertImageToPDF = async (file) => {
  try {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg');
    const base64 = dataUrl.split(',')[1];
    const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    const pdfDoc = await PDFDocument.create();
    const embedded = await pdfDoc.embedJpg(buffer);
    const page = pdfDoc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height
    });

    const pdfBytes = await pdfDoc.save();
    return new File([pdfBytes], `${file.name.split('.')[0]}.pdf`, {
      type: 'application/pdf'
    });
  } catch (error) {
    console.error('[convertImageToPDF] Error:', error);
    throw new Error('Failed to convert image to PDF');
  }
};

/**
 * Convierte imágenes a PDF (si aplica), sube a ControlFile y registra en backend ControlDoc.
 * @param {File} file
 * @param {string} folder
 * @param {Object} metadata
 * @param {(pct: number) => void} [onProgress]
 * @returns {Promise<{ fileId, fileName, docId }>}
 */
export const uploadFileWithConversion = async (file, folder, metadata = {}, onProgress) => {
  if (!file) throw new Error('No file selected');
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed`);
  }
  if (file.size > MAX_SIZE) {
    throw new Error(`File exceeds ${MAX_SIZE_MB}MB limit`);
  }

  // Convertir imagen a PDF si es necesario
  if (file.type.startsWith('image/')) {
    file = await convertImageToPDF(file);
    if (file.size > MAX_SIZE) {
      throw new Error(`Converted file exceeds ${MAX_SIZE_MB}MB limit`);
    }
  }

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const sanitizedFileName = file.name || `archivo_${Date.now()}.pdf`;
  const renamedFile = new File([file], sanitizedFileName, { type: file.type });

  const tenantId = getCurrentTenantId() || 'default';
  const path = buildControlFilePath(folder, tenantId);

  // Subir a ControlFile (con progress tracking)
  const { fileId, fileName } = await uploadToControlFile(renamedFile, path, { onProgress });

  // Registrar en ControlDoc backend
  const cleanMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, v]) => v !== undefined)
  );

  const token = await user.getIdToken();
  const regResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/register-document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId,
      fileName,
      fileType: renamedFile.type,
      fileSize: renamedFile.size,
      folder,
      metadata: cleanMetadata,
    }),
  });

  if (regResponse.status >= 400) {
    const errorData = await regResponse.json().catch(() => ({}));
    throw new Error(errorData.error || 'Server error registering document');
  }

  const result = await regResponse.json();
  console.log('✅ Upload + register OK:', result);
  return { fileId, fileName, docId: result.docId };
};
