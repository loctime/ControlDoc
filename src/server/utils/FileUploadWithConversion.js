import { getAuth } from "firebase/auth";
import { PDFDocument } from "pdf-lib";
import { cleanFileName } from '../../utils/cleanFileName';

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

export const uploadFileWithConversion = async (file, folder, metadata = {}, onProgress) => {
  try {
    if (!file) throw new Error('No file selected');
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }
    if (file.size > MAX_SIZE) {
      throw new Error(`File exceeds ${MAX_SIZE_MB}MB limit`);
    }

    if (file.type.startsWith('image/')) {
      file = await convertImageToPDF(file);
      if (file.size > MAX_SIZE) {
        throw new Error(`Converted file exceeds ${MAX_SIZE_MB}MB limit`);
      }
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Authentication required");

    // Si el archivo ya tiene un nombre formateado (como de la conversión), usarlo
    const sanitizedFileName = file.name || `archivo_${Date.now()}.pdf`;
    const renamedFile = new File([file], sanitizedFileName, { type: file.type });

    const formData = new FormData();
    formData.append("file", renamedFile);
    formData.append("fileName", sanitizedFileName);
    formData.append("folder", folder);

    const cleanMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([_, v]) => v !== undefined)
    );
    formData.append("metadata", JSON.stringify(cleanMetadata));

    const token = await user.getIdToken();

    const response = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        console.log('[uploadFileWithConversion] responseText:', xhr.responseText);
        resolve(xhr);
      };      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.onabort = () => reject(new Error('Upload aborted'));

      xhr.open('POST', `${import.meta.env.VITE_API_URL}/api/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });

    if (response.status >= 400) {
      const errorData = JSON.parse(response.responseText) || {};
      throw new Error(errorData.error || "Server error");
    }

    const result = JSON.parse(response.responseText);
    console.log('✅ Upload OK:', result);
    return result;

  } catch (error) {
    console.error("[FileUploadWithConversion] Error:", error);
    throw error;
  }
};
