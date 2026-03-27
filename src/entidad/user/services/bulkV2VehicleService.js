/**
 * Cliente API para Bulk Upload V2 — Vehicle.
 * Todas las llamadas requieren token (Bearer).
 */
const BASE = `${import.meta.env.VITE_API_URL || ''}/api/bulk/v2/vehicles`;

async function request(method, url, token, body = null, formData = null) {
  const headers = {
    Authorization: `Bearer ${token}`
  };
  if (!formData) headers['Content-Type'] = 'application/json';
  const options = { method, headers };
  if (body && !formData) options.body = JSON.stringify(body);
  if (formData) options.body = formData;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || res.statusText || 'Error en la solicitud');
  return data;
}

export async function createJob(token, clientId = null) {
  return request('POST', `${BASE}/jobs`, token, clientId != null ? { clientId } : {});
}

export async function getJob(token, jobId) {
  return request('GET', `${BASE}/jobs/${jobId}`, token);
}

export async function getJobFiles(token, jobId) {
  return request('GET', `${BASE}/jobs/${jobId}/files`, token);
}

export async function uploadJobFile(token, jobId, file) {
  const form = new FormData();
  form.append('file', file, file.name);
  return request('POST', `${BASE}/jobs/${jobId}/files`, token, null, form);
}

export async function startJob(token, jobId) {
  return request('POST', `${BASE}/jobs/${jobId}/start`, token);
}

export async function patchFileDecision(token, jobId, fileId, decision) {
  return request('PATCH', `${BASE}/jobs/${jobId}/files/${fileId}/decision`, token, decision);
}

export async function commitJob(token, jobId) {
  return request('POST', `${BASE}/jobs/${jobId}/commit`, token);
}
