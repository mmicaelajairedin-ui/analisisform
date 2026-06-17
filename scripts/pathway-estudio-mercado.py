# -*- coding: utf-8 -*-
"""Estudio de mercado y validacion de negocio - Pathway -> PDF unificado."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                 PageBreak, Flowable, KeepTogether)

# Paleta
BOSQUE=colors.HexColor("#2D6A4F"); BOSQUE_D=colors.HexColor("#1B4332")
LIGHT=colors.HexColor("#E8F5EE"); MID=colors.HexColor("#ACD4BB")
AMBER=colors.HexColor("#E9C46A"); TEXT=colors.HexColor("#1a1a1a")
MUTED=colors.HexColor("#777777"); GREY=colors.HexColor("#C9CFC9")
GREYD=colors.HexColor("#9aa39c"); REDC=colors.HexColor("#B23B3B")
ORANGE=colors.HexColor("#B5722A"); WHITE=colors.white
YELL=colors.HexColor("#E9C46A"); GREENZ=colors.HexColor("#7DB39A"); REDZ=colors.HexColor("#D89A95")

st=getSampleStyleSheet()
TITLE=ParagraphStyle('T',parent=st['Heading1'],textColor=BOSQUE_D,fontSize=24,leading=27,spaceAfter=4)
H1=ParagraphStyle('H1',parent=st['Heading1'],textColor=BOSQUE_D,fontSize=18,leading=22,spaceAfter=2)
SUB=ParagraphStyle('SUB',parent=st['Normal'],textColor=MUTED,fontSize=9.5,leading=12.5,spaceAfter=8)
H2=ParagraphStyle('H2',parent=st['Heading2'],textColor=BOSQUE,fontSize=13,leading=16,spaceBefore=6,spaceAfter=4)
CAP=ParagraphStyle('CAP',parent=st['Normal'],textColor=BOSQUE,fontSize=10.5,leading=13,spaceAfter=3,fontName='Helvetica-Bold')
BODY=ParagraphStyle('BODY',parent=st['Normal'],textColor=TEXT,fontSize=9.5,leading=13.5,spaceAfter=4)
BULL=ParagraphStyle('BULL',parent=BODY,leftIndent=11,spaceAfter=3)
SMALL=ParagraphStyle('SMALL',parent=st['Normal'],textColor=MUTED,fontSize=7.8,leading=10.5)
CELL=ParagraphStyle('CELL',parent=st['Normal'],textColor=TEXT,fontSize=8.2,leading=10.3)
CELLB=ParagraphStyle('CELLB',parent=CELL,fontName='Helvetica-Bold')
KNUM=ParagraphStyle('KNUM',parent=st['Normal'],textColor=BOSQUE,fontSize=19,leading=21,fontName='Helvetica-Bold',alignment=1)
KLBL=ParagraphStyle('KLBL',parent=st['Normal'],textColor=MUTED,fontSize=7.6,leading=9.5,alignment=1)
W=170*mm

class HBars(Flowable):
    def __init__(self,data,width=W,rowh=15,maxval=None,unit="$",fmt="{:.0f}",labelw=104):
        Flowable.__init__(self); self.data=data; self.width=width; self.rowh=rowh
        self.maxval=maxval or max(d[1] for d in data); self.unit=unit; self.fmt=fmt; self.labelw=labelw
        self.height=rowh*len(data)+4
    def draw(self):
        c=self.canv; labelw=self.labelw; barzone=self.width-labelw-70; y=self.height-self.rowh
        for (label,val,hi,note) in self.data:
            c.setFont("Helvetica",8.1); c.setFillColor(TEXT if hi else colors.HexColor("#444"))
            c.drawRightString(labelw-6,y+4,label)
            bw=max(2,barzone*(val/self.maxval))
            c.setFillColor(BOSQUE if hi else GREY); c.roundRect(labelw,y,bw,self.rowh-5,2,stroke=0,fill=1)
            c.setFont("Helvetica-Bold" if hi else "Helvetica",8.1); c.setFillColor(BOSQUE_D if hi else MUTED)
            c.drawString(labelw+bw+5,y+4,(self.unit+self.fmt.format(val)))
            if note:
                c.setFont("Helvetica-Bold",6.8); c.setFillColor(BOSQUE); c.drawString(labelw+bw+44,y+4,note)
            y-=self.rowh

class BenchBar(Flowable):
    """Track con zonas de color + marcador en la meta. zones=[(frac_end,color)] sobre 0..1"""
    def __init__(self,label,zones,target,target_lbl,width=W,height=30):
        Flowable.__init__(self); self.label=label; self.zones=zones; self.target=target
        self.target_lbl=target_lbl; self.width=width; self.height=height
    def draw(self):
        c=self.canv; x0=0; y=6; bw=self.width-150; h=9
        c.setFont("Helvetica-Bold",8.4); c.setFillColor(TEXT); c.drawString(0,self.height-9,self.label)
        bx=0; by=2
        prev=0
        for frac,col in self.zones:
            seg=bw*(frac-prev); c.setFillColor(col); c.rect(bx+bw*prev*0,by,0,0)  # noop keep
        # draw zones along a track starting at x=0
        prev=0
        for frac,col in self.zones:
            segx=bw*prev; segw=bw*(frac-prev); c.setFillColor(col); c.rect(segx,by,segw,h,stroke=0,fill=1); prev=frac
        # target marker
        tx=bw*self.target
        c.setFillColor(BOSQUE_D)
        c.setFont("Helvetica-Bold",7)
        # triangle
        c.saveState()
        from reportlab.graphics.shapes import Drawing  # not used; manual
        c.restoreState()
        p=c.beginPath(); p.moveTo(tx, by+h+1); p.lineTo(tx-4, by+h+7); p.lineTo(tx+4, by+h+7); p.close()
        c.setFillColor(BOSQUE_D); c.drawPath(p,fill=1,stroke=0)
        c.setFillColor(BOSQUE_D); c.setFont("Helvetica-Bold",8.2); c.drawString(bw+10,by+1,self.target_lbl)

class ValueMap(Flowable):
    def __init__(self,points,width=W,height=104*mm):
        Flowable.__init__(self); self.points=points; self.width=width; self.height=height
    def draw(self):
        c=self.canv; m=30; W0=self.width; H0=self.height
        x0,y0=m,m; x1,y1=W0-8,H0-12; midx=(x0+x1)/2; midy=(y0+y1)/2
        c.setFillColor(LIGHT); c.rect(midx,midy,x1-midx,y1-midy,stroke=0,fill=1)
        c.setStrokeColor(MID); c.setLineWidth(1); c.line(x0,y0,x0,y1); c.line(x0,y0,x1,y0)
        c.setDash(2,2); c.setStrokeColor(colors.HexColor("#DDE6E0")); c.line(midx,y0,midx,y1); c.line(x0,midy,x1,midy); c.setDash()
        c.setFont("Helvetica-Bold",8); c.setFillColor(MUTED)
        c.drawString(x0,y0-16,"Precio mas bajo"); c.drawRightString(x1,y0-16,"Precio mas alto")
        c.saveState(); c.translate(x0-16,y0); c.rotate(90)
        c.drawString(0,0,"Solo herramienta"); c.drawRightString(y1-y0,0,"Herramienta + TRAE CLIENTES"); c.restoreState()
        c.setFont("Helvetica-Oblique",7.5); c.setFillColor(BOSQUE); c.drawCentredString((midx+x1)/2,y1-9,"ZONA PATHWAY")
        for (px,py,label,kind) in self.points:
            cx=x0+(x1-x0)*px/100.0; cy=y0+(y1-y0)*py/10.0
            if kind in ("pw","pwp"):
                if kind=="pw":
                    c.setFillColor(BOSQUE); c.setStrokeColor(WHITE); c.setLineWidth(1.5); c.circle(cx,cy,5,stroke=1,fill=1); c.setFillColor(BOSQUE_D)
                else:
                    c.setStrokeColor(BOSQUE); c.setLineWidth(1.6); c.setFillColor(WHITE); c.circle(cx,cy,5,stroke=1,fill=1); c.setFillColor(BOSQUE)
                c.setFont("Helvetica-Bold",8); c.drawString(cx+8,cy-3,label)
            else:
                c.setFillColor(GREYD); c.circle(cx,cy,3,stroke=0,fill=1); c.setFont("Helvetica",7); c.setFillColor(colors.HexColor("#666")); c.drawString(cx+5,cy-2,label)

def vtxt(v): return {"si":("Si",BOSQUE),"no":("NO",REDC),"part":("Parcial",ORANGE),"add":("Extra $",ORANGE)}[v]

def niche_table(header_leader,rows):
    data=[[Paragraph("<b>Funcion</b>",CELLB),Paragraph("<b>Pathway</b>",CELLB),Paragraph("<b>"+header_leader+"</b>",CELLB)]]
    for f,pw,ld in rows:
        data.append([Paragraph(f,CELL),Paragraph(vtxt(pw)[0],CELLB),Paragraph(vtxt(ld)[0],CELL)])
    t=Table(data,colWidths=[88*mm,28*mm,54*mm])
    st2=[('BACKGROUND',(0,0),(-1,0),BOSQUE_D),('TEXTCOLOR',(0,0),(-1,0),WHITE),
         ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(1,0),(2,-1),'CENTER'),
         ('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,colors.HexColor("#F6FAF7")]),
         ('GRID',(0,0),(-1,-1),0.5,colors.HexColor("#E0E8E3")),
         ('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3),('LEFTPADDING',(0,0),(-1,-1),6)]
    for i,(f,pw,ld) in enumerate(rows,start=1):
        st2.append(('TEXTCOLOR',(1,i),(1,i),vtxt(pw)[1])); st2.append(('TEXTCOLOR',(2,i),(2,i),vtxt(ld)[1]))
    t.setStyle(TableStyle(st2)); return t

def kpi_cards(cards):
    row=[]
    for num,lbl in cards:
        row.append(Table([[Paragraph(num,KNUM)],[Paragraph(lbl,KLBL)]],
                   colWidths=[W/4-4], rowHeights=[24,22]))
        row[-1].setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),0.5,MID),
            ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2)]))
    outer=Table([row],colWidths=[W/4]*4)
    outer.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),2),('RIGHTPADDING',(0,0),(-1,-1),2),
        ('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
    return outer

def section_header(num,title):
    t=Table([[Paragraph("<font color='white'><b>"+num+"</b></font>",ParagraphStyle('s',parent=BODY,textColor=WHITE,fontSize=11)),
              Paragraph("<b>"+title+"</b>",ParagraphStyle('s2',parent=BODY,textColor=BOSQUE_D,fontSize=13))]],
             colWidths=[10*mm,W-10*mm])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(0,0),BOSQUE),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),('LEFTPADDING',(0,0),(0,0),0),
        ('ALIGN',(0,0),(0,0),'CENTER')]))
    return t

def build(path):
    doc=SimpleDocTemplate(path,pagesize=A4,topMargin=15*mm,bottomMargin=14*mm,leftMargin=20*mm,rightMargin=20*mm,
                          title="Pathway - Estudio de mercado y validacion de negocio")
    def foot(canvas,docu):
        canvas.saveState(); canvas.setFont("Helvetica",7); canvas.setFillColor(MUTED)
        canvas.drawString(20*mm,8*mm,"Pathway · Estudio de mercado y validacion de negocio")
        canvas.drawRightString(A4[0]-20*mm,8*mm,"Jun 2026 · confidencial · pag. %d"%docu.page)
        canvas.restoreState()
    E=[]
    # PORTADA
    E.append(Spacer(1,8))
    E.append(Paragraph("Estudio de mercado y validacion de negocio", TITLE))
    E.append(Paragraph("SaaS para coaches de carrera (multi-nicho) · Espana + Latinoamerica · Preparado para reunion con mentor de finanzas/negocios · 16 jun 2026", SUB))
    E.append(Paragraph("El negocio de un vistazo", H2))
    E.append(Paragraph("Pathway es un SaaS B2B2C: le vende herramientas con IA + portal del cliente a coaches (carrera, fitness, finanzas). El coach paga (EUR 58-89/mes); el candidato no. <b>Diferencial: un marketplace que TRAE clientes al coach.</b>", BODY))
    E.append(Spacer(1,4))
    E.append(kpi_cards([("USD 5,34 B","Mercado global de coaching 2025 (+17% vs 2023)"),
                        ("122.974","Coaches en el mundo (+15% en 2 anos, ICF)"),
                        ("~53%","Coaches sin plataforma = la oportunidad"),
                        ("0 de 8","Competidores que TRAEN clientes")]))
    E.append(Spacer(1,8))
    E.append(_box("<b>¿DONDE ESTAMOS PARADOS HOY?</b> (lo concreto, mas alla del mercado)<br/>"
        "<b>Etapa:</b> producto construido y ancho (3 nichos, panel, portal, app Android, marketplace), pero <b>0 coaches pagando aun</b>. Estamos en el <b>0 -> 1</b>: conseguir las primeras que pagan. El reto no es el producto, es la traccion.<br/>"
        "<b>El camino:</b> Idea [hecho] -> Producto [hecho] -> <b>&gt;&gt; PRIMERAS QUE PAGAN (estamos ACA)</b> -> Formula repetible -> Escala.<br/>"
        "<b>Tus 4 numeros a mirar (hoy ~0):</b> coaches que pagan · coaches en prueba · % que de prueba pasa a pago · % que sigue al mes 2. El mercado (USD 5,34 B, etc.) es el FONDO DE CANCHA, no tu posicion."))
    E.append(Spacer(1,8))
    E.append(Paragraph("Los 5 hallazgos", CAP))
    for t in [
      "<b>1. Mercado grande y en alza con una grieta.</b> El coaching crece a doble digito y la mitad de los coaches aun no usa software. El nicho carrera es el segmento mas grande de plataformas (~28%).",
      "<b>2. Tu diferencial se confirma.</b> Ninguno de los 8 competidores (Harbiz, CoachAccountable, Paperbell, Simply.Coach, Satori...) es un marketplace que genere demanda para el coach independiente. Todos son software de gestion.",
      "<b>3. Pricing bien ubicado, pero LatAm pide ajuste.</b> EUR 58 a la par de los lideres; EUR 89 en el techo. Un coach latino tiene 38-62% del poder adquisitivo de uno espanol.",
      "<b>4. Empeza por el coach, en UN nicho y UN pais.</b> La teoria de marketplaces (a16z, Lenny's) es unanime: sembra primero la oferta con valor 'single-player', concentra un nicho x geografia.",
      "<b>5. Medi contra benchmarks de bajo ticket, no enterprise.</b> SaaS de EUR 50-90/mes con trial sin tarjeta: churn 3-5%/mes es sano, conversion de trial ~9% es la media a batir.",
    ]:
        E.append(Paragraph(t, BULL))
    E.append(Spacer(1,4))
    E.append(_box("<b>Veredicto en una linea:</b> 'Software de gestion + genera demanda, para coaches de carrera independientes, en espanol' es un cruce practicamente desocupado. La oportunidad es real; el reto no es el producto, es conseguir y retener a los primeros 10-20 coaches que pagan."))

    # 1 MERCADO
    E.append(PageBreak()); E.append(section_header("1","Tamano de mercado: que tan grande es la torta")); E.append(Spacer(1,6))
    E.append(Paragraph("Crecimiento del mercado global de coaching (ingresos, USD B) — fuente ICF", CAP))
    E.append(HBars([("2019",2.85,False,""),("2022",4.56,False,""),("2025",5.34,True,"+17% vs 2023")],
                   rowh=17,unit="$",fmt="{:.2f} B",labelw=60))
    E.append(Paragraph("Confianza ALTA. ICF cuenta practicantes e ingresos de actividad de coaching (conservador vs reportes comerciales).", SMALL))
    E.append(Spacer(1,6))
    E.append(kpi_cards([("USD 1,43 B","Career coaching 2025 (-> 2,5 B en 2034)"),
                        ("USD 4,6 B","Mercado de outplacement 2024 (CAGR ~6%)"),
                        ("87%","Coaches usan videollamada (online = norma)"),
                        ("~28%","Carrera = mayor segmento de plataformas")]))
    E.append(Spacer(1,8))
    E.append(Paragraph("Tarifa media por sesion de 1 h (USD) — clave para el pricing regional", CAP))
    E.append(HBars([("Europa Occ.",277,False,""),("Norteamerica",272,False,""),("LatAm y Caribe",114,True,"~41% de la tarifa europea")],
                   rowh=17,unit="$",fmt="{:.0f}",labelw=80))
    E.append(Spacer(1,4))
    E.append(_box("<b>Lectura para el mentor:</b> el anclaje defendible es ICF (~123.000 coaches, USD 5,34 B en 2025). Las cifras de 'mercado de software de coaching' que circulan (USD 1,5-3,7 B el MISMO ano) tienen definiciones inconsistentes: usarlas con pinzas. El dato mas accionable: ~53% de coaches no tiene plataforma -> es adopcion, no creacion de categoria."))

    # 2 COMPETENCIA
    E.append(PageBreak()); E.append(section_header("2","Competencia: 8 plataformas analizadas")); E.append(Spacer(1,5))
    E.append(Paragraph("La pregunta clave: ¿traen clientes nuevos al coach?", CAP))
    comp=[["Plataforma","Precio/mes","Foco","Espanol","Trae clientes?"],
        ["Harbiz","~EUR 30+","Fitness (Madrid)","Si","NO"],
        ["CoachAccountable","$20-120","General/negocios","No","NO"],
        ["Paperbell","$57 plano","General","No","NO"],
        ["Simply.Coach","$19-69","General + verticales","Si","NO"],
        ["Satori","$33-124","General / ICF","No","NO"],
        ["CoachPilot","$35-100","Fitness/IA","No","NO"],
        ["Profi.io","cerro","Terapeutas/equipos","No","- (cerro dic-25)"],
        ["Coaching.com","listado +15-25%","General","No","Directorio pasivo"],
        ["PATHWAY","EUR 58 / 89","Carrera + IA (multi)","Si","SI - marketplace"]]
    ct=Table(comp,colWidths=[30*mm,26*mm,40*mm,18*mm,40*mm])
    cstyle=[('BACKGROUND',(0,0),(-1,0),BOSQUE_D),('TEXTCOLOR',(0,0),(-1,0),WHITE),('FONT',(0,0),(-1,0),'Helvetica-Bold',8),
        ('FONT',(0,1),(-1,-1),'Helvetica',8),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('GRID',(0,0),(-1,-1),0.5,colors.HexColor("#E0E8E3")),('ROWBACKGROUNDS',(0,1),(-1,-2),[WHITE,colors.HexColor("#F6FAF7")]),
        ('TOPPADDING',(0,0),(-1,-1),3.2),('BOTTOMPADDING',(0,0),(-1,-1),3.2),('LEFTPADDING',(0,0),(-1,-1),5)]
    for i in range(1,9): cstyle.append(('TEXTCOLOR',(4,i),(4,i),REDC if comp[i][4]=="NO" else MUTED))
    cstyle += [('BACKGROUND',(0,9),(-1,9),LIGHT),('FONT',(0,9),(-1,9),'Helvetica-Bold',8),
        ('TEXTCOLOR',(4,9),(4,9),BOSQUE),('TEXTCOLOR',(0,9),(0,9),BOSQUE_D),('LINEABOVE',(0,9),(-1,9),1,BOSQUE)]
    ct.setStyle(TableStyle(cstyle)); E.append(ct)
    E.append(Paragraph("Precios en su moneda original. Confianza ALTA en 'no traen clientes' para los 8 de gestion. Profi.io cerro en dic-2025.", SMALL))
    E.append(Spacer(1,6))
    two=Table([[_mini("El espacio en blanco","Demanda activa para el coach solo existe en modelos enterprise (BetterUp, CoachHub) donde el coach es contratado, no dueno de su cartera. Para el coach independiente, 'software + trae clientes' casi no existe — y en espanol, nicho carrera, es practicamente unico."),
                _mini("Oportunidad de timing","Profi.io (US) cerro en dic-2025 y su base esta migrando. Simply.Coach es el rival vivo mas directo con espanol nativo, pero es horizontal: sin informe de carrera con IA ni job-matching. El nicho carrera-ES sigue abierto.")]],
               colWidths=[W/2-3,W/2-3])
    two.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)]))
    E.append(two)

    # 3 PRICING
    E.append(PageBreak()); E.append(section_header("3","Pricing: ¿esta bien el precio?")); E.append(Spacer(1,6))
    E.append(Paragraph("Precio mensual representativo por plataforma (USD; EUR 58~$63, EUR 89~$96)", CAP))
    E.append(HBars([("Simply.Coach Start",19,False,""),("Harbiz (entrada)",32,False,""),("CoachAccountable",40,False,""),
        ("Simply.Coach Growth",49,False,""),("Paperbell",57,False,""),("Pathway Basic",63,True,""),
        ("Satori Pro",79,False,""),("Pathway Pro",96,True,"techo de banda")],rowh=15))
    E.append(Spacer(1,6))
    E.append(Paragraph("Poder adquisitivo: PIB per capita PPA 2024 (Espana = 100) — World Bank/IMF", CAP))
    E.append(HBars([("Espana",100,True,""),("Chile",62,False,""),("Argentina",55,False,"+ friccion FX"),
        ("Mexico",46,False,""),("Colombia",38,False,"")],rowh=15,unit="",fmt="{:.0f}%",labelw=70))
    E.append(Spacer(1,4))
    E.append(_box("<b>Recomendacion — pricing regional</b> (practica de Netflix/Spotify/JetBrains): Espana/Europa, mantener EUR 58-89 (anclar cerca de 58-69 si la profundidad de features no supera a Paperbell/Simply.Coach). Mexico/Colombia (PPA ~0,4): descuento ~40-55% en moneda local. Chile ~35%. Argentina: precio en moneda local, evitar tarjeta en USD/EUR por impuesto FX. Blindaje antiarbitraje: exigir metodo de pago/direccion local. El % optimo se fija con un test de precio."))

    # 4 METRICAS SAAS
    E.append(PageBreak()); E.append(section_header("4","Metricas SaaS: ¿que es 'ir bien' en tu liga?")); E.append(Spacer(1,5))
    E.append(_box("<b>Regla de oro:</b> Pathway es SaaS de BAJO TICKET ($50-100/mes) con trial SIN tarjeta. Esa esquina tiene, por estructura, mas churn y menor conversion de trial. No te midas contra cifras enterprise — te harian ver 'rota' una empresa sana."))
    E.append(Spacer(1,6))
    E.append(Paragraph("Donde apuntar (marcador = meta)", CAP))
    E.append(BenchBar("Churn mensual  (verde <=5%, amarillo 6-8%, rojo doble digito)",
        [(0.42,GREENZ),(0.67,YELL),(1.0,REDZ)],0.42,"meta <=5%"))
    E.append(BenchBar("Conversion trial->pago, SIN tarjeta  (media 8,9%; genial 10-15%)",
        [(0.45,REDZ),(0.75,YELL),(1.0,GREENZ)],0.6,"media ~9%"))
    E.append(BenchBar("Payback de CAC  (SMB self-serve recupera en 8-12 meses)",
        [(0.5,GREENZ),(0.75,YELL),(1.0,REDZ)],0.5,"meta <=12m"))
    E.append(Spacer(1,5))
    met=[["Metrica","Meta","Nota"],
        ["LTV : CAC","≥ 3 : 1","Por cada EUR 1 en captar un coach, ganar >=EUR 3 en su vida. A EUR 58-89/mes, CAC realista < EUR 300-600."],
        ["Bajas en 1ros 90 dias","43% (SMB)","El ciclo de mentoria de 4 semanas ES la ventana que define la retencion."],
        ["NRR tipico SMB","97%","Cerca de 100% es normal en bajo ticket; no busques el 118% enterprise."]]
    mt=Table(met,colWidths=[34*mm,24*mm,112*mm])
    mt.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),BOSQUE_D),('TEXTCOLOR',(0,0),(-1,0),WHITE),('FONT',(0,0),(-1,0),'Helvetica-Bold',8),
        ('FONT',(0,1),(-1,-1),'Helvetica',8.2),('FONT',(0,1),(1,-1),'Helvetica-Bold',8.2),('TEXTCOLOR',(1,1),(1,-1),BOSQUE),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('GRID',(0,0),(-1,-1),0.5,colors.HexColor("#E0E8E3")),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,colors.HexColor("#F6FAF7")]),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),('LEFTPADDING',(0,0),(-1,-1),6)]))
    E.append(mt)
    E.append(Spacer(1,4))
    E.append(_box("<b>Las dos palancas que importan ahora:</b> (1) Clavar el onboarding y el primer ciclo de 4 semanas: ahi se va el 43% de las bajas. (2) Instrumentar desde el coach #1: activacion, retencion semana a semana y conversion trial->pago. Con pocos clientes, estas 3 metricas valen mas que cualquier proyeccion."))

    # 5 ESTRATEGIA
    E.append(PageBreak()); E.append(section_header("5","Estrategia: como arrancar el marketplace")); E.append(Spacer(1,6))
    E.append(_box("<b>Huevo y gallina (a16z, Lenny's, NFX):</b> sembra primero la OFERTA (coaches): son el lado dificil, el que paga y el que escasea. El 80% de los marketplaces que estudio Lenny's crecieron la oferta primero. Los candidatos son mas abundantes y, en tu modelo, ya llegan via el coach."))
    E.append(Spacer(1,6))
    E.append(Paragraph("Hoja de ruta en 4 pasos", CAP))
    steps=[("1","Come for the tool","Vende el SaaS por su valor solo (informe IA, portal, CV/carta) — funciona con CERO marketplace. El pitch del trial NO es 'te traigo clientes' sino 'mejora los resultados de tus clientes actuales'."),
           ("2","UN nicho x UN pais","Concentra la 'red atomica': coaches de carrera en tu mercado hispano mas denso. Fitness y finanzas son redes separadas, no extensiones gratis."),
           ("3","Valida retencion","Antes de invertir en matching, comproba que los coaches QUIEREN la herramienta (retencion semanal, uso real del portal). Sin eso, el marketplace es prematuro."),
           ("4","Stay for the network","Recien con una bolsa densa de coaches activos, enciende el descubrimiento candidato->coach (patron OpenTable/HoneyBook). La base instalada es tu oferta el dia 1.")]
    sdata=[]
    for n,t,d in steps:
        sdata.append([Paragraph("<font color='white'><b>"+n+"</b></font>",ParagraphStyle('n',parent=BODY,textColor=WHITE,fontSize=13,alignment=1)),
                      Paragraph("<b>"+t+"</b><br/>"+d,BODY)])
    sttab=Table(sdata,colWidths=[12*mm,W-12*mm])
    sttab.setStyle(TableStyle([('BACKGROUND',(0,0),(0,-1),BOSQUE),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('ROWBACKGROUNDS',(1,0),(1,-1),[WHITE,LIGHT]),('GRID',(0,0),(-1,-1),3,WHITE),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LEFTPADDING',(1,0),(1,-1),9)]))
    E.append(sttab)
    E.append(Spacer(1,4))
    E.append(_box("<b>Matiz honesto (confianza media):</b> en tu modelo actual el candidato llega A TRAVES del coach (ya compro mentoria via agencia). Un marketplace de descubrimiento candidato->coach es una EXPANSION del modelo, no solo una feature. Si la meta de corto plazo es 'mas coaches pagando el SaaS', es un juego SaaS puro y el marketplace es prematuro: clava el tool y la concentracion nicho/geo igual."))

    # 6 DESVENTAJAS POR NICHO
    E.append(PageBreak()); E.append(section_header("6","Donde estamos en DESVENTAJA, por nicho")); E.append(Spacer(1,5))
    E.append(Paragraph("Verde = lo tenemos / a la par · Naranja = parcial · Rojo = gap. 'Lideres' = especialistas del nicho.", BODY))
    E.append(Paragraph("FITNESS — vs Trainerize / TrueCoach / Everfit / Harbiz", CAP))
    E.append(niche_table("Lideres fitness",[
        ("Gestion de clientes, agenda y cobros","si","si"),
        ("App movil propia (Android ya; iOS en camino)","part","si"),
        ("Ejercicios con preview + descripcion","part","si"),
        ("Sync wearables (Apple Health, Garmin, Fitbit)","no","si"),
        ("Conteo de macros/calorias con base de alimentos","no","si"),
        ("Planes auto-generados por IA (ver nota)","part","si"),
        ("Antropometria detallada (grasa, musculo, IMO)","si","part"),
        ("Directorio que TRAE clientes","si","no")]))
    E.append(Paragraph("<b>Lectura:</b> estamos mas cerca de lo que parecia. Ya tenemos <b>app Android</b> (iOS en camino) y <b>ejercicios con preview y descripcion</b>. Falta vs los especialistas: iOS, biblioteca mas grande de videos, sync con wearables y conteo de macros. <b>Nota IA:</b> NO auto-generamos los planes con IA a proposito — del otro lado hay un coach real; la IA asiste (CV, informes, categorizacion), no reemplaza. Ese es el angulo: humano + herramientas, no un bot.", SMALL))
    E.append(Spacer(1,5))
    E.append(Paragraph("FINANZAS — vs YNAB / Monarch / RightCapital", CAP))
    E.append(niche_table("Lideres finanzas",[
        ("Presupuesto, diagnostico y objetivos","si","si"),
        ("Categorizacion de gastos con IA","si","si"),
        ("Sync bancaria automatica","no","si"),
        ("Patrimonio neto + inversiones en vivo","part","si"),
        ("App movil para registrar gastos","no","si"),
        ("Dashboard colaborativo coach-cliente","si","part"),
        ("Directorio que TRAE clientes","si","no")]))
    E.append(Paragraph("<b>Lectura:</b> el nicho mas parejo. Gran gap = <b>sync bancaria</b>, pero la categorizacion con IA ya la tenemos. Coaching financiero es mercado menos maduro: competimos bien.", SMALL))
    E.append(PageBreak())
    E.append(Paragraph("CARRERA — vs Jobscan / Teal / Huntr", CAP))
    E.append(niche_table("Lideres carrera",[
        ("CV con IA + carta de presentacion","si","si"),
        ("Optimizacion ATS profunda (vs la oferta)","part","si"),
        ("Extension de navegador para guardar empleos","no","si"),
        ("Tracker de postulaciones (estados, contactos)","part","si"),
        ("Simulador de entrevistas","si","si"),
        ("Analisis de perfil de LinkedIn","si","part"),
        ("Directorio que TRAE clientes","si","no")]))
    E.append(Paragraph("<b>Lectura:</b> tenemos lo central (CV, carta, entrevistas, LinkedIn) pero faltan piezas: <b>extension de navegador, tracker de postulaciones y ATS mas profundo</b>. Ventaja: en carrera no existe un 'todo en uno para el coach' como en fitness.", SMALL))
    E.append(Spacer(1,8))
    E.append(Paragraph("Mapa de valor (precio vs 'trae clientes')", CAP))
    E.append(ValueMap([(16,1.2,"Simply.Coach","c"),(20,1.6,"CoachAccountable","c"),(23,2.4,"Trainerize","c"),
        (26,2.0,"TrueCoach","c"),(40,2.8,"Harbiz","c"),(39,2.2,"Satori","c"),(57,2.6,"Paperbell","c"),
        (63,8.2,"Basic hoy","pw"),(96,9.0,"Pro hoy","pw"),(39,8.2,"Basic prop.","pwp"),(79,9.0,"Pro prop.","pwp")]))

    # 7 CIERRE
    E.append(PageBreak()); E.append(section_header("7","Cierre: riesgos, proximos pasos y preguntas")); E.append(Spacer(1,6))
    risks=[("Seguridad de datos","Cerrar el gap de aislamiento por coach (RLS) ANTES de abrir registro masivo. Critico con datos de clientes."),
           ("Churn de bajo ticket","La liga $50-90/mes churnea mas por estructura. La retencion se gana en el 1er ciclo de 4 semanas."),
           ("Dispersion","Multi-nicho + multi-pais a la vez mata el foco. Una red atomica primero."),
           ("Dependencia de agencia","Hoy los clientes llegan via agencia externa. ¿Que pasa si ese canal cambia?")]
    rdata=[[Paragraph("<b>"+a+"</b>",BODY),Paragraph(b,BODY)] for a,b in risks]
    rt=Table([[Paragraph("<font color='white'><b>Riesgos a vigilar</b></font>",ParagraphStyle('x',parent=BODY,textColor=WHITE,fontSize=10)),""]]+rdata,colWidths=[42*mm,W-42*mm])
    rt.setStyle(TableStyle([('SPAN',(0,0),(-1,0)),('BACKGROUND',(0,0),(-1,0),BOSQUE),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,LIGHT]),('GRID',(0,1),(-1,-1),0.5,colors.HexColor("#E0E8E3")),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LEFTPADDING',(0,0),(-1,-1),8)]))
    E.append(rt); E.append(Spacer(1,8))
    E.append(Paragraph("Proximos pasos sugeridos", CAP))
    for s in ["Instrumentar 3 metricas: activacion, retencion semanal, trial->pago.",
              "Cerrar el gap de seguridad (RLS) en Supabase.",
              "Definir y testear pricing regional para LatAm.",
              "Concentrar adquisicion en 1 nicho x 1 pais.",
              "Validar retencion del SaaS antes de construir matching."]:
        E.append(Paragraph("• "+s, BULL))
    E.append(Spacer(1,6))
    E.append(Paragraph("Preguntas para el mentor", CAP))
    for q in ["Huevo y gallina: ¿lleno de coaches el directorio o traigo candidatos primero?",
              "¿Canal mas barato para los primeros 20-50 coaches que pagan?",
              "¿Pricing regional Espana vs LatAm — como lo estructuro sin canibalizar?",
              "¿Que metricas minimas deberia mirar ya, con tan pocos clientes?",
              "¿Foco en carrera primero, o multi-nicho (fitness/finanzas) ya?",
              "¿Esto es bootstrappeable o en algun punto necesito levantar capital?"]:
        E.append(Paragraph("? "+q, BULL))

    # ANEXO
    E.append(PageBreak()); E.append(section_header("A","Anexo: fuentes y metodologia")); E.append(Spacer(1,6))
    E.append(Paragraph("Metodologia", CAP))
    E.append(Paragraph("Investigacion multi-fuente (jun 2026): busqueda web + verificacion cruzada. Cifras del producto y pricing de Pathway = reales (del codigo). Datos de mercado y benchmarks = de las fuentes citadas, con nivel de confianza indicado. Proyecciones = ilustrativas, a validar con un test real. Algunas paginas primarias bloquearon acceso automatico; esas cifras se corroboraron desde multiples resumenes independientes que citan el mismo dato primario.", BODY))
    E.append(Paragraph("Fuentes principales", CAP))
    for s in ["Mercado de coaching: ICF Global Coaching Study 2023 y 2025 (coachingfederation.org, PRNewswire).",
              "Career coaching / outplacement: Verified Market Reports, Mordor Intelligence, Business Research Insights.",
              "Competencia: pricing/features de Harbiz, CoachAccountable, Paperbell, Simply.Coach, Satori, Profi, Coaching.com (Capterra, GetApp, sitios oficiales).",
              "Features por nicho 2026: Trainerize, TrueCoach, Everfit (trainerize.com, quickcoach.fit); Jobscan, Teal, Huntr (jobscan.co); software financiero (simply.coach, coupler.io).",
              "Poder adquisitivo: World Bank / IMF GDP per capita PPA 2024 (Trading Economics, Worldometer).",
              "Pricing regional / PPA: getMonetizely, PayPro Global, ParityDeals; casos Netflix/Spotify/JetBrains.",
              "Metricas SaaS: ChartMogul (churn), Lenny's Newsletter / Kyle Poyar (trial), OpenView (LTV:CAC), SaaS Capital (NRR).",
              "Estrategia de marketplace: A. Chen 'The Cold Start Problem' (a16z), Chris Dixon, Lenny Rachitsky, NFX; casos OpenTable, HoneyBook."]:
        E.append(Paragraph("• "+s, BULL))
    E.append(Spacer(1,4))
    E.append(_box("<b>Aviso de honestidad:</b> Pathway esta en etapa muy temprana (pre/early-revenue, primeras coaches onboardeadas a mano). Lo correcto frente al mentor es presentar los datos reales tal cual y marcar lo estimado como estimado. Un buen mentor valora esa distincion."))

    doc.build(E,onFirstPage=foot,onLaterPages=foot)

def _box(html):
    t=Table([[Paragraph(html,BODY)]],colWidths=[W])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),0.7,BOSQUE),
        ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    return t

def _mini(title,body):
    t=Table([[Paragraph("<b>"+title+"</b>",CAP)],[Paragraph(body,BODY)]],colWidths=[W/2-8])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor("#F6FAF7")),('BOX',(0,0),(-1,-1),0.5,MID),
        ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    return t

if __name__=="__main__":
    build("docs/pathway-estudio-mercado.pdf"); print("OK")
