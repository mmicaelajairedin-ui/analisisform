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
  var SB='https://ddxnrsnjdvtqhxunxbwj.supabase.co';
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
      // ── SEO: exponer las reseñas REALES a Google como datos estructurados ──
      // Google no ve las reseñas porque se cargan por JS. Inyectamos un
      // aggregateRating (promedio de TODAS las reseñas, no solo las 5★ que se
      // muestran) atado por @id al SoftwareApplication de la landing. Una sola
      // vez, solo en la landing (sin data-coach). El promedio es honesto: se
      // calcula sobre `rows` completo, no sobre las filtradas por min-stars.
      try{
        // Solo en la landing (sin data-coach) y una sola vez. La clave: NO crear
        // un segundo <script> SoftwareApplication con el mismo @id que el
        // estático de index.html — eso genera dos nodos en conflicto y Google
        // los marca como "elementos no válidos". En su lugar FUSIONAMOS el
        // aggregateRating + review DENTRO del nodo estático existente
        // (id="ld-software"), dejando UN solo SoftwareApplication.
        if(!coach && !window.__pwRatingSchema){
          var rated=[]; (rows||[]).forEach(function(c){ var n=parseInt(c.rating,10); if(n>=1&&n<=5) rated.push({n:n,nombre:c.nombre,texto:c.texto}); });
          if(rated.length){
            window.__pwRatingSchema=true;
            var rv=(rated.reduce(function(a,r){return a+r.n;},0)/rated.length).toFixed(1);
            var agg={"@type":"AggregateRating","ratingValue":rv,"reviewCount":String(rated.length),"bestRating":"5","worstRating":"1"};
            var revs=rated.slice(0,6).map(function(r){ return {"@type":"Review","author":{"@type":"Person","name":(r.nombre||'Cliente Pathway')},"reviewRating":{"@type":"Rating","ratingValue":String(r.n),"bestRating":"5","worstRating":"1"},"reviewBody":String(r.texto||'').slice(0,320)}; });
            var el=document.getElementById('ld-software'); var merged=false;
            if(el){
              try{
                var obj=JSON.parse(el.textContent||el.text||'{}');
                if(obj && (obj['@type']==='SoftwareApplication')){
                  obj.aggregateRating=agg; obj.review=revs;
                  el.textContent=JSON.stringify(obj); merged=true;
                }
              }catch(_){}
            }
            if(!merged){
              // Fallback (páginas sin el nodo estático): crear uno completo.
              var node={"@context":"https://schema.org","@type":"SoftwareApplication","@id":"https://pathwaycareercoach.com/#software",
                "name":"Pathway","applicationCategory":"BusinessApplication","operatingSystem":"Web",
                "aggregateRating":agg,"review":revs};
              var sc=document.createElement('script'); sc.type='application/ld+json'; sc.text=JSON.stringify(node); document.head.appendChild(sc);
            }
          }
        }
      }catch(e){}
      var reviews=[];
      rows.forEach(function(c){
        var stars=parseInt(c.rating,10);
        if(stars>=minStars && (c.texto||'').trim().length>=10){
          reviews.push({stars:stars,text:c.texto,nombre:c.nombre});
        }
      });

      var accent=theme==='beige'?'#8C7B80':'#2D6A4F';
      var sand=theme==='beige'?'#E9C46A':'#52B788';
      var titleColor=theme==='beige'?'#1B2E26':'#1B4332';

      // Marquee (landing): tira única con datos reales. Se decide adentro si hay
      // material suficiente; puede mostrarse aunque haya pocas/0 reseñas porque
      // la sostienen los datos + las fotos de coaches públicos.
      if(layout==='marquee'){ paintMarquee(reviews,accent,sand,titleColor); return; }

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
      // En perfiles de coach: "N opiniones verificadas" (confianza). En la landing no.
      if(coach && rows && rows.length){ headingHtml+='<div style="font-size:13px;font-weight:600;color:'+titleColor+';opacity:.72;">'+rows.length+' opiniones verificadas</div>'; }
      headingHtml+='</div>';

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
    // Una sola fila en movimiento que mezcla: reseñas (clic para leer completa),
    // datos REALES autocalculados de la base, fotos de coaches públicos y sus
    // logos (tipo sticker). Como fluye, el ojo no cuenta cuántas hay.
    function paintMarquee(reviews,accent,sand,titleColor){
      // Desambiguación de nombres repetidos (dos "Sol" -> "Sol M." / "Sol P.").
      var firstCount={};
      reviews.forEach(function(r){var fn=(r.nombre||'').split(/\s+/).filter(Boolean)[0]||'';if(fn)firstCount[fn]=(firstCount[fn]||0)+1;});
      reviews.forEach(function(r){
        var parts=(r.nombre||'').split(/\s+/).filter(Boolean);var fn=parts[0]||'';
        if(!fn||firstCount[fn]<2){r._display=r.nombre||'Cliente Pathway';return;}
        var li=parts.length>1?parts[parts.length-1].charAt(0).toUpperCase()+'.':'';
        r._display=li?(fn+' '+li):(r.nombre||fn);
      });
      var revShown=reviews.slice(0,max);
      var avgNum=reviews.length?reviews.reduce(function(s,r){return s+r.stars;},0)/reviews.length:0;
      var avg=avgNum?avgNum.toFixed(1):'';

      // CSS (keyframes + máscara de borde + modal de lectura): una sola vez.
      if(!document.getElementById('pw-mq-css')){
        var st=document.createElement('style'); st.id='pw-mq-css';
        st.textContent=
          '@keyframes pwmqL{from{transform:translateX(0)}to{transform:translateX(-50%)}}'+
          '.pw-mq-wrap{position:relative;overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent);mask:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent);}'+
          '.pw-mq-track{display:flex;width:max-content;align-items:center;}'+
          '.pw-mq-wrap:hover .pw-mq-track{animation-play-state:paused;}'+
          '.pw-rev-ov{position:fixed;inset:0;background:rgba(20,30,26,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}'+
          '.pw-rev-card{background:#fff;max-width:440px;width:100%;border-radius:18px;padding:28px 26px 24px;box-shadow:0 24px 60px rgba(0,0,0,.3);position:relative;}'+
          '.pw-rev-x{position:absolute;top:12px;right:14px;background:none;border:none;font-size:22px;line-height:1;color:#9aa;cursor:pointer;}'+
          '@media(prefers-reduced-motion:reduce){.pw-mq-track{animation:none!important;transform:none!important;}.pw-mq-wrap{overflow-x:auto;-webkit-mask:none;mask:none;}}';
        document.head.appendChild(st);
      }

      // Store global de reseñas para el modal "leer completa".
      window.__pwRev=window.__pwRev||[];
      if(!window.__pwRevOpen){
        window.__pwRevOpen=function(i){
          var r=(window.__pwRev||[])[i]; if(!r) return;
          function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
          var sd='#52B788',ti='#1B4332',ac='#2D6A4F';
          var rs='';for(var k=1;k<=5;k++)rs+='<span style="color:'+(k<=r.stars?sd:'#E5E0DD')+';font-size:18px;">★</span>';
          var dn=r._display||r.nombre||'Cliente Pathway';
          var ini=dn.split(' ').filter(Boolean).slice(0,2).map(function(x){return x.charAt(0).toUpperCase();}).join('');
          var ov=document.createElement('div');ov.className='pw-rev-ov';
          ov.onclick=function(ev){if(ev.target===ov)ov.parentNode.removeChild(ov);};
          ov.innerHTML='<div class="pw-rev-card"><button class="pw-rev-x" aria-label="Cerrar" onclick="var o=this.closest(\'.pw-rev-ov\');o.parentNode.removeChild(o)">×</button>'+
            '<div style="display:flex;gap:2px;margin-bottom:14px;">'+rs+'</div>'+
            '<div style="font-size:15px;line-height:1.6;color:#2A2A2A;font-style:italic;margin-bottom:18px;">"'+e(r.text)+'"</div>'+
            '<div style="display:flex;align-items:center;gap:11px;"><div style="width:38px;height:38px;border-radius:50%;background:'+ac+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">'+e(ini)+'</div>'+
            '<div style="font-size:14px;font-weight:700;color:'+ti+';">'+e(dn)+'</div></div></div>';
          document.body.appendChild(ov);
        };
      }

      function fmt(n){ return n>=1000 ? n.toLocaleString('es') : String(n); }
      function chipReview(r){
        var idx=window.__pwRev.length; window.__pwRev.push(r);
        var rs='';for(var i=1;i<=5;i++)rs+='<span style="color:'+(i<=r.stars?sand:'#E5E0DD')+';font-size:13px;">★</span>';
        var dn=r._display||r.nombre||'Cliente Pathway';
        return '<div role="button" tabindex="0" aria-label="Leer reseña de '+escH(dn)+'" onclick="__pwRevOpen('+idx+')" onkeydown="if(event.key===\'Enter\')__pwRevOpen('+idx+')" style="cursor:pointer;flex:0 0 auto;display:flex;align-items:center;gap:10px;height:64px;background:rgba(255,255,255,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(45,106,79,.10);border-radius:16px;padding:0 18px;">'+
          '<span style="display:flex;gap:1px;flex-shrink:0;">'+rs+'</span>'+
          '<span style="max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13.5px;font-style:italic;color:#2A2A2A;">"'+escH(r.text).replace(/\n/g,' ')+'"</span>'+
          '<span style="font-size:13px;font-weight:700;color:'+titleColor+';white-space:nowrap;flex-shrink:0;">— '+escH(dn)+'</span>'+
          '<span aria-hidden="true" style="font-size:15px;color:'+accent+';opacity:.55;flex-shrink:0;">＋</span>'+
          '</div>';
      }
      function chipStat(s){
        return '<div style="flex:0 0 auto;display:flex;align-items:center;gap:12px;height:64px;padding:0 12px;">'+
          '<div style="width:48px;height:48px;border-radius:50%;background:'+s.tint+';display:flex;align-items:center;justify-content:center;font-size:23px;flex-shrink:0;">'+s.icon+'</div>'+
          '<div style="line-height:1.12;"><div style="font-family:\'Fraunces\',Georgia,serif;font-size:23px;font-weight:600;color:'+s.col+';white-space:nowrap;">'+escH(s.num)+'</div>'+
          '<div style="font-size:12.5px;color:#6a7a70;white-space:nowrap;">'+escH(s.label)+'</div></div>'+
          '</div>';
      }
      function chipFace(f){
        return '<div title="'+escH(f.nombre)+'" style="flex:0 0 auto;width:58px;height:58px;border-radius:50%;overflow:hidden;border:2.5px solid #fff;box-shadow:0 3px 12px rgba(27,46,38,.16);background:#eee;">'+
          '<img src="'+escH(f.foto)+'" alt="'+escH(f.nombre)+'" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentNode.style.display=\'none\'"></div>';
      }
      function chipLogo(g){
        // Sin fondo — tipo sticker. Si el "logo" no es una imagen (p.ej. un link
        // de Instagram) el onerror lo oculta y no rompe la tira.
        return '<div title="'+escH(g.nombre)+'" style="flex:0 0 auto;height:52px;display:flex;align-items:center;padding:0 8px;">'+
          '<img src="'+escH(g.logo)+'" alt="'+escH(g.nombre)+'" loading="lazy" style="height:46px;width:auto;max-width:140px;object-fit:contain;filter:drop-shadow(0 2px 5px rgba(27,46,38,.20));" onerror="this.parentNode.style.display=\'none\'"></div>';
      }

      function render(faces,logos,paises,nCli,nInf){
        var stats=[];
        if(avg) stats.push({icon:'⭐',num:avg,label:'valoración media',tint:'#EAF7F0',col:'#2D6A4F'});
        if(paises>0) stats.push({icon:'🌎',num:String(paises),label:paises===1?'país':'países',tint:'#EAF2FF',col:'#3E6AC4'});
        if(nCli>0) stats.push({icon:'💚',num:fmt(nCli),label:'clientes acompañados',tint:'#FDEEF3',col:'#C4558A'});
        if(nInf>0) stats.push({icon:'✨',num:fmt(nInf),label:'informes con IA',tint:'#FBF3DE',col:'#C99A2E'});

        // Round-robin: reseña, dato, foto, logo, reseña, dato... -> mezcla pareja.
        var qs=[ revShown.map(chipReview), stats.map(chipStat), faces.map(chipFace), logos.map(chipLogo) ];
        var seq=[],any=true;
        while(any){any=false;qs.forEach(function(a){if(a.length){seq.push(a.shift());any=true;}});}
        if(!seq.length){ host.style.display='none'; var sect=host.closest('section'); if(sect)sect.style.display='none'; return; }
        var dur=Math.max(30,Math.round(seq.length*3.5));
        var body=seq.join('');
        host.innerHTML='<div class="pw-mq-wrap" style="max-width:1160px;margin:0 auto;">'+
          '<div class="pw-mq-track" style="gap:18px;padding:8px;animation:pwmqL '+dur+'s linear infinite;">'+body+body+'</div></div>';
      }

      function countRows(path){
        return fetch(SB+'/rest/v1/'+path+'&apikey='+encodeURIComponent(KEY),
          {headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'count=exact','Range':'0-0'}})
          .then(function(r){var cr=r.headers.get('content-range')||'';var t=cr.split('/')[1];var n=parseInt(t,10);return isFinite(n)?n:0;})
          .catch(function(){return 0;});
      }
      function loadCoaches(){
        var fu=SB+'/rest/v1/usuarios?rol=in.(coach,admin)&activo=eq.true&select=nombre,foto_url,configuracion,perfil_publico_activo&apikey='+encodeURIComponent(KEY);
        return fetch(fu,{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Accept':'application/json'}})
          .then(function(r){return r.ok?r.json():[];})
          .then(function(rows){
            var faces=[],logos=[],paisSet={};
            (rows||[]).forEach(function(c){
              var cfg=c.configuracion||{};
              var pub=(c.perfil_publico_activo===true||cfg.perfil_publico_activo===true);
              if(!pub) return;
              var foto=c.foto_url||cfg.foto_url||cfg.foto_perfil||'';
              if(foto) faces.push({foto:foto,nombre:c.nombre||'Coach'});
              var logo=cfg.logo_url||'';
              if(logo && /^https?:\/\//.test(logo)) logos.push({logo:logo,nombre:c.nombre||'Coach'});
              var pais=String(cfg.pais||'').trim().toUpperCase();
              if(pais) paisSet[pais]=1;
            });
            return {faces:faces,logos:logos,paises:Object.keys(paisSet).length};
          }).catch(function(){return {faces:[],logos:[],paises:0};});
      }

      Promise.all([loadCoaches(),countRows('candidatos?select=id'),countRows('informes?select=id')])
        .then(function(res){
          var cc=res[0]||{faces:[],logos:[],paises:0};
          render(cc.faces||[],cc.logos||[],cc.paises||0,res[1]||0,res[2]||0);
        })
        .catch(function(){ render([],[],0,0,0); });
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
