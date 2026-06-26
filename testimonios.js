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
  var SB='https://ddxnrsnjdvtqhxunxnwj.supabase.co';
  var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

  function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function render(host){
    var max=parseInt(host.getAttribute('data-max'))||6;
    var minStars=parseInt(host.getAttribute('data-min-stars'))||1;
    var theme=host.getAttribute('data-theme')||'green';

    // apikey duplicado en URL como fallback: si por algún proxy/CORS/cache el
    // header se pierde, Kong (gateway de Supabase) también acepta apikey en
    // la query. Sin esto el endpoint devolvía 400 "No API key found in request".
    fetch(SB+'/rest/v1/reviews?publica=eq.true&select=nombre,rating,texto&order=rating.desc,created_at.desc&apikey='+encodeURIComponent(KEY),{
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Accept':'application/json'}
    }).then(function(r){return r.ok?r.json():[];}).then(function(rows){
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

      var html='';
      html+='<div style="text-align:center;margin-bottom:36px;">';
      html+='<div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:14px;">';
      var stars='';for(var s=1;s<=5;s++)stars+='<span style="color:'+sand+';font-size:24px;">★</span>';
      html+=stars;
      html+='<span style="font-family:\'Fraunces\',Georgia,serif;font-size:24px;font-weight:500;color:'+titleColor+';">'+avg+'/5</span>';
      html+='</div>';
      html+='<h2 style="font-family:\'Fraunces\',Georgia,serif;font-size:clamp(28px,4vw,40px);font-weight:500;color:'+titleColor+';letter-spacing:-1.2px;line-height:1.15;margin-bottom:10px;">'+heading+'</h2>';
      html+='</div>';

      // Grilla de 2 columnas en desktop/tablet (1 en mobile). Mantiene la
      // sección simétrica con cualquier número par y los cards de cada fila
      // se estiran a la misma altura (default de CSS grid: align-items:stretch).
      html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:18px;align-items:stretch;max-width:880px;margin:0 auto;">';
      displayed.forEach(function(r){
        var rs='';for(var i=1;i<=5;i++)rs+='<span style="color:'+(i<=r.stars?sand:'#E5E0DD')+';font-size:16px;">★</span>';
        var displayName=r._display||r.nombre||'Cliente Pathway';
        var ini=displayName.split(' ').filter(Boolean).slice(0,2).map(function(s){return s.charAt(0).toUpperCase();}).join('');
        html+='<div style="background:#fff;border:1.5px solid rgba(45,106,79,.12);border-radius:16px;padding:22px 24px;display:flex;flex-direction:column;gap:14px;transition:transform .2s,box-shadow .2s;" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 12px 28px rgba(27,46,38,.08)\';" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';">';
        html+='<div style="display:flex;gap:1px;">'+rs+'</div>';
        html+='<div style="font-size:14px;color:#2A2A2A;line-height:1.6;font-style:italic;">"'+escH(r.text).replace(/\n/g,'<br>')+'"</div>';
        html+='<div style="display:flex;align-items:center;gap:12px;margin-top:auto;padding-top:14px;border-top:1px solid rgba(45,106,79,.08);">';
        html+='<div style="width:40px;height:40px;border-radius:50%;background:'+accent+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;">'+ini+'</div>';
        html+='<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:'+titleColor+';">'+escH(displayName)+'</div></div>';
        html+='</div>';
        html+='</div>';
      });
      html+='</div>';
      host.innerHTML=html;
    }).catch(function(){host.style.display='none';});
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){
      document.querySelectorAll('[data-testimonios]').forEach(render);
    });
  } else {
    document.querySelectorAll('[data-testimonios]').forEach(render);
  }
})();
