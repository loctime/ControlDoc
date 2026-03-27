import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Proxy seguro para archivos remotos
router.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url || !/^https?:\/\/cdn\.controldoc\.app\//.test(url)) {
    return res.status(400).send('URL inválida o no permitida');
  }
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).send('Error al descargar archivo');
    res.set('Content-Type', response.headers.get('content-type'));
    response.body.pipe(res);
  } catch (err) {
    res.status(500).send('Error en el proxy');
  }
});

export default router;