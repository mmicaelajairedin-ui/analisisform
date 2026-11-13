/* pw-review.js — pedir al cliente la reseña de SU COACH (portales fitness y life).
 *
 * El portal de carrera (cliente.html) ya lo hacía (_maybeReviewNudge). Los
 * portales de nicho solo tenían la tarjeta "Puntuar Pathway", que valora la
 * plataforma y nunca publica: los clientes de un coach fitness/life no podían
 * dejarle una reseña. Este módulo replica el mismo contrato:
 *   1. guarda en candidatos (review_rating / review_texto / review_fecha)
 *   2. publica en la tabla `reviews` con el coach_slug (3-5★ públicas, 1-2★ privadas)
 *   3. si el coach no tiene slug o el POST falla → client_errors (nunca en silencio)
 *
 * Uso:  PwReview.maybe({ sb:SB, hdr:_hdr, client:CRAW, lang:LANG, page:'pathway-fit-cliente.html' })
 * Regla: si ya reseñó → nunca. Si no → 1ª entrada y luego cada 2.
 * Color: neutro (crema/carbón), nunca el color de marca. Sin emojis en el chrome.
 */
(function(){
  var EVERY = 2;
  var TX = {
    es: { kicker:'TU OPINIÓN', q:'¿Cómo te va con {coach}?', qGen:'¿Cómo te va con tu coach?',
          sub:'Tu reseña ayuda a otras personas a elegir. Toma 10 segundos.',
          ph:'¿Qué te está pareciendo? (opcional)', pick:'Elige estrellas para enviar',
          send:'Enviar reseña', sending:'Enviando…', retry:'Reintentar', later:'Ahora no',
          thanks:'¡Gracias por tu reseña!', star:'estrellas', anon:'Cliente en Pathway' },
    en: { kicker:'YOUR OPINION', q:'How is it going with {coach}?', qGen:'How is it going with your coach?',
          sub:'Your review helps others choose. It takes 10 seconds.',
          ph:'How is it going so far? (optional)', pick:'Pick stars to send',
          send:'Send review', sending:'Sending…', retry:'Retry', later:'Not now',
          thanks:'Thanks for your review!', star:'stars', anon:'Pathway client' }
  };
  var O = null, RATING = 0, COACH = null;

  function tx(k){ var l=(O&&O.lang==='en')?'en':'es'; return TX[l][k]; }
  function hdr(x){ return O.hdr(x); }
  function logErr(kind, detail){
    try{
      fetch(O.sb+'/rest/v1/client_errors',{ method:'POST',
        headers:hdr({'Content-Type':'application/json','Prefer':'return=minimal'}),
        body:JSON.stringify({ kind:kind, email:(O.client&&O.client.email)||'anon', page:O.page||location.pathname,
          detail:(typeof detail==='string')?detail:JSON.stringify(detail) })
      }).catch(function(){});
    }catch(e){}
  }
  function authorName(){
    var n=((O.client&&O.client.nombre)||'').trim(); if(!n) return tx('anon');
    var p=n.split(/\s+/);
    return p.length>1 ? (p[0]+' '+p[p.length-1].charAt(0).toUpperCase()+'.') : p[0];
  }
  function yaReseno(c){ return !!(c && c.review_rating); }

  function loadCoach(){
    if(COACH) return Promise.resolve(COACH);
    return fetch(O.sb+'/rest/v1/usuarios?id=eq.'+encodeURIComponent(O.client.coach_id)+'&select=nombre,slug',{headers:hdr()})
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(rows){ COACH=(rows&&rows[0])||{}; return COACH; })
      .catch(function(){ COACH={}; return COACH; });
  }

  function pushPublic(rating, texto){
    var slug=(COACH&&COACH.slug)||'';
    if(!slug){
      // Sin slug la reseña no se puede vincular al perfil público: queda
      // registrada para recuperarla (mismo contrato que cliente.html).
      logErr('review_sin_slug',{coach_id:O.client.coach_id||null,rating:rating,texto:(texto||'').slice(0,300)});
      return;
    }
    fetch(O.sb+'/rest/v1/reviews',{ method:'POST',
      headers:hdr({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body:JSON.stringify({ nombre:authorName(), rating:rating, texto:((texto||'').trim().slice(0,500))||null,
        fuente:'portal', publica:(rating>=3), coach_slug:slug })
    }).then(function(r){ if(!r.ok) throw new Error('review_post_'+r.status); })
      .catch(function(e){ logErr('review_post_failed', String(e)); });
  }

  function close(){ var o=document.getElementById('pwrev-ov'); if(o) o.remove(); }
  function el(tag, css, txt){ var e=document.createElement(tag); if(css) e.style.cssText=css; if(txt!=null) e.textContent=txt; return e; }

  function setRating(n){
    RATING=n;
    var bs=document.querySelectorAll('#pwrev-stars button');
    for(var i=0;i<bs.length;i++){ bs[i].style.color=(i<n)?'#E9C46A':'#D8D3C7'; }
    var s=document.getElementById('pwrev-send');
    if(s){ s.disabled=false; s.style.opacity='1'; s.textContent=tx('send'); }
  }

  function submit(){
    if(!RATING) return;
    var c=O.client, s=document.getElementById('pwrev-send');
    var texto=(((document.getElementById('pwrev-text')||{}).value)||'').trim().slice(0,500);
    if(s){ s.disabled=true; s.textContent=tx('sending'); }
    var fecha=new Date().toISOString(), rating=RATING;
    fetch(O.sb+'/rest/v1/candidatos?id=eq.'+encodeURIComponent(c.id)+'&select=id',{ method:'PATCH',
      headers:hdr({'Content-Type':'application/json','Prefer':'return=representation'}),
      body:JSON.stringify({review_rating:rating, review_texto:texto||null, review_fecha:fecha})
    }).then(function(r){ if(!r.ok) throw new Error('save_'+r.status); return r.json(); })
      .then(function(rows){
        if(!rows||!rows.length) throw new Error('save_0_rows');
        c.review_rating=rating; c.review_texto=texto||null; c.review_fecha=fecha;
        pushPublic(rating, texto);
        var box=document.getElementById('pwrev-box');
        if(box){
          box.textContent='';
          box.appendChild(el('div','font-size:16px;font-weight:600;margin-bottom:8px;',tx('thanks')));
          box.appendChild(el('div','font-size:24px;letter-spacing:2px;color:#E9C46A;','★'.repeat(rating)));
        }
        setTimeout(close, 1800);
      })
      .catch(function(e){
        logErr('review_save_failed', String(e));
        if(s){ s.disabled=false; s.style.opacity='1'; s.textContent=tx('retry'); }
      });
  }

  function show(){
    if(document.getElementById('pwrev-ov') || yaReseno(O.client)) return;
    RATING=0;
    var first=((COACH&&COACH.nombre)||'').trim().split(/\s+/)[0];
    var ov=el('div','position:fixed;inset:0;z-index:9200;background:rgba(20,30,26,.55);display:flex;align-items:center;justify-content:center;padding:20px;');
    ov.id='pwrev-ov';
    var box=el('div','background:#FBF8F2;color:#22302A;border:1px solid #E4DDCF;border-radius:18px;max-width:360px;width:100%;padding:24px 22px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;font-family:inherit;');
    box.id='pwrev-box';
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    box.appendChild(el('div','font-size:11px;font-weight:700;letter-spacing:.6px;color:#7A7466;margin-bottom:6px;',tx('kicker')));
    box.appendChild(el('div','font-size:18px;font-weight:600;margin-bottom:6px;line-height:1.3;', first ? tx('q').replace('{coach}',first) : tx('qGen')));
    box.appendChild(el('div','font-size:12.5px;color:#5E5A50;line-height:1.5;margin-bottom:14px;',tx('sub')));
    var stars=el('div','display:flex;gap:4px;justify-content:center;margin-bottom:12px;'); stars.id='pwrev-stars';
    for(var i=1;i<=5;i++){ (function(n){
      var b=el('button','background:none;border:none;font-size:34px;color:#D8D3C7;cursor:pointer;padding:0 2px;line-height:1;transition:color .15s;','★');
      b.type='button'; b.setAttribute('aria-label',n+' '+tx('star')); b.addEventListener('click',function(){ setRating(n); });
      stars.appendChild(b);
    })(i); }
    box.appendChild(stars);
    var ta=el('textarea','width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #E4DDCF;border-radius:8px;background:#fff;color:#22302A;font-family:inherit;font-size:13px;resize:none;line-height:1.5;');
    ta.id='pwrev-text'; ta.rows=2; ta.maxLength=500; ta.placeholder=tx('ph');
    box.appendChild(ta);
    var send=el('button','margin-top:12px;width:100%;padding:11px;background:#22302A;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;opacity:.5;',tx('pick'));
    send.id='pwrev-send'; send.type='button'; send.disabled=true; send.addEventListener('click',submit);
    box.appendChild(send);
    var later=el('button','margin-top:8px;width:100%;padding:8px;background:none;border:none;color:#7A7466;font-size:12px;font-family:inherit;cursor:pointer;',tx('later'));
    later.type='button'; later.addEventListener('click',close);
    box.appendChild(later);
    ov.appendChild(box);
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    document.body.appendChild(ov);
  }

  function maybe(opts){
    try{
      var c=opts&&opts.client;
      if(!c || !c.id || !c.coach_id || !opts.sb || typeof opts.hdr!=='function') return;
      if(new URLSearchParams(location.search).get('coach_view')) return; // coach mirando el portal
      if(!c.consent_at) return;      // primero el consentimiento / intake
      if(yaReseno(c)) return;
      O=opts;
      var key='pw_rev_entries_'+(c.email||c.id), n=1;
      try{ n=(parseInt(localStorage.getItem(key)||'0',10)||0)+1; localStorage.setItem(key,String(n)); }catch(e){}
      if(n % EVERY !== 1) return;
      setTimeout(function(){ loadCoach().then(show); }, 2500);
    }catch(e){}
  }

  window.PwReview = { maybe:maybe, _show:function(opts){ O=opts; return loadCoach().then(show); } };
})();
