-- Restos del andamiaje de la ronda anterior: la retirada los nombró sin firma y
-- PostgreSQL no los borró. Un `drop function` sin argumentos NO casa una función
-- con parámetros, y no avisa cuando lleva `if exists`: se lee como hecho.
drop function if exists public.mc_verificar_lectura(uuid);
drop function if exists public.mc_verificar_privilegio(text, text);