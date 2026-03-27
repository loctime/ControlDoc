#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Generando script para limpiar caché del navegador...');

// Crear un archivo HTML que fuerce la limpieza del caché
const cacheBusterHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Limpieza de Caché - ControlDoc</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .button {
            background-color: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 5px;
        }
        .button:hover {
            background-color: #0056b3;
        }
        .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .success {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Limpieza de Caché - ControlDoc</h1>
        
        <div class="warning">
            <strong>⚠️ Importante:</strong> Si estás experimentando errores de carga de archivos JavaScript (404), 
            es posible que necesites limpiar el caché de tu navegador.
        </div>

        <h2>Pasos para solucionar el problema:</h2>
        
        <h3>1. Limpiar caché del navegador:</h3>
        <p>Presiona <strong>Ctrl + Shift + R</strong> (Windows/Linux) o <strong>Cmd + Shift + R</strong> (Mac) para forzar una recarga completa.</p>
        
        <h3>2. Limpiar caché manualmente:</h3>
        <ul>
            <li><strong>Chrome/Edge:</strong> F12 → Network → Marcar "Disable cache" → Recargar</li>
            <li><strong>Firefox:</strong> F12 → Network → Marcar "Disable Cache" → Recargar</li>
            <li><strong>Safari:</strong> Desarrollar → Deshabilitar cachés → Recargar</li>
        </ul>

        <h3>3. Limpiar caché completo:</h3>
        <ul>
            <li><strong>Chrome/Edge:</strong> Ctrl + Shift + Delete → Seleccionar "Caché" → Limpiar</li>
            <li><strong>Firefox:</strong> Ctrl + Shift + Delete → Seleccionar "Caché" → Limpiar</li>
            <li><strong>Safari:</strong> Safari → Preferencias → Avanzado → Mostrar menú Desarrollar → Desarrollar → Vaciar cachés</li>
        </ul>

        <div class="success">
            <strong>✅ Después de limpiar el caché:</strong>
            <ul>
                <li>Recarga la página principal</li>
                <li>Los archivos JavaScript deberían cargar correctamente</li>
                <li>Si el problema persiste, contacta al administrador</li>
            </ul>
        </div>

        <h3>4. Verificar archivos disponibles:</h3>
        <p>Los siguientes archivos deberían estar disponibles en el servidor:</p>
        <ul id="fileList">
            <li>Cargando lista de archivos...</li>
        </ul>

        <div style="margin-top: 30px; text-align: center;">
            <button class="button" onclick="window.location.href='/'">🏠 Ir a la página principal</button>
            <button class="button" onclick="location.reload(true)">🔄 Recargar página</button>
        </div>
    </div>

    <script>
        // Verificar archivos disponibles
        async function checkFiles() {
            const criticalFiles = [
                'UsuarioDashboard',
                'TourVirtual',
                'useDocumentEntityTypes'
            ];
            
            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '';
            
            for (const fileName of criticalFiles) {
                try {
                    // Intentar cargar un archivo de assets
                    const response = await fetch('/assets/' + fileName + '.js', { 
                        method: 'HEAD',
                        cache: 'no-cache'
                    });
                    
                    const li = document.createElement('li');
                    if (response.ok) {
                        li.innerHTML = \`✅ \${fileName}.js - <span style="color: green;">Disponible</span>\`;
                    } else {
                        li.innerHTML = \`❌ \${fileName}.js - <span style="color: red;">No encontrado</span>\`;
                    }
                    fileList.appendChild(li);
                } catch (error) {
                    const li = document.createElement('li');
                    li.innerHTML = \`❌ \${fileName}.js - <span style="color: red;">Error de red</span>\`;
                    fileList.appendChild(li);
                }
            }
        }
        
        // Ejecutar verificación al cargar la página
        checkFiles();
        
        // Verificar cada 30 segundos
        setInterval(checkFiles, 30000);
    </script>
</body>
</html>
`;

// Guardar el archivo en el directorio dist
const distPath = path.join('dist', 'cache-clear.html');
fs.writeFileSync(distPath, cacheBusterHTML);

console.log('✅ Archivo de limpieza de caché generado en:', distPath);
console.log('📋 Instrucciones:');
console.log('1. Ejecuta: npm run fix-assets');
console.log('2. Sube los archivos actualizados al servidor');
console.log('3. Accede a: https://tu-dominio.com/cache-clear.html');
console.log('4. Sigue las instrucciones para limpiar el caché del navegador');
