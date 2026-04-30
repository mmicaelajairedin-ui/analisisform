// Pathway — Popup de pricing con email capture y oferta de 1 mes gratis.
//
// Se dispara la primera vez que el visitante llega a la sección de precios
// (Intersection Observer sobre el elemento [data-pricing-trigger]) o tras X
// segundos en la página, lo que ocurra primero.
//
// Captura email → guarda en Supabase (tabla leads_pricing) → manda mail con
// link a registro.html?ref=popup&email=<email>. El email es el identificador
// que correlaciona popup → registro → trial → pago.
//
// Uso desde cualquier landing pública:
//   <script src="pricing-popup.js"></script>
//   <!-- opcional: marcar la sección de precios para trigger por scroll -->
//   <section data-pricing-trigger>...precios...</section>
//
// Atributos del <body> opcionales:
//   data-popup-pagina="soy-coach" (default: window.location.pathname)
//   data-popup-disabled="1"  → desactiva el popup en esa página
//
// La oferta es simbólica (Stripe ya tiene 30d de trial configurado en los
// Payment Links). El código PATHWAY30 es un sello visual, no un coupon real.

(function(){
  'use strict';

  var SB='https://ddxnrsnjdvtqhxunxnwj.supabase.co';
  var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
  var CODIGO='PATHWAY30';
  var DISMISS_KEY='pw_popup_dismissed';
  var SHOWN_KEY='pw_popup_shown';
  var SCROLL_TRIGGER_DELAY_MS=8000; // fallback si la página no tiene [data-pricing-trigger]

  if(document.body && document.body.getAttribute('data-popup-disabled'))return;
  // Si el visitante ya lo cerró/envió en esta sesión o en visitas previas,
  // no lo molestamos de nuevo.
  if(localStorage.getItem(DISMISS_KEY)||sessionStorage.getItem(SHOWN_KEY))return;

  function getPagina(){
    var p=document.body && document.body.getAttribute('data-popup-pagina');
    if(p)return p;
    var path=window.location.pathname.replace(/^\//,'').replace(/\.html$/,'');
    return path||'index';
  }

  function isValidEmail(s){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||'');
  }

  function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function buildOverlay(){
    var ov=document.createElement('div');
    ov.id='pw-popup-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(27,46,38,.55);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:pwPopupFade .25s ease;';

    var card=document.createElement('div');
    card.style.cssText='background:#fff;border-radius:18px;padding:32px 30px 26px;max-width:440px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.18);position:relative;font-family:Inter,-apple-system,sans-serif;animation:pwPopupSlide .3s ease;';

    // Popup solo se usa en landings de coach (index + soy-coach). El
    // candidato no se suscribe a Pathway directamente — paga al coach.
    // Bonus: el trial estándar es 14d, este popup regala +14 días extra
    // (28 en total) para los que dejen email con código PATHWAY30.
    var titulo='🎁 +14 días extra al trial';
    var subtitulo='El trial estándar es 14 días — con este código sumás 14 más, total 28 días gratis. Te mandamos el link al email para que actives la suscripción.';
    var ctaTexto='Quiero los 14 días extra';

    card.innerHTML=''
      +'<button data-pw-close style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:22px;cursor:pointer;color:#9E9E9E;line-height:1;padding:4px 8px;border-radius:6px;" aria-label="Cerrar">×</button>'
      +'<div style="display:inline-block;background:rgba(82,183,136,.15);color:#2D6A4F;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:100px;margin-bottom:16px;">CÓDIGO '+CODIGO+'</div>'
      +'<h3 style="font-family:Fraunces,Georgia,serif;font-size:26px;font-weight:500;color:#1B2E26;letter-spacing:-.6px;line-height:1.18;margin:0 0 10px;">'+titulo+'</h3>'
      +'<p style="font-size:14px;color:#4A4444;line-height:1.55;margin:0 0 18px;">'+subtitulo+'</p>'
      +'<form data-pw-form style="display:flex;flex-direction:column;gap:10px;">'
        +'<input data-pw-email type="email" required placeholder="tu@email.com" style="width:100%;padding:12px 14px;border:1.5px solid #E5E0DD;border-radius:10px;font-size:14px;font-family:Inter,sans-serif;outline:none;color:#1B2E26;transition:border-color .15s;" onfocus="this.style.borderColor=\'#2D6A4F\';" onblur="this.style.borderColor=\'#E5E0DD\';">'
        +'<button type="submit" data-pw-submit style="width:100%;padding:13px;background:#2D6A4F;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:Inter,sans-serif;cursor:pointer;transition:background .15s;">'+ctaTexto+'</button>'
      +'</form>'
      +'<div data-pw-status style="font-size:12px;color:#9E9E9E;margin-top:12px;text-align:center;line-height:1.5;min-height:18px;"></div>'
      +'<div style="font-size:11px;color:#9E9E9E;margin-top:10px;text-align:center;">Sin spam. Podés darte de baja cuando quieras.</div>';

    ov.appendChild(card);
    return ov;
  }

  function injectStyles(){
    if(document.getElementById('pw-popup-styles'))return;
    var s=document.createElement('style');
    s.id='pw-popup-styles';
    s.textContent=''
      +'@keyframes pwPopupFade{from{opacity:0;}to{opacity:1;}}'
      +'@keyframes pwPopupSlide{from{transform:translateY(20px);opacity:0;}to{transform:translateY(0);opacity:1;}}'
      +'#pw-popup-overlay button[data-pw-submit]:hover{background:#1B4332;}'
      +'#pw-popup-overlay button[data-pw-close]:hover{background:#F5F0F0;}';
    document.head.appendChild(s);
  }

  function dismiss(persist){
    var ov=document.getElementById('pw-popup-overlay');
    if(ov)ov.remove();
    sessionStorage.setItem(SHOWN_KEY,'1');
    if(persist)localStorage.setItem(DISMISS_KEY,Date.now().toString());
  }

  function handleSubmit(form){
    var emailEl=form.querySelector('[data-pw-email]');
    var btn=form.querySelector('[data-pw-submit]');
    var st=document.querySelector('#pw-popup-overlay [data-pw-status]');
    var email=(emailEl.value||'').trim().toLowerCase();
    if(!isValidEmail(email)){
      st.textContent='Email inválido';
      st.style.color='#c0756e';
      return;
    }
    btn.disabled=true;btn.textContent='Enviando...';
    st.textContent='';st.style.color='#9E9E9E';

    var pagina=getPagina();
    // Insert (o upsert) en leads_pricing — el email es el identificador que
    // correlaciona popup → conversiones posteriores (registro/trial/pago).
    fetch(SB+'/rest/v1/leads_pricing',{
      method:'POST',
      headers:{
        'apikey':KEY,
        'Authorization':'Bearer '+KEY,
        'Content-Type':'application/json',
        'Prefer':'resolution=merge-duplicates,return=minimal'
      },
      body:JSON.stringify({email:email,pagina:pagina,metadata:{ua:navigator.userAgent.slice(0,160)}})
    }).then(function(r){
      if(!r.ok && r.status!==201 && r.status!==204)return r.text().then(function(t){throw new Error('save '+r.status+' '+t.slice(0,80));});
      // Mandar email con link de registro pre-cargado
      var regUrl='https://pathwaycareercoach.com/registro.html?ref=popup&email='+encodeURIComponent(email);
      var html=''
        +'<h2 style="font-family:Fraunces,Georgia,serif;color:#1B4332;margin:0 0 14px;">¡Acá va tu link!</h2>'
        +'<p>Tu código <strong>'+CODIGO+'</strong> te suma <strong>14 días extra</strong> al trial estándar de 14 días — <strong>28 días gratis</strong> en total.</p>'
        +'<p style="margin-top:20px;"><a href="'+regUrl+'" style="display:inline-block;padding:13px 26px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-family:Inter,sans-serif;">Activar mi prueba de 28 días →</a></p>'
        +'<p style="font-size:13px;color:#666;margin-top:24px;">Te pedimos la tarjeta para activar la suscripción, pero <strong>no cobramos hasta que termine el trial</strong>. Si no te sirve, cancelás desde tu panel y listo, no se cobra nada.</p>'
        +'<p style="font-size:12px;color:#888;">Cualquier duda, respondé este mail y te contesto.</p>';
      return fetch(SB+'/functions/v1/send-email',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({to:email,to_name:email.split('@')[0],subject:'🎁 Tu código '+CODIGO+' — 30 días gratis en Pathway',html:html})
      }).catch(function(e){console.error('[popup] email fail',e);});
    }).then(function(){
      st.innerHTML='✓ Listo, te mandamos el mail. Revisá tu bandeja (y spam por las dudas).';
      st.style.color='#4a7c5f';
      btn.style.display='none';
      emailEl.disabled=true;
      // Cerrar el overlay después de unos segundos
      setTimeout(function(){dismiss(true);},3500);
    }).catch(function(err){
      console.error('[popup] error',err);
      st.textContent='No pudimos guardar — probá de nuevo en un momento.';
      st.style.color='#c0756e';
      btn.disabled=false;btn.textContent='Reintentar';
    });
  }

  function show(){
    if(document.getElementById('pw-popup-overlay'))return;
    if(sessionStorage.getItem(SHOWN_KEY)||localStorage.getItem(DISMISS_KEY))return;
    injectStyles();
    var ov=buildOverlay();
    document.body.appendChild(ov);
    sessionStorage.setItem(SHOWN_KEY,'1');
    // Bind events
    ov.querySelector('[data-pw-close]').addEventListener('click',function(){dismiss(true);});
    ov.addEventListener('click',function(e){if(e.target===ov)dismiss(false);});
    var form=ov.querySelector('[data-pw-form]');
    form.addEventListener('submit',function(e){e.preventDefault();handleSubmit(form);});
    setTimeout(function(){ov.querySelector('[data-pw-email]').focus();},150);
  }

  function init(){
    // Trigger 1: scroll a la sección [data-pricing-trigger] (o cualquier
    // sección con id="pricing"|"precios"|"planes")
    var triggerEl=document.querySelector('[data-pricing-trigger]')
      ||document.getElementById('pricing')
      ||document.getElementById('precios')
      ||document.getElementById('planes');
    if(triggerEl && 'IntersectionObserver' in window){
      var io=new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting){show();io.disconnect();}
        });
      },{threshold:0.3});
      io.observe(triggerEl);
    }
    // Trigger 2 (fallback): tras X segundos
    setTimeout(show,SCROLL_TRIGGER_DELAY_MS);
    // Trigger 3: cualquier elemento con [data-open-pricing-popup] —
    // útil para CTAs explícitos en el flow ("Suscribite aquí" → popup).
    document.addEventListener('click',function(e){
      var t=e.target.closest('[data-open-pricing-popup]');
      if(!t)return;
      e.preventDefault();
      // Si el usuario lo cerró antes pero ahora hace click explícito, lo
      // re-abrimos (resetea las dos llaves de "ya mostrado").
      sessionStorage.removeItem(SHOWN_KEY);
      localStorage.removeItem(DISMISS_KEY);
      show();
    });
  }

  // Exponer global para que cualquier link/botón en las landings pueda
  // gatillar el popup explícitamente con onclick="openPricingPopup()".
  window.openPricingPopup=function(){
    sessionStorage.removeItem(SHOWN_KEY);
    localStorage.removeItem(DISMISS_KEY);
    show();
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }
})();
