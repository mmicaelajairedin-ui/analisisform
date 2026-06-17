# -*- coding: utf-8 -*-
"""Brief de anuncios para Abril (captacion de coaches) -> PDF."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

BOSQUE=colors.HexColor("#2D6A4F"); BOSQUE_D=colors.HexColor("#1B4332")
LIGHT=colors.HexColor("#E8F5EE"); MID=colors.HexColor("#ACD4BB")
TEXT=colors.HexColor("#1a1a1a"); MUTED=colors.HexColor("#777777"); WHITE=colors.white
W=170*mm
st=getSampleStyleSheet()
TITLE=ParagraphStyle('T',parent=st['Heading1'],textColor=BOSQUE_D,fontSize=20,leading=24,spaceAfter=2)
SUB=ParagraphStyle('SUB',parent=st['Normal'],textColor=MUTED,fontSize=9.5,leading=12.5,spaceAfter=9)
H2=ParagraphStyle('H2',parent=st['Heading2'],textColor=BOSQUE,fontSize=12.5,leading=15,spaceBefore=7,spaceAfter=3)
BODY=ParagraphStyle('BODY',parent=st['Normal'],textColor=TEXT,fontSize=9.7,leading=13.8,spaceAfter=4)
BULL=ParagraphStyle('BULL',parent=BODY,leftIndent=11,spaceAfter=3)

def box(html):
    t=Table([[Paragraph(html,BODY)]],colWidths=[W])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),0.7,BOSQUE),
        ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    return t

def build(path):
    doc=SimpleDocTemplate(path,pagesize=A4,topMargin=16*mm,bottomMargin=14*mm,leftMargin=20*mm,rightMargin=20*mm,
                          title="Pathway - Brief de anuncios para coaches")
    E=[]
    E.append(Paragraph("Brief de anuncios — Pathway", TITLE))
    E.append(Paragraph("Captacion de coaches · Espana + Latinoamerica · para Abril · jun 2026", SUB))

    E.append(box("<b>Objetivo:</b> que el coach haga UNA de dos acciones (las dos cuentan): "
        "<b>(A)</b> empezar el <b>trial de 14 dias gratis</b>, o <b>(B)</b> <b>reservar una demo de 11 min</b>. "
        "Metrica que miramos: registros de trial + demos agendadas (no likes ni clics)."))

    E.append(Paragraph("Producto en una linea", H2))
    E.append(Paragraph("Pathway le ordena al coach todo su negocio en un panel (portal para sus clientes con SU marca + "
        "herramientas con IA) <b>y ademas le trae clientes</b> desde un directorio publico. <b>No es solo una herramienta: tambien genera demanda.</b>", BODY))

    E.append(Paragraph("A quien le hablamos", H2))
    for t in ["<b>Quien:</b> coaches y profesionales que acompanan personas — <b>carrera, fitness y finanzas</b>.",
              "<b>Donde:</b> Espana, Mexico, Argentina, Chile, Colombia, Peru, Uruguay.",
              "<b>Un anuncio (ad set) por nicho</b> — no mezclar en uno generico.",
              "<b>Idioma:</b> espanol (la plataforma es en espanol; el ingles queda para mas adelante)."]:
        E.append(Paragraph("• "+t, BULL))

    E.append(Paragraph("Mensajes / angulos (el primero es el mas fuerte)", H2))
    for t in ["<b>\"No solo te ordena el negocio — te traemos clientes\"</b> (el directorio = canal de clientes).",
              "\"Dejá el WhatsApp + Excel: portal del cliente <b>con tu marca</b>.\"",
              "\"Vos le cobrás a tus clientes lo que quieras — <b>0% de comision sobre lo tuyo</b>.\""]:
        E.append(Paragraph("• "+t, BULL))

    E.append(Paragraph("Ganchos por nicho (primeros 3 segundos)", H2))
    g=[["Fitness","\"Coach fitness: rutinas, mediciones y seguimiento de cada cliente en un solo lugar.\""],
       ["Finanzas","\"Coach financiero: dale a tus clientes un portal serio para ver su presupuesto y su avance.\""],
       ["Carrera","\"¿Acompanas busquedas laborales? CV con IA, simulador de entrevistas y portal del cliente.\""]]
    gt=Table([[Paragraph("<b>"+a+"</b>",BODY),Paragraph(b,BODY)] for a,b in g],colWidths=[28*mm,W-28*mm])
    gt.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,0),(-1,-1),[WHITE,LIGHT]),
        ('GRID',(0,0),(-1,-1),0.5,colors.HexColor("#E0E8E3")),('TOPPADDING',(0,0),(-1,-1),5),
        ('BOTTOMPADDING',(0,0),(-1,-1),5),('LEFTPADDING',(0,0),(-1,-1),7)]))
    E.append(gt)

    E.append(Paragraph("Oferta, precio y CTAs", H2))
    for t in ["<b>14 dias gratis, sin tarjeta. Cancela cuando quieras.</b> En el anuncio lideramos con el GRATIS.",
              "Precio (se menciona para calificar): <b>Basic USD $29/mes</b> · <b>Pro USD $59/mes</b>.",
              "<b>CTA A (registro):</b> \"Empezá 14 dias gratis →\"",
              "<b>CTA B (demo):</b> \"Reservá una demo de 11 min y te muestro como conseguís clientes.\""]:
        E.append(Paragraph("• "+t, BULL))

    E.append(Paragraph("A donde mandamos el trafico", H2))
    for t in ["Trial: <b>pathwaycareercoach.com/soy-coach.html</b> (tiene los dos botones).",
              "Demo: <b>calendly.com/mmicaela-jairedin/pathway-demo</b>.",
              "Sumar UTM por nicho y por CTA (ej. <font face='Courier'>?utm_campaign=coaches_fitness&utm_content=trial</font>)."]:
        E.append(Paragraph("• "+t, BULL))

    E.append(Paragraph("Formatos y presupuesto (test inicial)", H2))
    for t in ["Video vertical 30-40 seg (guion aparte) + 2-3 placas con los ganchos. Reusar el video demo que ya esta en la web.",
              "Presupuesto sugerido: <b>~US$15-25/dia, 2 semanas</b>, repartido en 2-3 ad sets (uno por nicho).",
              "Medir <b>costo por trial</b> y <b>costo por demo</b> por separado; escalar el nicho que mejor convierta.",
              "<b>Arrancar por UN nicho</b> y escalar (mi voto: fitness queda muy visual en video; o carrera, que tiene menos competencia)."]:
        E.append(Paragraph("• "+t, BULL))

    E.append(Spacer(1,6))
    E.append(box("<b>Regla de oro:</b> mostrar SIEMPRE el \"te traemos clientes\" al lado del precio. "
        "No competimos por ser los mas baratos — competimos por ser <b>el unico que ademas consigue clientes</b>."))

    doc.build(E)

if __name__=="__main__":
    build("docs/pathway-brief-anuncios.pdf"); print("OK")
