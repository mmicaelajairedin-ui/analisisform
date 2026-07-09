// Testimonios públicos — Pathway Career Coach
//
// Lee reseñas de la tabla `reviews` (publica=true) desde Supabase y las
// renderiza en cada <div data-testimonios> que encuentre.
//
// Tabla reviews: { id, nombre, rating (1-5), texto, fuente, publica, created_at }
//
// Uso desde cualquier página pública:
//   <div data-testimonios></div>
//   <script src="testimonios.js"></script>
//
// Atributos opcionales:
//   data-max:        máximo de reseñas a mostrar (default 6)
//   data-min-stars:  rating mínimo para mostrar (default 1). La landing usa
//                    data-min-stars="5" para mostrar solo las de 5★.
//   data-theme:      'green' (default) o 'beige' — afecta colores
//
// La sección se OCULTA automáticamente si no hay reseñas que cumplan el
// filtro, así es seguro incluirla aunque todavía no haya testimonios.

(function(){
  var SB='https://api.pathwaycareercoach.com';
  var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

  function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function render(host){
    var max=parseInt(host.getAttribute('data-max'))||6;
    var minStars=parseInt(host.getAttribute('data-min-stars'))||1;
    var theme=host.getAttribute('data-theme')||'green';
    // 'grid' (default, usado en perfiles de coach) o 'marquee' (tira en
    // movimiento — la usa la landing para que no se lea "solo hay N reseñas").
    var layout=(host.getAttribute('data-layout')||'grid').toLowerCase();

    // data-coach="<slug>" -> SOLO reseñas de ese coach (su perfil publico).
    // Sin data-coach (landing) -> reseñas de Pathway (coach_slug NULL).
    // Fallback robusto: si la columna coach_slug todavia no existe, la landing
    // reintenta sin filtro (sigue mostrando todo); el perfil de coach se oculta.
    var coach=(host.getAttribute('data-coach')||'').trim().toLowerCase();
    var SEL='select=nombre,rating,texto&order=rating.desc,created_at.desc';
    function load(filterClause, isFallback){
      // apikey duplicado en URL: si un proxy/CORS/cache pierde el header, Kong
      // (gateway de Supabase) tambien acepta apikey en la query.
      var url=SB+'/rest/v1/reviews?publica=eq.true&'+SEL+(filterClause?('&'+filterClause):'')+'&apikey='+encodeURIComponent(KEY);
      fetch(url,{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Accept':'application/json'}})
        .then(function(r){ if(!r.ok) throw 0; return r.json(); })
        .then(paint)
        .catch(function(){ if(!isFallback && !coach){ load('',true); } else { host.style.display='none'; } });
    }
    load(coach ? ('coach_slug=eq.'+encodeURIComponent(coach)) : 'coach_slug=is.null', false);

    function paint(rows){
      var reviews=[];
      rows.forEach(function(c){
        var stars=parseInt(c.rating,10);
        if(stars>=minStars && (c.texto||'').trim().length>=10){
          reviews.push({stars:stars,text:c.texto,nombre:c.nombre});
        }
      });

      if(!reviews.length){
        host.style.display='none';
        // Si la <section> contenedora solo envuelve este host, ocultarla
        // también para no dejar un espacio vacío entre secciones.
        var sect=host.closest('section');
        if(sect){
          var others=sect.querySelectorAll('[data-testimonios]');
          var anyVisible=false;
          others.forEach(function(n){if(n!==host && n.style.display!=='none')anyVisible=true;});
          if(!anyVisible)sect.style.display='none';
        }
        return;
      }

      var displayed=reviews.slice(0,max);
      // Si dos reseñas comparten primer nombre, las desambiguamos con la
      // inicial del apellido si está en la BD (ej. dos "Sol" → "Sol M." y
      // "Sol P."). Si no hay apellido, dejamos el nombre tal cual: prefiero
      // que se vean dos "Sol" antes que inventar un sufijo poco natural.
      var firstCount={};
      displayed.forEach(function(r){
        var fn=(r.nombre||'').split(/\s+/).filter(Boolean)[0]||'';
        if(fn) firstCount[fn]=(firstCount[fn]||0)+1;
      });
      displayed.forEach(function(r){
        var parts=(r.nombre||'').split(/\s+/).filter(Boolean);
        var fn=parts[0]||'';
        if(!fn || firstCount[fn]<2){ r._display=r.nombre||'Cliente Pathway'; return; }
        var lastInitial=parts.length>1 ? parts[parts.length-1].charAt(0).toUpperCase()+'.' : '';
        r._display=lastInitial ? (fn+' '+lastInitial) : (r.nombre||fn);
      });
      var avg=(reviews.reduce(function(s,r){return s+r.stars;},0)/reviews.length).toFixed(1);

      var accent=theme==='beige'?'#8C7B80':'#2D6A4F';
      var sand=theme==='beige'?'#E9C46A':'#52B788';
      var titleColor=theme==='beige'?'#1B2E26':'#1B4332';

      var heading=(host.getAttribute&&host.getAttribute('data-heading'))||'Lo que dicen de Pathway';

      // Encabezado (estrellas + promedio + titulo) — compartido por ambos layouts.
      var headingHtml='';
      headingHtml+='<div style="text-align:center;margin-bottom:36px;">';
      headingHtml+='<div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:14px;">';
      var stars='';for(var s=1;s<=5;s++)stars+='<span style="color:'+sand+';font-size:24px;">★</span>';
      headingHtml+=stars;
      headingHtml+='<span style="font-family:\'Fraunces\',Georgia,serif;font-size:24px;font-weight:500;color:'+titleColor+';">'+avg+'/5</span>';
      headingHtml+='</div>';
      headingHtml+='<h2 style="font-family:\'Fraunces\',Georgia,serif;font-size:clamp(28px,4vw,40px);font-weight:500;color:'+titleColor+';letter-spacing:-1.2px;line-height:1.15;margin-bottom:10px;">'+heading+'</h2>';
      headingHtml+='</div>';

      // ── Layout MARQUEE: tira horizontal en movimiento ─────────────────────
      // Reseñas que se deslizan solas (loop infinito, pausa al hover) + una
      // segunda tira con fotos REALES de coaches publicos. Como fluye, el ojo
      // no cuenta "hay N": no crea friccion cuando todavia hay pocas.
      if(layout==='marquee'){ paintMarquee(); return; }

      // Texto recortado a 4 lineas con toggle "Ver mas". Cada card lleva un id
      // unico para poder enganchar el toggle despues de pintar el HTML.
      var uid='tm'+Math.random().toString(36).slice(2,8);

      var html=headingHtml;

      // Grilla de 2 columnas en desktop/tablet (1 en mobile). Mantiene la
      // sección simétrica con cualquier número par y los cards de cada fila
      // se estiran a la misma altura (default de CSS grid: align-items:stretch).
      html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:18px;align-items:stretch;max-width:880px;margin:0 auto;">';
      displayed.forEach(function(r,idx){
        var rs='';for(var i=1;i<=5;i++)rs+='<span style="color:'+(i<=r.stars?sand:'#E5E0DD')+';font-size:16px;">★</span>';
        var displayName=r._display||r.nombre||'Cliente Pathway';
        var ini=displayName.split(' ').filter(Boolean).slice(0,2).map(function(s){return s.charAt(0).toUpperCase();}).join('');
        html+='<div style="background:#fff;border:1.5px solid rgba(45,106,79,.12);border-radius:16px;padding:22px 24px;display:flex;flex-direction:column;gap:14px;transition:transform .2s,box-shadow .2s;" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 12px 28px rgba(27,46,38,.08)\';" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';">';
        html+='<div style="display:flex;gap:1px;">'+rs+'</div>';
        // Clamp a 3 lineas (-webkit-line-clamp) para que las reseñas largas no
        // queden como un bloque. El toggle se agrega abajo solo si el texto
        // realmente desborda esas 3 lineas (chequeo post-render).
        html+='<div id="'+uid+'_t'+idx+'" data-clamped="1" style="font-size:13px;color:#2A2A2A;line-height:1.55;font-style:italic;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">"'+escH(r.text).replace(/\n/g,'<br>')+'"</div>';
        html+='<button id="'+uid+'_b'+idx+'" type="button" style="display:none;align-self:flex-start;background:none;border:none;padding:0;margin:-4px 0 0;font:inherit;font-size:13px;font-weight:600;color:'+accent+';cursor:pointer;">Ver más</button>';
        html+='<div style="display:flex;align-items:center;gap:12px;margin-top:auto;padding-top:14px;border-top:1px solid rgba(45,106,79,.08);">';
        html+='<div style="width:40px;height:40px;border-radius:50%;background:'+accent+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;">'+ini+'</div>';
        html+='<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:'+titleColor+';">'+escH(displayName)+'</div></div>';
        html+='</div>';
        html+='</div>';
      });
      html+='</div>';
      host.innerHTML=html;

      // Post-render: mostrar el boton "Ver más" solo en las reseñas que
      // desbordan las 3 lineas. Toggle entre clamp y texto completo.
      displayed.forEach(function(r,idx){
        var txt=document.getElementById(uid+'_t'+idx);
        var btn=document.getElementById(uid+'_b'+idx);
        if(!txt||!btn) return;
        if(txt.scrollHeight-txt.clientHeight>2){
          btn.style.display='block';
          btn.addEventListener('click',function(){
            var clamped=txt.getAttribute('data-clamped')==='1';
            if(clamped){
              txt.style.webkitLineClamp='unset';
              txt.style.display='block';
              txt.setAttribute('data-clamped','0');
              btn.textContent='Ver menos';
            }else{
              txt.style.display='-webkit-box';
              txt.style.webkitLineClamp='3';
              txt.setAttribute('data-clamped','1');
              btn.textContent='Ver más';
            }
          });
        }
      });
    }

    // ── Render del layout marquee ───────────────────────────────────────────
    function paintMarquee(){
      var uid='mq'+Math.random().toString(36).slice(2,8);
      // Keyframes + mascaras de borde: se inyectan una sola vez por pagina.
      if(!document.getElementById('pw-mq-css')){
        var st=document.createElement('style'); st.id='pw-mq-css';
        st.textContent=
          '@keyframes pwmqL{from{transform:translateX(0)}to{transform:translateX(-50%)}}'+
          '@keyframes pwmqR{from{transform:translateX(-50%)}to{transform:translateX(0)}}'+
          '.pw-mq-wrap{position:relative;overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);}'+
          '.pw-mq-track{display:flex;width:max-content;}'+
          '.pw-mq-wrap:hover .pw-mq-track{animation-play-state:paused;}'+
          '@media(prefers-reduced-motion:reduce){.pw-mq-track{animation:none!important;transform:none!important;}.pw-mq-wrap{overflow-x:auto;-webkit-mask:none;mask:none;}}';
        document.head.appendChild(st);
      }

      function mqCard(r){
        var rs='';for(var i=1;i<=5;i++)rs+='<span style="color:'+(i<=r.stars?sand:'#E5E0DD')+';font-size:13px;">★</span>';
        var dn=r._display||r.nombre||'Cliente Pathway';
        var ini=dn.split(' ').filter(Boolean).slice(0,2).map(function(s){return s.charAt(0).toUpperCase();}).join('');
        return '<div style="flex:0 0 auto;width:290px;background:#fff;border:1.5px solid rgba(45,106,79,.12);border-radius:14px;padding:15px 17px;display:flex;flex-direction:column;gap:8px;box-shadow:0 4px 14px rgba(27,46,38,.05);">'+
          '<div style="display:flex;gap:1px;">'+rs+'</div>'+
          '<div style="font-size:12.5px;color:#2A2A2A;line-height:1.5;font-style:italic;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:56px;">"'+escH(r.text).replace(/\n/g,' ')+'"</div>'+
          '<div style="display:flex;align-items:center;gap:9px;margin-top:2px;">'+
          '<div style="width:30px;height:30px;border-radius:50%;background:'+accent+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">'+ini+'</div>'+
          '<div style="font-size:12.5px;font-weight:700;color:'+titleColor+';">'+escH(dn)+'</div>'+
          '</div></div>';
      }
      function faceBubble(f){
        return '<div title="'+escH(f.nombre)+'" style="flex:0 0 auto;width:46px;height:46px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 3px 10px rgba(27,46,38,.14);background:#eee;">'+
          '<img src="'+escH(f.foto)+'" alt="'+escH(f.nombre)+'" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentNode.style.display=\'none\'">'+
          '</div>';
      }

      var durA=Math.max(24,displayed.length*9);
      var cards='';displayed.forEach(function(r){cards+=mqCard(r);});
      // Contenido duplicado ×2 -> el loop translateX(-50%) queda sin costura.
      var html=headingHtml;
      html+='<div class="pw-mq-wrap" style="max-width:1120px;margin:0 auto;">'+
        '<div class="pw-mq-track" style="gap:16px;padding:8px 8px 12px;animation:pwmqL '+durA+'s linear infinite;">'+cards+cards+'</div>'+
        '</div>';
      html+='<div id="'+uid+'_faces" style="margin-top:24px;"></div>';
      host.innerHTML=html;

      // Fotos reales de coaches publicos para la segunda tira. Solo perfiles
      // con perfil_publico_activo (consintieron aparecer) y foto cargada.
      var fu=SB+'/rest/v1/usuarios?rol=in.(coach,admin)&activo=eq.true&select=nombre,foto_url,configuracion,perfil_publico_activo&apikey='+encodeURIComponent(KEY);
      fetch(fu,{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Accept':'application/json'}})
        .then(function(r){return r.ok?r.json():[];})
        .then(function(rows){
          var faces=[];
          (rows||[]).forEach(function(c){
            var cfg=c.configuracion||{};
            var pub=(c.perfil_publico_activo===true||cfg.perfil_publico_activo===true);
            var foto=c.foto_url||cfg.foto_url||cfg.foto_perfil||'';
            if(pub && foto){ faces.push({foto:foto,nombre:c.nombre||'Coach'}); }
          });
          var box=document.getElementById(uid+'_faces');
          if(!box) return;
          // Con menos de 2 caras una tira se lee vacia aunque se mueva: la ocultamos.
          if(faces.length<2){ box.style.display='none'; return; }
          var fh='';faces.forEach(function(f){fh+=faceBubble(f);});
          var durB=Math.max(20,faces.length*7);
          box.innerHTML='<div class="pw-mq-wrap" style="max-width:620px;margin:0 auto 12px;">'+
            '<div class="pw-mq-track" style="gap:12px;padding:6px 8px;align-items:center;animation:pwmqR '+durB+'s linear infinite;">'+fh+fh+'</div>'+
            '</div>'+
            '<p style="text-align:center;font-size:13px;color:'+titleColor+';opacity:.72;margin:0;">Coaches de carrera, fitness y finanzas ya crean su espacio en Pathway</p>';
        })
        .catch(function(){ var box=document.getElementById(uid+'_faces'); if(box) box.style.display='none'; });
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){
      document.querySelectorAll('[data-testimonios]').forEach(render);
    });
  } else {
    document.querySelectorAll('[data-testimonios]').forEach(render);
  }
})();
