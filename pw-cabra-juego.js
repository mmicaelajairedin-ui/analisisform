/* ============================================================
   pw-cabra-juego.js — Juego "La cabra a la cima" (única fuente).
   Extraído del panel del coach para reusarlo tal cual en cualquier panel.
   API:  openJuego()  /  closeJuego()   (globales)
   Opcionales (si el host los define):
     window.PW_GAME_EMAIL      -> string, para guardar el mejor puntaje por persona
     window.PW_GAME_ONCLOSE    -> callback al cerrar (ej: refrescar un puntaje en el menú)
     window.PW_GAME_SYNC(pts)  -> callback para persistir el mejor puntaje (ej: Supabase)
   Assets: assets/cabra/*  (mismos que usa el panel del coach)
   ============================================================ */
(function(g){
  var CAB_ICO = "<img src='https://szf7yzy2hz.ucarecd.net/088834f5-6934-4e64-97b2-52ebd8647c1d/-/preview/1000x1000/' alt='' style='height:2em;width:auto;vertical-align:-.62em'>";
  var _game=null, _gameRAF=null;

  function _gameEmail(){
    if(g.PW_GAME_EMAIL) return g.PW_GAME_EMAIL;
    try{ var u=JSON.parse(localStorage.getItem("mj_user")||"null"); if(u&&u.email) return u.email; }catch(e){}
    return "x";
  }
  function _gameKey(){ return "pw_game_pts_"+_gameEmail(); }
  function _gameBest(){ try{ return parseInt(localStorage.getItem(_gameKey())||"0",10)||0; }catch(e){ return 0; } }
  function _gameSetBest(n){ try{ if(n>_gameBest()){ localStorage.setItem(_gameKey(),String(n)); if(typeof g.PW_GAME_SYNC==="function"){ try{ g.PW_GAME_SYNC(n); }catch(e){} } } }catch(e){} }

  var GAME_LEVELS=[
    {n:1,name:"Perfil",target:100,gap:330,trees:false},
    {n:2,name:"Cliente",target:200,gap:255,trees:true},
    {n:3,name:"Sesión",target:320,gap:170,trees:true}
  ];
  var ROCK_SVG="<svg width='40' height='30' viewBox='0 0 40 30'><path d='M4 28 Q0 17 9 13 Q12 3 23 5 Q36 6 36 18 Q39 28 31 28 Z' fill='#8A8D8B' stroke='#636664' stroke-width='1.6' stroke-linejoin='round'/><path d='M12 13 Q17 9 24 12' stroke='#AFB2B0' stroke-width='2' fill='none' stroke-linecap='round'/></svg>";
  var TREE_SVG="<svg width='42' height='56' viewBox='0 0 42 56'><rect x='18' y='42' width='6' height='13' rx='1.5' fill='#6F5A40'/><polygon points='21,4 35,25 7,25' fill='#2D6A4F'/><polygon points='21,16 38,41 4,41' fill='#357A5B'/><polygon points='21,28 41,52 1,52' fill='#3E8B66'/></svg>";
  var STAR_SVG="<svg width='34' height='34' viewBox='0 0 34 34'><polygon points='17,2 21,12 32,12.5 23.5,19 26.5,30 17,23.5 7.5,30 10.5,19 2,12.5 13,12' fill='#F2C14E' stroke='#D9A441' stroke-width='1.2' stroke-linejoin='round'/></svg>";

  function _gameKeyDown(e){ if(!_game) return; if(e.key==="ArrowRight"){_game.dir=1;e.preventDefault();} else if(e.key==="ArrowLeft"){_game.dir=-1;e.preventDefault();} else if(e.key===" "||e.code==="Space"){e.preventDefault(); _gameJump();} }
  function _gameKeyUp(e){ if(!_game) return; if((e.key==="ArrowRight"&&_game.dir===1)||(e.key==="ArrowLeft"&&_game.dir===-1)) _game.dir=0; }
  function _gameJump(){ if(!_game||_game.jumping||_game.over) return; _game.jumping=true; _game.vy=13; }

  function openJuego(){
    closeJuego();
    var o=document.createElement("div"); o.id="pw-juego"; o.className="pw-juego";
    o.innerHTML="<div class='pw-juego-box'>"+
      "<div class='pw-juego-hud'><span class='pw-juego-lvl' id='pwg-lvl'>La cabra a la cima</span>"+
        "<span class='pw-juego-pts'><b id='pwg-pts'>0</b> / <span id='pwg-tgt'>100</span> pts · <span id='pwg-saltos'>0</span> saltos</span>"+
        "<button class='pw-juego-x' id='pwg-x' aria-label='Cerrar'>✕</button></div>"+
      "<div class='pw-juego-stage' id='pwg-stage'>"+
        "<img class='pw-juego-cabra' id='pwg-cabra' src='assets/cabra/frente.gif' alt=''>"+
        "<div class='pw-juego-ov' id='pwg-ov'><div class='pw-juego-ovt'>La cabra a la cima "+CAB_ICO+"</div><div class='pw-juego-ovp'>◄ ► avanzar · <b>espacio</b> saltar piedras · salta alto para las estrellas ⭐ · clic en la cabra para saludar</div><button class='pwg-startbtn' id='pwg-start'>Empezar →</button></div>"+
      "</div>"+
      "<div class='pw-juego-foot'>Mejor puntaje: <b id='pwg-best'>"+_gameBest()+"</b></div>"+
    "</div>";
    document.body.appendChild(o);
    o.addEventListener("click",function(e){ if(e.target===o) closeJuego(); });
    document.getElementById("pwg-x").onclick=closeJuego;
    document.getElementById("pwg-start").onclick=function(){ _gameStart(0); };
    document.getElementById("pwg-cabra").addEventListener("click",function(ev){ ev.stopPropagation(); if(_game&&!_game.over) _game.waveT=70; });
    document.addEventListener("keydown",_gameKeyDown); document.addEventListener("keyup",_gameKeyUp);
  }
  function closeJuego(){
    if(_gameRAF){ cancelAnimationFrame(_gameRAF); _gameRAF=null; }
    document.removeEventListener("keydown",_gameKeyDown); document.removeEventListener("keyup",_gameKeyUp);
    var o=document.getElementById("pw-juego"); if(o) o.remove();
    var had=!!_game; _game=null;
    if(had && typeof g.PW_GAME_ONCLOSE==="function"){ try{ g.PW_GAME_ONCLOSE(); }catch(e){} }
  }
  function _gameStart(li){
    var L=GAME_LEVELS[li], stage=document.getElementById("pwg-stage"); if(!stage) return;
    stage.querySelectorAll(".pwg-ob,.pwg-pop").forEach(function(e){e.remove();});
    document.getElementById("pwg-ov").style.display="none";
    _game={li:li,L:L,pts:0,saltos:0,dir:0,cabraY:0,vy:0,jumping:false,nextSpawn:340,obs:[],waveT:0,over:false};
    document.getElementById("pwg-lvl").textContent="Nivel "+L.n+" · "+L.name;
    document.getElementById("pwg-tgt").textContent=L.target;
    _gameHUD();
    if(_gameRAF) cancelAnimationFrame(_gameRAF);
    _gameRAF=requestAnimationFrame(_gameLoop);
  }
  function _gameHUD(){ var a=document.getElementById("pwg-pts"),b=document.getElementById("pwg-saltos"); if(a)a.textContent=_game.pts; if(b)b.textContent=_game.saltos; }
  function _gamePop(txt){ var st=document.getElementById("pwg-stage"); if(!st)return; var p=document.createElement("div"); p.className="pwg-pop"; p.textContent=txt; p.style.left="140px"; st.appendChild(p); setTimeout(function(){p.remove();},700); }
  function _gameSpawn(){ var st=document.getElementById("pwg-stage"),L=_game.L,r=Math.random();
    var type=(r<0.22)?"star":((L.trees&&r<0.5)?"tree":"rock");
    var el=document.createElement("div"); el.className="pwg-ob pwg-"+type;
    el.innerHTML=type==="star"?STAR_SVG:(type==="tree"?TREE_SVG:ROCK_SVG);
    if(type==="star") el.style.bottom="132px";
    var w=st.clientWidth; el.style.left=w+"px"; st.appendChild(el);
    _game.obs.push({el:el,x:w,type:type,scored:false}); }
  function _gameEnd(win){
    _game.over=true; if(_gameRAF){cancelAnimationFrame(_gameRAF);_gameRAF=null;}
    _gameSetBest(_game.pts); var bs=document.getElementById("pwg-best"); if(bs)bs.textContent=_gameBest();
    var ov=document.getElementById("pwg-ov"),t=ov.querySelector(".pw-juego-ovt"),p=ov.querySelector(".pw-juego-ovp"),btn=document.getElementById("pwg-start");
    if(win){ var nx=_game.li+1;
      if(nx>=GAME_LEVELS.length){ t.textContent="¡Llegaste a la cima! 🏆"; p.textContent="Completaste los 3 niveles con "+_game.pts+" puntos."; btn.textContent="Jugar de nuevo"; btn.onclick=function(){_gameStart(0);}; }
      else { t.textContent="¡Nivel "+_game.L.n+" completado! 🎉"; p.innerHTML= nx===1?"Ahora con más piedras y árboles que suman puntos.":"Último nivel: las piedras vienen más seguidas."; btn.textContent="Ir al nivel "+(nx+1); btn.onclick=function(){_gameStart(nx);}; }
    } else { t.textContent="¡Chocaste! 🪨"; p.innerHTML="Salta con <b>espacio</b>. Prueba de nuevo este nivel."; btn.textContent="Reintentar"; btn.onclick=function(){_gameStart(_game.li);}; }
    ov.style.display="flex";
  }
  function _gameLoop(){
    if(!_game||_game.over) return;
    var st=document.getElementById("pwg-stage"); if(!st){ return; }
    var cabra=document.getElementById("pwg-cabra"), sp=4.4, CX=130;
    if(_game.dir>0){ _game.nextSpawn-=sp; _game.obs.forEach(function(o){o.x-=sp;o.el.style.left=o.x+"px";}); if(_game.nextSpawn<=0){ _gameSpawn(); _game.nextSpawn=_game.L.gap+Math.random()*60; } }
    if(_game.jumping){ _game.cabraY+=_game.vy; _game.vy-=0.72; if(_game.cabraY<=0){_game.cabraY=0;_game.jumping=false;_game.vy=0;} }
    var src=_game.waveT>0?"assets/cabra/atencion.png":(_game.jumping?"assets/cabra/salta.gif":(_game.dir>0?"assets/cabra/camina.gif":"assets/cabra/frente.gif"));
    if(_game.waveT>0)_game.waveT--;
    if(cabra){ var cur=cabra.getAttribute("src"); if(cur!==src) cabra.src=src; cabra.style.bottom=(44+_game.cabraY)+"px"; }
    for(var i=_game.obs.length-1;i>=0;i--){ var o=_game.obs[i]; var over=o.x>CX-44&&o.x<CX+44;
      if(o.type==="rock"){
        if(over && !o.scored && _game.cabraY<40){ return _gameEnd(false); }
        if(!o.scored && o.x<CX-32){ o.scored=true; _game.pts+=25; _game.saltos++; _gamePop("+25"); _gameHUD(); if(_game.pts>=_game.L.target) return _gameEnd(true); }
      } else if(o.type==="tree"){
        if(!o.scored && o.x<CX-32){ o.scored=true; _game.pts+=10; _gamePop("+10"); _gameHUD(); if(_game.pts>=_game.L.target) return _gameEnd(true); }
      } else {
        if(over && !o.scored && _game.cabraY>42){ o.scored=true; _game.pts+=50; _gamePop("+50"); o.el.style.transition="opacity .2s,transform .2s"; o.el.style.opacity="0"; o.el.style.transform="scale(1.6)"; _gameHUD(); if(_game.pts>=_game.L.target) return _gameEnd(true); }
      }
      if(o.x<-70){ o.el.remove(); _game.obs.splice(i,1); }
    }
    _gameRAF=requestAnimationFrame(_gameLoop);
  }

  // API pública
  g.openJuego=openJuego;
  g.closeJuego=closeJuego;
  g.PWCabra={ open:openJuego, close:closeJuego, best:_gameBest };
})(window);
