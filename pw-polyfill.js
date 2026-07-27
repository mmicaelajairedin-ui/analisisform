// pw-polyfill.js — parches para navegadores viejos y webviews in-app
// (Instagram, Facebook, WhatsApp, WebView de Android viejo) que NO traen métodos
// ES2022. Sin esto, el SDK de Supabase (u otra librería) llama a `.at()` y
// crashea con "x.at is not a function" → el usuario ni puede loguearse.
// Se incluye ANTES que cualquier otro script (sobre todo antes del SDK).
(function () {
  function def(obj, name, fn) {
    if (typeof obj[name] !== "function") {
      try { Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true }); }
      catch (_e) { /* algunos entornos no dejan; sin drama */ }
    }
  }
  // Array.prototype.at / String.prototype.at (ES2022) — la causa del crash.
  function at(n) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    return (n < 0 || n >= this.length) ? undefined : this[n];
  }
  def(Array.prototype, "at", at);
  def(String.prototype, "at", at);
  // Otros ES2022 que el SDK moderno puede usar — por las dudas.
  def(Object, "hasOwn", function (o, p) { return Object.prototype.hasOwnProperty.call(o, p); });
  def(Array.prototype, "findLast", function (cb, thisArg) {
    for (var i = this.length - 1; i >= 0; i--) { if (cb.call(thisArg, this[i], i, this)) return this[i]; }
    return undefined;
  });
  def(Array.prototype, "findLastIndex", function (cb, thisArg) {
    for (var i = this.length - 1; i >= 0; i--) { if (cb.call(thisArg, this[i], i, this)) return i; }
    return -1;
  });
})();
