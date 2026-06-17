// pw-exbank.js — Banco de ejercicios COMPARTIDO (panel del coach + portal del cliente).
// Da, por NOMBRE de ejercicio, una foto (free-exercise-db) y un paso a paso en
// español. Lo usan:
//   • pathway-fit-cliente.html → muestra foto + cómo se hace al cliente.
//   • panel-v2.html (Gym del cliente) → previsualiza al coach la foto automática
//     que verá el cliente; el coach puede subir otra y esa tiene prioridad.
//
// Las imágenes las sirve raw.githubusercontent (verificado). Si un id no resuelve,
// quien lo use debe poner onerror para degradar a un placeholder.
(function () {
  var BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

  // clave = nombre normalizado (minúsculas, sin acentos) → { img:'<carpeta>', pasos:[...] }
  // 'img' vacío = sin foto automática (se muestran solo los pasos).
  var DB = {
    "press de banca": { img: "Barbell_Bench_Press_-_Medium_Grip", pasos: ["Acostate en el banco con los pies firmes.", "Agarrá la barra un poco más ancho que los hombros.", "Bajá controlando hasta rozar el pecho.", "Empujá sin bloquear de golpe los codos."] },
    "remo con barra": { img: "Bent_Over_Barbell_Row", pasos: ["Incliná el torso con la espalda recta.", "Dejá colgar la barra con los brazos estirados.", "Tirá hacia el ombligo apretando la espalda.", "Bajá despacio."] },
    "sentadilla": { img: "Barbell_Squat", pasos: ["Pies al ancho de los hombros.", "Bajá llevando la cola atrás.", "Muslos paralelos al piso.", "Subí empujando con los talones."] },
    "sentadilla goblet": { img: "Barbell_Full_Squat", pasos: ["Sostené una pesa contra el pecho con ambas manos.", "Bajá con la espalda recta y el pecho arriba.", "Empujá con los talones para subir."] },
    "press militar": { img: "Barbell_Shoulder_Press", pasos: ["Barra a la altura de los hombros.", "Empujá hasta estirar los brazos.", "Bajá controlando."] },
    "peso muerto": { img: "Barbell_Deadlift", pasos: ["Pies al ancho de cadera, barra pegada a las canillas.", "Espalda recta, agarrá la barra.", "Subí estirando cadera y rodillas a la vez."] },
    "peso muerto rumano": { img: "Barbell_Deadlift", pasos: ["Barra adelante de los muslos.", "Bajá pegada a las piernas flexionando la cadera.", "Volvé arriba apretando los glúteos."] },
    "curl de biceps": { img: "Barbell_Curl", pasos: ["Brazos a los costados, codos fijos.", "Subí flexionando el codo.", "Bajá despacio sin balanceo."] },
    "fondos en paralelas": { img: "Bench_Dips", pasos: ["Sostené tu peso con los brazos estirados.", "Bajá flexionando los codos.", "Empujá hasta volver al inicio."] },
    "zancadas": { img: "Barbell_Walking_Lunge", pasos: ["Paso largo adelante.", "Bajá hasta 90° ambas rodillas.", "Cambiá de pierna."] },
    "hip thrust": { img: "Barbell_Hip_Thrust", pasos: ["Espalda apoyada en un banco, barra sobre la cadera.", "Subí la cadera apretando los glúteos.", "Bajá controlando sin tocar el piso."] },
    "dominadas": { img: "", pasos: ["Colgate de la barra con las palmas al frente.", "Tirá llevando el pecho hacia la barra.", "Bajá controlando hasta estirar los brazos."] },
    "dominadas asistidas": { img: "", pasos: ["Apoyá las rodillas en la asistencia.", "Tirá llevando el pecho hacia la barra.", "Bajá despacio."] },
    "remo en polea": { img: "", pasos: ["Sentado, espalda recta, agarrá el maneral.", "Tirá hacia el abdomen apretando la espalda.", "Volvé estirando los brazos sin encorvar."] },

    // ── Entrada en calor / cardio (sin foto: son movimientos conocidos) ──
    "caminar": { img: "", pasos: ["Caminá a ritmo sostenido, postura erguida.", "Empezá suave y subí el ritmo de a poco.", "5-10 min para entrar en calor."] },
    "correr": { img: "", pasos: ["Trotá a un ritmo en el que todavía puedas hablar.", "Pisá con todo el pie, brazos y hombros relajados.", "Arrancá suave 2-3 min antes de exigir."] },
    "trote": { img: "", pasos: ["Trote suave y continuo para activar el cuerpo.", "Respirá parejo; no busques velocidad.", "5-8 min como entrada en calor."] },
    "cinta": { img: "", pasos: ["Empezá caminando 2-3 min y subí la velocidad de a poco.", "Mantené la postura erguida, no te agarres del frente.", "Usá una inclinación leve si querés más intensidad."] },
    "bicicleta fija": { img: "", pasos: ["Ajustá el asiento a la altura de la cadera.", "Pedaleá parejo, resistencia suave para calentar.", "5-10 min a ritmo cómodo."] },
    "eliptica": { img: "", pasos: ["Movimiento fluido, empujá con piernas y brazos.", "Espalda recta, mirada al frente.", "5-10 min para entrar en calor."] },
    "saltar la cuerda": { img: "", pasos: ["Saltos bajos, solo con la punta de los pies.", "Codos pegados al cuerpo, giran las muñecas.", "Series cortas de 30-60 seg."] },
    "jumping jacks": { img: "", pasos: ["Saltá abriendo piernas y subiendo los brazos.", "Volvé al centro y repetí a ritmo.", "30-60 seg para activar todo el cuerpo."] },
    "movilidad articular": { img: "", pasos: ["Círculos suaves de cuello, hombros, cadera, rodillas y tobillos.", "Movimientos controlados, sin dolor.", "1-2 min antes de entrenar."] },
    "estiramientos": { img: "", pasos: ["Estirá cada músculo sin rebotes.", "Sostené 20-30 seg por zona.", "Mejor al final de la sesión o en días suaves."] },
    "burpees": { img: "", pasos: ["Bajá a plancha, hacé una flexión (opcional).", "Llevá los pies a las manos y saltá hacia arriba.", "Ritmo constante; cuidá la espalda."] },
    "sentadilla sin peso": { img: "Barbell_Squat", pasos: ["Pies al ancho de hombros, brazos al frente para equilibrio.", "Bajá llevando la cola atrás, espalda recta.", "Subí empujando con los talones."] }
  };

  function norm(s) {
    return ("" + (s || "")).toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  }
  function data(n) { return DB[norm(n)] || null; }

  window.PW_EXBANK = {
    base: BASE,
    db: DB,
    norm: norm,
    data: data,
    // URL de la foto: si hay una propia (explicit) y es http, manda esa; si no, la del banco.
    foto: function (nombre, explicit) {
      if (explicit && /^https?:\/\//i.test("" + explicit)) return explicit;
      var d = data(nombre);
      return (d && d.img) ? (BASE + d.img + "/0.jpg") : "";
    },
    pasos: function (n) { var d = data(n); return (d && d.pasos) ? d.pasos : null; },
    // Nombres "lindos" para sugerencias (datalist del panel).
    nombres: ["Caminar", "Correr", "Trote", "Cinta", "Bicicleta fija", "Elíptica", "Saltar la cuerda", "Jumping jacks", "Movilidad articular", "Estiramientos", "Burpees", "Sentadilla sin peso", "Press de banca", "Remo con barra", "Sentadilla", "Sentadilla goblet", "Press militar", "Peso muerto", "Peso muerto rumano", "Curl de bíceps", "Fondos en paralelas", "Zancadas", "Hip thrust", "Dominadas", "Dominadas asistidas", "Remo en polea"]
  };
})();
