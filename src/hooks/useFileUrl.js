// src/hooks/useFileUrl.js
// Resuelve fileId → URL temporal de descarga (TTL 5 min) con refresh automático.
// Fallback: si no hay fileId pero hay fileURL legacy, la retorna directamente.

import { useState, useEffect, useRef } from 'react';
import { getDownloadUrl } from '../utils/ControlFileStorage';

const TTL_MS = 5 * 60 * 1000;        // 5 minutos
const REFRESH_BEFORE_MS = 30 * 1000; // refrescar 30 seg antes de expirar

/**
 * @param {{ fileId?: string, fileURL?: string }} params
 * @returns {string | null} URL lista para usar en src/href (o null si aún cargando)
 */
export function useFileUrl({ fileId, fileURL } = {}) {
  const [resolvedUrl, setResolvedUrl] = useState(() => {
    // Si no hay fileId, retornar fileURL legacy de inmediato
    if (!fileId && fileURL) return fileURL;
    return null;
  });

  const timerRef = useRef(null);
  const abortRef = useRef(false);

  useEffect(() => {
    // Sin fileId → usar fileURL legacy directamente, sin efecto async
    if (!fileId) {
      setResolvedUrl(fileURL || null);
      return;
    }

    abortRef.current = false;

    async function fetchUrl() {
      try {
        const url = await getDownloadUrl(fileId);
        if (!abortRef.current) {
          setResolvedUrl(url);
          // Programar refresh antes de que expire
          timerRef.current = setTimeout(fetchUrl, TTL_MS - REFRESH_BEFORE_MS);
        }
      } catch (err) {
        console.warn('[useFileUrl] Error obteniendo URL de descarga:', err.message);
        // Fallback a fileURL legacy si existe
        if (!abortRef.current && fileURL) {
          setResolvedUrl(fileURL);
        }
      }
    }

    fetchUrl();

    return () => {
      abortRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fileId, fileURL]);

  return resolvedUrl;
}

export default useFileUrl;
