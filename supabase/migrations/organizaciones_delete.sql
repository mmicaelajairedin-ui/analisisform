-- Habilitar DELETE en organizaciones
-- Permite que los admins eliminen organizaciones completamente

-- Tabla existente - solo agregamos permisos
-- No modificamos la estructura, solo abrimos DELETE vía REST API

-- RLS para DELETE en organizaciones:
-- Un usuario autenticado como admin puede eliminar cualquier org
-- Un owner solo puede eliminar su propia org (cuando sea implementado)

-- Por ahora, permitir DELETE a cualquier usuario autenticado que sea admin
-- (El filtro de admin lo hace el frontend en panel-v2.html)

-- Nota: El RLS estricto se implementará cuando se cierre la Capa 3 en SECURITY MODEL
-- Por ahora confiamos en el filtro del frontend (state.adminTab === 'coaches')
