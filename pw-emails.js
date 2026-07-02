/* ============================================================
   pw-emails.js — Plantillas de email DISEÑADAS (única fuente).
   Mismos diseños de la galería, sin pie (abajo va la firma del empleado).
   window.PW_TEMPLATES = [{ n, nicho, s, build(nombre) -> html }]
   ============================================================ */
(function(g){
  var WEB="https://pathwaycareercoach.com";
  var DEMO="https://calendly.com/mmicaela-jairedin/pathway-demo";
  var LLAMADA="https://calendly.com/mmicaela-jairedin/30min";
  var LOGO="https://pathwaycareercoach.com/logo-horizontal.png";

  function esc(s){ return (""+(s==null?"":s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function N(s,nombre){ return (s||"").replace(/\{Nombre\}/g, nombre||""); }

  var HEADER='<tr><td style="padding:20px 32px;border-bottom:1px solid #F0F4F0;"><img src="'+LOGO+'" width="140" alt="Pathway" style="display:block;border:0;"></td></tr>';
  function WRAP(rows){
    return '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#EFF3EE;padding:18px;font-family:Arial,Helvetica,sans-serif;"><tr><td align="center">'
      + '<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E7EFE8;">'
      + rows + '</table></td></tr></table>';
  }
  function BTN(href,label,bg,fg){ bg=bg||"#2D6A4F"; fg=fg||"#ffffff";
    return '<table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="'+bg+'" style="border-radius:10px;"><a href="'+href+'" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1;font-weight:bold;color:'+fg+';text-decoration:none;border-radius:10px;">'+label+'</a></td></tr></table>'; }
  function step(n,t,d){
    return '<tr><td width="46" style="padding:13px 0 13px 16px;vertical-align:top;"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="30" height="30" bgcolor="#2D6A4F" align="center" style="border-radius:50%;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#fff;">'+n+'</td></tr></table></td>'
      + '<td style="padding:13px 16px 13px 12px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;font-weight:bold;color:#1B2E26;">'+t+'</div><div style="font-size:13.5px;color:#5A6B62;line-height:1.5;margin-top:2px;">'+d+'</div></td></tr>';
  }

  var T=[
    { n:"La pregunta incómoda", nicho:"general", s:"{Nombre}, ¿tu marca o una plantilla genérica?", build:function(nm){ return WRAP(HEADER
      +'<tr><td style="padding:32px 32px 28px;font-family:Arial,Helvetica,sans-serif;">'
      +'<div style="font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#52B788;">Hola '+esc(nm)+'</div>'
      +'<div style="font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#1B2E26;font-weight:bold;margin:8px 0 16px;">¿Tu marca… o una plantilla genérica?</div>'
      +'<div style="font-size:15px;line-height:1.65;color:#42514A;">Cuando le envías un CV o un plan a tu cliente, ¿lleva <b>tu logo y tu color</b>… o el de una web cualquiera?<br><br>Creamos <b>Pathway</b> para eso: tus clientes entran a un portal con tu marca y la IA hace el trabajo pesado.</div>'
      +'<div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>'+BTN(DEMO,"Verlo en 11 minutos →")+'</td></tr>'); } },

    { n:"Invitación a demo", nicho:"general", s:"11 minutos y te muestro tu plataforma, {Nombre}", build:function(nm){ return WRAP(
      '<tr><td bgcolor="#2D6A4F" style="padding:40px 34px;text-align:center;font-family:Arial,Helvetica,sans-serif;">'
      +'<div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#B7E4C7;font-weight:bold;">Pathway</div>'
      +'<div style="font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#fff;font-weight:bold;margin:12px 0 10px;">11 minutos. Un café.<br>Tu plataforma con IA.</div>'
      +'<div style="font-size:15px;line-height:1.6;color:#DFF3E6;margin-bottom:22px;">Sin “media hora para conocernos”. Te muestro todo y sales sabiendo si te sirve.</div>'
      +BTN(DEMO,"Reservar mi demo","#ffffff","#2D6A4F")+'</td></tr>'
      +'<tr><td style="padding:28px 34px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#42514A;">Hola '+esc(nm)+', te comparto pantalla y te muestro el portal con tu marca y las herramientas de IA. Sin compromiso.</td></tr>'); } },

    { n:"Tu servicio con tu marca", nicho:"carrera", s:"cómo se vería tu servicio con tu propia marca", build:function(nm){ return WRAP(HEADER
      +'<tr><td style="padding:30px 32px 8px;font-family:Arial,Helvetica,sans-serif;"><div style="font-family:Georgia,serif;font-size:23px;color:#1B2E26;font-weight:bold;margin-bottom:8px;">Tu servicio, con cara de producto</div><div style="font-size:15px;line-height:1.6;color:#42514A;">Hola '+esc(nm)+', esto verían tus clientes con Pathway:</div></td></tr>'
      +'<tr><td style="padding:10px 32px 4px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F8F3;border-radius:12px;">'
      +step("1","Tu marca, no la nuestra","Portal con tu logo, tu color y tu link.")
      +step("2","La IA hace lo pesado","CV, LinkedIn e informes en minutos.")
      +step("3","Tus clientes ven su avance","Progreso semana a semana, en un lugar.")
      +'</table></td></tr>'
      +'<tr><td style="padding:20px 32px 32px;font-family:Arial,Helvetica,sans-serif;">'+BTN(DEMO,"Quiero verlo con mi marca →")+'</td></tr>'); } },

    { n:"Testimonio", nicho:"general", s:"de un Excel caótico a portal propio en una tarde", build:function(nm){ return WRAP(HEADER
      +'<tr><td style="padding:30px 32px 10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#42514A;">Hola '+esc(nm)+', una coach que empezó como quizá estés vos hoy me dijo esto tras una semana:</td></tr>'
      +'<tr><td style="padding:6px 32px 8px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="5" bgcolor="#52B788"></td><td style="padding:18px 22px;background:#F4F8F3;font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.5;color:#26473A;">“Pasé de un Excel caótico a un portal con mi marca en una tarde.”</td></tr></table></td></tr>'
      +'<tr><td style="padding:20px 32px 32px;font-family:Arial,Helvetica,sans-serif;">'+BTN(DEMO,"Ver la demo (11 min) →")+'</td></tr>'); } },

    { n:"Prueba de 14 días", nicho:"general", s:"tu prueba de 14 días está lista, {Nombre}", build:function(nm){ return WRAP(HEADER
      +'<tr><td style="padding:30px 32px 6px;font-family:Arial,Helvetica,sans-serif;"><div style="font-family:Georgia,serif;font-size:23px;color:#1B2E26;font-weight:bold;">Tu prueba de 14 días está lista 🎉</div><div style="font-size:15px;color:#42514A;line-height:1.6;margin-top:8px;">Hola '+esc(nm)+', activarla te lleva 3 pasos:</div></td></tr>'
      +'<tr><td style="padding:10px 32px 4px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">'
      +step("1","Entrá con tu acceso","Sin tarjeta.")+step("2","Cargá un cliente real","Y mirá tu portal con marca.")+step("3","Contame qué te pareció","Te acompaño por WhatsApp.")
      +'</table></td></tr><tr><td style="padding:20px 32px 32px;font-family:Arial,Helvetica,sans-serif;">'+BTN(WEB,"Activar mi prueba →")+'</td></tr>'); } },

    { n:"Para candidato", nicho:"carrera", s:"{Nombre}, tu CV merece una segunda mirada", build:function(nm){ return WRAP(HEADER
      +'<tr><td style="padding:30px 32px 8px;font-family:Arial,Helvetica,sans-serif;"><div style="font-family:Georgia,serif;font-size:23px;color:#1B2E26;font-weight:bold;">Tu CV merece una segunda mirada</div><div style="font-size:15px;color:#42514A;line-height:1.6;margin-top:8px;">Hola '+esc(nm)+', si estás enviando CVs y no te responden, muchas veces no es tu perfil… es el formato.</div></td></tr>'
      +'<tr><td style="padding:8px 32px 8px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#FBF4E2" align="center" style="border-radius:12px;padding:20px;"><div style="font-family:Georgia,serif;font-size:32px;font-weight:bold;color:#C99A2E;line-height:1;">75%</div><div style="font-family:Arial,Helvetica,sans-serif;font-size:13.5px;color:#7A5F16;margin-top:6px;">de los CV los filtra un robot antes de llegar a un humano.</div></td></tr></table></td></tr>'
      +'<tr><td style="padding:18px 32px 32px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;color:#42514A;line-height:1.6;">30 minutos, gratis, para ordenar tu búsqueda.</div><div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>'+BTN(LLAMADA,"Agendar mi llamada gratis →")+'</td></tr>'); } }
  ];
  g.PW_TEMPLATES = T;
})(window);
