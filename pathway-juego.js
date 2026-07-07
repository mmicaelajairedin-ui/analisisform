/* ==========================================================================
   pathway-juego.js — Motor de juego unificado (cliente + coach, multi-nicho)
   --------------------------------------------------------------------------
   FUENTE ÚNICA DE VERDAD de:
     · umbrales de medalla (Bronce/Plata/Oro) — iguales en TODOS los nichos
     · el festejo: confeti EXPLOSIÓN (no cortina) + cabra que salta + sonido + cartel
     · el feedback "+X pts" flotante

   Filosofía: PUNTOS como moneda única. La medalla se llena por puntos
   acumulados. Cada nicho aporta su lista de logros; el cálculo de medalla,
   el festejo y el sonido viven acá una sola vez.

   Umbrales (en PUNTOS, no en conteo):  Bronce 200 · Plata 400 · Oro 600
   A 100 pts por logro grande, eso equivale a 2/4/6 logros — calibrado para
   que NADIE baje de medalla al migrar del sistema viejo (conteo 2/4/7).

   Uso mínimo:
     PWJ.medal(pts)                       -> {current,next,faltan,pct}
     PWJ.celebrate({kind,title,sub,...})  -> cartel + explosión + cabra + sonido
     PWJ.burst(x,y,n)                     -> solo la explosión de confeti
     PWJ.pop('+100 pts', x, y)            -> solo el "+X pts" flotante
     PWJ.sound('logro'|'medal'|'point')   -> solo el sonido

   Es vanilla, sin dependencias, se incluye con <script src>. Todo defensivo:
   si algo falla, no rompe el portal (los portales llaman con guardas).
   ========================================================================== */
(function(){
  'use strict';
  if (window.PWJ) return;               // idempotente
  var PWJ = {};
  window.PWJ = PWJ;

  /* ── Sprite de la cabra buena (assets/cabra/, NO la vieja de mascota) ──── */
  PWJ.GOAT = 'assets/cabra/salta.gif';  // cabra que salta = festejo

  /* ── FUENTE ÚNICA: umbrales de medalla en PUNTOS ────────────────────────
     Mantener la misma forma que usan los portales: min/ico/iconUrl/lbl/color/next.
     Si cambia un umbral, cambia acá y en ningún otro lado. */
  PWJ.PTS_LOGRO = 100;                  // puntos por logro grande
  PWJ.MEDALS = [
    {min:0,   ico:'',   iconUrl:'',                                  lbl:'',       color:'#9AA0A6', next:'Bronce'},
    {min:200, ico:'🥉', iconUrl:'/assets/iconos/medalla-bronce.png', lbl:'Bronce', color:'#CD7F32', next:'Plata'},
    {min:400, ico:'🥈', iconUrl:'/assets/iconos/medalla-plata.png',  lbl:'Plata',  color:'#A0A0A0', next:'Oro'},
    {min:600, ico:'🏆', iconUrl:'/assets/iconos/medalla-oro.png',    lbl:'Oro',    color:'#DAA520', next:null}
  ];

  /* Devuelve la info de medalla para un total de puntos. Misma forma que el
     getMedalInfo viejo de cliente.html, para que sea drop-in. */
  PWJ.medal = function(pts){
    pts = pts || 0;
    var M = PWJ.MEDALS, cur = M[0];
    for (var i = M.length - 1; i >= 0; i--){ if (pts >= M[i].min){ cur = M[i]; break; } }
    var idx  = M.indexOf(cur);
    var next = idx + 1 < M.length ? M[idx + 1] : null;
    var faltan = next ? (next.min - pts) : 0;
    var pct = next ? ((pts - cur.min) / (next.min - cur.min) * 100) : 100;
    pct = Math.max(0, Math.min(100, pct));
    return { current: cur, next: next, faltan: faltan, pct: Math.round(pct) };
  };

  /* ── Preferencia de movimiento reducido (accesibilidad) ─────────────────── */
  function reduceMotion(){
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return false; }
  }

  /* ── Sonido satisfactorio, sintetizado (Web Audio, SIN assets) ──────────── */
  PWJ.muted = false;
  PWJ._actx = null;
  PWJ.sound = function(kind){
    try {
      if (PWJ.muted) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      PWJ._actx = PWJ._actx || new AC();
      var ctx = PWJ._actx;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch(e){} }
      // escalitas ascendentes; medalla = fanfarria un poco más larga
      var notes = kind === 'medal' ? [523, 659, 784, 1047]
                : kind === 'point' ? [784, 1047]
                :                     [523, 784];   // 'logro' por defecto
      var t = ctx.currentTime;
      notes.forEach(function(f, i){
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        var st = t + i * 0.085;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.linearRampToValueAtTime(0.16, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0008, st + 0.24);
        o.connect(g); g.connect(ctx.destination);
        o.start(st); o.stop(st + 0.26);
      });
    } catch(e){}
  };

  /* ── Confeti EXPLOSIÓN: estalla desde un punto y cae con gravedad ────────
     Nada de "cortina" que baja derecho desde arriba. Cada pieza sale con un
     ángulo y velocidad propios, sube/se abre y después la gravedad la tira. */
  var CONF_COLORS = ['#8C7B80','#DAA520','#5B8C6E','#5B7FA6','#C4907A','#CD7F32','#E9C46A','#52B788'];
  PWJ.burst = function(x, y, n){
    if (reduceMotion()) return;
    x = (x == null) ? window.innerWidth  / 2 : x;
    y = (y == null) ? window.innerHeight / 2 : y;
    n = n || 48;
    for (var i = 0; i < n; i++){
      var p = document.createElement('div');
      p.className = 'pwj-conf';
      p.style.left = x + 'px';
      p.style.top  = y + 'px';
      p.style.background = CONF_COLORS[i % CONF_COLORS.length];
      if (i % 3 === 0) p.style.borderRadius = '50%';
      document.body.appendChild(p);
      var angle   = Math.random() * Math.PI * 2;
      var speed   = 90 + Math.random() * 230;           // radio de la explosión
      var dx      = Math.cos(angle) * speed;
      var dy      = Math.sin(angle) * speed;
      var gravity = 240 + Math.random() * 220;          // caída final
      var rot     = Math.random() * 720 - 360;
      var dur     = 900 + Math.random() * 750;
      p.animate([
        { transform:'translate(-50%,-50%) rotate(0deg)', opacity:1 },
        { transform:'translate(calc(-50% + '+(dx*0.55)+'px), calc(-50% + '+(dy*0.55 - 26)+'px)) rotate('+(rot*0.5)+'deg)', opacity:1, offset:0.35 },
        { transform:'translate(calc(-50% + '+dx+'px), calc(-50% + '+(dy + gravity)+'px)) rotate('+rot+'deg)', opacity:0 }
      ], { duration: dur, easing:'cubic-bezier(.18,.7,.32,1)' });
      (function(el, d){ setTimeout(function(){ if (el.parentNode) el.remove(); }, d + 60); })(p, dur);
    }
  };

  /* ── "+X pts" flotante que sube y se desvanece ──────────────────────────── */
  PWJ.pop = function(text, x, y){
    var el = document.createElement('div');
    el.className = 'pwj-pop';
    el.textContent = text;
    el.style.left = ((x == null) ? window.innerWidth / 2 : x) + 'px';
    el.style.top  = ((y == null) ? window.innerHeight / 2 : y) + 'px';
    document.body.appendChild(el);
    if (reduceMotion()){ setTimeout(function(){ el.remove(); }, 900); return; }
    el.animate([
      { transform:'translate(-50%,0) scale(.8)',   opacity:0 },
      { transform:'translate(-50%,-14px) scale(1)', opacity:1, offset:0.2 },
      { transform:'translate(-50%,-64px) scale(1)', opacity:0 }
    ], { duration: 1150, easing:'ease-out' });
    setTimeout(function(){ if (el.parentNode) el.remove(); }, 1200);
  };

  /* ── Cartel de desbloqueo: cabra que salta + título + "+pts" + explosión ── */
  PWJ.celebrate = function(o){
    o = o || {};
    injectStyle();
    var isMedal = o.kind === 'medal';
    var goat    = (o.goat === false) ? '' :
                  '<img class="pwj-goat" src="' + PWJ.GOAT + '" alt="" onerror="this.style.display=\'none\'">';
    var medalImg= (isMedal && o.tier && o.tier.iconUrl) ?
                  '<img class="pwj-medal-img" src="' + o.tier.iconUrl + '" alt="" onerror="this.style.display=\'none\'">' : '';
    var ptsBadge= o.points ? '<div class="pwj-pts">+' + o.points + ' pts</div>' : '';
    var accent  = (isMedal && o.tier && o.tier.color) ? o.tier.color : '#2D6A4F';

    var ov = document.createElement('div');
    ov.className = 'pwj-ov';
    ov.innerHTML =
      '<div class="pwj-card" style="--pwj-accent:' + accent + '">' +
        '<div class="pwj-goat-wrap">' + medalImg + goat + '</div>' +
        '<div class="pwj-title">' + (o.title || '¡Genial!') + '</div>' +
        (o.sub ? '<div class="pwj-sub">' + o.sub + '</div>' : '') +
        ptsBadge +
        '<button class="pwj-btn" type="button">' + (o.btn || '¡Sigo!') + '</button>' +
      '</div>';
    document.body.appendChild(ov);

    function close(){ if (ov.parentNode) ov.remove(); }
    ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
    var btn = ov.querySelector('.pwj-btn');
    if (btn) btn.addEventListener('click', close);

    // explosión desde el centro de la tarjeta + sonido
    requestAnimationFrame(function(){
      var card = ov.querySelector('.pwj-card');
      if (card){
        var r = card.getBoundingClientRect();
        PWJ.burst(r.left + r.width / 2, r.top + r.height * 0.34, isMedal ? 80 : 46);
      }
    });
    PWJ.sound(isMedal ? 'medal' : 'logro');
    return { close: close };
  };

  /* ── CSS del motor, inyectado una sola vez (mismo festejo en todo lado) ─── */
  var styled = false;
  function injectStyle(){
    if (styled) return;
    styled = true;
    var css =
      '.pwj-conf{position:fixed;width:10px;height:14px;border-radius:2px;z-index:100002;pointer-events:none;will-change:transform,opacity;}' +
      '.pwj-pop{position:fixed;z-index:100003;pointer-events:none;font-family:Inter,-apple-system,system-ui,sans-serif;font-weight:800;font-size:20px;color:#DAA520;text-shadow:0 2px 8px rgba(0,0,0,.18);white-space:nowrap;}' +
      '.pwj-ov{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(20,32,26,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:pwjFade .25s ease;}' +
      '.pwj-card{position:relative;overflow:hidden;background:#fff;border-radius:24px;padding:2.4rem 2rem 1.9rem;text-align:center;max-width:380px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,.3);animation:pwjPop .5s cubic-bezier(.175,.885,.32,1.275);}' +
      '.pwj-card:before{content:"";position:absolute;inset:0 0 auto 0;height:5px;background:var(--pwj-accent,#2D6A4F);}' +
      '.pwj-goat-wrap{position:relative;display:inline-flex;align-items:flex-end;justify-content:center;min-height:104px;margin-bottom:6px;}' +
      '.pwj-goat{width:104px;height:104px;object-fit:contain;animation:pwjJump 1s ease-in-out infinite;}' +
      '.pwj-medal-img{position:absolute;right:-6px;top:-4px;width:52px;height:52px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.25));animation:pwjMedalIn .6s .15s both cubic-bezier(.175,.885,.32,1.275);}' +
      '.pwj-title{font-family:"Fraunces",Georgia,serif;font-size:25px;font-weight:600;color:#1f2d26;letter-spacing:-.02em;margin-bottom:8px;}' +
      '.pwj-sub{font-size:14px;color:#5c6b63;line-height:1.55;margin-bottom:14px;}' +
      '.pwj-pts{display:inline-block;font-family:Inter,-apple-system,sans-serif;font-weight:800;font-size:15px;color:#fff;background:var(--pwj-accent,#2D6A4F);padding:5px 16px;border-radius:20px;margin-bottom:16px;box-shadow:0 4px 14px rgba(0,0,0,.16);}' +
      '.pwj-btn{display:inline-block;padding:12px 34px;background:var(--pwj-accent,#2D6A4F);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;font-family:Inter,-apple-system,sans-serif;cursor:pointer;transition:transform .15s,box-shadow .15s;}' +
      '.pwj-btn:hover{transform:translateY(-1.5px);box-shadow:0 8px 22px rgba(0,0,0,.2);}' +
      '.pwj-btn:active{transform:scale(.96);}' +
      '@keyframes pwjFade{from{opacity:0}to{opacity:1}}' +
      '@keyframes pwjPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}' +
      '@keyframes pwjJump{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}' +
      '@keyframes pwjMedalIn{from{opacity:0;transform:scale(.3) rotate(-25deg)}to{opacity:1;transform:scale(1) rotate(0)}}' +
      '@media(prefers-reduced-motion:reduce){.pwj-card,.pwj-goat,.pwj-medal-img{animation:none!important}}';
    var s = document.createElement('style');
    s.id = 'pwj-style';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
})();
