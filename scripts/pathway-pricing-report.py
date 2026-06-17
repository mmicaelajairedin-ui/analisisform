# -*- coding: utf-8 -*-
"""Informe visual: precios + posicionamiento + desventajas por nicho -> PDF."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                 PageBreak, Flowable)

BOSQUE = colors.HexColor("#2D6A4F"); BOSQUE_D = colors.HexColor("#1B4332")
LIGHT = colors.HexColor("#E8F5EE"); MID = colors.HexColor("#ACD4BB")
AMBER = colors.HexColor("#E9C46A"); TEXT = colors.HexColor("#1a1a1a")
MUTED = colors.HexColor("#777777"); GREY = colors.HexColor("#C9CFC9")
GREYD = colors.HexColor("#9aa39c"); REDC = colors.HexColor("#B23B3B")
ORANGE = colors.HexColor("#B5722A"); WHITE = colors.white

st = getSampleStyleSheet()
H1=ParagraphStyle('H1',parent=st['Heading1'],textColor=BOSQUE_D,fontSize=19,leading=23,spaceAfter=2)
SUB=ParagraphStyle('SUB',parent=st['Normal'],textColor=MUTED,fontSize=9.5,leading=12,spaceAfter=9)
H2=ParagraphStyle('H2',parent=st['Heading2'],textColor=BOSQUE,fontSize=13,leading=16,spaceBefore=6,spaceAfter=4)
CAP=ParagraphStyle('CAP',parent=st['Normal'],textColor=BOSQUE,fontSize=10.5,leading=13,spaceAfter=2,fontName='Helvetica-Bold')
BODY=ParagraphStyle('BODY',parent=st['Normal'],textColor=TEXT,fontSize=9.5,leading=13.5,spaceAfter=4)
SMALL=ParagraphStyle('SMALL',parent=st['Normal'],textColor=MUTED,fontSize=7.8,leading=10.5)
BULL=ParagraphStyle('BULL',parent=BODY,leftIndent=11,spaceAfter=3)
CELL=ParagraphStyle('CELL',parent=st['Normal'],textColor=TEXT,fontSize=8.3,leading=10.5)
CELLB=ParagraphStyle('CELLB',parent=CELL,fontName='Helvetica-Bold')
W = 170*mm

class HBars(Flowable):
    def __init__(self,data,width=W,rowh=15,maxval=None,unit="$",fmt="{:.0f}"):
        Flowable.__init__(self); self.data=data; self.width=width; self.rowh=rowh
        self.maxval=maxval or max(d[1] for d in data); self.unit=unit; self.fmt=fmt
        self.height=rowh*len(data)+6
    def draw(self):
        c=self.canv; labelw=96; barzone=self.width-labelw-66
        y=self.height-self.rowh
        for (label,val,hi,note) in self.data:
            c.setFont("Helvetica",8.2); c.setFillColor(TEXT if hi else colors.HexColor("#444"))
            c.drawRightString(labelw-6,y+4,label)
            bw=max(2,barzone*(val/self.maxval))
            c.setFillColor(BOSQUE if hi else GREY); c.roundRect(labelw,y,bw,self.rowh-5,2,stroke=0,fill=1)
            c.setFont("Helvetica-Bold" if hi else "Helvetica",8.2); c.setFillColor(BOSQUE_D if hi else MUTED)
            c.drawString(labelw+bw+5,y+4,(self.unit+self.fmt.format(val)))
            if note:
                c.setFont("Helvetica-Bold",7); c.setFillColor(BOSQUE); c.drawString(labelw+bw+40,y+4,note)
            y-=self.rowh

class ValueMap(Flowable):
    def __init__(self,points,width=W,height=110*mm):
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
        c.setFont("Helvetica-Oblique",7.5); c.setFillColor(BOSQUE); c.drawCentredString((midx+x1)/2,y1-9,"ZONA PATHWAY (mas valor)")
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

def val_txt(v):
    return {"si":("Si",BOSQUE),"no":("No",REDC),"part":("Parcial",ORANGE),"add":("Extra $",ORANGE)}[v]

def niche_table(header_leader, rows):
    """rows = [(feature, pathway_val, leader_val)]"""
    data=[[Paragraph("<b>Funcion</b>",CELLB), Paragraph("<b>Pathway</b>",CELLB), Paragraph("<b>"+header_leader+"</b>",CELLB)]]
    for f,pw,ld in rows:
        data.append([Paragraph(f,CELL), Paragraph(val_txt(pw)[0],CELLB), Paragraph(val_txt(ld)[0],CELL)])
    t=Table(data,colWidths=[86*mm,30*mm,54*mm])
    style=[('BACKGROUND',(0,0),(-1,0),BOSQUE_D),('TEXTCOLOR',(0,0),(-1,0),WHITE),
           ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(1,0),(2,-1),'CENTER'),
           ('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,colors.HexColor("#F6FAF7")]),
           ('GRID',(0,0),(-1,-1),0.5,colors.HexColor("#E0E8E3")),
           ('TOPPADDING',(0,0),(-1,-1),3.5),('BOTTOMPADDING',(0,0),(-1,-1),3.5),
           ('LEFTPADDING',(0,0),(-1,-1),6)]
    for i,(f,pw,ld) in enumerate(rows,start=1):
        style.append(('TEXTCOLOR',(1,i),(1,i),val_txt(pw)[1]))
        style.append(('TEXTCOLOR',(2,i),(2,i),val_txt(ld)[1]))
    t.setStyle(TableStyle(style))
    return t

def build(path):
    doc=SimpleDocTemplate(path,pagesize=A4,topMargin=15*mm,bottomMargin=13*mm,leftMargin=20*mm,rightMargin=20*mm,
                          title="Pathway - Precios, posicionamiento y desventajas por nicho")
    E=[]
    E.append(Paragraph("Pathway · Precios, posicionamiento y desventajas por nicho", H1))
    E.append(Paragraph("Donde estamos vs la competencia, que ofrecemos, en que estamos atras, y recomendaciones · Junio 2026", SUB))

    E.append(Paragraph("Resumen ejecutivo", H2))
    for t in [
      "<b>Nuestro foso:</b> somos el unico que ademas de la herramienta <b>TRAE clientes</b> (directorio/marketplace) y el unico <b>multi-nicho</b> (carrera + fitness + finanzas) con IA y white-label.",
      "<b>Nuestra desventaja:</b> en <b>profundidad por nicho</b>. Los especialistas (sobre todo en <b>fitness</b>) nos ganan en app movil, videos de ejercicios, wearables y macros.",
      "<b>Precio:</b> somos los mas caros y el Basic esta mal posicionado (cuesta como plan ilimitado pero limita a 5 clientes).",
      "<b>Recomendacion:</b> precio unico global en USD (Basic ~$39 · Pro ~$79) + comision del marketplace; y cerrar gaps por nicho priorizando fitness.",
    ]:
        E.append(Paragraph("• "+t, BULL))

    E.append(Spacer(1,5))
    E.append(Paragraph("1 · Precio mensual: donde estamos (USD)", CAP))
    E.append(HBars([
        ("Simply.Coach",19,False,""),("CoachAccountable",20,False,""),("Trainerize (Pro 5)",23,False,""),
        ("TrueCoach (5)",26,False,""),("CoachPilot",35,False,""),("Satori Personal",39,False,""),
        ("Harbiz (~)",40,False,""),("Paperbell",57,False,""),
        ("Pathway Basic",63,True,"trae clientes"),("Pathway Pro",96,True,"trae clientes"),
    ], rowh=15))
    E.append(Paragraph("La mayoria arranca entre $19 y $39. Quedamos arriba; el extra solo se justifica comunicando que <b>traemos clientes</b>.", SMALL))

    E.append(Spacer(1,8))
    E.append(Paragraph("2 · Mapa de valor", CAP))
    E.append(ValueMap([
        (16,1.2,"Simply.Coach","c"),(20,1.6,"CoachAccountable","c"),(23,2.4,"Trainerize","c"),
        (26,2.0,"TrueCoach","c"),(40,2.8,"Harbiz","c"),(39,2.2,"Satori","c"),(57,2.6,"Paperbell","c"),
        (63,8.2,"Basic hoy","pw"),(96,9.0,"Pro hoy","pw"),(39,8.2,"Basic propuesto","pwp"),(79,9.0,"Pro propuesto","pwp"),
    ]))
    E.append(Paragraph("Estamos solos arriba (mas valor). La jugada: <b>movernos a la izquierda</b> (mas accesible) sin perder altura. Circulos con borde = precio propuesto.", SMALL))

    E.append(PageBreak())
    E.append(Paragraph("3 · Donde estamos en DESVENTAJA, por nicho", H2))
    E.append(Paragraph("Verde = lo tenemos / estamos a la par · Naranja = parcial · Rojo = no lo tenemos (gap). 'Lideres' = los especialistas de ese nicho.", BODY))

    E.append(Spacer(1,3))
    E.append(Paragraph("FITNESS  —  vs Trainerize / TrueCoach / Everfit / Harbiz", CAP))
    E.append(niche_table("Lideres fitness", [
        ("Gestion de clientes, agenda y cobros","si","si"),
        ("App MOVIL nativa con tu marca (iOS/Android)","no","si"),
        ("Biblioteca de videos de ejercicios (1.200+)","no","si"),
        ("Sync wearables (Apple Health, Garmin, Fitbit)","no","si"),
        ("Macros/calorias con base de alimentos","no","si"),
        ("Constructor de rutinas y dietas con IA","no","si"),
        ("Antropometria detallada (grasa, musculo, IMO)","si","part"),
        ("Directorio que TRAE clientes","si","no"),
    ]))
    E.append(Paragraph("<b>Lectura:</b> es el nicho donde mas atras estamos. No le vamos a ganar a Trainerize en profundidad; ganamos con 'todo en uno + te traigo clientes' y simplicidad. Gap #1 a cerrar: <b>app movil + videos de ejercicios</b>.", SMALL))

    E.append(Spacer(1,7))
    E.append(Paragraph("FINANZAS  —  vs YNAB / Monarch / RightCapital", CAP))
    E.append(niche_table("Lideres finanzas", [
        ("Presupuesto, diagnostico y objetivos","si","si"),
        ("Categorizacion de gastos con IA","si","si"),
        ("Sync bancaria automatica (conectar cuentas)","no","si"),
        ("Patrimonio neto + inversiones en vivo","part","si"),
        ("App movil para registrar gastos al momento","no","si"),
        ("Dashboard colaborativo coach-cliente","si","part"),
        ("Directorio que TRAE clientes","si","no"),
    ]))
    E.append(Paragraph("<b>Lectura:</b> el nicho mas parejo. El gran gap es la <b>sync bancaria</b>, pero la categorizacion con IA ya la tenemos. El coaching financiero es un mercado menos maduro: ahi competimos bien.", SMALL))

    E.append(PageBreak())
    E.append(Paragraph("CARRERA  —  vs Jobscan / Teal / Huntr", CAP))
    E.append(niche_table("Lideres carrera/empleo", [
        ("CV con IA + carta de presentacion","si","si"),
        ("Optimizacion ATS profunda (vs la oferta)","part","si"),
        ("Extension de navegador para guardar empleos","no","si"),
        ("Tracker de postulaciones (estados, contactos)","part","si"),
        ("Simulador de entrevistas","si","si"),
        ("Analisis de perfil de LinkedIn","si","part"),
        ("Directorio que TRAE clientes","si","no"),
    ]))
    E.append(Paragraph("<b>Lectura:</b> tenemos lo central (CV, carta, entrevistas, LinkedIn) pero nos faltan piezas de los especialistas: <b>extension de navegador, tracker de postulaciones y ATS mas profundo</b>. Ventaja: en carrera no existe un 'todo en uno para el coach' como en fitness.", SMALL))

    E.append(Spacer(1,8))
    E.append(Paragraph("4 · Poder adquisitivo por pais (PIB per capita PPP 2024, miles USD)", CAP))
    E.append(HBars([
        ("Espana",48.4,True,""),("Uruguay",32.0,False,""),("Chile",30.2,False,""),
        ("Argentina (~)",27.0,False,""),("Mexico",22.0,False,""),("Colombia",18.5,False,""),("Peru",15.7,False,""),
    ], rowh=15, unit="$", fmt="{:.1f}k"))
    E.append(Paragraph("Espana tiene 2-3x el poder de compra de Peru/Colombia. Un precio unico debe ser pagable en el extremo bajo: fijarlo <b>en USD</b> y accesible; en Espana se siente justo y la comision compensa.", SMALL))

    E.append(PageBreak())
    E.append(Paragraph("5 · Recomendaciones", H2))
    rec=[
      ("Precio unico global en USD","Basic ~$39 · Pro ~$79. Mismo numero en todos los paises (cero arbitraje, un solo mensaje)."),
      ("Modelo: suscripcion competitiva + comision","Cuota accesible para captar coaches rapido; el upside sale de la comision del marketplace."),
      ("Arreglar el Basic","Hoy cuesta como plan ilimitado pero limita a 5 clientes. ~$39 lo deja a nivel Satori Personal."),
      ("Pro premium pero defendido","~$79 (entre Satori Pro $59 y Business $99). Lo justifican el white-label + el marketplace."),
      ("Posicionamiento honesto","No competir por 'mas profundo' (ahi gana el especialista). Competir por 'todo en uno multi-nicho + te traigo clientes + simple'."),
      ("Roadmap por nicho (cerrar gaps)","FITNESS (prioridad): app movil/PWA + biblioteca de ejercicios + sync Apple Health. CARRERA: extension de navegador + tracker de postulaciones. FINANZAS: sync bancaria (el resto ya esta)."),
      ("A vigilar con datos","Si la conversion de coaches en LatAm queda muy debajo de Espana al precio unico, recien ahi evaluar 2 tiers (UE vs LatAm)."),
    ]
    rdata=[["Recomendacion","Detalle"]]
    for a,b in rec: rdata.append([Paragraph("<b>"+a+"</b>",BODY),Paragraph(b,BODY)])
    rt=Table(rdata,colWidths=[50*mm,120*mm])
    rt.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),BOSQUE),('TEXTCOLOR',(0,0),(-1,0),WHITE),
        ('FONT',(0,0),(-1,0),'Helvetica-Bold',9),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,LIGHT]),('GRID',(0,0),(-1,-1),0.5,colors.HexColor("#E0E8E3")),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7)]))
    E.append(rt)
    E.append(Spacer(1,7))
    E.append(Paragraph("Fuentes: pricing y features 2026 de Trainerize/TrueCoach/Everfit (trainerize.com, quickcoach.fit, sportfitnessapps.com); Jobscan/Teal/Huntr (jobscan.co); software de coaching financiero 2026 (simply.coach, coupler.io); coaching platforms 2026 (learnworlds.com, assistantcoach.fit); Harbiz.io; PIB per capita PPP 2024 (Worldometer/Banco Mundial). Harbiz y PPP de Argentina = estimados.", SMALL))

    doc.build(E)

if __name__=="__main__":
    build("Pathway-analisis-precios.pdf"); print("OK")
