(function(){
/* global React, ReactDOM,
   StepWelcome, StepPerfil, StepLink, StepPagos, StepCliente,
   StepFormulario, StepDatosCliente, StepInforme, StepPlan, StepEmailMedalla,
   useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle */

const {
  useState,
  useEffect,
  useRef
} = React;

/* ── 9 steps definition ─────────────────────────────────────────── */
const STEPS = [{
  id: "welcome",
  n: 1,
  eyebrow: "PASO 1 · BIENVENIDA",
  title: "Hola,\nsoy Cabra",
  body: "Voy a guiarte para configurar Pathway. En menos de lo que toma un café, vas a tener tu primer cliente activo. ¿Empezamos?",
  cabra: "assets/cabra/atencion.png",
  Component: StepWelcome
}, {
  id: "perfil",
  n: 2,
  eyebrow: "PASO 2 · TU PERFIL",
  title: "Cuando configures tu perfil",
  body: "Esto aparece en el panel de tu cliente.",
  cabra: "assets/cabra/frente.gif",
  Component: StepPerfil
}, {
  id: "link",
  n: 3,
  eyebrow: "PASO 3 · TU LINK",
  title: "Tu URL única en Pathway",
  body: "Esta es la dirección que vas a compartir en tu Instagram, LinkedIn, o donde sea. Elegila bien.",
  cabra: "assets/cabra/salta.gif",
  Component: StepLink
}, {
  id: "pagos",
  n: 4,
  eyebrow: "PASO 4 · DINERO",
  title: "Tu dinero es tuyo. Siempre.",
  body: "Importante: hay dos formas en que llegan los clientes. Te explico la diferencia para que sepas cuándo cobras todo y cuándo Pathway retiene 20%.",
  cabra: "assets/cabra/mira.png",
  Component: StepPagos,
  highlight: true
}, {
  id: "cliente",
  n: 5,
  eyebrow: "PASO 5 · PRIMER CLIENTE",
  title: "Creemos tu primer cliente",
  body: "Solo necesitas su nombre y email. Pathway le manda su acceso al portal automáticamente.",
  cabra: "assets/cabra/atencion.png",
  Component: StepCliente
}, {
  id: "formulario",
  n: 6,
  eyebrow: "PASO 6 · FORMULARIO",
  title: "El intake de tu cliente",
  body: "Antes de la primera sesión, tu cliente contesta un formulario de 7 pasos. Ahorra una hora de entrevista.",
  cabra: "assets/cabra/frente.gif",
  Component: StepFormulario
}, {
  id: "datos",
  n: 7,
  eyebrow: "PASO 7 · LLEGAN LOS DATOS",
  title: "Cuando completa el formulario",
  body: "Tu cliente envía sus datos y los recibes aquí. Un click y la IA arma el informe, el plan y la carta.",
  cabra: "assets/cabra/mira.png",
  Component: StepDatosCliente
}, {
  id: "informe",
  n: 8,
  eyebrow: "PASO 8 · INFORME IA",
  title: "Tu IA hace el trabajo pesado",
  body: "El informe está listo. Lo revisas con prioridades, llegas con la conversación armada a la primera sesión.",
  cabra: "assets/cabra/mira.png",
  Component: StepInforme
}, {
  id: "plan",
  n: 9,
  eyebrow: "PASO 9 · PLAN 4 SEMANAS",
  title: "Tu metodología, lista para enviar",
  body: "Pathway viene con un plan de 4 semanas pre-armado. Es tu metodología — ajústalo y envíalo.",
  cabra: "assets/cabra/mira.png",
  Component: StepPlan
}, {
  id: "medalla",
  n: 10,
  eyebrow: "PASO 10 · MEDALLA",
  title: "Lo lograste",
  body: "Configuraste todo. Ya puedes enviar tu link público y empezar a recibir prospectas. Una sorpresa para ti.",
  cabra: "assets/cabra/salta.gif",
  Component: StepEmailMedalla
}];
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "cabraSize": "L",
  "leftBg": "niebla",
  "showProgress": true,
  "cabraBounce": true
} /*EDITMODE-END*/;
function App() {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(() => new Set());
  const [skipped, setSkipped] = useState(false);
  const [showMedalReveal, setShowMedalReveal] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);

  // Pre-filled with sample data so the coach doesn't have to type to advance.
  // (the coach enters their real data in the actual panel afterward)
  const [formData, setFormData] = useState({
    nombre: "Maria-demo",
    especialidad: "Career Coach Senior",
    anios: "8",
    bio: "Mentora de carrera y coach ontológica certificada.",
    slug: "micaela-jairedin",
    perfilPublico: true,
    stripeOn: false,
    recibirPathway: true,
    cliente: {
      nombre: "Julia Sánchez",
      email: "julia.sanchez@email.com",
      creado: false
    },
    intakeSent: false,
    planSent: false
  });
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const goNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const goPrev = () => {
    if (step > 0) setStep(step - 1);
  };
  const markComplete = () => {
    const next = new Set(completed);
    next.add(cur.id);
    setCompleted(next);
    if (isLast) {
      setShowMedalReveal(true);
    } else {
      setTimeout(goNext, 380);
    }
  };

  // Keyboard: ← back, Esc opens skip
  useEffect(() => {
    const onKey = e => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape" && !skipped) setConfirmSkip(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);
  if (skipped) {
    return /*#__PURE__*/React.createElement(SkippedScreen, {
      onResume: () => setSkipped(false)
    });
  }
  const leftBgStyle = tweaks.leftBg === "verde" ? {
    background: "linear-gradient(160deg, #1B4332 0%, #2D6A4F 100%)",
    color: "#fff"
  } : tweaks.leftBg === "cremma" ? {
    background: "linear-gradient(160deg, #FAF6EC 0%, #F5EBD0 100%)"
  } : {
    background: "linear-gradient(160deg, #FAFDF9 0%, #E8F2EC 100%)"
  };
  const onDark = tweaks.leftBg === "verde";
  return /*#__PURE__*/React.createElement("div", {
    className: "tut-shell",
    "data-screen-label": `Tutorial · ${cur.n.toString().padStart(2, "0")} ${cur.title}`
  }, /*#__PURE__*/React.createElement("header", {
    className: "tut-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-top-l"
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo-mark.png",
    alt: "",
    className: "tut-top-logo"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tut-top-brand"
  }, "pathway", /*#__PURE__*/React.createElement("span", {
    className: "pw-dot"
  }, ".")), /*#__PURE__*/React.createElement("span", {
    className: "tut-top-divider"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "tut-top-section"
  }, "Tutorial inicial")), tweaks.showProgress && /*#__PURE__*/React.createElement("div", {
    className: "tut-top-c"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-top-count"
  }, "Paso ", /*#__PURE__*/React.createElement("strong", null, cur.n), " de ", STEPS.length), /*#__PURE__*/React.createElement("div", {
    className: "tut-top-dots"
  }, STEPS.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    type: "button",
    className: "tut-dot " + (i === step ? "is-current " : "") + (completed.has(s.id) ? "is-done" : ""),
    onClick: () => setStep(i),
    "aria-label": `Ir al paso ${i + 1}`,
    title: s.title
  })))), /*#__PURE__*/React.createElement("div", {
    className: "tut-top-r"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "tut-skip",
    onClick: () => setConfirmSkip(true)
  }, "Saltar tutorial", /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }))))), /*#__PURE__*/React.createElement("main", {
    className: "tut-main"
  }, /*#__PURE__*/React.createElement("section", {
    className: "tut-left " + (onDark ? "is-dark" : ""),
    style: leftBgStyle
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-left-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-eyebrow " + (onDark ? "is-dark" : "") + (cur.highlight ? " is-highlight" : "")
  }, cur.eyebrow), /*#__PURE__*/React.createElement("h2", {
    className: "tut-title " + (onDark ? "is-dark" : "")
  }, cur.title, /*#__PURE__*/React.createElement("span", {
    className: "pw-dot"
  }, ".")), /*#__PURE__*/React.createElement("p", {
    className: "tut-body " + (onDark ? "is-dark" : "")
  }, cur.body), /*#__PURE__*/React.createElement("div", {
    className: "tut-cabra-wrap is-" + tweaks.cabraSize + (tweaks.cabraBounce ? " is-bounce" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-cabra-bg"
  }), /*#__PURE__*/React.createElement("img", {
    key: cur.id,
    src: cur.cabra,
    alt: "",
    className: "tut-cabra-svg"
  })), /*#__PURE__*/React.createElement("div", {
    className: "tut-nav-row"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "tut-nav-btn " + (onDark ? "is-dark" : ""),
    onClick: goPrev,
    disabled: step === 0
  }, "\u2190 Anterior"), /*#__PURE__*/React.createElement("span", {
    className: "tut-nav-meta " + (onDark ? "is-dark" : "")
  }, "Avanz\xE1 interactuando con el panel \u2192")))), /*#__PURE__*/React.createElement("section", {
    className: "tut-right",
    key: cur.id + "-r"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-right-inner"
  }, /*#__PURE__*/React.createElement(cur.Component, {
    onComplete: markComplete,
    done: completed.has(cur.id),
    data: formData,
    setData: setFormData,
    cur: cur
  })))), confirmSkip && /*#__PURE__*/React.createElement("div", {
    className: "tut-modal-bg",
    onClick: () => setConfirmSkip(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-modal-skip",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-modal-skip-cabra"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/cabra/mira.png",
    alt: ""
  })), /*#__PURE__*/React.createElement("h3", null, "\xBFSaltar el tutorial?"), /*#__PURE__*/React.createElement("p", null, "Puedes volver cuando quieras desde el men\xFA de tu perfil. Te recomiendo terminarlo \u2014 solo te quedan ", STEPS.length - step - 1, " pasos."), /*#__PURE__*/React.createElement("div", {
    className: "tut-modal-skip-actions"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "tut-nav-btn",
    onClick: () => setConfirmSkip(false)
  }, "Seguir aprendiendo"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "tut-nav-skip",
    onClick: () => {
      setConfirmSkip(false);
      setSkipped(true);
    }
  }, "Saltar de todos modos")))), showMedalReveal && /*#__PURE__*/React.createElement(MedalReveal, {
    coachName: formData.nombre || "coach",
    onClose: () => setShowMedalReveal(false)
  }), /*#__PURE__*/React.createElement(TweaksPanel, {
    title: "Tweaks"
  }, /*#__PURE__*/React.createElement(TweakSection, {
    label: "Layout"
  }, /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Panel izquierdo",
    value: tweaks.leftBg,
    options: [{
      value: "niebla",
      label: "Niebla"
    }, {
      value: "cremma",
      label: "Crema"
    }, {
      value: "verde",
      label: "Verde"
    }],
    onChange: v => setTweak("leftBg", v)
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Tama\xF1o de Cabra",
    value: tweaks.cabraSize,
    options: [{
      value: "M",
      label: "M"
    }, {
      value: "L",
      label: "L"
    }, {
      value: "XL",
      label: "XL"
    }],
    onChange: v => setTweak("cabraSize", v)
  }), /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Animar a Cabra (bounce)",
    value: tweaks.cabraBounce,
    onChange: v => setTweak("cabraBounce", v)
  }), /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Mostrar progreso arriba",
    value: tweaks.showProgress,
    onChange: v => setTweak("showProgress", v)
  }))));
}

/* ── Skipped screen ─────────────────────────────────────────────── */
function SkippedScreen({
  onResume
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "tut-shell tut-skipped"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-skipped-inner"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/cabra/atencion.png",
    alt: "",
    style: {
      width: 180,
      height: 180,
      objectFit: "contain"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Saliste del tutorial", /*#__PURE__*/React.createElement("span", {
    className: "pw-dot"
  }, ".")), /*#__PURE__*/React.createElement("p", null, "No te preocupes \u2014 puedes retomarlo cuando quieras desde ", /*#__PURE__*/React.createElement("em", null, "Perfil \u2192 Ayuda \u2192 Tutorial inicial"), "."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "tut-nav-btn is-primary",
    onClick: onResume
  }, "Retomar el tutorial")));
}

/* ── Medal reveal ───────────────────────────────────────────────── */
function MedalReveal({
  coachName,
  onClose
}) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 250);
    const t2 = setTimeout(() => setStage(2), 1100);
    const t3 = setTimeout(() => setStage(3), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "tut-medal-bg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-confetti"
  }, Array.from({
    length: 40
  }).map((_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "tut-confetti-piece",
    style: {
      left: `${i * 137 % 100}%`,
      animationDelay: `${i % 8 * 80}ms`,
      background: ["#52B788", "#E9C46A", "#D86A6A", "#2D6A4F"][i % 4]
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tut-medal-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-medal-eyebrow " + (stage >= 1 ? "is-in" : "")
  }, "LOGRO DESBLOQUEADO"), /*#__PURE__*/React.createElement("div", {
    className: "tut-medal-disc " + (stage >= 1 ? "is-in" : "")
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/iconos/medalla-oro.png",
    alt: "Medalla de oro"
  })), /*#__PURE__*/React.createElement("div", {
    className: "tut-medal-title " + (stage >= 2 ? "is-in" : "")
  }, "Estas lista", /*#__PURE__*/React.createElement("span", {
    className: "pw-dot"
  }, "!")), /*#__PURE__*/React.createElement("div", {
    className: "tut-medal-sub " + (stage >= 2 ? "is-in" : "")
  }, coachName.split(" ")[0] || "Coach", ", completaste los 9 pasos. Tu link p\xFAblico ya est\xE1 activo y puedes empezar a recibir prospectas."), /*#__PURE__*/React.createElement("div", {
    className: "tut-medal-stats " + (stage >= 3 ? "is-in" : "")
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontSize: "20px"
    }
  }, "9"), /*#__PURE__*/React.createElement("span", null, "pasos")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontSize: "20px"
    }
  }, "1"), /*#__PURE__*/React.createElement("span", null, "cliente")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontSize: "20px"
    }
  }, "0%"), /*#__PURE__*/React.createElement("span", null, "comisi\xF3n"))), /*#__PURE__*/React.createElement("div", {
    className: "tut-medal-actions " + (stage >= 3 ? "is-in" : "")
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "tut-nav-btn is-primary",
    onClick: onClose
  }, "Ir a mi panel \u2192"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "tut-nav-skip",
    onClick: onClose
  }, "Compartir mi medalla"))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));

})();
