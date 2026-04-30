// Testimonios públicos — Pathway Career Coach
//
// Fetchea reseñas de candidatos.resena (donde public:true) desde Supabase
// y las renderiza en el primer <div data-testimonios> que encuentre.
//
// Uso desde cualquier página pública:
//   <div data-testimonios data-max="6" data-theme="green"></div>
//   <script src="testimonios.js"></script>
//
// Atributos opcionales:
//   data-max:   número máximo de reseñas (default 6)
//   data-theme: 'green' (default) o 'beige' — afecta colores
//
// La sección se OCULTA automáticamente si no hay reseñas públicas, así
// que es seguro incluirla en una landing antes de tener testimonios.

(function(){
  var SB='https://ddxnrsnjdvtqhxunxnwj.supabase.co';
  var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

  function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function render(host){
    var max=parseInt(host.getAttribute('data-max'))||6;
    var theme=host.getAttribute('data-theme')||'green';

    fetch(SB+'/rest/v1/candidatos?resena=not.is.null&select=nombre,linkedin,resena&order=created_at.desc',{
      headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}
    }).then(function(r){return r.ok?r.json():[];}).then(function(rows){
      var reviews=[];
      rows.forEach(function(c){
        try{
          var r=JSON.parse(c.resena);
          if(r&&r.stars&&r.public!==false&&(r.text||'').trim().length>=10){
            reviews.push({stars:r.stars,text:r.text,date:r.date,nombre:c.nombre,linkedin:c.linkedin});
          }
        }catch(e){}
      });

      // Si no hay reseñas, ocultar la sección entera (no mostrar "vacío")
      if(!reviews.length){host.style.display='none';return;}

      // Ordenar por stars desc, luego fecha desc
      reviews.sort(function(a,b){
        if(b.stars!==a.stars)return b.stars-a.stars;
        return new Date(b.date)-new Date(a.date);
      });
      reviews=reviews.slice(0,max);

      var avg=(rows.reduce(function(s,c){
        try{var r=JSON.parse(c.resena);return s+(r&&r.stars&&r.public!==false?r.stars:0);}catch(e){return s;}
      },0)/reviews.length).toFixed(1);

      var accent=theme==='beige'?'#8C7B80':'#2D6A4F';
      var sand=theme==='beige'?'#E9C46A':'#52B788';
      var titleColor=theme==='beige'?'#1B2E26':'#1B4332';

      var html='';
      html+='<div style="text-align:center;margin-bottom:36px;">';
      html+='<div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:14px;">';
      var stars='';for(var s=1;s<=5;s++)stars+='<span style="color:'+sand+';font-size:24px;">★</span>';
      html+=stars;
      html+='<span style="font-family:\'Fraunces\',Georgia,serif;font-size:24px;font-weight:500;color:'+titleColor+';">'+avg+'/5</span>';
      html+='</div>';
      html+='<h2 style="font-family:\'Fraunces\',Georgia,serif;font-size:clamp(28px,4vw,40px);font-weight:500;color:'+titleColor+';letter-spacing:-1.2px;line-height:1.15;margin-bottom:10px;">Lo que dicen nuestros clientes</h2>';
      html+='<p style="font-size:15px;color:'+accent+';opacity:.85;max-width:560px;margin:0 auto;">'+reviews.length+' personas que pasaron por Pathway. Cada testimonio viene con link a su LinkedIn — son reales.</p>';
      html+='</div>';

      html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;">';
      reviews.forEach(function(r){
        var rs='';for(var i=1;i<=5;i++)rs+='<span style="color:'+(i<=r.stars?sand:'#E5E0DD')+';font-size:16px;">★</span>';
        var liUrl=r.linkedin?('https://linkedin.com/in/'+String(r.linkedin).replace(/^.*linkedin\.com\/in\//,'').replace(/\/$/,'')):'';
        var ini=(r.nombre||'?').split(' ').filter(Boolean).slice(0,2).map(function(s){return s.charAt(0).toUpperCase();}).join('');
        html+='<div style="background:#fff;border:1.5px solid rgba(45,106,79,.12);border-radius:16px;padding:22px 24px;display:flex;flex-direction:column;gap:14px;transition:transform .2s,box-shadow .2s;" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 12px 28px rgba(27,46,38,.08)\';" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';">';
        html+='<div style="display:flex;gap:1px;">'+rs+'</div>';
        html+='<div style="font-size:14px;color:#2A2A2A;line-height:1.6;font-style:italic;">"'+escH(r.text).replace(/\n/g,'<br>')+'"</div>';
        html+='<div style="display:flex;align-items:center;gap:12px;margin-top:auto;padding-top:14px;border-top:1px solid rgba(45,106,79,.08);">';
        html+='<div style="width:40px;height:40px;border-radius:50%;background:'+accent+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;">'+ini+'</div>';
        html+='<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:'+titleColor+';">'+escH(r.nombre||'Cliente Pathway')+'</div>';
        if(liUrl)html+='<a href="'+escH(liUrl)+'" target="_blank" rel="noopener" style="font-size:11px;color:'+accent+';text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:2px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>Ver LinkedIn</a>';
        html+='</div></div>';
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
