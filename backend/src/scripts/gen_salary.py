#!/usr/bin/env python3
"""
Usage: python3 gen_salary.py <input.json> <output.pdf>
"""
import sys
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm

# Vì dùng tiếng Việt không dấu nên ta xài thẳng font mặc định của PDF (nhẹ và nhanh nhất)
FONT = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'

def fmt(amount):
    if not amount:
        return "0"
    try:
        return f"{int(amount):,}".replace(",", ".")
    except:
        return str(amount)


def p(text, font=None, size=9, align=0, color=colors.black):
    f = font or FONT
    return Paragraph(str(text), ParagraphStyle(
        'x', fontName=f, fontSize=size,
        alignment=align, textColor=color,
        leading=size + 3
    ))


def pb(text, size=9, align=0, color=colors.black):
    return p(text, FONT_BOLD, size, align, color)


def generate(data, output_path):
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm
    )
    W = A4[0] - 30*mm
    story = []

    # ── HEADER ──
    h = [
        [pb("Cong ty TNHH Fly Visa"), '',
         p("Luong thuc te"), pb(fmt(data.get('finalSalary',0)), align=2)],
        [p("MST: 0316444315"), '',
         p("Ngay cong di lam"), pb(str(data.get('workDays',0)), align=2)],
        [p("DC: 219A Duong No Trang Long, Phuong Binh Thanh, TP.HCM"), '', '', ''],
    ]
    ht = Table(h, colWidths=[W*0.42, W*0.1, W*0.26, W*0.22])
    ht.setStyle(TableStyle([
        ('BOX',(0,0),(-1,-1),0.5,colors.black),
        ('GRID',(0,0),(-1,-1),0.3,colors.grey),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),3),
        ('BOTTOMPADDING',(0,0),(-1,-1),3),
        ('LEFTPADDING',(0,0),(-1,-1),5),
    ]))
    story.append(ht)
    story.append(Spacer(1,4*mm))

    # ── TIÊU ĐỀ ──
    story.append(pb("PHIEU LUONG", size=12, align=1))
    story.append(Spacer(1,1*mm))
    parts = str(data.get('monthYear','')).split('/')
    month_text = f"THANG {parts[0]} NAM {parts[1]}" if len(parts)==2 else data.get('monthYear','')
    story.append(pb(month_text, size=11, align=1))
    story.append(Spacer(1,3*mm))

    # ── INFO ──
    info = [
        [pb("Ma Nhan Vien"), p(data.get('employeeCode','')),
         pb("Luong thuc te"), pb(fmt(data.get('finalSalary',0)), align=2)],
        [pb("Ho Va Ten"), pb(data.get('name','')),
         pb("Ngay cong di lam"), pb(str(data.get('workDays',0)), align=2)],
        [pb("Chuc Danh"), p(data.get('role','')), '', ''],
    ]
    it = Table(info, colWidths=[W*0.2, W*0.3, W*0.25, W*0.25])
    it.setStyle(TableStyle([
        ('BOX',(0,0),(-1,-1),0.5,colors.black),
        ('GRID',(0,0),(-1,-1),0.3,colors.grey),
        ('SPAN',(1,2),(3,2)),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),4),
        ('BOTTOMPADDING',(0,0),(-1,-1),4),
        ('LEFTPADDING',(0,0),(-1,-1),5),
    ]))
    story.append(it)
    story.append(Spacer(1,3*mm))

    # ── BẢNG THU NHẬP & KHẤU TRỪ ──
    base     = data.get('baseSalary', 0)
    bonus    = data.get('totalBonus', 0)
    bhxh     = round(base * 0.08)
    bhyt     = round(base * 0.015)
    bhtn     = round(base * 0.01)
    thue     = data.get('thueTNCN', 0)
    half     = data.get('halfDayDeduction', 0)
    other    = data.get('otherDeduction', 0)

    total_in  = base + bonus
    total_out = bhxh + bhyt + bhtn + thue + half + other

    def row(s1, l1, v1, s2='', l2='', v2=''):
        vv1 = fmt(v1) if isinstance(v1,(int,float)) and v1 else (str(v1) if v1 else '0')
        vv2 = fmt(v2) if isinstance(v2,(int,float)) and v2 else (str(v2) if v2 else '')
        return [p(s1), p(l1), p(vv1, align=2), p(s2), p(l2), p(vv2, align=2)]

    rows = [
        [pb("STT",align=1), pb("Cac Khoan Thu Nhap"), p(''),
         pb("STT",align=1), pb("Cac Khoan Tru Vao Luong"), p('')],
        row('1','Luong co ban', base, '1','Bao Hiem Bat Buoc','............'),
        row('2','Phu Cap:','............','1,1','Bao hiem xa hoi (8%)', bhxh),
        row('2,1','Chuyen can', 0, '1,2','Bao hiem y te (1,5%)', bhyt),
        row('2,2','An trua', 0, '1,3','Bao hiem that nghiep (1%)', bhtn),
        row('2,3','Hoa hong', bonus if bonus else 0, '2','Thue Thu Nhap Ca Nhan', thue),
        row('2,4','Xang xe', 0, '3','1/2 ngay cong', half),
        row('2,5','Nha o', 0, '4','Khac', other),
        row('2,6','Ho tro khac', 0, '','',''),
        [pb("Tong Cong"), p(''), pb(fmt(total_in), align=2),
         pb("Tong Cong"), p(''), pb(fmt(total_out), align=2)],
    ]

    cw = [W*0.06, W*0.26, W*0.15, W*0.06, W*0.32, W*0.15]
    mt = Table(rows, colWidths=cw)
    mt.setStyle(TableStyle([
        ('BOX',(0,0),(-1,-1),0.5,colors.black),
        ('GRID',(0,0),(-1,-1),0.3,colors.grey),
        ('BACKGROUND',(0,0),(-1,0),colors.whitesmoke),
        ('BACKGROUND',(0,-1),(-1,-1),colors.whitesmoke),
        ('LINEAFTER',(2,0),(2,-1),1,colors.black),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),3),
        ('BOTTOMPADDING',(0,0),(-1,-1),3),
        ('LEFTPADDING',(0,0),(-1,-1),4),
    ]))
    story.append(mt)
    story.append(Spacer(1,3*mm))

    # ── TỔNG THỰC NHẬN ──
    ft = Table([[
        pb("Tong So Tien Luong Thuc Nhan", size=10), p(''), p(''),
        pb(fmt(data.get('finalSalary',0)), size=12, align=2,
           color=colors.HexColor('#1a56db')),
    ]], colWidths=[W*0.45, W*0.1, W*0.1, W*0.35])
    ft.setStyle(TableStyle([
        ('BOX',(0,0),(-1,-1),1.5,colors.HexColor('#1a56db')),
        ('SPAN',(0,0),(2,0)),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),7),
        ('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('LEFTPADDING',(0,0),(-1,-1),6),
    ]))
    story.append(ft)
    story.append(Spacer(1,3*mm))

    # ── BẰNG CHỮ ──
    bt = Table([[pb("Bang chu:"), p('')]], colWidths=[W*0.15, W*0.85])
    bt.setStyle(TableStyle([
        ('BOX',(0,0),(-1,-1),0.5,colors.black),
        ('GRID',(0,0),(-1,-1),0.3,colors.grey),
        ('TOPPADDING',(0,0),(-1,-1),7),
        ('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('LEFTPADDING',(0,0),(-1,-1),5),
    ]))
    story.append(bt)
    story.append(Spacer(1,5*mm))

    # ── CHỮ KÝ ──
    st = Table([
        [pb("Nguoi lap phieu",align=1), p(''), pb("Nguoi nhan tien",align=1)],
        [p("(Ky va ghi ro ho ten)",align=1), p(''), p("(Ky va ghi ro ho ten)",align=1)],
        [p('')]*3, [p('')]*3, [p('')]*3,
    ], colWidths=[W*0.4, W*0.2, W*0.4])
    st.setStyle(TableStyle([
        ('BOX',(0,0),(-1,-1),0.5,colors.black),
        ('GRID',(0,0),(-1,-1),0.3,colors.grey),
        ('TOPPADDING',(0,0),(-1,-1),4),
        ('BOTTOMPADDING',(0,0),(-1,-1),4),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ]))
    story.append(st)
    doc.build(story)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 gen_salary.py input.json output.pdf")
        sys.exit(1)
    with open(sys.argv[1]) as f:
        data = json.load(f)
    generate(data, sys.argv[2])
    print(f"OK: {sys.argv[2]}")