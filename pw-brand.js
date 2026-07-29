// pw-brand.js — MOTOR ÚNICO de white-label (color del coach + sus variantes).
// -------------------------------------------------------------------------
// Antes cada pantalla tenía su propio motor con su propio juego de tokens:
//   cliente.html  → --brand*      (_applyCoachColor)
//   fit/fin       → --rose*       (_pwBrandVars)
//   panel-v2      → --accent/--cp (_applyPanelBrand)
// Resultado: para algo NUEVO había que reinventar el white-label. Este módulo
// unifica: UN color → TODOS los tokens (canónicos --accent* + los históricos
// --brand*/--rose*), con las MISMAS variantes (tinte/sombra) que ya usaban los
// portales, así reemplazarlo es pixel-idéntico. Lo nuevo solo hace:
//     PWBrand.apply(colorDelCoach)
// y queda con la tipografía/espacios/colores de la base + el color del coach.
(function(){
  if (window.PWBrand) return;
  function cl(v){ return Math.max(0, Math.min(255, Math.round(v))); }
  function hx(v){ return cl(v).toString(16).padStart(2, "0"); }

  // Aplica el color de marca (hex #rrggbb) a las variables CSS del documento.
  // Devuelve true si el color era válido y se aplicó.
  function apply(hex){
    if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return false;
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    function sh(f){ return "#" + hx(r * f) + hx(g * f) + hx(b * f); }                     // sombra (más oscuro)
    function tint(a){ return "#" + hx(r + (255 - r) * a) + hx(g + (255 - g) * a) + hx(b + (255 - b) * a); } // tinte (más claro)
    function rgba(a){ return "rgba(" + r + "," + g + "," + b + "," + a + ")"; }
    // Variantes idénticas a las que ya usaban los portales (_pwBrandVars).
    var dark = sh(0.62), mid = tint(0.55), light = tint(0.90);
    var vars = {
      // canónicos (lo que debe usar TODA pantalla nueva)
      "--accent": hex, "--accent-soft": tint(0.30),
      "--accent-dark": dark, "--accent-mid": mid, "--accent-light": light,
      // históricos: mismo color/variantes → no rompe pantallas viejas al adoptarlo
      "--brand": hex, "--brand-dark": dark, "--brand-mid": rgba(".35"), "--brand-light": rgba(".12"),
      "--rose": hex, "--rose-dark": dark, "--rose-mid": mid, "--rose-light": light,
      // chrome derivado (sidebar, bordes, sombras) para que TODO siga la marca
      "--sb-bg": tint(0.94), "--border": tint(0.80),
      "--shadow": "0 2px 16px " + rgba(".08"), "--shadow-hover": "0 6px 24px " + rgba(".14")
    };
    var rs = document.documentElement.style;
    for (var k in vars) if (vars.hasOwnProperty(k)) rs.setProperty(k, vars[k]);
    return true;
  }

  // ── Color SECUNDARIO (acento de apoyo) ───────────────────────────────────
  // Token dedicado --accent-2 + los históricos de acento secundario que usan las
  // pantallas (--sendero en multicoach, --pw-sendero en panel/portal). Se aplica
  // DESPUÉS del color primario para que gane el secundario elegido explícitamente.
  function secondary(hex){
    if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return false;
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    function tint(a){ return "#" + hx(r+(255-r)*a) + hx(g+(255-g)*a) + hx(b+(255-b)*a); }
    var rs = document.documentElement.style, m = {
      "--accent-2": hex, "--accent-2-light": tint(0.86),
      "--sendero": hex, "--pw-sendero": hex
    };
    for (var k in m) if (m.hasOwnProperty(k)) rs.setProperty(k, m[k]);
    return true;
  }

  // ── TIPOGRAFÍA de marca ──────────────────────────────────────────────────
  // Una sola fuente white-label para toda la superficie: carga la Google Font (una
  // vez) y la aplica al body + al token --sans (que usan los portales). 'Inter' o
  // vacío = default de la base (limpia el override). Cubre panel, panel coach y
  // portal del cliente con la MISMA llamada.
  var FONTS = {
    "Inter": "'Inter',-apple-system,system-ui,sans-serif",
    "Poppins": "'Poppins',system-ui,sans-serif",
    "Montserrat": "'Montserrat',system-ui,sans-serif",
    "Lora": "'Lora',Georgia,serif",
    "Playfair Display": "'Playfair Display',Georgia,serif",
    "Nunito": "'Nunito',system-ui,sans-serif",
    "Work Sans": "'Work Sans',system-ui,sans-serif"
  };
  function font(name){
    var rs = document.documentElement.style;
    if (!name || name === "Inter" || !FONTS[name]) {           // default → limpiar override
      rs.removeProperty("--brand-font"); rs.removeProperty("--sans");
      try { document.body.style.fontFamily = ""; } catch(e){}
      return name === "Inter";
    }
    try {
      var id = "pwbf-" + name.replace(/\s+/g, "");
      if (!document.getElementById(id)) {
        var l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(name).replace(/%20/g, "+") + ":wght@400;500;600;700;800&display=swap";
        document.head.appendChild(l);
      }
    } catch(e){}
    var stack = FONTS[name];
    rs.setProperty("--brand-font", stack);
    rs.setProperty("--sans", stack);
    try { document.body.style.fontFamily = stack; } catch(e){}
    return true;
  }

  // Aplica una marca completa {color, color2, font} de una sola llamada.
  function marca(m){
    m = m || {};
    if (m.color) apply(m.color);
    if (m.color2) secondary(m.color2);
    if (m.font) font(m.font);
  }

  window.PWBrand = { apply: apply, secondary: secondary, font: font, marca: marca };
})();
