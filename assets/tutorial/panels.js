(function(){
/* global React */
/* The right-side "panel" shown for each step. Each component mimics a real
   slice of the Pathway coach panel — interactive enough that the coach
   actually completes the action. */

const {
  useState
} = React;

/* ── Shared chrome: a window-y wrapper with the panel sidebar visible
   on the left edge so the user reads "this is the panel". ───────── */
function PanelFrame({
  activeNav,
  children,
  label = "Panel del coach"
}) {
  const nav = [{
    id: "resumen",
    label: "Resumen",
    icon: "M3 3v18h18 M7 14l4-4 3 3 5-7"
  }, {
    id: "clientes",
    label: "Clientes",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"
  }, {
    id: "links",
    label: "Links",
    icon: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
  }, {
    id: "config",
    label: "Configuración",
    icon: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "pf-frame",
    "aria-label": label
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-titlebar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pf-dot",
    style: {
      background: "#E5847B"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "pf-dot",
    style: {
      background: "#E5C46A"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "pf-dot",
    style: {
      background: "#7AC79B"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "pf-url"
  }, "app.pathwaycareercoach.com/", activeNav)), /*#__PURE__*/React.createElement("div", {
    className: "pf-body"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "pf-side",
    style: {
      backgroundSize: "contain"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-side-brand"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 100 100",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "10,82 32,52 54,82",
    fill: "#52B788"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: "34,82 58,28 82,82",
    fill: "#FAFDF9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "58",
    cy: "22",
    r: "5",
    fill: "#E9C46A"
  })), /*#__PURE__*/React.createElement("span", null, "pathway", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#52B788"
    }
  }, "."))), /*#__PURE__*/React.createElement("div", {
    className: "pf-side-coach"
  }, /*#__PURE__*/React.createElement("img", {
    src: "https://fucfze9g4e.ucarecd.net/9713050f-340a-481e-9577-243c5fb106e2/-/scale_crop/400x400/center/-/format/auto/",
    alt: "",
    className: "pf-side-coach-avatar"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-side-coach-name"
  }, "Maria"), /*#__PURE__*/React.createElement("div", {
    className: "pf-side-coach-role"
  }, "Pro"))), /*#__PURE__*/React.createElement("nav", {
    className: "pf-side-nav"
  }, nav.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    className: "pf-side-nav-item " + (activeNav === it.id ? "is-active" : "")
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, it.icon.split(" M ").map((d, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: (i === 0 ? "" : "M ") + d
  }))), /*#__PURE__*/React.createElement("span", null, it.label))))), /*#__PURE__*/React.createElement("div", {
    className: "pf-content",
    "data-comment-anchor": "6782a8e6cc-div-54-9"
  }, children)));
}

/* ── Small primitives ───────────────────────────────────────────── */
function Eyebrow({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "pf-eyebrow"
  }, children);
}
function H1({
  children
}) {
  return /*#__PURE__*/React.createElement("h1", {
    className: "pf-h1"
  }, children, /*#__PURE__*/React.createElement("span", {
    className: "pw-dot"
  }, "."));
}
function PrimaryBtn({
  children,
  onClick,
  disabled,
  success,
  hint
}) {
  const showHint = hint && !success && !disabled;
  return /*#__PURE__*/React.createElement("span", {
    className: "pf-cta-wrap " + (showHint ? "has-hint" : "")
  }, showHint && /*#__PURE__*/React.createElement("span", {
    className: "pf-coach-mark"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pf-cm-icon",
    "aria-hidden": "true"
  }, "\uD83D\uDC47"), hint), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pf-btn-primary " + (success ? "is-success" : "") + (showHint ? " is-pulse" : ""),
    onClick: onClick,
    disabled: disabled
  }, children));
}
function GhostBtn({
  children,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pf-btn-ghost",
    onClick: onClick
  }, children);
}
function Card({
  children,
  title
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "pf-card"
  }, title && /*#__PURE__*/React.createElement("div", {
    className: "pf-card-hd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-card-title"
  }, title, /*#__PURE__*/React.createElement("span", {
    className: "pw-dot"
  }, "."))), /*#__PURE__*/React.createElement("div", {
    className: "pf-card-pad"
  }, children));
}

/* ── InfoBubble — opt-in details popover ───────────────────────── */
function InfoBubble({
  children,
  label = "Más info"
}) {
  const [open, setOpen] = useState(false);
  return /*#__PURE__*/React.createElement("span", {
    className: "pf-info-bubble"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pf-info-trigger " + (open ? "is-open" : ""),
    onClick: () => setOpen(!open)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, "\u24D8"), " ", label), open && /*#__PURE__*/React.createElement("div", {
    className: "pf-info-pop",
    onClick: e => e.stopPropagation()
  }, children, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pf-info-close",
    onClick: () => setOpen(false),
    "aria-label": "Cerrar"
  }, "\xD7")));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 1: Welcome (no panel interaction yet)                     ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepWelcome({
  onComplete,
  done
}) {
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "resumen"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Tu nuevo espacio"), /*#__PURE__*/React.createElement(H1, null, "\xA1Bienvenida a pathway"), /*#__PURE__*/React.createElement("p", {
    className: "pf-lead"
  }, "Soy ", /*#__PURE__*/React.createElement("strong", null, "Cabra"), ", tu copiloto en este recorrido. Vamos a configurar lo b\xE1sico en ", /*#__PURE__*/React.createElement("strong", null, "9 pasos"), " para que tu primer cliente pueda entrar hoy mismo."), /*#__PURE__*/React.createElement("div", {
    className: "pf-welcome-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-w-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-w-num"
  }, "5 min"), /*#__PURE__*/React.createElement("div", {
    className: "pf-w-lbl"
  }, "de tu tiempo")), /*#__PURE__*/React.createElement("div", {
    className: "pf-w-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-w-num"
  }, "9"), /*#__PURE__*/React.createElement("div", {
    className: "pf-w-lbl"
  }, "pasos guiados")), /*#__PURE__*/React.createElement("div", {
    className: "pf-w-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-w-num"
  }, "1"), /*#__PURE__*/React.createElement("div", {
    className: "pf-w-lbl"
  }, "medalla al final \uD83E\uDD47"))), /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: onComplete,
    success: done,
    hint: done ? null : "Empieza aquí"
  }, done ? "¡Listo!" : "Empezar el recorrido →"));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 2: Coach profile                                          ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepPerfil({
  onComplete,
  done,
  data,
  setData
}) {
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "config"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Configuraci\xF3n \u203A Tu perfil"), /*#__PURE__*/React.createElement(H1, null, "Tu perfil de coach"), /*#__PURE__*/React.createElement("p", {
    className: "pf-sub"
  }, "Esto es lo que ven tus prospectas en tu link p\xFAblico. ", /*#__PURE__*/React.createElement("strong", null, "No tienes que llenarlo ahora"), ". Configurar\xE1s los tuyos en el panel real."), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "pf-toggle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-toggle-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-toggle-title"
  }, "Activar mi perfil p\xFAblico"), /*#__PURE__*/React.createElement("div", {
    className: "pf-toggle-desc"
  }, "Tu p\xE1gina visible en pathwaycareercoach.com/coach/", data.slug)), /*#__PURE__*/React.createElement("div", {
    className: "pf-switch " + (data.perfilPublico ? "is-on" : ""),
    onClick: () => setData({
      ...data,
      perfilPublico: !data.perfilPublico
    })
  }, /*#__PURE__*/React.createElement("span", null))), /*#__PURE__*/React.createElement("div", {
    className: "pf-photo-pick",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "https://fucfze9g4e.ucarecd.net/9713050f-340a-481e-9577-243c5fb106e2/-/scale_crop/400x400/center/-/format/auto/",
    alt: "",
    className: "pf-photo-circle"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pf-photo-btn"
  }, "Cambiar foto"), /*#__PURE__*/React.createElement("div", {
    className: "pf-form-hint",
    style: {
      marginTop: 4
    }
  }, "JPG o PNG, m\xEDn. 400\xD7400"))), /*#__PURE__*/React.createElement("div", {
    className: "pf-form-row",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "pf-form-label"
  }, "Nombre completo"), /*#__PURE__*/React.createElement("input", {
    className: "pf-form-input",
    placeholder: "ej. Micaela Jairedin",
    value: data.nombre,
    onChange: e => setData({
      ...data,
      nombre: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pf-form-row",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "pf-form-label"
  }, "T\xEDtulo profesional"), /*#__PURE__*/React.createElement("input", {
    className: "pf-form-input",
    placeholder: "ej. Career Coach Senior",
    value: data.especialidad,
    onChange: e => setData({
      ...data,
      especialidad: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pf-form-row",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "pf-form-label"
  }, "Biograf\xEDa corta"), /*#__PURE__*/React.createElement("textarea", {
    className: "pf-form-textarea",
    placeholder: "Una o dos l\xEDneas sobre ti y a qui\xE9n ayudas.",
    value: data.bio,
    onChange: e => setData({
      ...data,
      bio: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "pf-form-hint"
  }, "Aparece en tu p\xE1gina p\xFAblica."))), /*#__PURE__*/React.createElement("div", {
    className: "pf-actions"
  }, /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: onComplete,
    success: done,
    hint: done ? null : "Continua"
  }, done ? "✓ Link reservado" : "Continuar →"), /*#__PURE__*/React.createElement("span", {
    className: "pf-actions-hint"
  }, "Es solo una vista previa. Lo configuras de verdad en Configuraci\xF3n.")));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 3: Public link                                            ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepLink({
  onComplete,
  done,
  data,
  setData
}) {
  const slug = (data.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "config"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Configuraci\xF3n \u203A URL del perfil"), /*#__PURE__*/React.createElement(H1, null, "Tu link p\xFAblico"), /*#__PURE__*/React.createElement("p", {
    className: "pf-sub"
  }, "Aqu\xED llegan tus prospectos."), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("label", {
    className: "pf-form-label"
  }, "URL p\xFAblica"), /*#__PURE__*/React.createElement("div", {
    className: "pf-url-input"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pf-url-prefix"
  }, "pathwaycareercoach.com/coach/"), /*#__PURE__*/React.createElement("input", {
    className: "pf-url-field",
    placeholder: "tu-nombre",
    value: data.slug,
    onChange: e => setData({
      ...data,
      slug: e.target.value
    })
  }), /*#__PURE__*/React.createElement("span", {
    className: "pf-url-status " + (slug.length >= 3 ? "is-ok" : "is-empty")
  }, slug.length >= 3 ? "✓ Disponible" : "esperando…")), /*#__PURE__*/React.createElement("div", {
    className: "pf-form-hint",
    style: {
      marginTop: 8
    }
  }, "Solo letras min\xFAsculas, n\xFAmeros y guiones. Puedes cambiarla luego."), slug.length >= 3 && /*#__PURE__*/React.createElement("div", {
    className: "pf-url-preview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-url-preview-lbl"
  }, "VISTA PREVIA"), /*#__PURE__*/React.createElement("div", {
    className: "pf-url-preview-card"
  }, /*#__PURE__*/React.createElement("img", {
    src: "https://fucfze9g4e.ucarecd.net/9713050f-340a-481e-9577-243c5fb106e2/-/scale_crop/400x400/center/-/format/auto/",
    alt: "",
    className: "pf-url-preview-photo"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pf-url-preview-name"
  }, data.nombre || "Tu nombre"), /*#__PURE__*/React.createElement("div", {
    className: "pf-url-preview-handle"
  }, "/coach/", slug)), /*#__PURE__*/React.createElement("div", {
    className: "pf-url-preview-live"
  }, "\u25CF Live")))), /*#__PURE__*/React.createElement("div", {
    className: "pf-actions"
  }, /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: onComplete,
    success: done,
    hint: done ? null : "Continua"
  }, done ? "✓ Link reservado" : "Entendido, sigamos →"), /*#__PURE__*/React.createElement("span", {
    className: "pf-actions-hint"
  }, "Eliges tu URL real m\xE1s tarde en Configuraci\xF3n.")));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 4: Payments — KEY MESSAGE: Pathway no toca tu dinero      ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepPagos({
  onComplete,
  done,
  data,
  setData
}) {
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "config"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Configuraci\xF3n \u203A Clientes de Pathway"), /*#__PURE__*/React.createElement(H1, null, "C\xF3mo funciona el dinero"), /*#__PURE__*/React.createElement("p", {
    className: "pf-sub"
  }, "Hay ", /*#__PURE__*/React.createElement("strong", null, "dos tipos de cliente"), ". Esto es lo importante:"), /*#__PURE__*/React.createElement("div", {
    className: "pf-flows"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-flow is-own"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-tag"
  }, "TUS CLIENTES PROPIOS"), /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-pct"
  }, "0%"), /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-pct-lbl"
  }, "comisi\xF3n"), /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-desc"
  }, "Los que llegan por ", /*#__PURE__*/React.createElement("strong", null, "tu link p\xFAblico"), " o que ya conoces. Les cobras como siempre. ", /*#__PURE__*/React.createElement("strong", null, "Pathway no toca este dinero.")), /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-line"
  }, /*#__PURE__*/React.createElement("span", null, "Cliente"), /*#__PURE__*/React.createElement("svg", {
    width: "40",
    height: "14",
    viewBox: "0 0 40 14"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 2 7 L 34 7",
    stroke: "#52B788",
    strokeWidth: "2",
    strokeDasharray: "3 3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 30 3 L 38 7 L 30 11",
    stroke: "#52B788",
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), /*#__PURE__*/React.createElement("span", null, "T\xFA \xB7 100%"))), /*#__PURE__*/React.createElement("div", {
    className: "pf-flow is-pathway"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-tag"
  }, "CLIENTES QUE PATHWAY TE ENV\xCDA"), /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-pct"
  }, "20%"), /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-pct-lbl"
  }, "retiene Pathway"), /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-desc"
  }, "Pathway te manda candidatos. Si los aceptas (en 24h), el dinero entra", /*#__PURE__*/React.createElement("strong", null, " directo a tu cuenta"), " y Pathway se queda el 20%."), /*#__PURE__*/React.createElement("div", {
    className: "pf-flow-line"
  }, /*#__PURE__*/React.createElement("span", null, "Candidato"), /*#__PURE__*/React.createElement("svg", {
    width: "40",
    height: "14",
    viewBox: "0 0 40 14"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 2 7 L 34 7",
    stroke: "#2D6A4F",
    strokeWidth: "2",
    strokeDasharray: "3 3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 30 3 L 38 7 L 30 11",
    stroke: "#2D6A4F",
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), /*#__PURE__*/React.createElement("span", null, "T\xFA \xB7 80%")))), /*#__PURE__*/React.createElement("div", {
    className: "pf-reassurance"
  }, /*#__PURE__*/React.createElement("strong", null, "Pathway nunca tiene tu dinero en sus cuentas."), " Stripe cobra al cliente y deposita en tu cuenta. Tu plan de Pathway se cobra aparte, como cualquier herramienta."), /*#__PURE__*/React.createElement("div", {
    className: "pf-info-row"
  }, /*#__PURE__*/React.createElement(InfoBubble, {
    label: "Servicios y precios"
  }, "T\xFA defines tus precios en ", /*#__PURE__*/React.createElement("strong", null, "Configuraci\xF3n \u2192 Clientes de Pathway"), ". Ejemplo: Mentor\xEDa 4 sem \u20AC400, Sesi\xF3n \u20AC120, Auditor\xEDa LinkedIn \u20AC60."), /*#__PURE__*/React.createElement(InfoBubble, {
    label: "Cuenta de cobro (Stripe)"
  }, "Conectas tu cuenta de Stripe ", /*#__PURE__*/React.createElement("strong", null, "solo si aceptas clientes derivados"), " de Pathway. Para tus clientes propios no hace falta. Lo configuras despu\xE9s en Configuraci\xF3n."), /*#__PURE__*/React.createElement(InfoBubble, {
    label: "Aparecer en el directorio"
  }, "Hay un toggle en Configuraci\xF3n para activarlo o desactivarlo. Si est\xE1 apagado, solo trabajas con tus clientes propios (0% comisi\xF3n siempre).")), /*#__PURE__*/React.createElement("div", {
    className: "pf-actions"
  }, /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: onComplete,
    success: done,
    hint: done ? null : "Continúa"
  }, done ? "✓ Entendido" : "Entendido, sigamos →")));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 5: Create first client                                    ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepCliente({
  onComplete,
  done,
  data,
  setData
}) {
  const [showModal, setShowModal] = useState(false);
  const ready = data.cliente.nombre.length > 1 && data.cliente.email.includes("@");
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "clientes"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Clientes"), /*#__PURE__*/React.createElement("div", {
    className: "pf-topbar"
  }, /*#__PURE__*/React.createElement(H1, null, "Crea tu primer cliente"), /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: () => setShowModal(true),
    hint: !data.cliente.creado ? "Click aquí" : null
  }, "+ Nuevo cliente")), /*#__PURE__*/React.createElement("p", {
    className: "pf-sub"
  }, "Click en ", /*#__PURE__*/React.createElement("strong", null, "\u201C+ Nuevo cliente\u201D"), " para abrir el alta."), /*#__PURE__*/React.createElement(Card, null, data.cliente.creado ? /*#__PURE__*/React.createElement("div", {
    className: "pf-client-row"
  }, /*#__PURE__*/React.createElement("img", {
    src: "https://fucfze9g4e.ucarecd.net/0be4c644-0915-4325-96aa-b1c94651b42b/-/scale_crop/400x400/center/-/format/auto/",
    alt: "",
    className: "pf-client-photo"
  }), /*#__PURE__*/React.createElement("div", {
    className: "pf-client-id"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-client-name"
  }, data.cliente.nombre), /*#__PURE__*/React.createElement("div", {
    className: "pf-client-meta"
  }, data.cliente.email, " \xB7 Semana 1 \xB7 Reci\xE9n creado")), /*#__PURE__*/React.createElement("span", {
    className: "pf-pill is-on"
  }, "\u25CF Activo")) : /*#__PURE__*/React.createElement("div", {
    className: "pf-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-empty-icon",
    style: {
      color: "rgb(109, 143, 128)"
    }
  }, "\uD83D\uDC65"), /*#__PURE__*/React.createElement("div", {
    className: "pf-empty-h"
  }, "A\xFAn no tienes clientes"), /*#__PURE__*/React.createElement("div", {
    className: "pf-empty-d"
  }, "Cuando creas uno, aparecer\xE1 aqu\xED con su progreso semanal."))), showModal && /*#__PURE__*/React.createElement("div", {
    className: "pf-modal-bg",
    onClick: () => setShowModal(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-modal-hd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-modal-title"
  }, "Nuevo cliente", /*#__PURE__*/React.createElement("span", {
    className: "pw-dot"
  }, ".")), /*#__PURE__*/React.createElement("button", {
    className: "pf-modal-close",
    onClick: () => setShowModal(false)
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "pf-modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-form-row"
  }, /*#__PURE__*/React.createElement("label", {
    className: "pf-form-label"
  }, "Nombre del cliente"), /*#__PURE__*/React.createElement("input", {
    className: "pf-form-input",
    autoFocus: true,
    placeholder: "ej. Julia S\xE1nchez",
    value: data.cliente.nombre,
    onChange: e => setData({
      ...data,
      cliente: {
        ...data.cliente,
        nombre: e.target.value
      }
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pf-form-row",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "pf-form-label"
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    className: "pf-form-input",
    placeholder: "julia@email.com",
    value: data.cliente.email,
    onChange: e => setData({
      ...data,
      cliente: {
        ...data.cliente,
        email: e.target.value
      }
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "pf-form-hint",
    style: {
      marginTop: 10
    }
  }, "Le enviaremos un email con su link para entrar al portal.")), /*#__PURE__*/React.createElement("div", {
    className: "pf-modal-foot"
  }, /*#__PURE__*/React.createElement(GhostBtn, {
    onClick: () => setShowModal(false)
  }, "Cancelar"), /*#__PURE__*/React.createElement(PrimaryBtn, {
    disabled: !ready,
    onClick: () => {
      setData({
        ...data,
        cliente: {
          ...data.cliente,
          creado: true
        }
      });
      setShowModal(false);
      onComplete();
    },
    hint: ready ? "Crea tu primer cliente" : null
  }, "Crear cliente \u2192")))), data.cliente.creado && /*#__PURE__*/React.createElement("div", {
    className: "pf-actions"
  }, /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: onComplete,
    success: done
  }, done ? "✓ Cliente creado" : "Continuar →")));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 6: Send intake form                                       ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepFormulario({
  onComplete,
  done,
  data,
  setData
}) {
  const items = [{
    ic: "👤",
    t: "Datos personales",
    d: "Nombre, edad, ubicación"
  }, {
    ic: "💼",
    t: "Experiencia laboral",
    d: "CV actual + cargo objetivo"
  }, {
    ic: "🎯",
    t: "Objetivos a 6 meses",
    d: "Qué busca conseguir"
  }, {
    ic: "🧭",
    t: "Estilo de búsqueda",
    d: "Activa / pasiva / cambio de carrera"
  }, {
    ic: "📄",
    t: "CV actual (PDF)",
    d: "Para analizar con IA"
  }, {
    ic: "🔗",
    t: "LinkedIn",
    d: "Auditoría de perfil"
  }, {
    ic: "💬",
    t: "Comentarios",
    d: "Cualquier cosa que quiera contarte"
  }];
  const clientName = data.cliente.nombre || "Julia";
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "clientes"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Clientes \u203A ", clientName, " \u203A Formulario inicial"), /*#__PURE__*/React.createElement(H1, null, "Enviar formulario de intake"), /*#__PURE__*/React.createElement("p", {
    className: "pf-sub"
  }, clientName, " contesta este formulario de 7 pasos antes de la primera sesi\xF3n."), /*#__PURE__*/React.createElement(Card, {
    title: "El formulario que ver\xE1 tu cliente"
  }, /*#__PURE__*/React.createElement("ol", {
    className: "pf-form-list"
  }, items.map((it, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "pf-form-list-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pf-form-list-n"
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    className: "pf-form-list-ic"
  }, it.ic), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pf-form-list-t"
  }, it.t), /*#__PURE__*/React.createElement("div", {
    className: "pf-form-list-d"
  }, it.d)))))), /*#__PURE__*/React.createElement("div", {
    className: "pf-send-card"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pf-send-lbl"
  }, "Link \xFAnico para ", clientName), /*#__PURE__*/React.createElement("div", {
    className: "pf-send-url"
  }, "pathway.app/intake/x9k2-jul\u2026")), /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: () => {
      setData({
        ...data,
        intakeSent: true
      });
      onComplete();
    },
    success: done || data.intakeSent,
    hint: !done && !data.intakeSent ? "Envía el formulario" : null
  }, data.intakeSent || done ? "✓ Enviado por email" : "Enviar a " + clientName + " →")));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 7: Client data arrived — review + Generate with AI        ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepDatosCliente({
  onComplete,
  done,
  data
}) {
  const clientName = data.cliente.nombre || "Julia Sánchez";
  const [generating, setGenerating] = useState(false);
  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      onComplete();
    }, 1400);
  };
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "clientes"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Clientes \u203A ", clientName.split(" ")[0], " \u203A Perfil"), /*#__PURE__*/React.createElement(H1, null, "Llegaron los datos de ", clientName.split(" ")[0]), /*#__PURE__*/React.createElement("p", {
    className: "pf-sub"
  }, "Tu cliente complet\xF3 el formulario. Aqu\xED est\xE1n sus datos \u2014 listos para generar con IA."), /*#__PURE__*/React.createElement("div", {
    className: "pf-notif"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-notif-icon"
  }, "\uD83D\uDCE5"), /*#__PURE__*/React.createElement("div", {
    className: "pf-notif-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-notif-t"
  }, "Formulario completado"), /*#__PURE__*/React.createElement("div", {
    className: "pf-notif-d"
  }, "Recibido hace 12 minutos \xB7 ", clientName, " \xB7 CV + LinkedIn adjuntos")), /*#__PURE__*/React.createElement("span", {
    className: "pf-pill is-on"
  }, "Nuevo")), /*#__PURE__*/React.createElement(Card, {
    title: "Datos del cliente"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-data-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-data-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-data-lbl"
  }, "Nombre"), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-val"
  }, clientName)), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-data-lbl"
  }, "Email"), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-val"
  }, data.cliente.email || "julia@email.com")), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-data-lbl"
  }, "Rol actual"), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-val"
  }, "Product Manager")), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-data-lbl"
  }, "Rol que busca"), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-val"
  }, "Senior PM, Lead PM")), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-data-lbl"
  }, "Situaci\xF3n"), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-val"
  }, "En b\xFAsqueda activa")), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-data-lbl"
  }, "Urgencia"), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-val"
  }, "3 a 6 meses"))), /*#__PURE__*/React.createElement("div", {
    className: "pf-data-foot"
  }, "Vienen del formulario \xB7 ", /*#__PURE__*/React.createElement("strong", null, "editable"), " desde la pesta\xF1a Perfil.")), /*#__PURE__*/React.createElement(Card, {
    title: "Generar con IA"
  }, /*#__PURE__*/React.createElement("p", {
    className: "pf-form-hint",
    style: {
      marginBottom: 10
    }
  }, "La IA analiza el formulario + CV + LinkedIn y genera un informe con prioridades, un plan de 4 semanas y una carta de presentaci\xF3n."), /*#__PURE__*/React.createElement("div", {
    className: "pf-gen-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-gen-icon",
    style: {
      background: "var(--pw-success-bg)"
    }
  }, "\uD83D\uDCC4"), /*#__PURE__*/React.createElement("div", {
    className: "pf-gen-info"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-gen-t"
  }, "Informe + plan + carta"), /*#__PURE__*/React.createElement("div", {
    className: "pf-gen-d"
  }, generating ? "Analizando datos…" : "Lo más usado · todo de una vez")), /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: handleGenerate,
    disabled: generating || done,
    success: done,
    hint: !done && !generating ? "Genera ahora" : null
  }, done ? "✓ Generado" : generating ? "Generando…" : "Generar")), /*#__PURE__*/React.createElement("div", {
    className: "pf-info-row"
  }, /*#__PURE__*/React.createElement(InfoBubble, {
    label: "Solo CV"
  }, "Si solo necesitas refinar el CV (sin plan ni carta), hay un bot\xF3n separado para eso."), /*#__PURE__*/React.createElement(InfoBubble, {
    label: "Solo la carta"
  }, "Para regenerar la carta de presentaci\xF3n despu\xE9s de cambios en el plan."))));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 8: Review AI report                                       ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepInforme({
  onComplete,
  done
}) {
  const [tab, setTab] = useState("cv");
  const scores = {
    cv: {
      score: 78,
      label: "CV / ATS",
      items: [{
        t: "Formato compatible con ATS",
        s: "ok",
        d: "Pasa filtros automáticos"
      }, {
        t: "Verbos de acción",
        s: "warn",
        d: "Demasiados pasivos en sección 2024"
      }, {
        t: "Métricas cuantificables",
        s: "warn",
        d: "Solo 3 de 8 bullets tienen números"
      }, {
        t: "Keywords del cargo objetivo",
        s: "ok",
        d: "12 de 15 coincidencias"
      }]
    },
    linkedin: {
      score: 62,
      label: "LinkedIn",
      items: [{
        t: "Foto profesional",
        s: "ok",
        d: ""
      }, {
        t: "Titular optimizado",
        s: "warn",
        d: "Falta el cargo objetivo"
      }, {
        t: "Sección Acerca de",
        s: "bad",
        d: "Vacía — alta prioridad"
      }, {
        t: "Recomendaciones",
        s: "warn",
        d: "Solo 1, recomendado 3+"
      }]
    },
    foto: {
      score: 90,
      label: "Foto perfil",
      items: [{
        t: "Fondo neutro",
        s: "ok",
        d: ""
      }, {
        t: "Iluminación",
        s: "ok",
        d: ""
      }, {
        t: "Expresión profesional",
        s: "ok",
        d: ""
      }, {
        t: "Encuadre",
        s: "warn",
        d: "Podría ser más cercano"
      }]
    }
  };
  const active = scores[tab];
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "clientes"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Clientes \u203A Julia \u203A Informe IA"), /*#__PURE__*/React.createElement(H1, null, "El informe ya est\xE1 listo"), /*#__PURE__*/React.createElement("p", {
    className: "pf-sub"
  }, "Nuestra IA analiz\xF3 su CV, LinkedIn y foto. Revisalo antes de la sesi\xF3n."), /*#__PURE__*/React.createElement("div", {
    className: "pf-tabs"
  }, Object.entries(scores).map(([k, v]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    type: "button",
    className: "pf-tab " + (tab === k ? "is-on" : ""),
    onClick: () => setTab(k)
  }, v.label, /*#__PURE__*/React.createElement("span", {
    className: "pf-tab-score is-" + (v.score >= 80 ? "ok" : v.score >= 65 ? "warn" : "bad")
  }, v.score)))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "pf-score-hd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-score-ring",
    style: {
      "--p": active.score
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "15px"
    }
  }, active.score), /*#__PURE__*/React.createElement("small", {
    style: {
      fontSize: "15px"
    }
  }, "/100")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pf-score-title"
  }, active.label), /*#__PURE__*/React.createElement("div", {
    className: "pf-score-sub"
  }, active.score >= 80 ? "Buen punto de partida" : active.score >= 65 ? "Necesita refinamiento" : "Trabajo prioritario"))), /*#__PURE__*/React.createElement("div", {
    className: "pf-score-list"
  }, active.items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "pf-score-row is-" + it.s
  }, /*#__PURE__*/React.createElement("span", {
    className: "pf-score-dot"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pf-score-row-t"
  }, it.t), it.d && /*#__PURE__*/React.createElement("div", {
    className: "pf-score-row-d"
  }, it.d)))))), /*#__PURE__*/React.createElement("div", {
    className: "pf-actions"
  }, /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: onComplete,
    success: done,
    hint: done ? null : "Genera el plan"
  }, done ? "✓ Revisado" : "Revisado, generar plan →")));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 8: 4-week mentorship plan                                 ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepPlan({
  onComplete,
  done,
  data,
  setData
}) {
  const weeks = [{
    n: 1,
    t: "Diagnóstico",
    color: "#52B788",
    items: ["Sesión 1:1 inicial", "Refinar CV con IA", "Definir cargo objetivo"]
  }, {
    n: 2,
    t: "LinkedIn",
    color: "#3D9970",
    items: ["Auditoría de perfil", "Reescribir titular y Acerca de", "Plan de contenido"]
  }, {
    n: 3,
    t: "Búsqueda",
    color: "#2D6A4F",
    items: ["Mapeo de empresas", "20 aplicaciones", "Networking activo"]
  }, {
    n: 4,
    t: "Entrevistas",
    color: "#1B4332",
    items: ["Método STAR", "Sesión 1:1 cierre", "Plan de seguimiento"]
  }];
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "clientes"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Clientes \u203A Julia \u203A Plan"), /*#__PURE__*/React.createElement(H1, null, "Plan de 4 semanas"), /*#__PURE__*/React.createElement("p", {
    className: "pf-sub"
  }, "Tu metodolog\xEDa, lista para enviar. Puedes ajustar antes."), /*#__PURE__*/React.createElement("div", {
    className: "pf-weeks"
  }, weeks.map(w => /*#__PURE__*/React.createElement("div", {
    key: w.n,
    className: "pf-week",
    style: {
      borderTopColor: w.color
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-week-hd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-week-n",
    style: {
      color: w.color
    }
  }, "S", w.n), /*#__PURE__*/React.createElement("div", {
    className: "pf-week-t"
  }, w.t)), /*#__PURE__*/React.createElement("ul", {
    className: "pf-week-items"
  }, w.items.map((it, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "pf-week-check",
    style: {
      borderColor: w.color
    }
  }), it)))))), /*#__PURE__*/React.createElement("div", {
    className: "pf-actions"
  }, /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: () => {
      setData({
        ...data,
        planSent: true
      });
      onComplete();
    },
    success: done || data.planSent,
    hint: !done && !data.planSent ? "Envía el plan" : null
  }, data.planSent || done ? "✓ Plan enviado a Julia" : "Enviar plan a Julia →")));
}

/* ╔═════════════════════════════════════════════════════════════════╗ */
/* ║  Step 9: Emails + medal celebration                             ║ */
/* ╚═════════════════════════════════════════════════════════════════╝ */
function StepEmailMedalla({
  onComplete,
  done
}) {
  const [sent, setSent] = useState(false);
  const templates = [{
    ic: "📩",
    t: "Bienvenida",
    d: "Primer email cuando creas un cliente"
  }, {
    ic: "📄",
    t: "CV listo",
    d: "Cuando subes el CV revisado"
  }, {
    ic: "🎉",
    t: "Logro desbloqueado",
    d: "Cuando completan una medalla"
  }, {
    ic: "⏰",
    t: "Recordatorio sesión",
    d: "24h antes del 1:1"
  }];
  return /*#__PURE__*/React.createElement(PanelFrame, {
    activeNav: "clientes"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Comunicaci\xF3n \u203A Plantillas"), /*#__PURE__*/React.createElement(H1, null, "Emails que env\xEDas sin pensarlo"), /*#__PURE__*/React.createElement("p", {
    className: "pf-sub"
  }, "Plantillas con tu marca. Solo das click, Pathway escribe."), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "pf-emails"
  }, templates.map((tpl, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "pf-email-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pf-email-ic"
  }, tpl.ic), /*#__PURE__*/React.createElement("div", {
    className: "pf-email-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-email-t"
  }, tpl.t), /*#__PURE__*/React.createElement("div", {
    className: "pf-email-d"
  }, tpl.d)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pf-email-send",
    onClick: () => setSent(true)
  }, sent && i === 0 ? "✓ Enviado" : "Enviar"))))), /*#__PURE__*/React.createElement("div", {
    className: "pf-final-banner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pf-final-banner-l"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Fraunces, serif",
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: "-.5px"
    }
  }, "Completaste el tutorial", /*#__PURE__*/React.createElement("span", {
    className: "pw-dot"
  }, ".")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--pw-text-soft)",
      marginTop: 4
    }
  }, "Cabra te tiene una sorpresa.")), /*#__PURE__*/React.createElement(PrimaryBtn, {
    onClick: onComplete,
    success: done,
    hint: done ? null : "Reclama tu medalla"
  }, done ? "🥇 ¡Sorpresa abierta!" : "Reclamar mi medalla 🥇")));
}
Object.assign(window, {
  PanelFrame,
  StepWelcome,
  StepPerfil,
  StepLink,
  StepPagos,
  StepCliente,
  StepFormulario,
  StepDatosCliente,
  StepInforme,
  StepPlan,
  StepEmailMedalla
});

})();
