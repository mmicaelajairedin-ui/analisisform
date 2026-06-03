// ===================================================================
// Pathway Coaches — config + cliente Supabase (proyecto pathway-coaches)
// Claves PÚBLICAS (anon) — ok en el frontend. La service_role NUNCA va acá.
// Requiere que la página cargue antes el CDN de supabase-js v2.
// ===================================================================
window.PW_SB_URL  = "https://usirblvmumaloombgfel.supabase.co";
window.PW_SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzaXJibHZtdW1hbG9vbWJnZmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzkyNjgsImV4cCI6MjA5NjA1NTI2OH0.dE96Ev4VAO4GkkjIkX5bjROwwS02aobxYcwub-z0Ycc";

(function(){
  if(!window.supabase || !window.supabase.createClient){
    console.error("Falta el CDN de supabase-js (cargalo antes de pw-coaches.js)");
    return;
  }
  window.sb = window.supabase.createClient(window.PW_SB_URL, window.PW_SB_ANON, {
    auth: { persistSession:true, autoRefreshToken:true, storageKey:"pw_coaches_auth" }
  });
})();

// Helper: a qué panel/portal va cada quien según su rol/coach_type
window.pwRedirect = function(rol, coachType){
  if(rol === "cliente"){
    location.href = (coachType === "financiero") ? "pathway-fin-cliente.html" : "pathway-fit-cliente.html";
  } else {
    location.href = (coachType === "financiero") ? "pathway-fin-coach.html" : "pathway-fit-coach.html";
  }
};
