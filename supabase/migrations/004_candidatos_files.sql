-- P0-06: Persist client file uploads (plans, progress photos, session documents)
-- Adds JSONB columns to store file metadata in candidatos table

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS archivo_plan JSONB DEFAULT NULL;
-- Structure: { name: string, url: string, uploaded_at: timestamp }

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS archivos_progreso JSONB DEFAULT '[]'::jsonb;
-- Structure: [{ name: string, data_uri: string or url, uploaded_at: timestamp }, ...]

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS archivos_sesion JSONB DEFAULT '[]'::jsonb;
-- Structure: [{ name: string, url: string, uploaded_at: timestamp }, ...]

COMMENT ON COLUMN candidatos.archivo_plan IS
  'Coach uploads plan document for client (PDF, image). JSONB with name, url, timestamp.';

COMMENT ON COLUMN candidatos.archivos_progreso IS
  'Array of progress photos uploaded by coach for client. Each item has name, data_uri/url, timestamp.';

COMMENT ON COLUMN candidatos.archivos_sesion IS
  'Array of session documents uploaded by coach for client (PDFs, images, docs). Each item has name, url, timestamp.';
