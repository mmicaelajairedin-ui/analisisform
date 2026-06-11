-- WhatsApp del cliente (el formulario no lo pide; lo carga el coach en Perfil).
-- Lo usa el botón de WhatsApp de la ficha (rail + cabecera) para escribirle al cliente.
-- Correr UNA vez en Supabase (SQL Editor) ANTES de desplegar el cambio del panel.
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS whatsapp TEXT;
