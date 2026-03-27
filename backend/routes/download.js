// routes/download.js
import express from 'express';
import axios from 'axios';

const router = express.Router();

// Función auxiliar para deducir extensión
function guessExtensionFromContentType(contentType = '') {
  if (contentType.includes('pdf')) return '.pdf';
  if (contentType.includes('jpeg')) return '.jpg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('zip')) return '.zip';
  if (contentType.includes('msword')) return '.doc';
  if (contentType.includes('wordprocessingml.document')) return '.docx';
  return '.bin';
}

router.get('/force-download', async (req, res) => {
  const { url, filename = 'archivo', filetype } = req.query;

  if (!url) return res.status(400).json({ error: 'Falta la URL del archivo' });

  try {
    // Cambia a arraybuffer para máxima compatibilidad
    const response = await axios.get(url, { responseType: 'arraybuffer' });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const ext = filetype || guessExtensionFromContentType(contentType);
    const safeName = filename.endsWith(ext) ? filename : `${filename}${ext}`;

    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Type', contentType);
    res.send(Buffer.from(response.data));
    // Log de depuración
    console.log(`[DEPURACIÓN BACKEND] Archivo '${safeName}' enviado. Bytes: ${Buffer.byteLength(response.data)}`);
  } catch (err) {
    console.error('Error al descargar desde Backblaze:', err.message);
    res.status(500).json({ error: 'No se pudo descargar el archivo' });
  }
});

export default router;
