// pw-polyfill.js — parches para navegadores viejos y webviews in-app
// (Instagram, Facebook, WhatsApp, WebView de Android viejo) que NO traen métodos
// ES2022. Sin esto, el SDK de Supabase (u otra librería) llama a `.at()` y
// crashea con "x.at is not a function" → el usuario ni puede loguearse.
// Se incluye ANTES que cualquier otro script (sobre todo antes del SDK).
window.__pwPolyfilledAt = false; // flag para diagnosticar si el parche se aplicó
(function () {
  function def(obj, name, fn) {
    if (typeof obj[name] !== "function") {
      if (Object.defineProperty) {
        try { Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true }); }
        catch (_e) { /* algunos entornos no dejan; fallback a asignación directa */ }
      }
      // Fallback: si Object.defineProperty falló o no existe, asignar directamente
      if (typeof obj[name] !== "function") {
        try { obj[name] = fn; }
        catch (_e) { /* entorno completamente bloqueado */ }
      }
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
  // Verificar que los parches se aplicaron correctamente
  window.__pwPolyfilledAt = (typeof Array.prototype.at === "function" && typeof String.prototype.at === "function");
  if (!window.__pwPolyfilledAt) {
    console.warn("⚠️ pw-polyfill: No se pudo aplicar .at(). Navegador muy antiguo o entorno bloqueado.");
  }
})();
