-- Normalizar todos los emails a lowercase y crear índice case-insensitive
-- Ejecutar en Supabase SQL Editor

-- 1) Normalizar emails existentes en usuarios a lowercase
UPDATE usuarios SET email = LOWER(email) WHERE email != LOWER(email);

-- 2) Crear índice UNIQUE case-insensitive en usuarios.email
-- Esto permite que PostgREST encuentre el email sin importar mayúsculas
DROP INDEX IF EXISTS usuarios_email_lower CASCADE;
CREATE UNIQUE INDEX usuarios_email_lower ON usuarios (LOWER(email));

-- 3) Normalizar emails en candidatos (por si acaso)
UPDATE candidatos SET email = LOWER(email) WHERE email != LOWER(email);

-- 4) Crear índice case-insensitive en candidatos también
DROP INDEX IF EXISTS candidatos_email_lower CASCADE;
CREATE UNIQUE INDEX candidatos_email_lower ON candidatos (LOWER(email));

-- 5) Normalizar cv_express
UPDATE cv_express SET email = LOWER(email) WHERE email != LOWER(email);
DROP INDEX IF EXISTS cv_express_email_lower CASCADE;
CREATE UNIQUE INDEX cv_express_email_lower ON cv_express (LOWER(email));

-- 6) Verificación: contar emails duplicados (case-insensitive) que ahora serían problema
-- Esto NO debería retornar filas si todo está correcto
SELECT LOWER(email) as email_lower, COUNT(*) as cant FROM usuarios
GROUP BY LOWER(email) HAVING COUNT(*) > 1;
