// scripts/copyPdfWorker.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  // Obtener el directorio raíz del proyecto (un nivel arriba de scripts/)
  const projectRoot = path.join(__dirname, '..');
  
  // Crear directorio public si no existe
  const publicDir = path.join(projectRoot, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
    console.log('✅ Directorio public creado');
  }

  // Rutas de origen y destino
  const sourcePath = path.join(projectRoot, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
  const destPath = path.join(publicDir, 'pdf.worker.min.mjs');

  // Verificar que el archivo origen existe
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No se encontró el worker en: ${sourcePath}`);
  }

  // Copiar el archivo
  fs.copyFileSync(sourcePath, destPath);
  console.log('✅ PDF.js worker copiado exitosamente a public/');
  
  // Verificar que se copió correctamente
  const stats = fs.statSync(destPath);
  console.log(`📁 Tamaño del worker: ${(stats.size / 1024).toFixed(2)} KB`);
  
} catch (error) {
  console.error('❌ Error copiando PDF.js worker:', error.message);
  process.exit(1);
}
