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
    base  = data.get('baseSalary', 0)      # = insuranceSalary (luong CB de dong BH)
    cc    = data.get('chuyenCan', 0)
    at    = data.get('anTrua', 0)
    htk   = data.get('hoTroKhac', 0)
    hh    = data.get('hoaHong', 0)
    ins   = data.get('insuranceSalary', base)
    bhxh  = round(ins * 0.08)
    bhyt  = round(ins * 0.015)
    bhtn  = round(ins * 0.01)
    half  = data.get('halfDayDeduction', 0)
    other = data.get('otherDeduction', 0)

    total_in  = base + cc + at + htk + hh
    total_bh  = bhxh + bhyt + bhtn
    total_out = total_bh + half + other

    def row(s1, l1, v1, s2='', l2='', v2=''):
        vv1 = fmt(v1) if isinstance(v1, (int, float)) and v1 else (str(v1) if v1 else '0')
        vv2 = fmt(v2) if isinstance(v2, (int, float)) and v2 else (str(v2) if v2 else '')
        return [p(s1), p(l1), p(vv1, align=2), p(s2), p(l2), p(vv2, align=2)]

    rows = [
        [pb("STT", align=1), pb("Cac Khoan Thu Nhap"), p(''),
         pb("STT", align=1), pb("Cac Khoan Tru Vao Luong"), p('')],
        row('1', 'Luong co ban', base,  '1',   'Bao Hiem Bat Buoc', '............'),
        row('2', 'Phu Cap:',     '............', '1,1', 'Bao hiem xa hoi (8%)',       bhxh),
        row('2,1', 'Chuyen can', cc,   '1,2', 'Bao hiem y te (1,5%)',        bhyt),
        row('2,2', 'An trua',    at,   '1,3', 'Bao hiem that nghiep (1%)',   bhtn),
        row('2,3', 'Ho tro khac', htk, '2',   'Tong bao hiem NLD dong',      total_bh),
        row('2,4', 'Hoa hong / Thuong', hh, '3', '1/2 ngay cong',            half),
        row('',    '',           '',   '4',   'Khac (phat + di tre)',         other),
        row('',    '',           '',   '',    '',                             ''),
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
        cp("Tam ung", bold=True),
        cp("Tru tien di tre", bold=True),
        cp("Thuc linh", bold=True),
        cp("Ngay cong di lam", bold=True),
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
        cp(""), cp(""), cp(""), cp(""),
    ]

    # Col widths — 24 cot, tong = 0.970W (< 1.0 de tranh tran)
    cws = [
        W*0.020,  # STT
        W*0.100,  # Ho ten
        W*0.045,  # Chuc vu
        W*0.055,  # Luong CB
        W*0.038,  # Chuyen can
        W*0.035,  # An trua
        W*0.035,  # Ho tro khac
        W*0.038,  # Hoa hong
        W*0.055,  # Tong thu nhap
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
        W*0.037,  # Tam ung
        W*0.038,  # Tru di tre
        W*0.060,  # Thuc linh
        W*0.025,  # Ngay cong di lam
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
            cv(tu), cv(hd), cv(final),
            cp(str(ngay), align=1),
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
        tv(tot_tu), tv(tot_hd), tv(tot_final),
        cp(str(int(tot_ngay)), align=1, bold=True),
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
        ('SPAN', (20, 0), (20, 1)), # Tam ung
        ('SPAN', (21, 0), (21, 1)), # Tru di tre
        ('SPAN', (22, 0), (22, 1)), # Thuc linh
        ('SPAN', (23, 0), (23, 1)), # Ghi chu
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
#  HỖ TRỢ: Thêm sheet phiếu lương cá nhân cho từng nhân viên
# ══════════════════════════════════════════════════════════════
def _add_slip_sheets(wb, employees, month_text):
    """Thêm sheet phiếu lương cá nhân cho từng nhân viên vào workbook."""
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    ORANGE  = "FFA500"
    BLUE    = "1a56db"
    LGRAY   = "F5F5F5"
    _thin   = Side(style='thin')

    def bd():
        return Border(left=_thin, right=_thin, top=_thin, bottom=_thin)

    def sc(ws, cell_ref, value='', bold=False, size=10, h='left', v='center',
           fill=None, bdr=False, wrap=False, color='000000', num_fmt=None):
        c = ws[cell_ref]
        c.value = value
        c.font = Font(name='Arial', bold=bold, size=size, color=color)
        c.alignment = Alignment(horizontal=h, vertical=v, wrap_text=wrap)
        if fill:
            c.fill = PatternFill("solid", fgColor=fill)
        if bdr:
            c.border = bd()
        if num_fmt:
            c.number_format = num_fmt
        return c

    def merge(ws, rng, value='', bold=False, size=10, h='left', v='center',
              fill=None, bdr=False, wrap=False, color='000000', num_fmt=None):
        ws.merge_cells(rng)
        tl = rng.split(':')[0]
        return sc(ws, tl, value, bold, size, h, v, fill, bdr, wrap, color, num_fmt)

    for emp in employees:
        # Ten sheet = ho ten (gioi han 31 ky tu, bo ky tu dac biet)
        raw_name = emp.get('name', 'NV')
        sheet_name = raw_name.strip()[:28]
        for ch in r'\/*?[]':
            sheet_name = sheet_name.replace(ch, '')
        ws = wb.create_sheet(title=sheet_name)

        base  = emp.get('baseSalary', 0) or 0
        cc    = emp.get('chuyenCan', 0) or 0
        at    = emp.get('anTrua', 0) or 0
        htk   = emp.get('hoTroKhac', 0) or 0
        hh    = emp.get('hoaHong', 0) or 0
        ins   = emp.get('insuranceSalary', base) or base
        bhxh  = round(ins * 0.08)
        bhyt  = round(ins * 0.015)
        bhtn  = round(ins * 0.01)
        half  = emp.get('halfDayDeduction', 0) or 0
        other = emp.get('otherDeduction', 0) or 0
        tu    = emp.get('tamUng', 0) or 0
        wdays = emp.get('workDays', 0) or 0
        total_in  = base + cc + at + htk + hh
        total_bh  = bhxh + bhyt + bhtn
        total_out = total_bh + half + other + tu
        # Thực lĩnh = tổng thu nhập - bảo hiểm NLD - tạm ứng - trừ nửa ngày - phạt (manual + vắng mặt)
        final = total_in - total_bh - tu - half - other

        # ── HEADER CONG TY (rows 1-3) ──
        merge(ws, 'A1:G1', 'Cong ty TNHH Fly Visa', bold=True, size=11)
        merge(ws, 'A2:G2', 'MST: 0316444315', size=9)
        merge(ws, 'A3:G3', 'DC: 219A Duong No Trang Long, Phuong Binh Thanh, TP.HCM', size=9)

        # row 4 trong
        ws.row_dimensions[4].height = 6

        # ── TIEU DE (rows 5-6) ──
        merge(ws, 'A5:G5', 'PHIEU LUONG', bold=True, size=14, h='center')
        merge(ws, 'A6:G6', month_text, bold=True, size=12, h='center')

        ws.row_dimensions[5].height = 20
        ws.row_dimensions[6].height = 18

        # row 7 trong
        ws.row_dimensions[7].height = 4

        # ── THONG TIN NHAN VIEN (rows 8-10) ──
        sc(ws, 'A8', 'Ma Nhan Vien', bold=True, size=9, bdr=True, fill=LGRAY)
        merge(ws, 'B8:D8', emp.get('employeeCode', ''), size=9, bdr=True)
        sc(ws, 'E8', 'Luong thuc te', bold=True, size=9, bdr=True, fill=LGRAY)
        merge(ws, 'F8:G8', final, size=10, bold=True, h='right', bdr=True, num_fmt='#,##0')

        sc(ws, 'A9', 'Ho Va Ten', bold=True, size=9, bdr=True, fill=LGRAY)
        merge(ws, 'B9:D9', emp.get('name', ''), size=9, bold=True, bdr=True)
        sc(ws, 'E9', 'Ngay cong di lam', bold=True, size=9, bdr=True, fill=LGRAY)
        merge(ws, 'F9:G9', wdays, size=10, bold=True, h='right', bdr=True)

        sc(ws, 'A10', 'Chuc Danh', bold=True, size=9, bdr=True, fill=LGRAY)
        merge(ws, 'B10:G10', emp.get('role', ''), size=9, bdr=True)

        ws.row_dimensions[8].height = 16
        ws.row_dimensions[9].height = 16
        ws.row_dimensions[10].height = 16

        # row 11 trong
        ws.row_dimensions[11].height = 4

        # ── HEADER BANG THU NHAP / KHAU TRU (row 12) ──
        sc(ws, 'A12', 'STT',               bold=True, size=8, h='center', fill=ORANGE, bdr=True)
        sc(ws, 'B12', 'Cac Khoan Thu Nhap',bold=True, size=8, h='center', fill=ORANGE, bdr=True)
        sc(ws, 'C12', '',                  bold=True, size=8, fill=ORANGE, bdr=True)
        sc(ws, 'D12', 'STT',               bold=True, size=8, h='center', fill=ORANGE, bdr=True)
        merge(ws, 'E12:F12', 'Cac Khoan Tru Vao Luong', bold=True, size=8, h='center', fill=ORANGE, bdr=True)
        sc(ws, 'G12', 'So tien',           bold=True, size=8, h='center', fill=ORANGE, bdr=True)
        ws.row_dimensions[12].height = 16

        # ── DATA ROWS (13-20) ──
        def dr(ws, row, s1, l1, v1, s2, l2, v2):
            # Cot A: STT thu nhap
            sc(ws, f'A{row}', s1, size=8, h='center', bdr=True)
            # Cot B: Ten khoan thu nhap (khong merge voi C)
            sc(ws, f'B{row}', l1, size=8, bdr=True)
            # Cot C: Gia tri thu nhap
            c_in = ws[f'C{row}']
            # Luôn hiển thị giá trị, kể cả khi là 0
            if isinstance(v1, (int, float)):
                c_in.value = v1
                c_in.number_format = '#,##0'
            elif isinstance(v1, str) and v1:
                c_in.value = v1
            else:
                c_in.value = None
            c_in.font = Font(name='Arial', size=8)
            c_in.alignment = Alignment(horizontal='right', vertical='center')
            c_in.border = bd()
            # Cot D: STT khau tru
            sc(ws, f'D{row}', s2, size=8, h='center', bdr=True)
            # Cot E+F merge: Ten khoan khau tru
            merge(ws, f'E{row}:F{row}', l2, size=8, bdr=True, wrap=True)
            # Cot G: Gia tri khau tru
            c_out = ws[f'G{row}']
            # Luôn hiển thị giá trị, kể cả khi là 0 (để rõ: không trừ gì)
            if isinstance(v2, (int, float)):
                c_out.value = v2
                c_out.number_format = '#,##0'
            elif isinstance(v2, str) and v2:
                c_out.value = v2
            else:
                c_out.value = None
            c_out.font = Font(name='Arial', size=8)
            c_out.alignment = Alignment(horizontal='right', vertical='center')
            c_out.border = bd()
            ws.row_dimensions[row].height = 15

        dr(ws, 13, '1',   'Luong co ban',        base, '1',   'Bao Hiem Bat Buoc',            '............')
        dr(ws, 14, '2',   'Phu Cap:',             '............', '1,1', 'Bao hiem xa hoi (8%)', bhxh)
        dr(ws, 15, '2,1', 'Chuyen can',           cc,   '1,2', 'Bao hiem y te (1,5%)',         bhyt)
        dr(ws, 16, '2,2', 'An trua',              at,   '1,3', 'Bao hiem that nghiep (1%)',    bhtn)
        dr(ws, 17, '2,3', 'Ho tro khac',          htk,  '2',   'Tong BH NLD dong',             total_bh)
        dr(ws, 18, '2,4', 'Hoa hong / Thuong',    hh,   '3',   'Tru 1/2 ngay cong',            half)
        dr(ws, 19, '',    '',                      '',   '4',   'Tam ung',                      tu)
        dr(ws, 20, '',    '',                      '',   '5',   'Khac (phat + di tre)',         other)

        # ── DONG TONG (row 21) ──
        merge(ws, 'A21:B21', 'Tong Cong', bold=True, size=9, fill=ORANGE, bdr=True)
        c21 = ws['C21']
        c21.value = total_in
        c21.font = Font(name='Arial', bold=True, size=9)
        c21.alignment = Alignment(horizontal='right', vertical='center')
        c21.fill = PatternFill("solid", fgColor=ORANGE)
        c21.border = bd()
        c21.number_format = '#,##0'

        merge(ws, 'D21:E21', 'Tong Cong', bold=True, size=9, fill=ORANGE, bdr=True)
        ws.merge_cells('F21:F21')
        f21 = ws['F21']
        f21.fill = PatternFill("solid", fgColor=ORANGE)
        f21.border = bd()
        g21 = ws['G21']
        g21.value = total_out
        g21.font = Font(name='Arial', bold=True, size=9)
        g21.alignment = Alignment(horizontal='right', vertical='center')
        g21.fill = PatternFill("solid", fgColor=ORANGE)
        g21.border = bd()
        g21.number_format = '#,##0'
        ws.row_dimensions[21].height = 16

        # row 22 trong
        ws.row_dimensions[22].height = 6

        # ── TONG THUC NHAN (row 23) ──
        ws.merge_cells('A23:E23')
        a23 = ws['A23']
        a23.value = 'Tong So Tien Luong Thuc Nhan'
        a23.font = Font(name='Arial', bold=True, size=11)
        a23.alignment = Alignment(horizontal='left', vertical='center')
        a23.border = Border(left=Side(style='medium'), top=Side(style='medium'),
                            bottom=Side(style='medium'))

        ws.merge_cells('F23:G23')
        g23 = ws['F23']
        g23.value = final
        g23.font = Font(name='Arial', bold=True, size=12, color=BLUE)
        g23.alignment = Alignment(horizontal='right', vertical='center')
        g23.number_format = '#,##0'
        g23.border = Border(right=Side(style='medium'), top=Side(style='medium'),
                            bottom=Side(style='medium'))
        ws.row_dimensions[23].height = 20

        # row 24 trong
        ws.row_dimensions[24].height = 6

        # ── BANG CHU (row 25) ──
        sc(ws, 'A25', 'Bang chu:', bold=True, size=9, bdr=True)
        merge(ws, 'B25:G25', '', size=9, bdr=True)
        ws.row_dimensions[25].height = 20

        # rows 26-27 trong
        ws.row_dimensions[26].height = 8

        # ── CHU KY (rows 27-30) ──
        merge(ws, 'A27:C27', 'Nguoi lap phieu', bold=True, size=9, h='center')
        merge(ws, 'E27:G27', 'Nguoi nhan tien', bold=True, size=9, h='center')
        merge(ws, 'A28:C28', '(Ky va ghi ro ho ten)', size=8, h='center', color='666666')
        merge(ws, 'E28:G28', '(Ky va ghi ro ho ten)', size=8, h='center', color='666666')
        for r in range(29, 33):
            ws.row_dimensions[r].height = 14

        # ── DO RONG COT ──
        ws.column_dimensions['A'].width = 6
        ws.column_dimensions['B'].width = 22
        ws.column_dimensions['C'].width = 14
        ws.column_dimensions['D'].width = 6
        ws.column_dimensions['E'].width = 22
        ws.column_dimensions['F'].width = 4
        ws.column_dimensions['G'].width = 14

        ws.sheet_view.showGridLines = False


# ══════════════════════════════════════════════════════════════
#  BANG LUONG TONG — EXCEL (openpyxl)
# ══════════════════════════════════════════════════════════════
def generate_summary_excel(data, output_path):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError:
        raise Exception("Thieu thu vien: pip install openpyxl")

    employees = data.get('employees', [])
    parts = str(data.get('monthYear', '')).split('/')
    month_text = f"THANG {parts[0]} NAM {parts[1]}" if len(parts) == 2 else data.get('monthYear', '')

    wb = Workbook()
    ws = wb.active
    ws.title = "Bang Luong"

    ORANGE      = "FFA500"
    LT_ORANGE   = "FFF3E0"
    WHITE       = "FFFFFF"

    _thin  = Side(style='thin')

    def bd(left=_thin, right=_thin, top=_thin, bottom=_thin):
        return Border(left=left, right=right, top=top, bottom=bottom)

    def style(cell, bold=False, size=9, color=None, fill=None,
              h='center', v='center', wrap=False, fmt=None, bdr=True):
        cell.font = Font(name='Arial', bold=bold, size=size,
                         color=color or "000000")
        if fill:
            cell.fill = PatternFill("solid", fgColor=fill)
        cell.alignment = Alignment(horizontal=h, vertical=v, wrap_text=wrap)
        if bdr:
            cell.border = bd()
        if fmt:
            cell.number_format = fmt

    NUM = '#,##0'

    # ── HEADER CONG TY ──
    ws.merge_cells('A1:X1')
    ws['A1'] = 'CONG TY TNHH FLY VISA'
    style(ws['A1'], bold=True, size=11, h='left', bdr=False)

    ws.merge_cells('A2:X2')
    ws['A2'] = 'MST: 0316444315'
    style(ws['A2'], size=9, h='left', bdr=False)

    ws.merge_cells('A3:X3')
    ws['A3'] = 'DC: 219A Duong No Trang Long, Phuong Binh Thanh, TP.HCM'
    style(ws['A3'], size=9, h='left', bdr=False)

    # ── TIEU DE ──
    ws.merge_cells('A5:X5')
    ws['A5'] = 'BANG LUONG NHAN VIEN'
    style(ws['A5'], bold=True, size=14, bdr=False)
    ws.row_dimensions[5].height = 22

    ws.merge_cells('A6:X6')
    ws['A6'] = month_text
    style(ws['A6'], bold=True, size=12, bdr=False)
    ws.row_dimensions[6].height = 18

    # ── HEADER BANG — 2 DONG ──
    # Columns A..X (24 cols):
    # A=STT B=Ho ten C=Chuc vu D=Luong CB
    # E=CC  F=AT     G=HTK     H=HH
    # I=Tong TN  J=Ngay cong  K=Tong luong TT  L=Luong dong BH
    # M=BHXH cty N=BHYT cty  O=BHTN cty  P=Tong cty
    # Q=BHXH nld R=BHYT nld  S=BHTN nld  T=Tong nld
    # U=Tam ung  V=Tru di tre W=Thuc linh X=Ngay cong di lam

    HR1, HR2 = 8, 9
    DS = 10  # Data Start row

    # Merge header row 1
    for rng in ['A8:A9','B8:B9','C8:C9','D8:D9',
                'E8:H8',                           # Phu cap
                'I8:I9','J8:J9','K8:K9','L8:L9',
                'M8:P8',                           # Chi phi DN
                'Q8:T8',                           # Trich vao luong
                'U8:U9','V8:V9','W8:W9','X8:X9']:
        ws.merge_cells(rng)

    h1_vals = {
        'A': 'STT', 'B': 'Ho va ten', 'C': 'Chuc vu', 'D': 'Luong co ban',
        'E': 'Phu cap',
        'I': 'Tong thu nhap', 'J': 'Ngay cong TT', 'K': 'Tong luong TT',
        'L': 'Luong dong BH',
        'M': 'Cac khoan trich chi phi DN',
        'Q': 'Cac khoan trich vao luong',
        'U': 'Tam ung', 'V': 'Tru tien di tre', 'W': 'Thuc linh', 'X': 'Ngay cong di lam',
    }
    h2_vals = {
        'E': 'Chuyen can', 'F': 'An trua', 'G': 'Ho tro khac', 'H': 'Hoa hong',
        'M': 'BHXH\n(17,5%)', 'N': 'BHYT\n(3%)', 'O': 'BHTN\n(1%)', 'P': 'Tong',
        'Q': 'BHXH\n(8%)',    'R': 'BHYT\n(1,5%)', 'S': 'BHTN\n(1%)', 'T': 'Tong',
    }

    all_cols = [chr(c) for c in range(ord('A'), ord('X') + 1)]

    for c in all_cols:
        c1 = ws[f'{c}{HR1}']
        c2 = ws[f'{c}{HR2}']
        for cell in (c1, c2):
            style(cell, bold=True, size=8, fill=ORANGE, wrap=True)
        if c in h1_vals:
            c1.value = h1_vals[c]
        if c in h2_vals:
            c2.value = h2_vals[c]

    ws.row_dimensions[HR1].height = 28
    ws.row_dimensions[HR2].height = 28

    # ── DATA ROWS ──
    for i, emp in enumerate(employees, start=1):
        r = DS + i - 1
        base = emp.get('baseSalary', 0) or 0
        cc   = emp.get('chuyenCan', 0) or 0
        at_  = emp.get('anTrua', 0) or 0
        htk  = emp.get('hoTroKhac', 0) or 0
        hh   = emp.get('hoaHong', 0) or 0
        ngay = emp.get('workDays', 0) or 0
        tu   = emp.get('tamUng', 0) or 0
        hd   = emp.get('halfDayDeduction', 0) or 0

        fill_c = LT_ORANGE if i % 2 == 0 else WHITE

        # Gia tri truc tiep
        raw = {
            'A': i, 'B': emp.get('name', ''), 'C': emp.get('role', ''),
            'D': base,
            'E': cc  if cc  else None,
            'F': at_ if at_ else None,
            'G': htk if htk else None,
            'H': hh  if hh  else None,
            'J': ngay if ngay else None,
            'U': tu  if tu  else None,
            'V': hd  if hd  else None,
            'X': ngay if ngay else 0,
        }
        for c, val in raw.items():
            cell = ws[f'{c}{r}']
            cell.value = val
            cell.fill = PatternFill("solid", fgColor=fill_c)
            cell.border = bd()
            cell.font = Font(name='Arial', size=8)
            if c in ('A', 'J', 'X'):
                cell.alignment = Alignment(horizontal='center', vertical='center')
            elif c in ('B', 'C'):
                cell.alignment = Alignment(horizontal='left', vertical='center')
            else:
                cell.alignment = Alignment(horizontal='right', vertical='center')
                if val is not None:
                    cell.number_format = NUM

        # Cong thuc Excel tu tinh
        formulas = {
            'I': f'=D{r}+IF(E{r}="",0,E{r})+IF(F{r}="",0,F{r})+IF(G{r}="",0,G{r})+IF(H{r}="",0,H{r})',
            'K': f'=IF(J{r}=0,0,ROUND(I{r}*J{r}/21,0))',
            'L': f'=D{r}',
            'M': f'=ROUND(L{r}*17.5%,0)',
            'N': f'=ROUND(L{r}*3%,0)',
            'O': f'=ROUND(L{r}*1%,0)',
            'P': f'=M{r}+N{r}+O{r}',
            'Q': f'=ROUND(L{r}*8%,0)',
            'R': f'=ROUND(L{r}*1.5%,0)',
            'S': f'=ROUND(L{r}*1%,0)',
            'T': f'=Q{r}+R{r}+S{r}',
            'W': f'=K{r}-T{r}-IF(U{r}="",0,U{r})-IF(V{r}="",0,V{r})',
        }
        for c, formula in formulas.items():
            cell = ws[f'{c}{r}']
            cell.value = formula
            cell.fill = PatternFill("solid", fgColor=fill_c)
            cell.border = bd()
            cell.font = Font(name='Arial', size=8)
            cell.number_format = NUM
            cell.alignment = Alignment(horizontal='right', vertical='center')

        ws.row_dimensions[r].height = 16

    # ── DONG TONG ──
    TR = DS + len(employees)
    data_end = TR - 1

    ws.merge_cells(f'A{TR}:C{TR}')
    cell = ws[f'A{TR}']
    cell.value = 'TONG'
    style(cell, bold=True, size=10, fill=ORANGE)

    for c in all_cols[3:]:   # D..X
        cell = ws[f'{c}{TR}']
        if c != 'X':
            cell.value = f'=SUM({c}{DS}:{c}{data_end})'
            style(cell, bold=True, fill=ORANGE, h='right', fmt=NUM)
        else:
            cell.value = ''  # Cột X không cộng tổng (đó là ngày công)
            style(cell, bold=True, fill=ORANGE)
    # Fix B, C cells cua dong tong (da merge)
    for c in ('B', 'C'):
        ws[f'{c}{TR}'].fill = PatternFill("solid", fgColor=ORANGE)
        ws[f'{c}{TR}'].border = bd()

    ws.row_dimensions[TR].height = 18

    # ── CHU KY ──
    SR = TR + 3
    sigs = [('B', 'Nguoi lap bieu'), ('J', 'Ke toan'), ('T', 'Giam doc')]
    for col, title in sigs:
        ws[f'{col}{SR}'].value = title
        style(ws[f'{col}{SR}'], bold=True, size=9, bdr=False)
        ws[f'{col}{SR + 1}'].value = '(Ky, ghi ro ho ten)'
        style(ws[f'{col}{SR + 1}'], size=8, bdr=False)
        ws[f'{col}{SR + 1}'].font = Font(name='Arial', size=8, italic=True)
        ws[f'{col}{SR + 1}'].alignment = Alignment(horizontal='center')

    # ── DO RONG COT ──
    widths = {
        'A': 5,  'B': 22, 'C': 12, 'D': 14,
        'E': 12, 'F': 10, 'G': 12, 'H': 12,
        'I': 14, 'J': 8,  'K': 14, 'L': 14,
        'M': 12, 'N': 10, 'O': 10, 'P': 12,
        'Q': 10, 'R': 10, 'S': 10, 'T': 12,
        'U': 12, 'V': 12, 'W': 14, 'X': 10,
    }
    for c, w in widths.items():
        ws.column_dimensions[c].width = w

    # Freeze header
    ws.freeze_panes = f'A{DS}'

    # ── THEM SHEET PHIEU LUONG CA NHAN CHO TUNG NHAN VIEN ──
    _add_slip_sheets(wb, employees, month_text)

    wb.save(output_path)


# ══════════════════════════════════════════════════════════════
#  PHIEU LUONG CA NHAN — EXCEL (moi nguoi 1 sheet)
# ══════════════════════════════════════════════════════════════
def generate_slips_excel(data, output_path):
    try:
        from openpyxl import Workbook
    except ImportError:
        raise Exception("Thieu thu vien: pip install openpyxl")

    employees = data.get('employees', [])
    parts = str(data.get('monthYear', '')).split('/')
    month_text = f"THANG {parts[0]} NAM {parts[1]}" if len(parts) == 2 else data.get('monthYear', '')

    wb = Workbook()
    wb.remove(wb.active)  # xoa sheet mac dinh

    # Sử dụng hàm chung để thêm sheets phiếu lương
    _add_slip_sheets(wb, employees, month_text)

    wb.save(output_path)



# ══════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════
if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == 'summary':
        with open(sys.argv[2], encoding='utf-8') as f:
            data = json.load(f)
        generate_summary(data, sys.argv[3])
        print(f"OK: {sys.argv[3]}")
    elif len(sys.argv) == 4 and sys.argv[1] == 'excel':
        with open(sys.argv[2], encoding='utf-8') as f:
            data = json.load(f)
        generate_summary_excel(data, sys.argv[3])
        print(f"OK: {sys.argv[3]}")
    elif len(sys.argv) == 4 and sys.argv[1] == 'slips':
        with open(sys.argv[2], encoding='utf-8') as f:
            data = json.load(f)
        generate_slips_excel(data, sys.argv[3])
        print(f"OK: {sys.argv[3]}")
    elif len(sys.argv) == 3:
        with open(sys.argv[1], encoding='utf-8') as f:
            data = json.load(f)
        generate(data, sys.argv[2])
        print(f"OK: {sys.argv[2]}")
    else:
        print("Usage:")
        print("  python gen_salary.py <input.json> <output.pdf>")
        print("  python gen_salary.py summary <input.json> <output.pdf>")
        print("  python gen_salary.py excel   <input.json> <output.xlsx>")
        print("  python gen_salary.py slips   <input.json> <output.xlsx>")
        sys.exit(1)
