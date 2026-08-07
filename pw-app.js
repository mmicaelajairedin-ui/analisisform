// ===================================================================
// pw-app.js — Detecta cuando Pathway corre DENTRO de la app de tienda
// (iOS App Store / Google Play) y, en ese caso, oculta TODO lo de pago.
//
// Por que: Apple y Google exigen SU sistema de cobro (15-30%) para compras
// digitales hechas dentro de la app. Solucion (modelo Netflix/Spotify): la
// app es "inicia sesion y usa"; la suscripcion se compra en la WEB con Stripe.
// En la web normal y en la PWA "agregar a inicio" esto NO se activa -> ahi
// los cobros siguen exactamente igual.
//
// Como se activa (de mas confiable a menos):
//   1) El build de tienda abre la web con ?app=1  (RECOMENDADO, lo mas seguro).
//      Configurar el start_url del wrapper como, por ej:
//        https://pathwaycareercoach.com/login.html?app=1
//      Asi el revisor de Apple/Google NUNCA ve un boton de pago.
//   2) Capacitor nativo (window.Capacitor.isNativePlatform()).
//   3) TWA de Google Play (document.referrer empieza con "android-app://").
// El flag queda guardado en localStorage para el resto de las pantallas.
//
// Uso en el HTML: marcar lo que es pago con  data-app-hide  y se oculta solo
// dentro de la app. En JS se puede consultar  window.PW_IN_APP.
// ===================================================================
(function(){
  try{
    var inApp=false;
    var qs=new URLSearchParams(location.search||"");
    if(qs.get("app")==="1"){ inApp=true; try{ localStorage.setItem("pw_native","1"); }catch(e){} }
    if(!inApp){ try{ if(localStorage.getItem("pw_native")==="1") inApp=true; }catch(e){} }
    if(!inApp && window.Capacitor){
      var C=window.Capacitor;
      if(typeof C.isNativePlatform==="function" ? C.isNativePlatform() : C.isNative) inApp=true;
    }
    if(!inApp && document.referrer && document.referrer.indexOf("android-app://")===0) inApp=true;
    window.PW_IN_APP=inApp;
    if(inApp){
      document.documentElement.classList.add("pw-in-app");
      var s=document.createElement("style");
      // Oculta: (1) lo marcado a mano con data-app-hide, (2) CUALQUIER boton/link
      // que abra Stripe o la pagina de planes (asi no hay que marcar uno por uno),
      // y muestra los avisos .app-only ("gestioná tu plan en la web").
      s.textContent=
        ".pw-in-app [data-app-hide]{display:none !important;}"+
        ".pw-in-app [data-ios-hide]{display:none !important;}"+
        ".pw-in-app [data-url*='buy.stripe.com'],.pw-in-app [data-url*='billing.stripe.com'],.pw-in-app [data-url*='upgrade.html'],"+
        ".pw-in-app a[href*='buy.stripe.com'],.pw-in-app a[href*='billing.stripe.com'],.pw-in-app a[href*='upgrade.html']{display:none !important;}"+
        ".app-only{display:none !important;}.pw-in-app .app-only{display:block !important;}";
      (document.head||document.documentElement).appendChild(s);
    }
  }catch(e){ /* ante cualquier duda, NO marcamos in-app: la web sigue normal */ }
})();
