/* Genera el estudio de mercado de Pathway en PDF visual (gráficos + tablas).
   Uso: node scripts/gen-estudio-pdf.js  →  docs/pathway-estudio-mercado.pdf
   Datos verificados en investigación (jun 2026). Fuentes en la última página. */
const PDFDocument = require('pdfkit');
const fs = require('fs');

// ── Paleta de marca Pathway ──
const C = {
  bosque:'#2D6A4F', sendero:'#52B788', amanecer:'#E9C46A', carbon:'#1B2E26',
  niebla:'#FAFDF9', texto:'#1B2E26', suave:'#6B6B66', borde:'#DCE7E0',
  rojo:'#C0564B', azul:'#3E6B8C', naranja:'#D98E3A', gris:'#B4B4AE',
  blanco:'#FFFFFF', verdeClaro:'#EAF5EF', amarilloClaro:'#FBF3DC'
};
const PAGE_W = 595.28, PAGE_H = 841.89, M = 46;
const CW = PAGE_W - M*2; // content width

const out = 'docs/pathway-estudio-mercado.pdf';
const doc = new PDFDocument({ size:'A4', margins:{top:M,bottom:18,left:M,right:M}, bufferPages:true });
doc.pipe(fs.createWriteStream(out));
// Solo newPage() puede crear páginas: bloquea la auto-paginación espuria de PDFKit.
const _addPage = doc.addPage.bind(doc); let _allowPage=false;
doc.addPage=function(){ if(!_allowPage) return doc; return _addPage.apply(doc,arguments); };

// Fuente con cobertura Unicode (→ ≤ ≥ ▼ · € …). Fallback a Helvetica si no está.
let F='Helvetica', FB='Helvetica-Bold';
try{
  const fr='assets/fonts/LiberationSans-Regular.ttf', fb='assets/fonts/LiberationSans-Bold.ttf';
  if(fs.existsSync(fr)&&fs.existsSync(fb)){ doc.registerFont('Sans',fr); doc.registerFont('SansB',fb); F='Sans'; FB='SansB'; }
}catch(e){ /* usa Helvetica */ }

// ── helpers de dibujo ──
function rrect(x,y,w,h,r,fill,stroke,lw){
  doc.roundedRect(x,y,w,h,r);
  if(fill) doc.fillColor(fill);
  if(stroke){ doc.lineWidth(lw||1).strokeColor(stroke); doc.fillAndStroke(fill||C.blanco, stroke); }
  else doc.fill(fill);
}
function txt(s,x,y,opt){ doc.fillColor((opt&&opt.color)||C.texto).font((opt&&opt.font)||F).fontSize((opt&&opt.size)||10);
  doc.text(s,x,y,Object.assign({lineBreak:false},opt)); }

// Texto fluido ACOTADO en altura → nunca auto-pagina. Devuelve la y final.
function flow(s,x,yy,w,o){ o=o||{};
  doc.font(o.font||F).fontSize(o.size||8.8);
  const hh=doc.heightOfString(s,{width:w});
  doc.fillColor(o.color||C.texto).text(s,x,yy,{width:w,height:hh+2,lineBreak:true});
  return yy+hh;
}

let pageNum=0;
function header(kicker,title){
  pageNum++;
  // banda superior
  doc.rect(0,0,PAGE_W,8).fill(C.bosque);
  txt(kicker.toUpperCase(),M,30,{font:FB,size:9,color:C.sendero,characterSpacing:1.5});
  txt(title,M,44,{font:FB,size:21,color:C.carbon});
  doc.moveTo(M,78).lineTo(PAGE_W-M,78).lineWidth(1).strokeColor(C.borde).stroke();
}
function footer(){
  const y=PAGE_H-32;
  doc.moveTo(M,y).lineTo(PAGE_W-M,y).lineWidth(0.7).strokeColor(C.borde).stroke();
  txt('Pathway · Estudio de mercado',M,y+7,{size:8,color:C.suave});
  txt('Jun 2026 · confidencial',PAGE_W-M-150,y+7,{size:8,color:C.suave,width:150,align:'right'});
  txt(String(pageNum),PAGE_W/2-10,y+7,{size:8,color:C.suave,width:20,align:'center'});
}
function newPage(kicker,title){ _allowPage=true; doc.addPage(); _allowPage=false; header(kicker,title); footer(); }

// Tarjeta de estadística grande (etiqueta arriba con espacio propio, sub anclado abajo)
function statCard(x,y,w,h,number,label,color,sub){
  rrect(x,y,w,h,9,C.blanco,C.borde,1);
  doc.rect(x,y+10,4,h-20).fill(color);
  txt(number,x+15,y+12,{font:FB,size:20,color:color,width:w-22});
  doc.font(FB).fontSize(8).fillColor(C.carbon).text(label,x+15,y+39,{width:w-24,height:22,lineBreak:true,ellipsis:true});
  if(sub) doc.font(F).fontSize(7).fillColor(C.suave).text(sub,x+15,y+h-16,{width:w-24,height:12,lineBreak:false,ellipsis:true});
}

// Barras horizontales: items=[{label,val,color,note}], maxVal, unit
function hbars(x,y,w,items,maxVal,fmt){
  const rowH=26, labelW=140, barMax=w-labelW-58;
  items.forEach((it,i)=>{
    const ry=y+i*rowH;
    txt(it.label,x,ry+4,{size:8.5,color:C.texto,width:labelW-6,font:it.bold?FB:F});
    const bw=Math.max(2,(it.val/maxVal)*barMax);
    rrect(x+labelW,ry,barMax,13,3,C.niebla); // track
    rrect(x+labelW,ry,bw,13,3,it.color||C.sendero);
    txt(fmt?fmt(it.val):String(it.val),x+labelW+bw+6,ry+2.5,{size:8.5,font:FB,color:it.color||C.bosque});
    if(it.note) txt(it.note,x+labelW,ry+15,{size:6.8,color:C.suave,width:barMax});
  });
  return y+items.length*rowH;
}

// Caja de texto con título (callout)
function callout(x,y,w,title,body,accent,bg){
  const pad=12; doc.fontSize(8.8).font(F);
  const bodyH=doc.heightOfString(body,{width:w-pad*2});
  const h=bodyH+34;
  rrect(x,y,w,h,8,bg||C.verdeClaro,accent,1.2);
  doc.rect(x,y+8,3.5,h-16).fill(accent);
  txt(title,x+pad,y+9,{font:FB,size:9.5,color:accent,width:w-pad*2});
  flow(body,x+pad,y+23,w-pad*2,{size:8.8});
  return y+h;
}

// ════════════ PÁGINA 1 — PORTADA ════════════
doc.rect(0,0,PAGE_W,PAGE_H).fill(C.carbon);
doc.rect(0,0,PAGE_W,6).fill(C.sendero);
// logo
const lx=M, ly=120;
doc.polygon([lx,ly+34],[lx+13,ly+14],[lx+26,ly+34]).fill(C.sendero);
doc.polygon([lx+15,ly+34],[lx+30,ly+6],[lx+45,ly+34]).fill(C.niebla);
doc.circle(lx+30,ly+2,4).fill(C.amanecer);
txt('pathway',lx+54,ly+8,{font:FB,size:26,color:C.niebla});
txt('.',lx+54+105,ly+8,{font:FB,size:26,color:C.sendero});

txt('ESTUDIO DE MERCADO Y',M,300,{font:FB,size:13,color:C.sendero,characterSpacing:2});
doc.font(FB).fontSize(40).fillColor(C.niebla).text('Validación de',M,322,{width:CW});
doc.font(FB).fontSize(40).fillColor(C.niebla).text('negocio',M,366,{width:CW});
doc.font(F).fontSize(13).fillColor('#B9C7BF').text('SaaS para coaches de carrera · España + Latinoamérica',M,425,{width:CW});

// chips de contenido
const chips=['Tamaño de mercado','Competencia','Pricing','Métricas SaaS','Estrategia'];
let cx=M, cyc=478;
chips.forEach(ch=>{
  const wch=doc.font(F).fontSize(9).widthOfString(ch)+22;
  if(cx+wch>PAGE_W-M){cx=M;cyc+=30;}
  rrect(cx,cyc,wch,21,11,'#24382E',C.sendero,1);
  txt(ch,cx+11,cyc+6,{size:9,color:C.sendero});
  cx+=wch+8;
});

rrect(M,PAGE_H-150,CW,70,9,'#24382E',null);
txt('PREPARADO PARA',M+16,PAGE_H-136,{font:FB,size:8,color:C.sendero,characterSpacing:1.5});
txt('Reunión con mentor de finanzas / negocios',M+16,PAGE_H-122,{font:FB,size:13,color:C.niebla});
txt('Datos verificados con fuentes citadas (ICF, ChartMogul, World Bank, a16z/Lenny\'s).',M+16,PAGE_H-100,{size:8.5,color:'#B9C7BF'});
txt('Cifras reales del producto + benchmarks de industria. Estimaciones marcadas como tales.',M+16,PAGE_H-88,{size:8.5,color:'#B9C7BF'});
txt('16 de junio de 2026',PAGE_W-M-160,PAGE_H-60,{size:9,color:C.suave,width:160,align:'right'});

// ════════════ PÁGINA 2 — RESUMEN EJECUTIVO ════════════
newPage('Resumen ejecutivo','El negocio de un vistazo');
let y=96;
txt('Pathway es un SaaS B2B2C: le vende herramientas con IA + portal del cliente a coaches de carrera.',M,y,{size:10,color:C.texto,width:CW});
txt('El coach paga (€58–89/mes); el candidato no. Diferencial: un marketplace que TRAE clientes al coach.',M,y+14,{size:10,color:C.texto,width:CW});

y=138;
const gap=12, cwd=(CW-gap*3)/4;
statCard(M,y,cwd,86,'$5,34 B','Mercado global de coaching','#2D6A4F','2025 · +17% vs 2023');
statCard(M+(cwd+gap),y,cwd,86,'122.974','Coaches en el mundo','#3E6B8C','+15% en 2 años (ICF)');
statCard(M+(cwd+gap)*2,y,cwd,86,'~53%','Coaches sin plataforma',C.naranja,'= tu oportunidad');
statCard(M+(cwd+gap)*3,y,cwd,86,'0 de 8','Competidores que traen clientes','#C0564B','espacio en blanco');

y=242;
txt('LOS 5 HALLAZGOS',M,y,{font:FB,size:10,color:C.bosque,characterSpacing:1});
y+=18;
const finds=[
  ['1','Mercado grande y en alza con una grieta','Coaching crece a doble dígito y la mitad de los coaches aún no usa software. El nicho carrera es el segmento más grande de plataformas de coaching (~28%).'],
  ['2','Tu diferencial se confirma','Ninguno de los 8 competidores analizados (Harbiz, CoachAccountable, Paperbell, Simply.Coach, Satori…) es un marketplace que genere demanda para el coach independiente. Todos son software de gestión.'],
  ['3','Pricing bien ubicado, pero LatAm pide ajuste','€58 está a la par de los líderes; €89 en el techo de la banda. Un coach latinoamericano tiene 38–62% del poder adquisitivo de uno español → conviene precio regional.'],
  ['4','Empezá por el coach, en UN nicho y UN país','La teoría de marketplaces (a16z, Lenny\'s) es unánime: sembrá primero la oferta (coaches) con valor de "single-player", concentrá un nicho×geografía y recién después abrí el marketplace.'],
  ['5','Medite contra benchmarks de bajo ticket, no enterprise','Para un SaaS de €50–90/mes con trial sin tarjeta: churn 3–5%/mes es sano, conversión de trial ~9% es la media a batir. No te compares con cifras enterprise.'],
];
finds.forEach(f=>{
  doc.circle(M+9,y+8,9).fill(C.sendero); txt(f[0],M+5.5,y+3.5,{font:FB,size:10,color:C.blanco});
  txt(f[1],M+28,y,{font:FB,size:10.5,color:C.carbon,width:CW-28});
  const fe=flow(f[2],M+28,y+13,CW-28,{size:8.8,color:C.suave});
  y=fe+11;
});

callout(M,y+4,CW,'Veredicto en una línea',
 '"Software de gestión + genera demanda, para coaches de carrera independientes, en español" es un cruce prácticamente desocupado. La oportunidad es real; el reto no es el producto, es conseguir y retener a los primeros 10–20 coaches que pagan.',
 C.bosque, C.verdeClaro);

// ════════════ PÁGINA 3 — MERCADO ════════════
newPage('1 · Tamaño de mercado','¿Qué tan grande es la torta?');
y=96;
txt('Crecimiento del mercado global de coaching (ingresos, USD) — fuente ICF Global Coaching Study',M,y,{font:FB,size:9.5,color:C.carbon});
y+=22;
y=hbars(M,y,CW,[
  {label:'2019',val:2.849,color:C.gris},
  {label:'2022',val:4.564,color:C.azul},
  {label:'2025',val:5.34,color:C.bosque,bold:true,note:'+17% vs 2023 · +87% vs 2019'},
],6,v=>'$'+v.toFixed(2)+' B');
y+=6;
txt('Confianza ALTA. ICF cuenta practicantes e ingresos de actividad de coaching (cifra conservadora vs. reportes comerciales).',M,y,{size:7.6,color:C.suave,width:CW});

y+=24;
const cwd2=(CW-gap*2)/3;
statCard(M,y,cwd2,80,'$1,43 B','Career coaching (servicio)',C.azul,'2025 → $2,5 B en 2034');
statCard(M+(cwd2+gap),y,cwd2,80,'$4,6 B','Mercado de outplacement',C.bosque,'2024 · CAGR ~6%');
statCard(M+(cwd2+gap)*2,y,cwd2,80,'87%','Coaches usan videollamada',C.sendero,'el coaching online ya es norma');

y+=98;
txt('Tarifa media por sesión de 1 h (USD) — el dato clave para el pricing regional',M,y,{font:FB,size:9.5,color:C.carbon});
y+=20;
y=hbars(M,y,CW,[
  {label:'Europa Occidental',val:277,color:C.bosque},
  {label:'Norteamérica',val:272,color:C.azul},
  {label:'LatAm y Caribe',val:114,color:C.naranja,bold:true,note:'el coach latino factura ~41% de la tarifa europea'},
],300,v=>'$'+v);

y+=18;
callout(M,y,CW,'Lectura para el mentor',
 'El anclaje defendible es ICF: ~123.000 coaches y $5,34 B (2025). Las cifras de "mercado de software de coaching" que circulan ($1,5–3,7 B para el MISMO año) tienen definiciones inconsistentes y huelen a inflado por proveedores: usarlas con pinzas. El dato más accionable es que ~53% de coaches no tiene plataforma → adopción, no creación de categoría.',
 C.azul, '#EAF1F6');

// ════════════ PÁGINA 4 — COMPETENCIA ════════════
newPage('2 · Competencia','8 plataformas analizadas');
y=92;
txt('Software para coaches: precios, foco y la pregunta clave — ¿traen clientes nuevos al coach?',M,y,{size:9.5,color:C.texto,width:CW});
y+=24;

// tabla
const cols=[
  {h:'Plataforma',w:96},{h:'Precio/mes',w:92},{h:'Foco',w:120},{h:'Español',w:58},{h:'¿Trae clientes?',w:CW-96-92-120-58}
];
let tx=M;
doc.rect(M,y,CW,20).fill(C.carbon);
cols.forEach(c=>{ txt(c.h,tx+6,y+6,{font:FB,size:8,color:C.niebla,width:c.w-8}); tx+=c.w; });
y+=20;
const rows=[
  ['Harbiz','~€30+','Fitness (Madrid)','Sí','NO',false],
  ['CoachAccountable','$20–120','General/negocios','No','NO',false],
  ['Paperbell','$57 plano','General','No','NO',false],
  ['Simply.Coach','$19–69','General + verticales','Sí','NO',false],
  ['Satori','$33–124','General / ICF','No','NO',false],
  ['CoachPilot','$35–100','Fitness/IA','No','NO',false],
  ['Profi.io','— cerró —','Terapeutas/equipos','No','— (defunct)',false],
  ['Coaching.com','listado + 15–25%','General','No','Directorio pasivo',null],
  ['PATHWAY','€58 / €89','Carrera + IA','Sí','SÍ — marketplace',true],
];
rows.forEach((r,i)=>{
  const rh=19;
  const bg = r[5]===true ? C.verdeClaro : (i%2? '#F6F8F6':C.blanco);
  doc.rect(M,y,CW,rh).fill(bg);
  if(r[5]===true){ doc.rect(M,y,3,rh).fill(C.sendero); }
  tx=M;
  r.slice(0,5).forEach((cell,ci)=>{
    let col=C.texto, fnt=F;
    if(ci===0 && r[5]===true){col=C.bosque;fnt=FB;}
    if(ci===4){ if(cell.startsWith('SÍ')){col=C.bosque;fnt=FB;} else if(cell.startsWith('NO')){col=C.rojo;fnt=FB;} else {col=C.naranja;} }
    txt(cell,tx+6,y+5.5,{size:8,color:col,font:fnt,width:cols[ci].w-8});
    tx+=cols[ci].w;
  });
  y+=rh;
});
doc.rect(M,y-19*rows.length,CW,19*rows.length).lineWidth(0.7).strokeColor(C.borde).stroke();
y+=6;
txt('Precios en su moneda original (USD salvo Harbiz/Pathway en €). Confianza ALTA en "no traen clientes" para los 8 de gestión. Profi.io cerró en dic-2025.',M,y,{size:7.4,color:C.suave,width:CW});

y+=22;
const half=(CW-gap)/2;
callout(M,y,half,'El espacio en blanco',
 'Demanda activa para el coach solo existe en modelos enterprise (BetterUp, CoachHub) donde el coach es contratado, no dueño de su cartera. Para el coach independiente, "software + trae clientes" casi no existe — y en español, nicho carrera, es prácticamente único.',
 C.bosque, C.verdeClaro);
callout(M+half+gap,y,half,'Oportunidad de timing',
 'Profi.io (US/terapeutas) cerró en dic-2025 y su base está migrando ahora. Simply.Coach es el rival vivo más directo con español nativo, pero es horizontal y no tiene informe de carrera con IA ni job-matching. El nicho carrera-ES sigue abierto.',
 C.azul, '#EAF1F6');

// ════════════ PÁGINA 5 — PRICING ════════════
newPage('3 · Pricing','¿Está bien el precio?');
y=94;
txt('Precio mensual representativo por plataforma (USD; €58≈$63, €89≈$96)',M,y,{font:FB,size:9.5,color:C.carbon});
y+=22;
y=hbars(M,y,CW,[
  {label:'Simply.Coach (Starter)',val:19,color:C.gris},
  {label:'Harbiz (entrada)',val:32,color:C.gris},
  {label:'CoachAccountable (5 cli.)',val:40,color:C.gris},
  {label:'Simply.Coach (Growth)',val:49,color:C.gris},
  {label:'Paperbell (plano)',val:57,color:C.azul},
  {label:'Pathway Basic',val:63,color:C.sendero,bold:true},
  {label:'Satori (Pro)',val:79,color:C.gris},
  {label:'Pathway Pro',val:96,color:C.bosque,bold:true,note:'techo de la banda — exige diferenciación clara (IA + marketplace)'},
],110,v=>'$'+v);
y+=8;
txt('Confianza ALTA/MEDIA según fuente. Precios "representativos" (planos o solo-coach); algunos escalan por nº de clientes.',M,y,{size:7.4,color:C.suave,width:CW});

y+=22;
txt('Poder adquisitivo: PIB per cápita PPA 2024 (España = 100) — World Bank / IMF',M,y,{font:FB,size:9.5,color:C.carbon});
y+=20;
y=hbars(M,y,CW,[
  {label:'España',val:100,color:C.bosque,bold:true},
  {label:'Chile',val:62,color:C.azul},
  {label:'Argentina',val:55,color:C.azul,note:'+ fricción FX/inflación: facturar en moneda local'},
  {label:'México',val:46,color:C.naranja},
  {label:'Colombia',val:38,color:C.naranja},
],100,v=>v+'%');

y+=14;
callout(M,y,CW,'Recomendación: pricing regional (práctica reconocida: Netflix, Spotify, JetBrains)',
 'España/Europa: mantener €58–89 (anclar más cerca de €58–69 si la profundidad de features no supera claramente a Paperbell/Simply.Coach). México/Colombia (PPA ~0,4): descuento ~40–55% en moneda local. Chile: ~35%. Argentina: precio en moneda local y evitar tarjeta en USD/€ por el impuesto FX y los tipos de cambio múltiples. Blindaje anti-arbitraje: exigir método de pago/dirección local. El % óptimo se fija con un test de precio, no con estos benchmarks.',
 C.naranja, C.amarilloClaro);

// ════════════ PÁGINA 6 — MÉTRICAS SAAS ════════════
newPage('4 · Métricas SaaS','¿Qué es "ir bien" en tu liga?');
y=94;
callout(M,y,CW,'Regla de oro',
 'Pathway es SaaS de BAJO TICKET ($50–100/mes) con trial SIN tarjeta. Esa esquina del SaaS tiene, por estructura, más churn y menor conversión de trial. No te midas contra cifras enterprise — te haría ver "rota" una empresa sana.',
 C.rojo, '#F8ECEA');
y+=68;

const Z_OK=C.sendero, Z_WARN=C.amanecer, Z_BAD='#E2A6A0';
// 4 medidores con zonas. La META va en la misma línea del título; ▼ = dónde deberías estar.
function gauge(x,y,w,title,zones,markerPct,metaLabel,note){
  txt(title,x,y,{font:FB,size:9,color:C.carbon,width:w-72});
  txt(metaLabel,x+w-72,y,{font:FB,size:8.5,color:C.bosque,width:72,align:'right'});
  const by=y+16, bh=11;
  let cxp=x;
  zones.forEach(z=>{ const zw=w*z.p; doc.rect(cxp,by,zw,bh).fill(z.c); cxp+=zw; });
  const mx=x+w*markerPct;
  doc.polygon([mx,by-2],[mx-4,by-8],[mx+4,by-8]).fill(C.carbon);
  doc.moveTo(mx,by).lineTo(mx,by+bh).lineWidth(1.5).strokeColor(C.carbon).stroke();
  if(note) doc.font(F).fontSize(7.2).fillColor(C.suave).text(note,x,by+bh+5,{width:w,height:24,lineBreak:true});
}
// leyenda de colores
function sw(xx,yy,c,t){ doc.rect(xx,yy,9,9).fill(c); txt(t,xx+12,yy+1,{size:7.5,color:C.suave}); }
txt('Cómo leer:',M,y,{font:FB,size:8,color:C.carbon});
sw(M+54,y-1,Z_OK,'zona sana'); sw(M+128,y-1,Z_WARN,'alerta'); sw(M+180,y-1,Z_BAD,'problema');
txt('▼ = dónde deberías apuntar',M+248,y,{size:7.5,color:C.carbon,font:FB});
y+=20;
const colW=(CW-gap)/2;
gauge(M,y,colW,'Churn mensual',[{p:0.45,c:Z_OK},{p:0.30,c:Z_WARN},{p:0.25,c:Z_BAD}],0.30,'meta ≤5%','Eje: 0% (izq) a 12%+ (der). Verde ≤5%, amarillo 6–8%, rojo doble dígito. Bajo ticket ronda 6%/mes (ChartMogul).');
gauge(M+colW+gap,y,colW,'Conversión trial→pago',[{p:0.30,c:Z_BAD},{p:0.30,c:Z_WARN},{p:0.40,c:Z_OK}],0.45,'media ~9%','Trial SIN tarjeta: media 8,9%, bueno 4–6%, genial 10–15%. Con tarjeta sería ~31% (no comparar).');
y+=82;
gauge(M,y,colW,'LTV : CAC (valor cliente ÷ costo captarlo)',[{p:0.40,c:Z_BAD},{p:0.20,c:Z_WARN},{p:0.40,c:Z_OK}],0.62,'meta ≥3:1','Por cada €1 en captar un coach, ganar ≥€3 en su vida. A €58–89/mes, CAC realista <€300–600.');
gauge(M+colW+gap,y,colW,'Payback de CAC (meses en recuperarlo)',[{p:0.55,c:Z_OK},{p:0.25,c:Z_WARN},{p:0.20,c:Z_BAD}],0.45,'meta ≤12m','Eje: 0 (izq) a 24+ meses (der). SMB self-serve recupera el CAC en 8–12 meses.');
y+=86;

txt('Dato accionable para retención',M,y,{font:FB,size:9.5,color:C.bosque});
y+=16;
y=hbars(M,y,CW,[
  {label:'Bajas en 1ros 90 días',val:43,color:C.rojo,bold:true,note:'el ciclo de mentoría de 4 semanas ES la ventana que define la retención'},
  {label:'NRR típico SMB',val:97,color:C.azul,note:'cerca o algo bajo 100% es normal en bajo ticket; no busques el 118% enterprise'},
],100,v=>v+'%');
y+=8;
callout(M,y+4,CW,'Las dos palancas que importan ahora',
 '(1) Clavar el onboarding y el primer ciclo de 4 semanas: ahí se va el 43% de las bajas de SMB. (2) Instrumentar desde el coach #1: activación, retención semana a semana y conversión trial→pago. Con pocos clientes, estas 3 métricas valen más que cualquier proyección.',
 C.bosque, C.verdeClaro);

// ════════════ PÁGINA 7 — ESTRATEGIA COLD START ════════════
newPage('5 · Estrategia','Cómo arrancar el marketplace');
y=94;
callout(M,y,CW,'La pregunta del huevo y la gallina — respuesta de la teoría (a16z, Lenny\'s, NFX)',
 'Sembrá primero la OFERTA (coaches): son el lado difícil, el que paga y el que escasea. El 80% de los marketplaces estudiados por Lenny\'s crecieron la oferta primero. Los candidatos son más abundantes y, en tu modelo, ya llegan a través del coach.',
 C.bosque, C.verdeClaro);
y+=70;

txt('HOJA DE RUTA EN 4 PASOS',M,y,{font:FB,size:10,color:C.bosque,characterSpacing:1});
y+=20;
const steps=[
  ['Paso 1','"Come for the tool"','Vendé el SaaS por su valor solo (informe IA, portal, CV/carta) — funciona con CERO marketplace. El pitch del trial NO es "te traigo clientes" sino "mejora los resultados de tus clientes actuales".'],
  ['Paso 2','UN nicho × UN país','Concentrá la "red atómica": coaches de carrera en tu mercado hispano más denso. Fitness y finanzas son redes separadas, no extensiones gratis — abrirlas solo cuando la primera se sostenga sola.'],
  ['Paso 3','Validá retención','Antes de invertir en matching, comprobá que los coaches QUIEREN la herramienta (retención semanal, uso real del portal). Sin eso, el marketplace es prematuro.'],
  ['Paso 4','"Stay for the network"','Recién con una bolsa densa de coaches activos, encendé el descubrimiento candidato→coach (patrón OpenTable / HoneyBook). La base instalada es tu oferta el día 1 — nunca enfrentás un cold start real.'],
];
steps.forEach((s,i)=>{
  const h=46;
  rrect(M,y,CW,h,8,C.blanco,C.borde,1);
  doc.rect(M,y,46,h).fill(i<2?C.sendero:C.bosque);
  // clip rounded left corner overlay
  txt(s[0].split(' ')[1],M+14,y+8,{font:FB,size:18,color:C.blanco});
  txt('PASO',M+13,y+30,{font:FB,size:7,color:C.niebla,characterSpacing:1});
  txt(s[1],M+58,y+8,{font:FB,size:11,color:C.carbon,width:CW-66});
  flow(s[2],M+58,y+23,CW-70,{size:8.5,color:C.suave});
  y+=h+8;
});

y+=2;
callout(M,y,CW,'Matiz honesto (confianza media)',
 'En tu modelo actual el candidato llega A TRAVÉS del coach (ya compró mentoría vía agencia). Un marketplace de descubrimiento candidato→coach es una EXPANSIÓN del modelo, no solo una feature. Si la meta de corto plazo es "más coaches pagando el SaaS", entonces es un juego SaaS puro y el marketplace es prematuro: clavá el tool y la concentración nicho/geo igual.',
 C.naranja, C.amarilloClaro);

// ════════════ PÁGINA 8 — RIESGOS + PREGUNTAS ════════════
newPage('Cierre','Riesgos, próximos pasos y preguntas');
y=94;
const colA=(CW-gap)/2;
txt('RIESGOS A VIGILAR',M,y,{font:FB,size:10,color:C.rojo,characterSpacing:1});
let ya=y+18;
const risks=[
  ['Seguridad de datos','Cerrar el gap de aislamiento por coach (RLS) ANTES de abrir registro masivo. Crítico con datos de clientes.'],
  ['Churn de bajo ticket','La liga $50–90/mes churnea más por estructura. La retención se gana en el 1er ciclo de 4 semanas.'],
  ['Dispersión','Multi-nicho + multi-país a la vez mata el foco. Una red atómica primero.'],
  ['Dependencia de agencia','Hoy los clientes llegan vía agencia externa. ¿Qué pasa si ese canal cambia?'],
];
risks.forEach(r=>{
  txt('» '+r[0],M,ya,{font:FB,size:9,color:C.carbon,width:colA});
  const re=flow(r[1],M+10,ya+12,colA-10,{size:8,color:C.suave});
  ya=re+10;
});

txt('PRÓXIMOS PASOS SUGERIDOS',M+colA+gap,y,{font:FB,size:10,color:C.bosque,characterSpacing:1});
let yb=y+18; const bx=M+colA+gap;
const steps2=[
  'Instrumentar 3 métricas: activación, retención semanal, trial→pago.',
  'Cerrar el gap de seguridad (RLS) en Supabase.',
  'Definir y testear pricing regional para LatAm.',
  'Concentrar adquisición en 1 nicho × 1 país.',
  'Validar retención del SaaS antes de construir matching.',
];
steps2.forEach((s,i)=>{
  doc.circle(bx+7,yb+7,7).fill(C.sendero); txt(String(i+1),bx+4,yb+3,{font:FB,size:8.5,color:C.blanco});
  doc.font(F).fontSize(8.8); const sh=doc.heightOfString(s,{width:colA-22});
  flow(s,bx+22,yb+1,colA-22,{size:8.8});
  yb+=Math.max(22,sh+12);
});

y=Math.max(ya,yb)+12;
txt('PREGUNTAS PARA EL MENTOR',M,y,{font:FB,size:10,color:C.carbon,characterSpacing:1});
y+=18;
const qs=[
  'Huevo y gallina: ¿lleno de coaches el directorio o traigo candidatos primero?',
  '¿Canal más barato para los primeros 20–50 coaches que pagan?',
  '¿Pricing regional España vs LatAm — cómo lo estructuro sin canibalizar?',
  '¿Qué métricas mínimas debería mirar ya, con tan pocos clientes?',
  '¿Foco en carrera primero, o multi-nicho (fitness/finanzas) ya?',
  '¿Esto es bootstrappeable o en algún punto necesito levantar capital?',
];
qs.forEach(q=>{
  rrect(M,y,CW,22,6,C.niebla,C.borde,0.8);
  txt('?',M+9,y+5,{font:FB,size:11,color:C.sendero});
  txt(q,M+26,y+6.5,{size:9,color:C.texto,width:CW-34});
  y+=27;
});

// ════════════ PÁGINA 9 — FUENTES ════════════
newPage('Anexo','Fuentes y metodología');
y=94;
txt('Metodología',M,y,{font:FB,size:11,color:C.bosque}); y+=16;
y=flow('Investigación multi-fuente (jun 2026): 5 ángulos, búsqueda web + verificación cruzada. Cifras del producto y pricing de Pathway = reales (del código). Datos de mercado y benchmarks = de las fuentes citadas, con nivel de confianza indicado. Proyecciones financieras = ilustrativas, a validar con un test real. Algunas páginas primarias bloquearon el acceso automático; esas cifras se corroboraron desde múltiples resúmenes independientes que citan el mismo dato primario.',
 M,y,CW,{size:9});
y+=16;
txt('Fuentes principales',M,y,{font:FB,size:11,color:C.bosque}); y+=16;
const srcs=[
 ['Mercado de coaching','ICF Global Coaching Study 2023 & 2025 (coachingfederation.org, PRNewswire)'],
 ['Career coaching / outplacement','Verified Market Reports, Mordor Intelligence, Business Research Insights'],
 ['Competencia','Pricing/features de Harbiz, CoachAccountable, Paperbell, Simply.Coach, Satori, Profi, Coaching.com (Capterra, GetApp, SourceForge, sitios oficiales)'],
 ['Poder adquisitivo','World Bank / IMF GDP per cápita PPA 2024 (vía Trading Economics, Worldometer)'],
 ['Pricing regional / PPA','getMonetizely, PayPro Global, ParityDeals; casos Netflix/Spotify/JetBrains'],
 ['Fricción FX Argentina','US State Dept Investment Climate 2025, EY, PwC, MercoPress'],
 ['Métricas SaaS','ChartMogul (churn por ARPA), Lenny\'s Newsletter / Kyle Poyar (trial conversion), OpenView (LTV:CAC), Optifai/SaaS Capital (NRR)'],
 ['Estrategia de marketplace','Andrew Chen "The Cold Start Problem" (a16z), Chris Dixon (cdixon.org), Lenny Rachitsky, NFX; casos OpenTable, HoneyBook'],
];
srcs.forEach(s=>{
  txt('•',M,y,{font:FB,size:9,color:C.sendero});
  txt(s[0],M+12,y,{font:FB,size:8.8,color:C.carbon,width:160});
  doc.font(F).fontSize(8.5); const seh=doc.heightOfString(s[1],{width:CW-175});
  flow(s[1],M+175,y,CW-175,{size:8.5,color:C.suave});
  y+=Math.max(15,seh+8);
});

y+=10;
callout(M,y,CW,'Aviso de honestidad para la conversación',
 'Pathway está en etapa muy temprana (pre/early-revenue, primeras coaches onboardeadas a mano). Lo correcto frente al mentor es presentar los datos reales tal cual y marcar lo estimado como estimado. Un buen mentor valora esa distinción y te dará mejores consejos por ella.',
 C.bosque, C.verdeClaro);

doc.end();
console.log('PDF generado en',out);
