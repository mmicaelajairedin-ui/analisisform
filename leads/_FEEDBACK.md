# Feedback de producto (de usuarios reales)

Registro de feedback para mejorar Pathway / cv-express. No se publica.

## 2026-05-18 — Usuaria cv-express (WhatsApp +54 9 11 3678-2305)
Perfil: abogada reposicionándose a bienestar laboral.

**Lo que le gustó (lo más fuerte):**
- 🟢 Devolución de **LinkedIn**: aptitudes y palabras clave que no tenía en
  cuenta. "Muy copado."
- 🟢 **Carta de presentación**: buen enfoque que no se le había ocurrido;
  mezcló su experiencia en derecho con herramientas de bienestar laboral.
- Le gustó poder cambiar color/letra; valoró las 2 versiones de CV.

**Lo que hay que mejorar (accionable):**
1. 🔴 **CV demasiado largo / no depurado al puesto objetivo.** Sintió que
   solo le cambió formato y tiempos verbales pero no recortó la experiencia
   que no suma al rol al que aplica. "Muy extenso y un poco confuso."
   → Ajustar el prompt de generación de CV (`supabase/functions/generar-informe/index.ts`):
   priorizar y **recortar** experiencia según el objetivo, ser conciso,
   límite de extensión. (Requiere redeploy de la edge function — no se
   publica solo con el sitio estático.)
2. 🔴 **No descubrió que el CV se podía editar.** "Ahhh no, no me di cuenta."
   Recién lo vio cuando Mica se lo dijo. → Hacer la edición obvia en
   cv-express post-pago (banner/CTA "✏️ Editá todo tu CV acá", tooltip, etc.).

**Estado:** posible testimonio (quedó contenta: "está muy bueno, gracias por
la oportunidad"). Pedirle reseña.
