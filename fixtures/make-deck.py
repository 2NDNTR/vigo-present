from reportlab.lib.pagesizes import landscape
from reportlab.pdfgen import canvas

W, H = 960, 540  # 16:9 slide, like a deck exported from Keynote
c = canvas.Canvas('fixtures/deck.pdf', pagesize=(W, H))

def footer(n):
    c.setFont('Helvetica', 8)
    c.drawString(40, 20, 'Alessi Foods — Confidential')
    c.drawRightString(W - 40, 20, str(n))

# 1 — cover
c.setFont('Helvetica-Bold', 11); c.drawString(60, H-70, 'Q4 2026 COMMERCIAL STRATEGY')
c.setFont('Helvetica-Bold', 46); c.drawString(60, H-140, 'Sell the Box')
footer(1); c.showPage()

# 2 — section divider
c.setFont('Helvetica-Bold', 44); c.drawString(60, H/2, 'Performance')
footer(2); c.showPage()

# 3 — three metrics
c.setFont('Helvetica-Bold', 13); c.drawString(60, H-60, 'WHERE WE STAND')
c.setFont('Helvetica-Bold', 30); c.drawString(60, H-120, 'The quarter in three numbers')
for i, (v, l, s) in enumerate([('6.2x','Order volume','vs April'),('42%','Repeat rate','up 9 pts'),('$38','Average order','target $52')]):
    x = 60 + i*290
    c.setFont('Helvetica-Bold', 40); c.drawString(x, 220, v)
    c.setFont('Helvetica', 12); c.drawString(x, 195, l)
    c.setFont('Helvetica', 10); c.drawString(x, 178, s)
footer(3); c.showPage()

# 4 — bullets
c.setFont('Helvetica-Bold', 30); c.drawString(60, H-100, 'What has to be true')
c.setFont('Helvetica', 14)
for i, b in enumerate(['Gift boxes live by 15 October','Retargeting pool above 40,000','Chili crisp stays in stock','Shipping promise under five days']):
    c.drawString(60, H-160-i*32, '•  ' + b)
footer(4); c.showPage()

# 5 — quote
c.setFont('Helvetica-Oblique', 22)
c.drawString(60, H/2+20, '“They understand the category better than anyone we buy from.”')
c.setFont('Helvetica', 12); c.drawString(60, H/2-20, '— Category buyer, national grocery')
footer(5); c.showPage()

# 6 — table
c.setFont('Helvetica-Bold', 28); c.drawString(60, H-90, 'Channel mix')
rows = [['Channel','Q3','Q4 plan','Change'],
        ['Shopify','$180K','$420K','+133%'],
        ['Amazon','$95K','$140K','+47%'],
        ['Retail','$310K','$360K','+16%']]
y = H-150
for r in rows:
    c.setFont('Helvetica-Bold' if r is rows[0] else 'Helvetica', 12)
    for j, cell in enumerate(r):
        c.drawString(60 + j*180, y, cell)
    y -= 28
footer(6); c.showPage()

# 7 — flattened (no text at all)
c.setFillColorRGB(.85,.2,.15); c.rect(0,0,W,H, fill=1, stroke=0)
footer(7); c.showPage()

# 8 — prose with a price inside it: must NOT become a metric
c.setFont('Helvetica-Bold', 28); c.drawString(60, H-90, 'Why the box works')
c.setFont('Helvetica', 13)
prose = ['A pantry brand only gets one window a year to sell a gift, and a gift is a box.',
         'At $38 the average order is a single jar plus shipping, which is a habit purchase.',
         'The box reframes it: three jars, a recipe card and a ribbon, and the same shopper',
         'spends $52 without hesitating, because they are no longer buying groceries.']
for i, line in enumerate(prose):
    c.drawString(60, H-150-i*24, line)
footer(8); c.showPage()

# 9 — one big figure with an explanation
c.setFont('Helvetica-Bold', 13); c.drawString(60, H-60, 'THE HEADLINE NUMBER')
c.setFont('Helvetica-Bold', 64); c.drawString(60, 260, '6.2x')
c.setFont('Helvetica', 14); c.drawString(60, 230, 'Order volume since April')
c.setFont('Helvetica', 12)
for i, line in enumerate(['Growth has compounded every month since the storefront relaunched,',
                          'and none of it came from discounting. The base is real.']):
    c.drawString(60, 190-i*20, line)
footer(9); c.showPage()

# 10 — closing
c.setFont('Helvetica-Bold', 40); c.drawString(60, H/2, 'Thank you')
c.setFont('Helvetica', 13); c.drawString(60, H/2-40, 'alessifoods.com')
footer(10); c.showPage()

c.save()
print('written')
