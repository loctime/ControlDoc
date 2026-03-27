import express from 'express';
import { PDFDocument } from 'pdf-lib';
import axios from 'axios';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';

const router = express.Router();

export default () => {
  router.post('/split',
    authenticateFirebaseUser,
    async (req, res) => {
      try {
        console.log('--- Nueva solicitud de división de PDF ---');
        console.log('Usuario autenticado:', req.user);
        console.log('Body:', req.body);

        const { fileUrl, selectedPages, filename } = req.body;

        // Validaciones
        if (!fileUrl || !selectedPages || !Array.isArray(selectedPages) || selectedPages.length === 0) {
          return res.status(400).json({ 
            error: 'Datos requeridos: fileUrl y selectedPages (array no vacío)' 
          });
        }

        if (selectedPages.length > 50) {
          return res.status(400).json({ 
            error: 'Máximo 50 páginas permitidas para división' 
          });
        }

        // Validar que todas las páginas sean números positivos
        const invalidPages = selectedPages.filter(page => !Number.isInteger(page) || page < 1);
        if (invalidPages.length > 0) {
          return res.status(400).json({ 
            error: 'Las páginas deben ser números enteros positivos' 
          });
        }

        console.log(`Procesando división de PDF: ${filename}`);
        console.log(`Páginas seleccionadas: ${selectedPages.join(', ')}`);

        // Descargar el PDF original
        console.log('Descargando PDF original...');
        const pdfResponse = await axios.get(fileUrl, {
          responseType: 'arraybuffer',
          timeout: 30000 // 30 segundos timeout
        });

        if (!pdfResponse.data) {
          return res.status(400).json({ error: 'No se pudo descargar el PDF original' });
        }

        console.log(`PDF descargado: ${pdfResponse.data.byteLength} bytes`);

        // Cargar el PDF con pdf-lib
        console.log('Cargando PDF con pdf-lib...');
        const originalPdf = await PDFDocument.load(pdfResponse.data);
        const totalPages = originalPdf.getPageCount();

        // Validar que las páginas seleccionadas existan
        const invalidPageNumbers = selectedPages.filter(page => page > totalPages);
        if (invalidPageNumbers.length > 0) {
          return res.status(400).json({ 
            error: `Las siguientes páginas no existen en el PDF: ${invalidPageNumbers.join(', ')}. Total de páginas: ${totalPages}` 
          });
        }

        // Crear nuevo PDF con las páginas seleccionadas
        console.log('Creando PDF dividido...');
        const newPdf = await PDFDocument.create();

        // Copiar las páginas seleccionadas
        const pagesToCopy = await newPdf.copyPages(originalPdf, selectedPages.map(page => page - 1)); // pdf-lib usa índice base 0
        pagesToCopy.forEach(page => newPdf.addPage(page));

        // Generar el PDF dividido
        console.log('Generando bytes del PDF dividido...');
        const pdfBytes = await newPdf.save();

        // Validar que el PDF generado no esté vacío
        if (!pdfBytes || pdfBytes.length === 0) {
          console.error('❌ PDF generado está vacío');
          return res.status(500).json({ error: 'Error: El PDF generado está vacío' });
        }

        // Validar que sea un PDF válido (debe empezar con %PDF)
        const pdfHeaderBytes = pdfBytes.slice(0, 4);
        const pdfHeader = String.fromCharCode(...pdfHeaderBytes);
        if (pdfHeader !== '%PDF') {
          console.error('❌ PDF generado no tiene header válido:', pdfHeader, 'Bytes:', Array.from(pdfHeaderBytes));
          return res.status(500).json({ error: 'Error: El PDF generado no es válido' });
        }

        // Generar nombre del archivo
        const baseName = filename ? filename.replace(/\.pdf$/i, '') : 'documento';
        const pagesStr = selectedPages.sort((a, b) => a - b).join('-');
        const newFilename = `${baseName}_pagina_${pagesStr}.pdf`;

        console.log(`✅ PDF dividido generado: ${pdfBytes.length} bytes`);
        console.log(`✅ Header PDF válido: ${pdfHeader}`);
        console.log(`✅ Nombre del archivo: ${newFilename}`);

        // Configurar headers para descarga (sin charset para mantener binario)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${newFilename}"`);
        res.setHeader('Content-Length', pdfBytes.length);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Transfer-Encoding', 'binary');
        
        // Enviar el PDF como buffer binario
        res.end(pdfBytes);

        console.log('✅ PDF dividido enviado exitosamente');

      } catch (error) {
        console.error('❌ Error en división de PDF:', error);
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          return res.status(408).json({ error: 'Timeout: El archivo PDF es demasiado grande o la conexión es lenta' });
        }
        
        if (error.message.includes('Invalid PDF')) {
          return res.status(400).json({ error: 'El archivo no es un PDF válido o está corrupto' });
        }

        if (error.response?.status === 404) {
          return res.status(404).json({ error: 'No se pudo encontrar el archivo PDF original' });
        }

        if (error.response?.status === 403) {
          return res.status(403).json({ error: 'No tienes permisos para acceder al archivo PDF original' });
        }

        res.status(500).json({ 
          error: 'Error interno del servidor al procesar el PDF',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  );

  router.post('/split-all',
    authenticateFirebaseUser,
    async (req, res) => {
      try {
        console.log('--- Nueva solicitud de división completa de PDF ---');
        console.log('Usuario autenticado:', req.user);
        console.log('Body:', req.body);

        const { fileUrl, filename } = req.body;

        // Validaciones
        if (!fileUrl) {
          return res.status(400).json({ 
            error: 'Datos requeridos: fileUrl' 
          });
        }

        console.log(`Procesando división completa de PDF: ${filename}`);

        // Descargar el PDF original
        console.log('Descargando PDF original...');
        const pdfResponse = await axios.get(fileUrl, {
          responseType: 'arraybuffer',
          timeout: 30000 // 30 segundos timeout
        });

        if (!pdfResponse.data) {
          return res.status(400).json({ error: 'No se pudo descargar el PDF original' });
        }

        console.log(`PDF descargado: ${pdfResponse.data.byteLength} bytes`);

        // Cargar el PDF con pdf-lib
        console.log('Cargando PDF con pdf-lib...');
        const originalPdf = await PDFDocument.load(pdfResponse.data);
        const totalPages = originalPdf.getPageCount();

        console.log(`Total de páginas: ${totalPages}`);

        // Crear un ZIP con todas las páginas
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        // Procesar cada página
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          console.log(`Procesando página ${pageNum}...`);
          
          // Crear PDF con una sola página
          const singlePagePdf = await PDFDocument.create();
          const [copiedPage] = await singlePagePdf.copyPages(originalPdf, [pageNum - 1]);
          singlePagePdf.addPage(copiedPage);
          
          // Generar bytes del PDF de una página
          const pageBytes = await singlePagePdf.save();
          
          // Agregar al ZIP
          const baseName = filename ? filename.replace(/\.pdf$/i, '') : 'documento';
          const pageFilename = `${baseName}_pagina_${pageNum}.pdf`;
          zip.file(pageFilename, pageBytes);
        }

        // Generar el ZIP
        console.log('Generando archivo ZIP...');
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // Generar nombre del archivo ZIP
        const baseName = filename ? filename.replace(/\.pdf$/i, '') : 'documento';
        const zipFilename = `${baseName}_todas_las_paginas.zip`;

        console.log(`✅ ZIP generado: ${zipBuffer.length} bytes`);
        console.log(`✅ Nombre del archivo: ${zipFilename}`);

        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
        res.setHeader('Content-Length', zipBuffer.length);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Transfer-Encoding', 'binary');
        
        // Enviar el ZIP
        res.end(zipBuffer);

        console.log('✅ ZIP enviado exitosamente');

      } catch (error) {
        console.error('❌ Error en división completa de PDF:', error);
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          return res.status(408).json({ error: 'Timeout: El archivo PDF es demasiado grande o la conexión es lenta' });
        }
        
        if (error.message.includes('Invalid PDF')) {
          return res.status(400).json({ error: 'El archivo no es un PDF válido o está corrupto' });
        }

        if (error.response?.status === 404) {
          return res.status(404).json({ error: 'No se pudo encontrar el archivo PDF original' });
        }

        if (error.response?.status === 403) {
          return res.status(403).json({ error: 'No tienes permisos para acceder al archivo PDF original' });
        }

        res.status(500).json({ 
          error: 'Error interno del servidor al procesar el PDF',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  );

  router.post('/split-selected',
    authenticateFirebaseUser,
    async (req, res) => {
      try {
        console.log('--- Nueva solicitud de división de páginas seleccionadas ---');
        console.log('Usuario autenticado:', req.user);
        console.log('Body:', req.body);

        const { fileUrl, selectedPages, filename } = req.body;

        // Validaciones
        if (!fileUrl || !selectedPages || !Array.isArray(selectedPages) || selectedPages.length === 0) {
          return res.status(400).json({ 
            error: 'Datos requeridos: fileUrl y selectedPages (array no vacío)' 
          });
        }

        if (selectedPages.length > 50) {
          return res.status(400).json({ 
            error: 'Máximo 50 páginas permitidas para división' 
          });
        }

        // Validar que todas las páginas sean números positivos
        const invalidPages = selectedPages.filter(page => !Number.isInteger(page) || page < 1);
        if (invalidPages.length > 0) {
          return res.status(400).json({ 
            error: 'Las páginas deben ser números enteros positivos' 
          });
        }

        console.log(`Procesando división de páginas seleccionadas: ${filename}`);
        console.log(`Páginas seleccionadas: ${selectedPages.join(', ')}`);

        // Descargar el PDF original
        console.log('Descargando PDF original...');
        const pdfResponse = await axios.get(fileUrl, {
          responseType: 'arraybuffer',
          timeout: 30000
        });

        if (!pdfResponse.data) {
          return res.status(400).json({ error: 'No se pudo descargar el PDF original' });
        }

        console.log(`PDF descargado: ${pdfResponse.data.byteLength} bytes`);

        // Cargar el PDF con pdf-lib
        console.log('Cargando PDF con pdf-lib...');
        const originalPdf = await PDFDocument.load(pdfResponse.data);
        const totalPages = originalPdf.getPageCount();

        // Validar que las páginas seleccionadas existan
        const invalidPageNumbers = selectedPages.filter(page => page > totalPages);
        if (invalidPageNumbers.length > 0) {
          return res.status(400).json({ 
            error: `Las siguientes páginas no existen en el PDF: ${invalidPageNumbers.join(', ')}. Total de páginas: ${totalPages}` 
          });
        }

        // Crear un ZIP con las páginas seleccionadas
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        // Procesar cada página seleccionada
        for (const pageNum of selectedPages) {
          console.log(`Procesando página ${pageNum}...`);
          
          // Crear PDF con una sola página
          const singlePagePdf = await PDFDocument.create();
          const [copiedPage] = await singlePagePdf.copyPages(originalPdf, [pageNum - 1]);
          singlePagePdf.addPage(copiedPage);
          
          // Generar bytes del PDF de una página
          const pageBytes = await singlePagePdf.save();
          
          // Agregar al ZIP
          const baseName = filename ? filename.replace(/\.pdf$/i, '') : 'documento';
          const pageFilename = `${baseName}_pagina_${pageNum}.pdf`;
          zip.file(pageFilename, pageBytes);
        }

        // Generar el ZIP
        console.log('Generando archivo ZIP...');
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // Generar nombre del archivo ZIP
        const baseName = filename ? filename.replace(/\.pdf$/i, '') : 'documento';
        const pagesStr = selectedPages.sort((a, b) => a - b).join('-');
        const zipFilename = `${baseName}_paginas_${pagesStr}.zip`;

        console.log(`✅ ZIP generado: ${zipBuffer.length} bytes`);
        console.log(`✅ Nombre del archivo: ${zipFilename}`);

        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
        res.setHeader('Content-Length', zipBuffer.length);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Transfer-Encoding', 'binary');
        
        // Enviar el ZIP
        res.end(zipBuffer);

        console.log('✅ ZIP enviado exitosamente');

      } catch (error) {
        console.error('❌ Error en división de páginas seleccionadas:', error);
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          return res.status(408).json({ error: 'Timeout: El archivo PDF es demasiado grande o la conexión es lenta' });
        }
        
        if (error.message.includes('Invalid PDF')) {
          return res.status(400).json({ error: 'El archivo no es un PDF válido o está corrupto' });
        }

        if (error.response?.status === 404) {
          return res.status(404).json({ error: 'No se pudo encontrar el archivo PDF original' });
        }

        if (error.response?.status === 403) {
          return res.status(403).json({ error: 'No tienes permisos para acceder al archivo PDF original' });
        }

        res.status(500).json({ 
          error: 'Error interno del servidor al procesar el PDF',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  );

  return router;
};
