/* ============================================================
   pw-sign.js — Firma corporativa Pathway (única fuente de verdad).
   Genera la firma de email APROBADA (misma estética que "Mi firma"),
   email-safe: los iconos van como PNG embebido (Gmail borra los SVG).
   Uso:  pwSignature({name, email, photo, ig, li}, 'verde'|'blanca')
         -> Promise<string html>
   ============================================================ */
(function(g){
  var WA  = "https://wa.me/34623816019";
  var CAL = "https://calendly.com/mmicaela-jairedin/30min";
  var WEB = "https://pathwaycareercoach.com";

  var IC = {
    mail:  '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
    cal:   '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'
  };
  var WHATS = '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.76.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.53 0-3.03-.41-4.34-1.19l-.31-.18-3.11.82.83-3.03-.2-.32a8.2 8.2 0 0 1-1.26-4.35c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.24-8.23 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42l-.48-.01c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/>';
  var IG = '<rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.3"/>';
  var LI = '<path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75V21h-4v-5.1c0-1.22-.02-2.8-1.7-2.8-1.7 0-1.96 1.32-1.96 2.7V21h-4z"/>';
  var BADGES = [
    { k:"mail",  i:IC.mail,  f:false },
    { k:"whats", i:WHATS,    f:true  },
    { k:"web",   i:IC.globe, f:false },
    { k:"cal",   i:IC.cal,   f:false },
    { k:"ig",    i:IG,       f:false },
    { k:"li",    i:LI,       f:true  }
  ];

  function esc(s){ return (""+(s==null?"":s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function initials(n){ return (""+(n||"?")).trim().split(/\s+/).map(function(w){return w[0];}).slice(0,2).join("").toUpperCase(); }

  function badgeSVG(inner, filled, bg, fg){
    var ic = filled
      ? '<svg x="17" y="17" width="30" height="30" viewBox="0 0 24 24" fill="'+fg+'">'+inner+'</svg>'
      : '<svg x="17" y="17" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="'+fg+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+inner+'</svg>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="'+bg+'"/>'+ic+'</svg>';
  }
  function rasterize(svg){
    return new Promise(function(res){
      var img = new Image();
      img.onload = function(){ var c=document.createElement("canvas"); c.width=64;c.height=64; c.getContext("2d").drawImage(img,0,0,64,64); try{ res(c.toDataURL("image/png")); }catch(e){ res(""); } };
      img.onerror = function(){ res(""); };
      img.src = "data:image/svg+xml;base64," + btoa(svg);
    });
  }
  var _iconCache = {};
  function icons(variant){
    if(_iconCache[variant]) return Promise.resolve(_iconCache[variant]);
    var bg = variant==="verde" ? "#ffffff" : "#2D6A4F";
    var fg = variant==="verde" ? "#2D6A4F" : "#ffffff";
    return Promise.all(BADGES.map(function(b){ return rasterize(badgeSVG(b.i,b.f,bg,fg)).then(function(p){ return {k:b.k,p:p}; }); }))
      .then(function(arr){ var m={}; arr.forEach(function(x){ m[x.k]=x.p; }); _iconCache[variant]=m; return m; });
  }
  function badge(href, src, title){
    return '<a href="'+href+'" title="'+title+'" style="text-decoration:none;display:inline-block;margin:0 6px 0 0;"><img src="'+(src||"")+'" width="31" height="31" alt="'+title+'" style="display:inline-block;border:0;vertical-align:middle;"></a>';
  }

  function sigInner(p, m, variant){
    var green   = variant==="verde";
    var nameCol = green ? "#ffffff" : "#2D6A4F";
    var roleCol = green ? "#B7E4C7" : "#52B788";
    var divider = green ? "rgba(255,255,255,.6)" : "#52B788";
    var ring    = green ? "#ffffff" : "#52B788";
    var ig = p.ig || "https://www.instagram.com/pathway.coach/";
    var li = p.li || "https://linkedin.com/company/pathwaycareercoach";
    var ph = p.photo
      ? '<img src="'+p.photo+'" width="104" height="104" alt="" style="display:block;border-radius:50%;object-fit:cover;border:3px solid '+ring+';">'
      : '<div style="width:104px;height:104px;border-radius:50%;background:'+(green?"rgba(255,255,255,.18)":"#2D6A4F")+';color:#fff;font-family:Georgia,serif;font-size:34px;font-weight:bold;line-height:104px;text-align:center;border:3px solid '+ring+';">'+esc(initials(p.name))+'</div>';
    return '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>'
      + '<td style="vertical-align:middle;padding-right:20px;">'+ph+'</td>'
      + '<td style="vertical-align:middle;border-left:2px solid '+divider+';padding-left:20px;">'
      +   '<div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;letter-spacing:2.5px;color:'+nameCol+';text-transform:uppercase;line-height:1.2;">'+esc(p.name)+'</div>'
      +   '<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:600;letter-spacing:2.5px;color:'+roleCol+';text-transform:uppercase;margin-top:4px;">Pathway Team</div>'
      +   '<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>'
      +   '<div style="white-space:nowrap;">'
      +     badge('mailto:'+esc(p.email), m.mail, 'Email') + badge(WA, m.whats, 'WhatsApp') + badge(WEB, m.web, 'Web')
      +     badge(CAL, m.cal, 'Agenda') + badge(ig, m.ig, 'Instagram') + badge(li, m.li, 'LinkedIn')
      +   '</div>'
      + '</td></tr></table>';
  }

  // API pública
  g.pwSignature = function(person, variant){
    variant = (variant==="verde") ? "verde" : "blanca";
    return icons(variant).then(function(m){
      var inner = sigInner(person||{}, m, variant);
      if(variant==="verde"){
        return '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="background:#2D6A4F;border-radius:14px;padding:20px 24px;">'+inner+'</td></tr></table>';
      }
      return inner;
    });
  };
})(window);
