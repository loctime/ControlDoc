#!/usr/bin/env node

/**
 * Script para enviar notificaciones de vencimientos
 * Se puede ejecutar manualmente o como cron job
 * 
 * Uso:
 * node scripts/sendExpirationNotifications.js
 * 
 * O programar en cron:
 * 0 9 * * * cd /path/to/backend && node scripts/sendExpirationNotifications.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const NOTIFICATION_ENDPOINT = `${API_BASE_URL}/api/notifications/send-expiration-notifications`;

/**
 * Función principal para ejecutar las notificaciones
 */
async function ejecutarNotificaciones() {
  console.log('🚀 Iniciando proceso de notificaciones de vencimientos...');
  console.log(`📡 Endpoint: ${NOTIFICATION_ENDPOINT}`);
  console.log(`⏰ Fecha: ${new Date().toLocaleString('es-AR')}`);
  
  try {
    const response = await fetch(NOTIFICATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Notificaciones enviadas exitosamente');
      console.log('📊 Detalles:', JSON.stringify(result.details, null, 2));
    } else {
      console.error('❌ Error en las notificaciones:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando notificaciones:', error.message);
    process.exit(1);
  }
}

/**
 * Función para probar el sistema de notificaciones
 */
async function probarSistema() {
  console.log('🧪 Probando sistema de notificaciones...');
  
  try {
    const testEndpoint = `${API_BASE_URL}/api/notifications/test`;
    const response = await fetch(testEndpoint);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Sistema de notificaciones funcionando correctamente');
      console.log('📊 Datos de prueba:', JSON.stringify(result.testData, null, 2));
    } else {
      console.error('❌ Error en el test:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error probando sistema:', error.message);
  }
}

// Manejo de argumentos de línea de comandos
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'test':
    await probarSistema();
    break;
  case 'send':
  default:
    await ejecutarNotificaciones();
    break;
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  await ejecutarNotificaciones();
}
