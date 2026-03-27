#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Script para limpiar puertos ocupados antes de ejecutar el servidor
 * Funciona en Windows, Linux y macOS
 */

const PORTS_TO_CHECK = [3001, 5173, 5174, 5175, 5176, 5177];

async function killProcessOnPort(port) {
  try {
    console.log(`🔍 Verificando puerto ${port}...`);
    
    let command, pidPattern;
    
    if (process.platform === 'win32') {
      // Windows
      command = `netstat -ano | findstr ":${port}"`;
      try {
        const { stdout } = await execAsync(command);
      
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            
            if (pid && pid !== '0') {
              console.log(`🔥 Matando proceso PID ${pid} en puerto ${port}...`);
              try {
                await execAsync(`taskkill /PID ${pid} /F`);
                console.log(`✅ Proceso eliminado del puerto ${port}`);
              } catch (error) {
                if (error.message.includes('no se encontró el proceso')) {
                  console.log(`✅ Proceso ya terminado en puerto ${port}`);
                } else {
                  throw error;
                }
              }
            }
          }
        }
      } else {
        console.log(`✅ Puerto ${port} está libre`);
      }
      } catch (error) {
        if (error.code === 1) {
          console.log(`✅ Puerto ${port} está libre`);
        } else {
          throw error;
        }
      }
    } else {
      // Linux/macOS
      command = `lsof -ti:${port}`;
      try {
        const { stdout } = await execAsync(command);
        const pids = stdout.trim().split('\n').filter(pid => pid);
        
        for (const pid of pids) {
          console.log(`🔥 Matando proceso PID ${pid} en puerto ${port}...`);
          await execAsync(`kill -9 ${pid}`);
          console.log(`✅ Proceso eliminado del puerto ${port}`);
        }
      } catch (error) {
        if (error.code === 1) {
          console.log(`✅ Puerto ${port} está libre`);
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    console.log(`⚠️  Error verificando puerto ${port}:`, error.message);
  }
}

async function cleanupPorts() {
  console.log('🚀 Iniciando limpieza de puertos...\n');
  
  for (const port of PORTS_TO_CHECK) {
    await killProcessOnPort(port);
  }
  
  console.log('\n✨ Limpieza de puertos completada!');
  console.log('🎯 Ahora puedes ejecutar npm run dev sin problemas\n');
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupPorts().catch(console.error);
}

// Ejecutar siempre cuando se importa como script
cleanupPorts().catch(console.error);

export default cleanupPorts;
