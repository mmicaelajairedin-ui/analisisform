// Pathway — Modal "Ver demo" con email gate.
//
// Captura el email del visitante antes de mostrar el video Loom de la
// demo. El email se guarda en `leads_pricing` con pagina='demo-request'
// para que aparezca en el panel admin (sub-tab Popup pricing → distinguible
// por la columna Página).
//
// Loom también tiene activado "Request email to view" como red de seguridad
// por si alguien comparte la URL directa, así nadie ve el video sin email
// aunque se brinque este modal.
//
// Uso desde cualquier landing pública:
//   <script src="demo-popup.js"></script>
//   <a href="#" data-open-demo-popup>Ver demo</a>
//
// Configurable vía atributos del <body>:
//   data-demo-loom-id="72bbe92b..." (default abajo)
//   data-demo-pagina="soy-coach"   (default: nombre del archivo)

(function(){
  'use strict';

  var SB='https://ddxnrsnjdvtqhxunxnwj.supabase.co';
  var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

  // Loom ID del video de demo. Si en el futuro se cambia el video,
  // editar acá o setear data-demo-loom-id en el <body>.
  var DEFAULT_LOOM_ID='72bbe92b3f704518abd768417ed30991';

  function getLoomId(){
    var b=document.body && document.body.getAttribute('data-demo-loom-id');
    return b||DEFAULT_LOOM_ID;
  }

  function getPagina(){
    var p=document.body && document.body.getAttribute('data-demo-pagina');
    if(p)return p;
    var path=window.location.pathname.replace(/^\//,'').replace(/\.html$/,'');
    return (path||'index')+'-demo';
  }

  function isValidEmail(s){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||'');
  }

  function buildOverlay(){
    var ov=document.createElement('div');
    ov.id='pw-demo-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(27,46,38,.65);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:pwDemoFade .25s ease;';

    var card=document.createElement('div');
    card.style.cssText='background:#fff;border-radius:18px;padding:32px 30px 26px;max-width:480px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.18);position:relative;font-family:Inter,-apple-system,sans-serif;animation:pwDemoSlide .3s ease;';

    card.innerHTML=''
      +'<button data-pw-close style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:22px;cursor:pointer;color:#9E9E9E;line-height:1;padding:4px 8px;border-radius:6px;" aria-label="Cerrar">×</button>'
      +'<div style="display:inline-block;background:rgba(82,183,136,.15);color:#2D6A4F;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:100px;margin-bottom:16px;">DEMO · 4 MIN</div>'
      +'<h3 style="font-family:Fraunces,Georgia,serif;font-size:26px;font-weight:500;color:#1B2E26;letter-spacing:-.6px;line-height:1.18;margin:0 0 10px;">Mirá Pathway en 4 minutos</h3>'
      +'<p style="font-size:14px;color:#4A4444;line-height:1.55;margin:0 0 18px;">Dejá tu email y te muestro la plataforma — qué ves vos como coach y qué ve tu cliente. Sin agendar nada.</p>'
      +'<form data-pw-form style="display:flex;flex-direction:column;gap:10px;">'
        +'<input data-pw-email type="email" required placeholder="tu@email.com" style="width:100%;padding:12px 14px;border:1.5px solid #E5E0DD;border-radius:10px;font-size:14px;font-family:Inter,sans-serif;outline:none;color:#1B2E26;transition:border-color .15s;" onfocus="this.style.borderColor=\'#2D6A4F\';" onblur="this.style.borderColor=\'#E5E0DD\';">'
        +'<button type="submit" data-pw-submit style="width:100%;padding:13px;background:#2D6A4F;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:Inter,sans-serif;cursor:pointer;transition:background .15s;">Ver el video →</button>'
      +'</form>'
      +'<div data-pw-status style="font-size:12px;color:#9E9E9E;margin-top:12px;text-align:center;line-height:1.5;min-height:18px;"></div>'
      +'<div style="font-size:11px;color:#9E9E9E;margin-top:10px;text-align:center;">Sin spam. Solo te escribimos si querés probar la plataforma.</div>';

    ov.appendChild(card);
    return ov;
  }

  function buildVideoOverlay(){
    var ov=document.createElement('div');
    ov.id='pw-demo-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(27,46,38,.85);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:pwDemoFade .25s ease;';

    var card=document.createElement('div');
    card.style.cssText='background:#000;border-radius:14px;max-width:920px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.4);position:relative;font-family:Inter,-apple-system,sans-serif;animation:pwDemoSlide .3s ease;overflow:hidden;';

    var loomId=getLoomId();
    card.innerHTML=''
      +'<button data-pw-close style="position:absolute;top:10px;right:14px;background:rgba(0,0,0,.5);border:none;font-size:22px;cursor:pointer;color:#fff;line-height:1;padding:6px 12px;border-radius:50px;z-index:2;" aria-label="Cerrar">×</button>'
      +'<div style="position:relative;padding-bottom:62.5%;height:0;background:#000;">'
        +'<iframe src="https://www.loom.com/embed/'+loomId+'?autoplay=1" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>'
      +'</div>';

    ov.appendChild(card);
    return ov;
  }

  function injectStyles(){
    if(document.getElementById('pw-demo-styles'))return;
    var s=document.createElement('style');
    s.id='pw-demo-styles';
    s.textContent=''
      +'@keyframes pwDemoFade{from{opacity:0;}to{opacity:1;}}'
      +'@keyframes pwDemoSlide{from{transform:translateY(20px);opacity:0;}to{transform:translateY(0);opacity:1;}}'
      +'#pw-demo-overlay button[data-pw-submit]:hover{background:#1B4332;}'
      +'#pw-demo-overlay button[data-pw-close]:hover{background:#F5F0F0;}';
    document.head.appendChild(s);
  }

  function dismiss(){
    var ov=document.getElementById('pw-demo-overlay');
    if(ov)ov.remove();
  }

  function showVideo(){
    dismiss();
    injectStyles();
    var ov=buildVideoOverlay();
    document.body.appendChild(ov);
    ov.querySelector('[data-pw-close]').addEventListener('click',function(){dismiss();});
    ov.addEventListener('click',function(e){if(e.target===ov)dismiss();});
  }

  function handleSubmit(form){
    var emailEl=form.querySelector('[data-pw-email]');
    var btn=form.querySelector('[data-pw-submit]');
    var st=document.querySelector('#pw-demo-overlay [data-pw-status]');
    var email=(emailEl.value||'').trim().toLowerCase();
    if(!isValidEmail(email)){
      st.textContent='Email inválido';
      st.style.color='#c0756e';
      return;
    }
    btn.disabled=true;btn.textContent='Cargando...';
    st.textContent='';st.style.color='#9E9E9E';

    var pagina=getPagina();
    var loomId=getLoomId();
    // Insert (o upsert) en leads_pricing — el panel admin (sub-tab Popup
    // pricing) ya muestra esta tabla y la columna `pagina` distingue
    // 'demo-request' de los leads del popup de pricing.
    fetch(SB+'/rest/v1/leads_pricing',{
      method:'POST',
      headers:{
        'apikey':KEY,
        'Authorization':'Bearer '+KEY,
        'Content-Type':'application/json',
        'Prefer':'resolution=merge-duplicates,return=minimal'
      },
      body:JSON.stringify({
        email:email,
        pagina:pagina,
        metadata:{source:'demo-request',loom_id:loomId,ua:navigator.userAgent.slice(0,160)}
      })
    }).then(function(r){
      // 201 created, 204 no content (merge-duplicates), 200 OK son todos OK
      if(!r.ok && r.status!==201 && r.status!==204){
        return r.text().then(function(t){throw new Error('save '+r.status+' '+t.slice(0,80));});
      }
    }).then(function(){
      // Mostrar el video. No esperamos al email — la red de seguridad
      // adicional es el "Request email to view" propio de Loom.
      showVideo();
    }).catch(function(err){
      console.error('[demo-popup] error',err);
      // Fallback: si falla guardar el email igual mostramos el video
      // — preferimos un visitante feliz a uno bloqueado por un bug.
      // El Loom email-gate sigue funcionando como red de seguridad.
      showVideo();
    });
  }

  function showEmailGate(){
    if(document.getElementById('pw-demo-overlay'))return;
    injectStyles();
    var ov=buildOverlay();
    document.body.appendChild(ov);
    ov.querySelector('[data-pw-close]').addEventListener('click',function(){dismiss();});
    ov.addEventListener('click',function(e){if(e.target===ov)dismiss();});
    var form=ov.querySelector('[data-pw-form]');
    form.addEventListener('submit',function(e){e.preventDefault();handleSubmit(form);});
    setTimeout(function(){ov.querySelector('[data-pw-email]').focus();},150);
  }

  function init(){
    document.addEventListener('click',function(e){
      var t=e.target.closest('[data-open-demo-popup]');
      if(!t)return;
      e.preventDefault();
      showEmailGate();
    });
  }

  // Exponer global por si algún botón usa onclick directo.
  window.openDemoPopup=showEmailGate;

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }
})();
