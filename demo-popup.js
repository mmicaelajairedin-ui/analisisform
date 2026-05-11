// Pathway — Modal "Ver demo" sin friccion.
//
// Click en cualquier elemento con data-open-demo-popup → abre el video
// Loom directo en un overlay. Antes habia un email-gate; lo sacamos
// porque pedir email genera friccion y bajaba conversion.
//
// Uso desde cualquier landing publica:
//   <script src="demo-popup.js"></script>
//   <a href="#" data-open-demo-popup>Ver demo</a>
//
// Configurable via atributos del <body>:
//   data-demo-loom-id="72bbe92b..." (default abajo)

(function(){
  'use strict';

  var DEFAULT_LOOM_ID='72bbe92b3f704518abd768417ed30991';

  // Stripe Payment Link de la prueba de 30 dias.
  var TRIAL_URL='https://buy.stripe.com/14A28rfz2fckarifa38AE08';

  function getLoomId(){
    var b=document.body && document.body.getAttribute('data-demo-loom-id');
    return b||DEFAULT_LOOM_ID;
  }

  function buildVideoOverlay(){
    var ov=document.createElement('div');
    ov.id='pw-demo-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(27,46,38,.85);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:pwDemoFade .25s ease;overflow-y:auto;';

    var card=document.createElement('div');
    card.style.cssText='background:#0F1A15;border-radius:14px;max-width:920px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.4);position:relative;font-family:Inter,-apple-system,sans-serif;animation:pwDemoSlide .3s ease;overflow:hidden;';

    var loomId=getLoomId();
    card.innerHTML=''
      +'<button data-pw-close style="position:absolute;top:10px;right:14px;background:rgba(0,0,0,.5);border:none;font-size:22px;cursor:pointer;color:#fff;line-height:1;padding:6px 12px;border-radius:50px;z-index:2;" aria-label="Cerrar">×</button>'
      +'<a href="'+TRIAL_URL+'" target="_blank" rel="noopener" data-pw-trial-top style="display:block;background:#1B4332;color:#fff;text-decoration:none;padding:12px 56px 12px 20px;font-size:13.5px;font-weight:600;line-height:1.4;text-align:center;">'
        +'<span style="opacity:.85;font-weight:500;">¿Listo? </span>'
        +'<span style="text-decoration:underline;">Empezá la prueba de 30 días</span>'
        +'<span style="opacity:.75;font-weight:500;"> — cancelá cuando quieras</span>'
      +'</a>'
      +'<div style="position:relative;padding-bottom:62.5%;height:0;background:#000;">'
        +'<iframe src="https://www.loom.com/embed/'+loomId+'?autoplay=1" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>'
      +'</div>'
      +'<div style="background:#fff;padding:22px 24px 24px;text-align:center;">'
        +'<a href="'+TRIAL_URL+'" target="_blank" rel="noopener" data-pw-trial-bottom style="display:inline-block;background:#2D6A4F;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;line-height:1.2;box-shadow:0 6px 16px rgba(45,106,79,.25);">Empezá la prueba de 30 días →</a>'
        +'<div style="font-size:12px;color:#6B6B6B;margin-top:10px;">Cancelá cuando quieras. Sin permanencia.</div>'
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
      +'#pw-demo-overlay button[data-pw-close]:hover{background:rgba(0,0,0,.7);}'
      +'#pw-demo-overlay a[data-pw-trial-top]:hover{background:#143028;}'
      +'#pw-demo-overlay a[data-pw-trial-bottom]:hover{background:#1B4332;}';
    document.head.appendChild(s);
  }

  function dismiss(){
    var ov=document.getElementById('pw-demo-overlay');
    if(ov)ov.remove();
  }

  function showVideo(){
    if(document.getElementById('pw-demo-overlay'))return;
    injectStyles();
    var ov=buildVideoOverlay();
    document.body.appendChild(ov);
    ov.querySelector('[data-pw-close]').addEventListener('click',function(){dismiss();});
    ov.addEventListener('click',function(e){if(e.target===ov)dismiss();});
  }

  function init(){
    document.addEventListener('click',function(e){
      var t=e.target.closest('[data-open-demo-popup]');
      if(!t)return;
      e.preventDefault();
      showVideo();
    });
  }

  // Exponer global por si algun boton usa onclick directo.
  window.openDemoPopup=showVideo;

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }
})();
