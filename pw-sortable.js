/* pw-sortable.js — arrastrar-para-ordenar reutilizable (mouse + touch).
 *
 * Uso:
 *   pwSortable(contenedor, function(orden){ ... guardar ... }, { handle:'.pw-grip' })
 *
 * - Cada item ordenable lleva `data-sort="<clave>"`. `orden` es el array de
 *   claves en el nuevo orden (para persistir).
 * - Si se pasa `handle`, el arrastre SOLO empieza desde ese elemento (una
 *   manija ⠿), así los botones/clicks del item siguen andando. Sin `handle`,
 *   se arrastra el item entero (evita empezar sobre button/a/input).
 * - No toca el guardado: al soltar llama al callback con el nuevo orden.
 *
 * Auto-init: cualquier contenedor con `data-pw-sortable` se activa solo y, al
 * reordenar, dispara el evento `pw:reorder` con detail={order}. (Para casos
 * simples sin JS extra.) Para persistir, usá la forma con callback.
 */
(function () {
  var LONG_PRESS_MS = 120; // pequeño delay para no confundir con un tap/click

  function itemsOf(container, sel) {
    return Array.prototype.slice.call(container.querySelectorAll(sel))
      .filter(function (el) { return el.parentNode === container; });
  }

  function pwSortable(container, onReorder, opts) {
    if (!container || container._pwSortable) return;
    container._pwSortable = true;
    opts = opts || {};
    var itemSel = opts.item || '[data-sort]';
    var handleSel = opts.handle || null;

    var drag = null; // {el, placeholder, offsetX, offsetY, startX, startY, active}
    var pressTimer = null;

    function down(e) {
      if (e.button != null && e.button !== 0) return; // solo botón principal
      var item = e.target.closest ? e.target.closest(itemSel) : null;
      if (!item || item.parentNode !== container) return;
      if (handleSel) {
        if (!e.target.closest(handleSel)) return;
      } else if (e.target.closest('button,a,input,textarea,select,label')) {
        return; // sin manija: no arrancar sobre controles
      }
      var pt = point(e);
      var rect = item.getBoundingClientRect();
      var cand = { el: item, startX: pt.x, startY: pt.y, offsetX: pt.x - rect.left, offsetY: pt.y - rect.top, w: rect.width, h: rect.height, active: false };
      pressTimer = setTimeout(function () { begin(cand, pt); }, LONG_PRESS_MS);
      drag = cand;
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    }

    function begin(cand, pt) {
      cand.active = true;
      var el = cand.el;
      var ph = document.createElement(el.tagName);
      ph.className = 'pw-sort-ph';
      ph.style.cssText = 'box-sizing:border-box;width:' + cand.w + 'px;height:' + cand.h + 'px;border:2px dashed rgba(45,106,79,.4);border-radius:12px;background:rgba(82,183,136,.08);flex:0 0 auto;list-style:none;';
      el.parentNode.insertBefore(ph, el);
      cand.placeholder = ph;
      // El item pasa a “flotar” siguiendo el dedo/cursor.
      el.style.width = cand.w + 'px';
      el.style.position = 'fixed';
      el.style.left = (pt.x - cand.offsetX) + 'px';
      el.style.top = (pt.y - cand.offsetY) + 'px';
      el.style.zIndex = '9999';
      el.style.pointerEvents = 'none';
      el.style.boxShadow = '0 12px 30px rgba(20,46,38,.22)';
      el.style.opacity = '.96';
      el.style.transform = 'scale(1.02)';
      document.body.classList.add('pw-sorting');
    }

    function move(e) {
      if (!drag) return;
      var pt = point(e);
      if (!drag.active) {
        // ¿se movió lo suficiente antes del timer? entonces arrancamos ya.
        if (Math.abs(pt.x - drag.startX) + Math.abs(pt.y - drag.startY) > 6) {
          clearTimeout(pressTimer); begin(drag, pt);
        } else return;
      }
      e.preventDefault();
      var el = drag.el;
      el.style.left = (pt.x - drag.offsetX) + 'px';
      el.style.top = (pt.y - drag.offsetY) + 'px';
      // ¿sobre qué item cae? insertamos el placeholder antes/después.
      var over = null, items = itemsOf(container, itemSel);
      for (var i = 0; i < items.length; i++) {
        if (items[i] === el) continue;
        var r = items[i].getBoundingClientRect();
        if (pt.y >= r.top && pt.y <= r.bottom && pt.x >= r.left && pt.x <= r.right) { over = items[i]; break; }
      }
      if (over) {
        var r2 = over.getBoundingClientRect();
        var after = (pt.y - r2.top) > r2.height / 2;
        // en grillas anchas, decidir por X si están lado a lado
        if (r2.width > 60 && Math.abs(pt.y - (r2.top + r2.height / 2)) < r2.height * 0.6) {
          after = (pt.x - r2.left) > r2.width / 2;
        }
        container.insertBefore(drag.placeholder, after ? over.nextSibling : over);
      }
    }

    function up() {
      clearTimeout(pressTimer);
      window.removeEventListener('pointermove', move, { passive: false });
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      var d = drag; drag = null;
      if (!d) return;
      var el = d.el;
      if (d.active && d.placeholder) {
        // soltar el item en la posición del placeholder
        el.style.cssText = el.style.cssText.replace(/(width|position|left|top|z-index|pointer-events|box-shadow|opacity|transform)\s*:[^;]*;?/g, '');
        d.placeholder.parentNode.insertBefore(el, d.placeholder);
        d.placeholder.parentNode.removeChild(d.placeholder);
        document.body.classList.remove('pw-sorting');
        // Efecto "settle" al soltar: un rebote suave (si la página no re-renderiza
        // al instante). El re-render por red suele tardar, así que alcanza a verse.
        el.classList.add('pw-sort-dropped');
        (function (node) { setTimeout(function () { node.classList.remove('pw-sort-dropped'); }, 340); })(el);
        var order = itemsOf(container, itemSel).map(function (x) { return x.getAttribute('data-sort'); });
        try { if (typeof onReorder === 'function') onReorder(order); } catch (e) {}
        try { container.dispatchEvent(new CustomEvent('pw:reorder', { detail: { order: order }, bubbles: true })); } catch (e) {}
      }
    }

    container.addEventListener('pointerdown', down);
  }

  function point(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  // Estilo mínimo de la manija (si el que la usa no define uno propio).
  try {
    var st = document.createElement('style');
    st.textContent = '.pw-grip{cursor:grab;touch-action:none;user-select:none;color:#9AA8A0;display:inline-flex;align-items:center;justify-content:center}.pw-grip:active{cursor:grabbing}body.pw-sorting{cursor:grabbing;user-select:none}body.pw-sorting *{cursor:grabbing !important}@keyframes pw-sort-settle{0%{transform:scale(1.05)}55%{transform:scale(.985)}100%{transform:scale(1)}}.pw-sort-dropped{animation:pw-sort-settle .30s cubic-bezier(.34,1.56,.64,1)}';
    document.head.appendChild(st);
  } catch (e) {}

  // Auto-init de contenedores marcados (sin persistencia; escuchar pw:reorder).
  function autoInit() {
    var cs = document.querySelectorAll('[data-pw-sortable]');
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      pwSortable(c, null, { handle: c.getAttribute('data-pw-sortable-handle') || '.pw-grip', item: c.getAttribute('data-pw-sortable-item') || '[data-sort]' });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInit);
  else autoInit();

  window.pwSortable = pwSortable;
})();
