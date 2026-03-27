#!/usr/bin/env node

/**
 * Script para configurar el cron job de notificaciones
 * 
 * Uso:
 * node scripts/cron-setup.js
 * 
 * Este script genera el comando cron y las instrucciones
 * para configurar las notificaciones automáticas
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Genera el comando cron para las notificaciones
 */
function generarComandoCron() {
  const backendPath = path.resolve(__dirname, '..');
  const scriptPath = path.join(backendPath, 'scripts', 'sendExpirationNotifications.js');
  
  // Ejecutar todos los días a las 9:00 AM
  const cronExpression = '0 9 * * *';
  
  return `${cronExpression} cd ${backendPath} && node ${scriptPath}`;
}

/**
 * Configura el cron job automáticamente (solo en sistemas Unix/Linux)
 */
async function configurarCronJob() {
  try {
    console.log('🔧 Configurando cron job para notificaciones...');
    
    const comandoCron = generarComandoCron();
    const cronJob = `# ControlDoc - Notificaciones de vencimientos\n${comandoCron}\n`;
    
    // Agregar al crontab
    const { stdout, stderr } = await execAsync(`(crontab -l 2>/dev/null; echo "${cronJob}") | crontab -`);
    
    if (stderr && !stderr.includes('no crontab for')) {
      console.error('❌ Error configurando cron:', stderr);
      return false;
    }
    
    console.log('✅ Cron job configurado exitosamente');
    console.log('📅 Se ejecutará todos los días a las 9:00 AM');
    return true;
    
  } catch (error) {
    console.error('❌ Error configurando cron job:', error.message);
    return false;
  }
}

/**
 * Muestra las instrucciones manuales para configurar el cron
 */
function mostrarInstruccionesManuales() {
  console.log('\n📋 INSTRUCCIONES PARA CONFIGURAR CRON MANUALMENTE:');
  console.log('='.repeat(60));
  
  const comandoCron = generarComandoCron();
  
  console.log('\n1. Abrir el crontab:');
  console.log('   crontab -e');
  
  console.log('\n2. Agregar la siguiente línea:');
  console.log(`   ${comandoCron}`);
  
  console.log('\n3. Guardar y salir (en vim: :wq, en nano: Ctrl+X, Y, Enter)');
  
  console.log('\n4. Verificar que se agregó correctamente:');
  console.log('   crontab -l');
  
  console.log('\n📅 HORARIOS DISPONIBLES:');
  console.log('   0 9 * * *   - Todos los días a las 9:00 AM');
  console.log('   0 8 * * 1   - Todos los lunes a las 8:00 AM');
  console.log('   0 10 * * 1,3,5 - Lunes, miércoles y viernes a las 10:00 AM');
  
  console.log('\n🧪 COMANDOS DE PRUEBA:');
  console.log('   # Probar el sistema:');
  console.log('   node scripts/sendExpirationNotifications.js test');
  console.log('   # Enviar notificaciones manualmente:');
  console.log('   node scripts/sendExpirationNotifications.js send');
}

/**
 * Verifica si el sistema soporta cron
 */
async function verificarSistema() {
  try {
    await execAsync('which crontab');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Configurador de Cron para ControlDoc Notificaciones');
  console.log('='.repeat(60));
  
  const soportaCron = await verificarSistema();
  
  if (soportaCron) {
    console.log('✅ Sistema soporta cron jobs');
    
    const configurado = await configurarCronJob();
    
    if (configurado) {
      console.log('\n🎉 ¡Configuración completada!');
      console.log('📧 Las notificaciones se enviarán automáticamente todos los días a las 9:00 AM');
    } else {
      console.log('\n⚠️  No se pudo configurar automáticamente');
      mostrarInstruccionesManuales();
    }
  } else {
    console.log('❌ Sistema no soporta cron jobs');
    console.log('💡 Considera usar un servicio de cron en la nube como:');
    console.log('   - GitHub Actions');
    console.log('   - Render Cron Jobs');
    console.log('   - Vercel Cron');
    console.log('   - Heroku Scheduler');
    
    mostrarInstruccionesManuales();
  }
  
  console.log('\n🔗 ENDPOINTS DISPONIBLES:');
  console.log('   POST /api/notifications/send-expiration-notifications');
  console.log('   GET  /api/notifications/test');
  
  console.log('\n📚 DOCUMENTACIÓN:');
  console.log('   - Ver README.md para más detalles');
  console.log('   - Revisar logs en la consola del servidor');
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
