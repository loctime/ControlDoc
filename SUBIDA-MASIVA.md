SUBIDA MASIVA V2 — VEHICLE
1. Objetivo

Implementar un sistema de carga masiva inteligente para vehículos donde:

El usuario sube múltiples archivos (PDF/JPG/PNG).

El sistema sugiere:

Vehículo (detectando patente).

Documento requerido (entre los requiredDocuments entityType = "vehicle").

El usuario revisa y confirma manualmente.

Solo al final se realiza el commit y se crean los documentos definitivos.

No existe automatización de decisiones.

Todo queda auditado.

El sistema actúa como asistente inteligente, no como decisor.

2. Principios

Sin auto-commit.

Sin decisiones automáticas.

UX simple, pantalla única.

Backend orquesta.

Frontend solo muestra estado y permite edición.

Seguridad multi-tenant estricta (companyId derivado del token).

Reutilizar lógica actual de subida (ModalDocument + uploadFile).

3. UX — Pantalla única

Ruta propuesta:

/bulk-upload/vehicles?clientId={id}

A. Dropzone

Arrastrar múltiples archivos.

Mostrar contador y tamaño total.

Estado general del job.

B. Tabla de revisión

Por archivo:

Vista previa

Patente detectada (chip)

Vehículo sugerido (Select con búsqueda)

Documento requerido sugerido (Select)

Confianza (High / Med / Low)

Campos detectados (fechas, posible vencimiento, etc.)

Estado: Procesando | Listo | Error

C. Filtros superiores

Mostrar: Todo | Solo baja confianza | Sin requerido | Sin vehículo

Buscador por patente o nombre de archivo

D. Acción final

Botón único:

"Confirmar asignaciones (X)"

Solo aquí se ejecuta el commit.

4. Datos existentes
Required Documents

Ruta:
/tenants/{tenantId}/requiredDocuments/{requiredId}

Campos relevantes:

entityType: "vehicle"

name

exampleImage

exampleMetadata.text

allowedFileTypes

Se recomienda agregar:

keywords: []

expectedFields: []

docCategory

Vehículos

Ruta:
/tenants/{tenantId}/vehiculos/{vehicleId}

Campos:

patente

clientId

companyId

activo

5. Modelo Firestore V2
5.1 Bulk Job

/tenants/{tenantId}/bulkJobs/{jobId}

Campos:

tenantId

createdBy { uid, email }

companyId (derivado del token)

clientId (opcional)

mode: "vehicle"

status: uploading | processing | review | committed | canceled

counts { total, processed, needsReview, confirmed, errors }

createdAt

updatedAt

5.2 Files

/tenants/{tenantId}/bulkJobs/{jobId}/files/{fileId}

Campos:

originalName

mime

size

staging { bucket, path, url }

status: uploaded | analyzed | needs_review | confirmed | committed | error

analysis:

ocrText (extracto)

detected:

patentes[]

fechas[]

possibleExpirationDate

numbers[]

suggestions:

vehicleCandidates[]

requiredCandidates[]

suggestedVehicleId

suggestedRequiredId

confidenceVehicle

confidenceRequired

decision:

finalVehicleId

finalRequiredId

finalExpirationDate

confirmedBy

confirmedAt

errors[]

6. Motor de sugerencias
6.1 Detectar patente

Detectar variantes:

ABC123

AB123CD

123ABC

Normalizar:

mayúsculas

sin espacios

sin guiones

6.2 Sugerir vehículo

Buscar match exacto por patente.

Filtrar:

activo == true

companyId del usuario

clientId si aplica

Confianza:

High: 1 match exacto

Med: múltiples matches

Low: ninguno

6.3 Sugerir requerido

Solo usar requiredDocuments con:

entityType == "vehicle"

aplicables al clientId

Scoring simple:

Coincidencia keywords

Presencia de expectedFields

Similitud básica con exampleMetadata.text

Presencia de fechas si aplica

Devolver top 5.

7. API
POST /api/bulk/v2/vehicles/jobs

Crear job.

POST /api/bulk/v2/vehicles/jobs/{jobId}/files

Crear fileId y preparar staging.

POST /api/bulk/v2/vehicles/jobs/{jobId}/start

Iniciar análisis.

GET /api/bulk/v2/vehicles/jobs/{jobId}

Estado general.

GET /api/bulk/v2/vehicles/jobs/{jobId}/files

Lista con sugerencias.

PATCH /api/bulk/v2/vehicles/jobs/{jobId}/files/{fileId}/decision

Guardar decisión del usuario.

POST /api/bulk/v2/vehicles/jobs/{jobId}/commit

Crear documentos finales usando la misma lógica actual de ModalDocument.

8. Qué queda fuera

Auto-commit

IA generativa

Embeddings

Aprendizaje automático

Separación compleja de PDFs

9. Resultado esperado

El usuario sube 30 archivos.

El sistema sugiere vehículo y requerido.

El usuario revisa y confirma.

Se crean documentos como hoy, pero en lote.

Auditoría completa entre sugerencia y decisión.