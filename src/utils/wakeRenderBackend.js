/**
 * Un único ping CORS al backend (p. ej. despertar Render) por sesión de pestaña.
 * Evita mode: 'no-cors', que provoca respuestas opacas y errores confusos en DevTools.
 */
const SESSION_KEY = 'renderPinged';

export async function wakeRenderBackendOnce() {
  if (typeof sessionStorage === 'undefined') return;
  const raw = import.meta.env.VITE_API_URL;
  if (!raw || sessionStorage.getItem(SESSION_KEY) === 'true') return;
  const base = String(raw).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/ping`, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store'
    });
    if (res.ok) {
      sessionStorage.setItem(SESSION_KEY, 'true');
    }
  } catch {
    // Red o backend caído; no marcar como completado para reintentar más tarde
  }
}
