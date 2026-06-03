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

// ── Auth ──
window.pwSession = async function(){ try{ var r=await sb.auth.getSession(); return (r.data&&r.data.session)||null; }catch(e){ return null; } };
window.pwLogin   = function(email,pass){ return sb.auth.signInWithPassword({email:email,password:pass}); };
window.pwSignup  = function(email,pass){ return sb.auth.signUp({email:email,password:pass}); };
window.pwLogout  = function(){ return sb.auth.signOut(); };

// ── Hábitos (clave = el propio usuario; RLS deja escribir lo suyo) ──
window.pwSaveHabit = function(uid,fecha,habito,done){
  return sb.from('habitos_log').upsert({cliente_id:uid,fecha:fecha,habito:habito,done:done},{onConflict:'cliente_id,fecha,habito'});
};
window.pwLoadHabits = function(uid,desde){
  return sb.from('habitos_log').select('fecha,habito,done').eq('cliente_id',uid).gte('fecha',desde);
};
window.pwHoy = function(){ return new Date().toISOString().slice(0,10); };

// ── White-label: aplicar la marca del coach (color + logo + nombre) ──
// La marca viaja denormalizada en clientes.config (la setea el coach), así el
// cliente la lee de su propia fila (sin chocar con RLS).
window.pwApplyBrand = function(b){
  if(!b) return;
  try{
    var root=document.documentElement.style;
    if(b.color_marca){ root.setProperty('--rose', b.color_marca); root.setProperty('--rose-dark', b.color_marca); }
    if(b.coach_nombre){
      var nm=document.querySelector('.ptop-coach-name'); if(nm) nm.textContent=b.coach_nombre;
      var sub=document.querySelector('.sb-brand-sub'); if(sub) sub.textContent='con '+b.coach_nombre;
    }
    if(b.logo_url){
      var av=document.querySelector('.ptop-av'); if(av){ av.style.background='transparent'; av.innerHTML='<img src="'+b.logo_url+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'; }
    }
  }catch(e){}
};
window.pwMyBrand = async function(uid){
  try{ var c=await sb.from('clientes').select('config').eq('id',uid).maybeSingle(); return (c.data&&c.data.config)||null; }catch(e){ return null; }
};

// Helper: a qué panel/portal va cada quien según su rol/coach_type
window.pwRedirect = function(rol, coachType){
  if(rol === "cliente"){
    location.href = (coachType === "financiero") ? "pathway-fin-cliente.html" : "pathway-fit-cliente.html";
  } else {
    location.href = (coachType === "financiero") ? "pathway-fin-coach.html" : "pathway-fit-coach.html";
  }
};
