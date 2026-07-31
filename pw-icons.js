/* ===================================================================
   PATHWAY ICON SYSTEM — window.PWI  (una sola fuente de verdad)
   Iconos Lucide (https://lucide.dev/icons) para TODA la plataforma:
   landing, panel del coach (panel-v2), multicoach, portales del cliente
   y páginas de empresa. NO se mezclan librerías. NO se usan emojis del
   sistema como iconos de interfaz.

   Spec (definido en pw-icons.css): outline · stroke 2px · 20px (18px en
   botones chicos) · color #1F4030 (--pw-icon), hereda currentColor en
   controles de color propio.

   API:
     PWI.svg(name, opts)   -> string <svg> listo para innerHTML.
                              opts: {sm:true} 18px · {cls:'x'} clase extra
                              {size:24} tamaño puntual · {title:'..'} a11y.
     PWI.chip(name, opts)  -> icono dentro del "chip" gris (.pw-icchip).
     PWI.mount(root)       -> reemplaza <i data-ic="name"></i> por el SVG.
                              data-sm -> 18px. Corre solo en DOMContentLoaded.
     PWI.has(name)         -> boolean.
     PWI.IC                -> el mapa de path data (compartido con panel-v2).

   Al sumar un icono nuevo: agregarlo UNA vez acá (nombre semántico) y
   usarlo por nombre en todas las pantallas. Nunca pegar <svg> sueltos.
   =================================================================== */
(function(){
  "use strict";

  /* ── Mapa de iconos (path data Lucide, viewBox 0 0 24 24) ───────────
     Bloque base = el set canónico que ya vivía en panel-v2.html (IC).
     Se mantiene idéntico para que panel-v2 apunte acá sin cambios. */
  var IC = {
    /* navegación / chrome del panel */
    navResumen: "<path d='M3 3v18h18'/><path d='M7 14l4-4 3 3 5-7'/>",
    navClientes:"<path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/>",
    navLinks:   "<path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/>",
    navConfig:  "<circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'/>",
    navAdmin:   "<path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/><path d='M9 12l2 2 4-4'/>",
    navMsg:     "<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/>",
    navEmails:  "<rect x='2' y='4' width='20' height='16' rx='2'/><path d='m22 6-10 7L2 6'/>",
    plus:       "<line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/>",
    extLink:    "<path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/><polyline points='15 3 21 3 21 9'/><line x1='10' y1='14' x2='21' y2='3'/>",
    logout:     "<path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'/><polyline points='16 17 21 12 16 7'/><line x1='21' y1='12' x2='9' y2='12'/>",
    arrowR:     "<line x1='5' y1='12' x2='19' y2='12'/><polyline points='12 5 19 12 12 19'/>",
    arrowL:     "<line x1='19' y1='12' x2='5' y2='12'/><polyline points='12 19 5 12 12 5'/>",
    chevR:      "<polyline points='9 18 15 12 9 6'/>",
    chevL:      "<polyline points='15 18 9 12 15 6'/>",
    chevUp:     "<polyline points='18 15 12 9 6 15'/>",
    chevDown:   "<polyline points='6 9 12 15 18 9'/>",
    navCal:     "<rect x='3' y='4' width='18' height='18' rx='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/><path d='m9 15 2 2 4-4'/>",
    navNegocio: "<path d='M4 20h16'/><path d='M7 20V10M12 20V4M17 20v-7'/>",
    search:     "<circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/>",
    eye:        "<path d='M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z'/><circle cx='12' cy='12' r='3'/>",
    eyeOff:     "<path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/><line x1='1' y1='1' x2='23' y2='23'/>",
    eyeClosed:  "<path d='M2 12s3-7 10-7 10 7 10 7'/><path d='m4 15 1.5-2.5M9 18l.5-3M15 18l-.5-3M20 15l-1.5-2.5'/>",
    pulse:      "<path d='M22 12h-4l-3 9L9 3l-3 9H2'/>",
    copy:       "<rect x='9' y='9' width='13' height='13' rx='2' ry='2'/><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/>",
    check:      "<polyline points='20 6 9 17 4 12'/>",
    qr:         "<rect x='3' y='3' width='7' height='7'/><rect x='14' y='3' width='7' height='7'/><rect x='3' y='14' width='7' height='7'/><line x1='14' y1='14' x2='14' y2='21'/><line x1='18' y1='14' x2='18' y2='18'/><line x1='21' y1='18' x2='18' y2='18'/>",
    wa:         "<path d='M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'/>",
    lkProfile:  "<path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/>",
    lkIntake:   "<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='9' y1='13' x2='15' y2='13'/>",
    lkSignup:   "<path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='8.5' cy='7' r='4'/><line x1='20' y1='8' x2='20' y2='14'/><line x1='23' y1='11' x2='17' y2='11'/>",
    cfgProfile: "<path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/>",
    cfgServices:"<line x1='12' y1='1' x2='12' y2='23'/><path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'/>",
    cfgRecursos:"<path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20'/><path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'/>",
    cfgBrand:   "<circle cx='13.5' cy='6.5' r='.5' fill='currentColor'/><circle cx='17.5' cy='10.5' r='.5' fill='currentColor'/><circle cx='8.5' cy='7.5' r='.5' fill='currentColor'/><circle cx='6.5' cy='12.5' r='.5' fill='currentColor'/><path d='M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.688-1.687h1.996c3.094 0 5.543-2.55 5.543-5.65C22 6.5 17.5 2 12 2z'/>",
    cfgBilling: "<rect x='2' y='5' width='20' height='14' rx='2'/><line x1='2' y1='10' x2='22' y2='10'/>",
    cfgNotifs:  "<path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/><path d='M13.73 21a2 2 0 0 1-3.46 0'/>",
    cfgInteg:   "<polyline points='16 18 22 12 16 6'/><polyline points='8 6 2 12 8 18'/>",
    cfgAccount: "<path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/>",
    download:   "<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' y1='15' x2='12' y2='3'/>",
    upload:     "<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='17 8 12 3 7 8'/><line x1='12' y1='3' x2='12' y2='15'/>",
    edit:       "<path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/>",
    close:      "<line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/>",
    msg:        "<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/>",
    insStale:   "<circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/>",
    insClosing: "<path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/><polyline points='22 4 12 14.01 9 11.01'/>",
    insProfile: "<circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/>",
    insMilestone:"<polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/>",
    spark:      "<path d='M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2z'/><path d='M18 14.5l.7 2.1L21 17.5l-2.3.9L18 21l-.7-2.6L15 17.5l2.3-.9z'/>",

    /* ── reemplazos de emojis del chrome (nombres semánticos Lucide) ──
       Se usan por NOMBRE en todas las pantallas para matar el emoji. */
    target:     "<circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/>",                 /* 🎯 */
    fileText:   "<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/><line x1='10' y1='9' x2='8' y2='9'/>", /* 📄 📝 */
    clipboard:  "<path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'/><rect x='8' y='2' width='8' height='4' rx='1' ry='1'/>",        /* 📋 */
    trophy:     "<path d='M6 9H4.5a2.5 2.5 0 0 1 0-5H6'/><path d='M18 9h1.5a2.5 2.5 0 0 0 0-5H18'/><path d='M4 22h16'/><path d='M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22'/><path d='M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22'/><path d='M18 2H6v7a6 6 0 0 0 12 0V2Z'/>",  /* 🏆 */
    medal:      "<circle cx='12' cy='8' r='7'/><polyline points='8.21 13.89 7 23 12 20 17 23 15.79 13.88'/>",                       /* 🏅 🥇 🥈 🥉 */
    calendar:   "<rect x='3' y='4' width='18' height='18' rx='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/>", /* 📅 🗓 */
    alert:      "<path d='M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/><line x1='12' y1='9' x2='12' y2='13'/><line x1='12' y1='17' x2='12.01' y2='17'/>", /* ⚠ */
    checkCircle:"<path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/><polyline points='22 4 12 14.01 9 11.01'/>",                            /* ✅ */
    barChart:   "<line x1='12' y1='20' x2='12' y2='10'/><line x1='18' y1='20' x2='18' y2='4'/><line x1='6' y1='20' x2='6' y2='16'/>",  /* 📊 */
    trendUp:    "<polyline points='23 6 13.5 15.5 8.5 10.5 1 18'/><polyline points='17 6 23 6 23 12'/>",                             /* 📈 */
    briefcase:  "<rect x='2' y='7' width='20' height='14' rx='2' ry='2'/><path d='M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'/>",     /* 💼 */
    flame:      "<path d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'/>", /* 🔥 */
    chat:       "<path d='M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'/>", /* 💬 */
    dollar:     "<line x1='12' y1='1' x2='12' y2='23'/><path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'/>",                  /* 💰 */
    wallet:     "<path d='M21 12V7H5a2 2 0 0 1 0-4h14v4'/><path d='M3 5v14a2 2 0 0 0 2 2h16v-5'/><path d='M18 12a2 2 0 0 0 0 4h4v-4Z'/>",  /* 💰 alt */
    mail:       "<rect x='2' y='4' width='20' height='16' rx='2'/><path d='m22 6-10 7L2 6'/>",                                       /* ✉ 📧 */
    star:       "<polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/>", /* ⭐ ★ ✦ */
    dumbbell:   "<path d='M6 7v10M18 7v10M4 9h2M18 9h2M4 15h2M18 15h2M6 12h12'/>", /* 💪 🏋 — barra horizontal (misma que el nav del cliente: gym idéntico coach↔cliente) */
    camera:     "<path d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'/><circle cx='12' cy='13' r='4'/>", /* 📷 */
    paperclip:  "<path d='M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'/>", /* 📎 */
    heart:      "<path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/>", /* ❤ 💚 */
    users:      "<path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/>", /* 👥 */
    user:       "<path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/>",                              /* 👤 */
    sprout:     "<path d='M7 20h10'/><path d='M10 20c5.5-2.5.8-6.4 3-10'/><path d='M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z'/><path d='M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z'/>", /* 🌱 */
    lock:       "<rect x='3' y='11' width='18' height='11' rx='2' ry='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/>",                     /* 🔒 */
    phone:      "<path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'/>", /* 📞 */
    zap:        "<polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/>",                                                       /* ⚡ */
    gift:       "<polyline points='20 12 20 22 4 22 4 12'/><rect x='2' y='7' width='20' height='5'/><line x1='12' y1='22' x2='12' y2='7'/><path d='M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z'/><path d='M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'/>", /* 🎁 */
    book:       "<path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20'/><path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'/>",  /* 📚 */
    ruler:      "<path d='M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z'/><path d='m7.5 10.5 2 2'/><path d='m10.5 7.5 2 2'/><path d='m13.5 4.5 2 2'/><path d='m4.5 13.5 2 2'/>", /* 📐 */
    handshake:  "<path d='m11 17 2 2a1 1 0 1 0 3-3'/><path d='m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4'/><path d='m21 3 1 11h-2'/><path d='M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3'/><path d='M3 4h8'/>", /* 🤝 */
    rocket:     "<path d='M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z'/><path d='m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z'/><path d='M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0'/><path d='M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5'/>", /* 🚀 */
    video:      "<polygon points='23 7 16 12 23 17 23 7'/><rect x='1' y='5' width='15' height='14' rx='2' ry='2'/>",                /* 📹 🎥 🎬 */
    clock:      "<circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/>",                                            /* ⏳ 🕐 */
    creditCard: "<rect x='2' y='5' width='20' height='14' rx='2'/><line x1='2' y1='10' x2='22' y2='10'/>",                          /* 💳 */
    link:       "<path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/>", /* 🔗 */
    megaphone:  "<path d='m3 11 18-5v12L3 14v-3z'/><path d='M11.6 16.8a3 3 0 1 1-5.8-1.6'/>",                                        /* 📣 */
    smartphone: "<rect x='5' y='2' width='14' height='20' rx='2' ry='2'/><line x1='12' y1='18' x2='12.01' y2='18'/>",              /* 📱 */
    home:       "<path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/><polyline points='9 22 9 12 15 12 15 22'/>",             /* 🏠 */
    lightbulb:  "<line x1='9' y1='18' x2='15' y2='18'/><line x1='10' y1='22' x2='14' y2='22'/><path d='M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14'/>", /* 💡 */
    bot:        "<rect x='3' y='11' width='18' height='10' rx='2'/><circle cx='12' cy='5' r='2'/><path d='M12 7v4'/><line x1='8' y1='16' x2='8' y2='16'/><line x1='16' y1='16' x2='16' y2='16'/>", /* 🤖 */
    palette:    "<circle cx='13.5' cy='6.5' r='.5' fill='currentColor'/><circle cx='17.5' cy='10.5' r='.5' fill='currentColor'/><circle cx='8.5' cy='7.5' r='.5' fill='currentColor'/><circle cx='6.5' cy='12.5' r='.5' fill='currentColor'/><path d='M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.688-1.687h1.996c3.094 0 5.543-2.55 5.543-5.65C22 6.5 17.5 2 12 2z'/>", /* 🎨 */
    mapPin:     "<path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/>",                          /* 📍 */
    thumbsUp:   "<path d='M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3'/>", /* 👍 */
    thumbsDown: "<path d='M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17'/>", /* 👎 */
    gamepad:    "<line x1='6' y1='11' x2='10' y2='11'/><line x1='8' y1='9' x2='8' y2='13'/><line x1='15' y1='12' x2='15.01' y2='12'/><line x1='18' y1='10' x2='18.01' y2='10'/><path d='M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z'/>", /* 🎮 */
    instagram:  "<rect x='2' y='2' width='20' height='20' rx='5' ry='5'/><path d='M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z'/><line x1='17.5' y1='6.5' x2='17.51' y2='6.5'/>", /* 📷 IG */
    hand:       "<path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/>", /* 👋 🙌 🙏 */
    apple:      "<path d='M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06z'/><path d='M10 2c1 .5 2 2 2 5'/>", /* 🍎 */
    settings:   "<circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'/>", /* ⚙ */
    play:       "<polygon points='5 3 19 12 5 21 5 3'/>",                                                                          /* ▶ */
    globe:      "<circle cx='12' cy='12' r='10'/><line x1='2' y1='12' x2='22' y2='12'/><path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'/>", /* 🌐 */
    shield:     "<path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/>",                                                          /* 🛡 */
    infoCircle: "<circle cx='12' cy='12' r='10'/><line x1='12' y1='16' x2='12' y2='12'/><line x1='12' y1='8' x2='12.01' y2='8'/>", /* ℹ */
    party:      "<path d='M5.8 11.3 2 22l10.7-3.79'/><path d='M4 3h.01'/><path d='M22 8h.01'/><path d='M15 2h.01'/><path d='M22 20h.01'/><path d='m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10'/><path d='m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17'/><path d='m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7'/><path d='M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z'/>", /* 🎉 */
    mic:        "<path d='M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z'/><path d='M19 10v2a7 7 0 0 1-14 0v-2'/><line x1='12' y1='19' x2='12' y2='23'/><line x1='8' y1='23' x2='16' y2='23'/>", /* 🎙 🎤 */
    scale:      "<path d='m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z'/><path d='m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z'/><path d='M7 21h10'/><path d='M12 3v18'/><path d='M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2'/>", /* ⚖ */
    bell:       "<path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/><path d='M13.73 21a2 2 0 0 1-3.46 0'/>", /* 🔔 */
    help:       "<circle cx='12' cy='12' r='10'/><path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/><line x1='12' y1='17' x2='12.01' y2='17'/>", /* ❓ */
    package:    "<line x1='16.5' y1='9.4' x2='7.5' y2='4.21'/><path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'/><polyline points='3.27 6.96 12 12.01 20.73 6.96'/><line x1='12' y1='22.08' x2='12' y2='12'/>", /* 📦 */
    send:       "<line x1='22' y1='2' x2='11' y2='13'/><polygon points='22 2 15 22 11 13 2 9 22 2'/>", /* ✈ 📤 */
    trash:      "<polyline points='3 6 5 6 21 6'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/><line x1='10' y1='11' x2='10' y2='17'/><line x1='14' y1='11' x2='14' y2='17'/>", /* 🗑 */
    crown:      "<path d='m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z'/><path d='M5 20h14'/>", /* 👑 */
    laptop:     "<rect x='3' y='4' width='18' height='12' rx='1'/><line x1='2' y1='20' x2='22' y2='20'/>", /* 💻 */
    graduation: "<path d='M22 10 12 5 2 10l10 5 10-5z'/><path d='M6 12v5c0 1 2 2 6 2s6-1 6-2v-5'/>", /* 🎓 🧑‍🏫 */
    cart:       "<circle cx='9' cy='21' r='1'/><circle cx='20' cy='21' r='1'/><path d='M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6'/>", /* 🛒 */
    repeat:     "<polyline points='17 1 21 5 17 9'/><path d='M3 11V9a4 4 0 0 1 4-4h14'/><polyline points='7 23 3 19 7 15'/><path d='M21 13v2a4 4 0 0 1-4 4H3'/>", /* 🔁 */
    headphones: "<path d='M3 18v-6a9 9 0 0 1 18 0v6'/><path d='M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z'/>", /* 🎧 */
    pin:        "<line x1='12' y1='17' x2='12' y2='22'/><path d='M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z'/>", /* 📌 */
    droplet:    "<path d='M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z'/>", /* 💧 */
    walk:       "<circle cx='13' cy='4' r='1'/><path d='m7 21 3-6 2 1.5V21m0-6.5L10 9l4 1 2 3'/>", /* 🚶 */
    lifebuoy:   "<circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='4'/><line x1='4.93' y1='4.93' x2='9.17' y2='9.17'/><line x1='14.83' y1='14.83' x2='19.07' y2='19.07'/><line x1='14.83' y1='9.17' x2='19.07' y2='4.93'/><line x1='4.93' y1='19.07' x2='9.17' y2='14.83'/>", /* 🛟 */
    piggyBank:  "<path d='M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z'/><path d='M2 9v1c0 1.1.9 2 2 2h1'/><path d='M16 11h.01'/>", /* 🐷 🐖 */
    landmark:   "<line x1='3' y1='22' x2='21' y2='22'/><line x1='6' y1='18' x2='6' y2='11'/><line x1='10' y1='18' x2='10' y2='11'/><line x1='14' y1='18' x2='14' y2='11'/><line x1='18' y1='18' x2='18' y2='11'/><polygon points='12 2 20 7 4 7'/>", /* 🏦 */
    building:   "<rect x='4' y='2' width='16' height='20' rx='2' ry='2'/><path d='M9 22v-4h6v4'/><line x1='8' y1='6' x2='8' y2='6'/><line x1='16' y1='6' x2='16' y2='6'/><line x1='12' y1='6' x2='12' y2='6'/><line x1='8' y1='10' x2='8' y2='10'/><line x1='16' y1='10' x2='16' y2='10'/><line x1='12' y1='10' x2='12' y2='10'/>", /* 🏢 */
    trendDown:  "<polyline points='23 18 13.5 8.5 8.5 13.5 1 6'/><polyline points='17 18 23 18 23 12'/>", /* 📉 */
    newspaper:  "<path d='M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2'/><path d='M18 14h-8M15 18h-5M10 6h8v4h-8V6z'/>", /* 📰 */
    inbox:      "<polyline points='22 12 16 12 14 15 10 15 8 12 2 12'/><path d='M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'/>", /* 📥 📧 */
    brain:      "<path d='M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z'/><path d='M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z'/>", /* 🧠 */
    phoneOff:   "<path d='M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91'/><line x1='23' y1='1' x2='1' y2='23'/>", /* 📵 */
    ban:        "<circle cx='12' cy='12' r='10'/><line x1='4.93' y1='4.93' x2='19.07' y2='19.07'/>", /* 🚫 */
    yoga:       "<circle cx='12' cy='4' r='2'/><path d='M12 6v6m0 0-4 8m4-8 4 8M6 10h12'/>", /* 🧘 */
    coffee:     "<path d='M18 8h1a4 4 0 0 1 0 8h-1'/><path d='M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z'/><line x1='6' y1='1' x2='6' y2='4'/><line x1='10' y1='1' x2='10' y2='4'/><line x1='14' y1='1' x2='14' y2='4'/>", /* ☕ */
    save:       "<path d='M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'/><polyline points='17 21 17 13 7 13 7 21'/><polyline points='7 3 7 8 15 8'/>", /* 💾 */
    layoutGrid: "<rect x='3' y='3' width='7' height='7'/><rect x='14' y='3' width='7' height='7'/><rect x='3' y='14' width='7' height='7'/><rect x='14' y='14' width='7' height='7'/>" /* 📊 grid/dashboard */
  };

  var esc = function(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); };

  /* PWI.svg(name, opts) -> string. Estilo/tamaño/color viven en pw-icons.css
     vía las clases .pw-ic / .pw-ic-sm. NO se hardcodea width/height/stroke acá
     salvo opts.size puntual. */
  function svg(name, opts){
    opts = opts || {};
    var inner = IC[name];
    if(inner == null){ if(window.console && console.warn) console.warn("[PWI] icono desconocido:", name); inner = IC.infoCircle; }
    var cls = "pw-ic" + (opts.sm ? " pw-ic-sm" : "") + (opts.cc ? " pw-ic-cc" : "") + (opts.cls ? " " + opts.cls : "");
    var style = opts.size ? " style='width:"+opts.size+"px;height:"+opts.size+"px'" : "";
    var a11y = opts.title ? " role='img' aria-label='"+esc(opts.title)+"'><title>"+esc(opts.title)+"</title" : " aria-hidden='true'";
    return "<svg class='"+cls+"' viewBox='0 0 24 24'"+style+a11y+">"+inner+"</svg>";
  }

  /* Icono dentro del chip gris redondeado (.pw-icchip). */
  function chip(name, opts){
    opts = opts || {};
    return "<span class='pw-icchip"+(opts.sm?" sm":"")+(opts.cls?" "+opts.cls:"")+"'>"+svg(name,{title:opts.title})+"</span>";
  }

  /* Mascota de Pathway = la CABRA DE FRENTE (no el emoji 🐐 de perfil). Es un
     asset de marca (imagen), no un icono Lucide, así que va por su propio helper.
     Una sola fuente: cambiar el src acá cambia la mascota en TODA la plataforma. */
  var GOAT_SRC = "/assets/cabra/frente.gif";
  function goat(opts){
    opts = opts || {};
    var px = opts.size || 20;
    return "<img src='" + GOAT_SRC + "' alt='" + esc(opts.title || "Cabra Pathway") +
      "' class='pw-goat' style='height:" + px + "px;width:auto;vertical-align:-.22em'>";
  }

  /* Auto-montado declarativo: <i data-ic="edit"></i> · data-sm -> 18px. */
  function mount(root){
    var host = root || document;
    var nodes = host.querySelectorAll ? host.querySelectorAll("i[data-ic]") : [];
    for(var i=0;i<nodes.length;i++){
      var el = nodes[i];
      if(el.getAttribute("data-ic-done")) continue;
      var name = el.getAttribute("data-ic");
      if(!IC[name]) continue;
      var sz = el.getAttribute("data-size");
      el.innerHTML = svg(name, { sm: el.hasAttribute("data-sm"), cc: el.hasAttribute("data-cc"), size: sz?parseInt(sz,10):0, title: el.getAttribute("data-title")||"" });
      el.setAttribute("data-ic-done","1");
    }
  }

  window.PWI = { IC: IC, svg: svg, chip: chip, goat: goat, mount: mount, has: function(n){ return !!IC[n]; } };

  if(document.readyState !== "loading") mount();
  else document.addEventListener("DOMContentLoaded", function(){ mount(); });
})();
