  import express from 'express';
  import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';
  import { initB2 } from '../services/backblazeService.js';
  import axios from 'axios';

  const router = express.Router();

  // Extrae ruta relativa desde la URL completa del archivo
  function extractB2Path(fileURL) {
    const regex = /\/file\/(.+?)\/(.+)/; // captura bucket y ruta interna
    const match = fileURL.match(regex);
    if (!match || match.length < 3) return null;
    const [, , path] = match;
    return path;
  }

  router.post('/', authenticateFirebaseUser, async (req, res) => {
    const { fileURL } = req.body;
    if (!fileURL) return res.status(400).json({ error: 'fileURL requerido' });

    try {
      const fileName = extractB2Path(fileURL);
      if (!fileName) return res.status(400).json({ error: 'URL no válida' });

      const authData = await initB2();

      // Paso 1: Buscar el archivo
      const findRes = await axios.post(
        `${authData.apiUrl}/b2api/v2/b2_list_file_names`,
        {
          bucketId: authData.allowed.bucketId,
          prefix: fileName,
          maxFileCount: 1
        },
        {
          headers: { Authorization: authData.authorizationToken }
        }
      );

      const file = findRes.data.files?.[0];
      if (!file) return res.status(404).json({ error: 'Archivo no encontrado en Backblaze' });

      // Paso 2: Eliminar el archivo
      await axios.post(
        `${authData.apiUrl}/b2api/v2/b2_delete_file_version`,
        {
          fileName: file.fileName,
          fileId: file.fileId
        },
        {
          headers: { Authorization: authData.authorizationToken }
        }
      );

      res.json({ success: true, deleted: file.fileName });
    } catch (err) {
      console.error('[Backblaze] Error al eliminar archivo:', err.response?.data || err.message);
      res.status(500).json({ error: 'Error al eliminar archivo', details: err.message });
    }
  });

  // Nueva ruta para eliminación en lote
  router.post('/batch', authenticateFirebaseUser, async (req, res) => {
    const { fileURLs } = req.body;
    
    if (!fileURLs || !Array.isArray(fileURLs)) {
      return res.status(400).json({ error: 'Se requiere un array de fileURLs' });
    }

    try {
      const authData = await initB2();
      const results = [];
      
      // Procesar cada archivo en paralelo
      await Promise.all(fileURLs.map(async (fileURL) => {
        try {
          const fileName = extractB2Path(fileURL);
          if (!fileName) {
            results.push({ fileURL, success: false, error: 'URL no válida' });
            return;
          }

          // Buscar el archivo en Backblaze
          const findRes = await axios.post(
            `${authData.apiUrl}/b2api/v2/b2_list_file_names`,
            {
              bucketId: authData.allowed.bucketId,
              prefix: fileName,
              maxFileCount: 1
            },
            { headers: { Authorization: authData.authorizationToken } }
          );

          const file = findRes.data.files?.[0];
          if (!file) {
            results.push({ fileURL, success: false, error: 'Archivo no encontrado' });
            return;
          }

          // Eliminar el archivo
          await axios.post(
            `${authData.apiUrl}/b2api/v2/b2_delete_file_version`,
            {
              fileName: file.fileName,
              fileId: file.fileId
            },
            { headers: { Authorization: authData.authorizationToken } }
          );

          results.push({ fileURL, success: true, fileName: file.fileName });
        } catch (err) {
          console.error(`Error eliminando ${fileURL}:`, err.message);
          results.push({ 
            fileURL, 
            success: false, 
            error: err.response?.data?.message || err.message 
          });
        }
      }));

      res.json({ 
        success: true, 
        results,
        stats: {
          total: fileURLs.length,
          succeeded: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      });
    } catch (err) {
      console.error('Error general en eliminación en lote:', err);
      res.status(500).json({ 
        error: 'Error al procesar solicitud', 
        details: err.message 
      });
    }
  });

  export default router;
