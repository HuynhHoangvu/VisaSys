#!/usr/bin/env python3
"""
Usage:
  python3 gen_salary.py <input.json> <output.pdf>           # phieu luong ca nhan
  python3 gen_salary.py summary <input.json> <output.pdf>   # bang luong tong
"""
import sys
import json
import os
from reportlab.lib.pagesizes import A4, landscape, A3
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'

# Đăng ký font Unicode để hiển thị tiếng Việt
_font_candidates = [
    # Windows
    ('C:/Windows/Fonts/arial.ttf',   'C:/Windows/Fonts/arialbd.ttf'),
    # Alpine Linux (ttf-dejavu)
    ('/usr/share/fonts/dejavu/DejaVuSans.ttf',        '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'),
    # Ubuntu/Debian
    ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
]
for _reg, _bold in _font_candidates:
    if os.path.exists(_reg) and os.path.exists(_bold):
        try:
            pdfmetrics.registerFont(TTFont('UniFont',      _reg))
            pdfmetrics.registerFont(TTFont('UniFont-Bold', _bold))
            FONT      = 'UniFont'
            FONT_BOLD = 'UniFont-Bold'
            break
        except Exception:
            pass


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


# ══════════════════════════════════════════════════════════════
#  PHIEU LUONG CA NHAN
# ══════════════════════════════════════════════════════════════
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
         p("Luong thuc te"), pb(fmt(data.get('finalSalary', 0)), align=2)],
        [p("MST: 0316444315"), '',
         p("Ngay cong di lam"), pb(str(data.get('workDays', 0)), align=2)],
        [p("DC: 219A Duong No Trang Long, Phuong Binh Thanh, TP.HCM"), '', '', ''],
    ]
    ht = Table(h, colWidths=[W*0.42, W*0.1, W*0.26, W*0.22])
    ht.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(ht)
    story.append(Spacer(1, 4*mm))

    # ── TIEU DE ──
    story.append(pb("PHIEU LUONG", size=12, align=1))
    story.append(Spacer(1, 1*mm))
    parts = str(data.get('monthYear', '')).split('/')
    month_text = f"THANG {parts[0]} NAM {parts[1]}" if len(parts) == 2 else data.get('monthYear', '')
    story.append(pb(month_text, size=11, align=1))
    story.append(Spacer(1, 3*mm))

    # ── INFO ──
    info = [
        [pb("Ma Nhan Vien"), p(data.get('employeeCode', '')),
         pb("Luong thuc te"), pb(fmt(data.get('finalSalary', 0)), align=2)],
        [pb("Ho Va Ten"), pb(data.get('name', '')),
         pb("Ngay cong di lam"), pb(str(data.get('workDays', 0)), align=2)],
        [pb("Chuc Danh"), p(data.get('role', '')), '', ''],
    ]
    it = Table(info, colWidths=[W*0.2, W*0.3, W*0.25, W*0.25])
    it.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
        ('SPAN', (1, 2), (3, 2)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(it)
    story.append(Spacer(1, 3*mm))

    # ── DANH SACH NGAY DI LAM ──
    work_dates = data.get('workDates', [])
    if work_dates:
        # Sap xep ngay tang dan
        def sort_key(d):
            try:
                parts = d.split('/')
                return (int(parts[2]), int(parts[1]), int(parts[0]))
            except:
                return (0, 0, 0)
        work_dates = sorted(work_dates, key=sort_key)

        COLS = 7
        date_rows = []
        # Header
        date_rows.append([pb("Cac ngay di lam trong thang:", size=8)] + [p('')] * (COLS - 1))
        # Chia ngay thanh cac hang 7 ngay
        chunk = []
        for d in work_dates:
            chunk.append(p(d, size=8, align=1))
            if len(chunk) == COLS:
                date_rows.append(chunk)
                chunk = []
        if chunk:
            # Pad phan con lai
            chunk += [p('')] * (COLS - len(chunk))
            date_rows.append(chunk)

        col_w = [W / COLS] * COLS
        dt = Table(date_rows, colWidths=col_w)
        dt_style = [
            ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
            ('SPAN', (0, 0), (-1, 0)),  # merge header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ]
        dt.setStyle(TableStyle(dt_style))
        story.append(dt)
        story.append(Spacer(1, 3*mm))

    # ── BANG THU NHAP & KHAU TRU ──
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
        vv1 = fmt(v1) if isinstance(v1, (int, float)) and v1 else (str(v1) if v1 else '0')
        vv2 = fmt(v2) if isinstance(v2, (int, float)) and v2 else (str(v2) if v2 else '')
        return [p(s1), p(l1), p(vv1, align=2), p(s2), p(l2), p(vv2, align=2)]

    rows = [
        [pb("STT", align=1), pb("Cac Khoan Thu Nhap"), p(''),
         pb("STT", align=1), pb("Cac Khoan Tru Vao Luong"), p('')],
        row('1', 'Luong co ban', base, '1', 'Bao Hiem Bat Buoc', '............'),
        row('2', 'Phu Cap:', '............', '1,1', 'Bao hiem xa hoi (8%)', bhxh),
        row('2,1', 'Chuyen can', 0, '1,2', 'Bao hiem y te (1,5%)', bhyt),
        row('2,2', 'An trua', 0, '1,3', 'Bao hiem that nghiep (1%)', bhtn),
        row('2,3', 'Hoa hong', bonus if bonus else 0, '2', 'Thue Thu Nhap Ca Nhan', thue),
        row('2,4', 'Xang xe', 0, '3', '1/2 ngay cong', half),
        row('2,5', 'Nha o', 0, '4', 'Khac', other),
        row('2,6', 'Ho tro khac', 0, '', '', ''),
        [pb("Tong Cong"), p(''), pb(fmt(total_in), align=2),
         pb("Tong Cong"), p(''), pb(fmt(total_out), align=2)],
    ]

    cw = [W*0.06, W*0.26, W*0.15, W*0.06, W*0.32, W*0.15]
    mt = Table(rows, colWidths=cw)
    mt.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
        ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
        ('BACKGROUND', (0, -1), (-1, -1), colors.whitesmoke),
        ('LINEAFTER', (2, 0), (2, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(mt)
    story.append(Spacer(1, 3*mm))

    # ── TONG THUC NHAN ──
    ft = Table([[
        pb("Tong So Tien Luong Thuc Nhan", size=10), p(''), p(''),
        pb(fmt(data.get('finalSalary', 0)), size=12, align=2,
           color=colors.HexColor('#1a56db')),
    ]], colWidths=[W*0.45, W*0.1, W*0.1, W*0.35])
    ft.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#1a56db')),
        ('SPAN', (0, 0), (2, 0)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(ft)
    story.append(Spacer(1, 3*mm))

    # ── BANG CHU ──
    bt = Table([[pb("Bang chu:"), p('')]], colWidths=[W*0.15, W*0.85])
    bt.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(bt)
    story.append(Spacer(1, 5*mm))

    # ── CHU KY ──
    st = Table([
        [pb("Nguoi lap phieu", align=1), p(''), pb("Nguoi nhan tien", align=1)],
        [p("(Ky va ghi ro ho ten)", align=1), p(''), p("(Ky va ghi ro ho ten)", align=1)],
        [p('')]*3, [p('')]*3, [p('')]*3,
    ], colWidths=[W*0.4, W*0.2, W*0.4])
    st.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(st)
    doc.build(story)


# ══════════════════════════════════════════════════════════════
#  BANG LUONG TONG (BANG LUONG NHAN VIEN)
# ══════════════════════════════════════════════════════════════
def generate_summary(data, output_path):
    doc = SimpleDocTemplate(
        output_path, pagesize=landscape(A3),
        leftMargin=10*mm, rightMargin=10*mm,
        topMargin=10*mm, bottomMargin=10*mm
    )
    W = A3[1] - 20*mm   # landscape width = A3 height
    story = []

    employees = data.get('employees', [])
    parts = str(data.get('monthYear', '')).split('/')
    month_text = f"THANG {parts[0]} NAM {parts[1]}" if len(parts) == 2 else data.get('monthYear', '')

    # ── HEADER CONG TY ──
    header_data = [
        [pb("CONG TY TNHH FLY VISA", size=9), '', '', ''],
        [p("MST: 0316444315", size=8), '', '', ''],
        [p("DC: 219A Duong No Trang Long, Phuong Binh Thanh, TP.HCM", size=8), '', '', ''],
    ]
    ht = Table(header_data, colWidths=[W*0.5, W*0.2, W*0.15, W*0.15])
    ht.setStyle(TableStyle([
        ('SPAN', (0, 0), (3, 0)),
        ('SPAN', (0, 1), (3, 1)),
        ('SPAN', (0, 2), (3, 2)),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(ht)
    story.append(Spacer(1, 3*mm))

    # ── TIEU DE ──
    story.append(pb("BANG LUONG NHAN VIEN", size=13, align=1))
    story.append(Spacer(1, 1*mm))
    story.append(pb(month_text, size=11, align=1))
    story.append(Spacer(1, 4*mm))

    # ── TINH TONG ──
    def total_field(field):
        return sum(e.get(field, 0) or 0 for e in employees)

    tot_base      = total_field('baseSalary')
    tot_cc        = total_field('chuyenCan')
    tot_at        = total_field('anTrua')
    tot_htk       = total_field('hoTroKhac')
    tot_hh        = total_field('hoaHong')
    tot_thu       = total_field('totalBonus') + tot_base
    tot_ngay      = total_field('workDays')
    tot_luong_tt  = total_field('totalSalary')
    tot_ins       = total_field('insuranceSalary')
    tot_bhxh_cty  = total_field('bhxhCty')
    tot_bhyt_cty  = total_field('bhytCty')
    tot_bhtn_cty  = total_field('bhtnCty')
    tot_cty       = total_field('totalCty')
    tot_bhxh_nld  = total_field('bhxhNld')
    tot_bhyt_nld  = total_field('bhytNld')
    tot_bhtn_nld  = total_field('bhtnNld')
    tot_nld       = total_field('totalNld')
    tot_thue      = total_field('thueTNCN')
    tot_tu        = total_field('tamUng')
    tot_hd        = total_field('halfDayDeduction')
    tot_final     = total_field('finalSalary')

    # ── BANG LUONG ──
    # Header 2 dong
    BG_HEADER   = colors.HexColor('#FFA500')  # cam
    BG_TOTAL    = colors.HexColor('#FFA500')
    BG_LIGHT    = colors.HexColor('#FFF3E0')

    fs = 7  # font size cho bang

    def cp(text, size=None, bold=False, align=1):
        s = size or fs
        return pb(text, size=s, align=align) if bold else p(text, size=s, align=align)

    # Dinh nghia header hang 1 va hang 2
    header1 = [
        cp("STT", bold=True),
        cp("Ho va ten", bold=True),
        cp("Chuc vu", bold=True),
        cp("Luong co ban", bold=True),
        cp("Phu cap", bold=True), cp(""), cp(""), cp(""),   # 4 cot phu cap
        cp("Tong thu nhap", bold=True),
        cp("Ngay cong TT", bold=True),
        cp("Tong luong TT", bold=True),
        cp("Luong dong BH", bold=True),
        cp("Cac khoan trich chi phi DN", bold=True), cp(""), cp(""), cp(""),  # 4 cot cty
        cp("Cac khoan trich vao luong", bold=True), cp(""), cp(""), cp(""),  # 4 cot NLD
        cp("Thue TNCN", bold=True),
        cp("Tam ung", bold=True),
        cp("Tru tien di tre", bold=True),
        cp("Thuc linh", bold=True),
        cp("Ghi chu", bold=True),
    ]

    header2 = [
        cp(""), cp(""), cp(""), cp(""),
        cp("Chuyen can", bold=True), cp("An trua", bold=True),
        cp("Ho tro khac", bold=True), cp("Hoa hong", bold=True),
        cp(""), cp(""), cp(""), cp(""),
        cp("BHXH\n(17,5%)", bold=True), cp("BHYT\n(3%)", bold=True),
        cp("BHTN\n(1%)", bold=True), cp("Tong", bold=True),
        cp("BHXH\n(8%)", bold=True), cp("BHYT\n(1,5%)", bold=True),
        cp("BHTN\n(1%)", bold=True), cp("Tong", bold=True),
        cp(""), cp(""), cp(""), cp(""), cp(""),
    ]

    # Col widths — 25 cot, tong = 0.970W (< 1.0 de tranh tran)
    cws = [
        W*0.020,  # STT
        W*0.090,  # Ho ten      — rong hon de hien day du ten
        W*0.045,  # Chuc vu
        W*0.050,  # Luong CB
        W*0.038,  # Chuyen can
        W*0.035,  # An trua
        W*0.035,  # Ho tro khac
        W*0.038,  # Hoa hong
        W*0.050,  # Tong thu nhap
        W*0.028,  # Ngay cong
        W*0.050,  # Tong luong TT
        W*0.045,  # Luong dong BH
        W*0.038,  # BHXH cty (17.5%)
        W*0.030,  # BHYT cty (3%)
        W*0.030,  # BHTN cty (1%)
        W*0.038,  # Tong cty
        W*0.035,  # BHXH nld (8%)
        W*0.030,  # BHYT nld (1.5%)
        W*0.030,  # BHTN nld (1%)
        W*0.035,  # Tong nld
        W*0.035,  # Thue TNCN
        W*0.030,  # Tam ung
        W*0.038,  # Tru di tre
        W*0.052,  # Thuc linh
        W*0.025,  # Ghi chu
    ]

    table_rows = [header1, header2]

    for i, emp in enumerate(employees, start=1):
        base     = emp.get('baseSalary', 0) or 0
        cc       = emp.get('chuyenCan', 0) or 0
        at       = emp.get('anTrua', 0) or 0
        htk      = emp.get('hoTroKhac', 0) or 0
        hh       = emp.get('hoaHong', 0) or 0
        tong_tn  = base + cc + at + htk + hh
        ngay     = emp.get('workDays', 0) or 0
        luong_tt = emp.get('totalSalary', tong_tn) or tong_tn
        ins      = emp.get('insuranceSalary', base) or base
        bx_c     = emp.get('bhxhCty', 0) or 0
        by_c     = emp.get('bhytCty', 0) or 0
        bt_c     = emp.get('bhtnCty', 0) or 0
        t_cty    = emp.get('totalCty', 0) or 0
        bx_n     = emp.get('bhxhNld', 0) or 0
        by_n     = emp.get('bhytNld', 0) or 0
        bt_n     = emp.get('bhtnNld', 0) or 0
        t_nld    = emp.get('totalNld', 0) or 0
        thue     = emp.get('thueTNCN', 0) or 0
        tu       = emp.get('tamUng', 0) or 0
        hd       = emp.get('halfDayDeduction', 0) or 0
        final    = emp.get('finalSalary', 0) or 0

        def cv(v):
            return cp(fmt(v) if v else '0', align=2)

        row_data = [
            cp(str(i), align=1),
            p(emp.get('name', ''), size=fs),
            p(emp.get('role', ''), size=fs, align=1),
            cv(base), cv(cc), cv(at), cv(htk), cv(hh),
            cv(tong_tn), cp(str(ngay), align=1), cv(luong_tt),
            cv(ins),
            cv(bx_c), cv(by_c), cv(bt_c), cv(t_cty),
            cv(bx_n), cv(by_n), cv(bt_n), cv(t_nld),
            cv(thue), cv(tu), cv(hd), cv(final),
            p('', size=fs),
        ]
        table_rows.append(row_data)

    # Dong TONG
    def tv(v):
        return cp(fmt(v) if v else '0', bold=True, align=2)

    total_row = [
        cp("TONG", bold=True, align=1), cp(""), cp(""),
        tv(tot_base), tv(tot_cc), tv(tot_at), tv(tot_htk), tv(tot_hh),
        tv(tot_thu), tv(tot_ngay), tv(tot_luong_tt),
        tv(tot_ins),
        tv(tot_bhxh_cty), tv(tot_bhyt_cty), tv(tot_bhtn_cty), tv(tot_cty),
        tv(tot_bhxh_nld), tv(tot_bhyt_nld), tv(tot_bhtn_nld), tv(tot_nld),
        tv(tot_thue), tv(tot_tu), tv(tot_hd), tv(tot_final),
        cp(""),
    ]
    table_rows.append(total_row)

    tbl = Table(table_rows, colWidths=cws, repeatRows=2)

    n_data = len(table_rows)

    tbl_style = [
        # Khung chung
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
        # Merge header hang 1: STT, Ho ten, Chuc vu, Luong CB, Tong TN, Ngay cong, Tong luong TT, Luong BH
        ('SPAN', (0, 0), (0, 1)),   # STT
        ('SPAN', (1, 0), (1, 1)),   # Ho ten
        ('SPAN', (2, 0), (2, 1)),   # Chuc vu
        ('SPAN', (3, 0), (3, 1)),   # Luong CB
        ('SPAN', (4, 0), (7, 0)),   # Phu cap (4 cot)
        ('SPAN', (8, 0), (8, 1)),   # Tong thu nhap
        ('SPAN', (9, 0), (9, 1)),   # Ngay cong
        ('SPAN', (10, 0), (10, 1)), # Tong luong TT
        ('SPAN', (11, 0), (11, 1)), # Luong dong BH
        ('SPAN', (12, 0), (15, 0)), # Chi phi DN (4 cot)
        ('SPAN', (16, 0), (19, 0)), # Trich vao luong (4 cot)
        ('SPAN', (20, 0), (20, 1)), # Thue TNCN
        ('SPAN', (21, 0), (21, 1)), # Tam ung
        ('SPAN', (22, 0), (22, 1)), # Tru di tre
        ('SPAN', (23, 0), (23, 1)), # Thuc linh
        ('SPAN', (24, 0), (24, 1)), # Ghi chu
        # Merge dong TONG: STT + Ho ten + Chuc vu
        ('SPAN', (0, n_data - 1), (2, n_data - 1)),
        # Mau header
        ('BACKGROUND', (0, 0), (-1, 1), BG_HEADER),
        # Mau dong tong
        ('BACKGROUND', (0, n_data - 1), (-1, n_data - 1), BG_TOTAL),
        # Mau xen ke hang du lieu
        *[('BACKGROUND', (0, r), (-1, r), BG_LIGHT)
          for r in range(2, n_data - 1) if (r - 2) % 2 == 1],
        # Can chinh
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        # Padding
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        # Bo duong ke dam giua 2 nhom cot
        ('LINEAFTER', (11, 0), (11, -1), 1, colors.black),
        ('LINEAFTER', (15, 0), (15, -1), 1, colors.black),
        ('LINEAFTER', (19, 0), (19, -1), 1, colors.black),
    ]
    tbl.setStyle(TableStyle(tbl_style))
    story.append(tbl)
    story.append(Spacer(1, 8*mm))

    # ── CHU KY ──
    sig = Table([
        [pb("Nguoi lap bieu", align=1), p(''), pb("Ke toan", align=1), p(''), pb("Giam doc", align=1)],
        [p("(Ky, ghi ro ho ten)", size=8, align=1), p(''),
         p("(Ky, ghi ro ho ten)", size=8, align=1), p(''),
         p("(Ky, ghi ro ho ten)", size=8, align=1)],
        [p('')]*5, [p('')]*5, [p('')]*5,
    ], colWidths=[W*0.25, W*0.1, W*0.25, W*0.1, W*0.3])
    sig.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(sig)
    doc.build(story)


# ══════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════
if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == 'summary':
        # python gen_salary.py summary input.json output.pdf
        with open(sys.argv[2], encoding='utf-8') as f:
            data = json.load(f)
        generate_summary(data, sys.argv[3])
        print(f"OK: {sys.argv[3]}")
    elif len(sys.argv) == 3:
        # python gen_salary.py input.json output.pdf
        with open(sys.argv[1], encoding='utf-8') as f:
            data = json.load(f)
        generate(data, sys.argv[2])
        print(f"OK: {sys.argv[2]}")
    else:
        print("Usage:")
        print("  python gen_salary.py <input.json> <output.pdf>")
        print("  python gen_salary.py summary <input.json> <output.pdf>")
        sys.exit(1)
