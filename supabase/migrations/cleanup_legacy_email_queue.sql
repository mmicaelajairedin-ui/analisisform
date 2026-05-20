-- Limpieza de email_queue: filas heredadas del modelo viejo "trial con tarjeta"
--
-- Contexto: el `registro.html` viejo programaba 3 emails (trial_day_7,
-- trial_day_13, trial_day_14) bajo el supuesto de que Stripe iba a cobrar
-- la tarjeta automáticamente al dia 14. En particular, `trial_day_14` decia
-- "Tu suscripción a Pathway está activa 🌱 — tu trial terminó y se activó
-- tu plan de €58/mes" — lo cual hoy es FALSO porque el modelo nuevo es
-- "trial sin tarjeta": el coach jamás cargó tarjeta y nada se activa
-- automáticamente.
--
-- Estas filas siguen en email_queue y se siguen enviando, dando información
-- incorrecta a los coaches. Las cancelamos.
--
-- El flow nuevo (en registro.html y auth-callback.html post-cutover) usa
-- trial_day_7, trial_day_13 y trial_day_15_post con copy honesto. El
-- defensa en send-queued-emails ahora también descarta cualquier trial_*
-- pendiente cuando el coach es admin, vitalicio, ya pagante o inactivo.
--
-- Correr esto UNA vez en Supabase (Studio → SQL Editor).

-- Diagnostico previo (ver que vamos a cancelar):
SELECT plantilla_id, status, count(*),
       min(scheduled_at) AS earliest,
       max(scheduled_at) AS latest
FROM email_queue
WHERE status = 'pending'
  AND plantilla_id IN ('trial_day_7', 'trial_day_14', 'recovery_5min')
GROUP BY plantilla_id, status;

-- Cancelacion: trial_day_14 (el peor: miente afirmando que la suscripcion
-- esta activa cuando no se cargó tarjeta).
UPDATE email_queue
SET status = 'canceled',
    error_msg = 'legacy trial_day_14 from card-on-file model: claimed subscription auto-activated, but new model is trial-without-card'
WHERE status = 'pending'
  AND plantilla_id = 'trial_day_14';

-- Cancelacion: trial_day_7 viejos. El body viejo linkeaba a `panel.html`
-- (URL que ya no existe — cutover a panel-v2.html). send-queued-emails
-- reescribe panel.html → panel-v2.html automaticamente, pero el cuerpo
-- está pensado para el modelo viejo y referencia "trial con tarjeta".
-- El registro.html nuevo va a programar trial_day_7 nuevamente con copy
-- correcto para los signups de ahora en mas.
UPDATE email_queue
SET status = 'canceled',
    error_msg = 'legacy trial_day_7 from card-on-file model'
WHERE status = 'pending'
  AND plantilla_id = 'trial_day_7'
  AND created_at < NOW() - INTERVAL '1 hour';

-- Cancelacion: recovery_5min. El body afirma "vi que te registraste pero no
-- llegaste a entrar al panel". Falso: el auth-callback redirige al panel
-- inmediatamente. La promesa del comentario era que panel-v2.html iba a
-- borrar la fila al primer login — esa logica nunca se implementó. Ya no
-- se programa en el codigo nuevo.
UPDATE email_queue
SET status = 'canceled',
    error_msg = 'legacy recovery_5min: was meant to be canceled on first panel login but cleanup never implemented'
WHERE status = 'pending'
  AND plantilla_id = 'recovery_5min';

-- Verificacion final:
SELECT plantilla_id, status, count(*)
FROM email_queue
WHERE plantilla_id IN ('trial_day_7', 'trial_day_13', 'trial_day_14', 'trial_day_15_post', 'recovery_5min')
GROUP BY plantilla_id, status
ORDER BY plantilla_id, status;
