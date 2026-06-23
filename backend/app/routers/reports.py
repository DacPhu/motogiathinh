"""Reports — dashboard PDF, 7-day PDF, full data Excel.

Uses reportlab for PDFs and openpyxl for Excel.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from reportlab.lib import colors as rl_colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select

from app.dependencies import CurrentUser, DB
from app.models.enums import RoleName
from app.models.payment import Payment
from app.models.student import Student
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])

_CYAN   = rl_colors.HexColor("#1a7ba4")
_HEADER = rl_colors.HexColor("#0d3b52")
_ALT    = rl_colors.HexColor("#f0f7fb")
_WHITE  = rl_colors.white
_GRAY   = rl_colors.HexColor("#888888")


def _vn_date(dt) -> str:
    if dt is None:
        return ""
    if hasattr(dt, "strftime"):
        return dt.strftime("%d/%m/%Y")
    return str(dt)


def _money(v) -> str:
    if v is None:
        return ""
    return f"{int(v):,}".replace(",", ".")


def _pdf_resp(buf: BytesIO, name: str) -> StreamingResponse:
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})


def _xlsx_resp(buf: BytesIO, name: str) -> StreamingResponse:
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


def _tbl_style(header_rows: int = 1) -> list:
    return [
        ("BACKGROUND",    (0, 0), (-1, header_rows - 1), _HEADER),
        ("TEXTCOLOR",     (0, 0), (-1, header_rows - 1), _WHITE),
        ("FONTNAME",      (0, 0), (-1, header_rows - 1), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, header_rows - 1), 8),
        ("ROWBACKGROUNDS",(0, header_rows), (-1, -1), [_WHITE, _ALT]),
        ("FONTNAME",      (0, header_rows), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, header_rows), (-1, -1), 7.5),
        ("GRID",          (0, 0), (-1, -1), 0.25, rl_colors.HexColor("#cccccc")),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]


def _enum_val(v) -> str:
    return str(v.value if hasattr(v, "value") else v)


# ─── Dashboard PDF ──────────────────────────────────────────────────────────
@router.get("/dashboard.pdf")
async def dashboard_pdf(current_user: CurrentUser, db: DB):
    from app.models.branch import Branch

    now = datetime.now(timezone.utc)
    students = (await db.execute(select(Student).where(Student.deleted_at.is_(None)))).scalars().all()
    payments = (await db.execute(select(Payment).where(Payment.deleted_at.is_(None)))).scalars().all()
    branches = (await db.execute(select(Branch))).scalars().all()

    branch_map = {b.id: b.ten_chi_nhanh for b in branches}
    total_rev  = sum(p.so_tien for p in payments if p.so_tien > 0)

    by_status: dict[str, int] = {}
    for s in students:
        k = _enum_val(s.trang_thai)
        by_status[k] = by_status.get(k, 0) + 1

    by_branch: dict[str, dict] = {str(b.id): {"name": b.ten_chi_nhanh, "students": 0, "revenue": Decimal(0)} for b in branches}
    for s in students:
        k = str(s.branch_id)
        if k in by_branch:
            by_branch[k]["students"] += 1
    for p in payments:
        k = str(p.branch_id)
        if k in by_branch:
            by_branch[k]["revenue"] += p.so_tien

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=1.5*cm, rightMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
    T  = ParagraphStyle
    story = [
        Paragraph("TỔNG QUAN HỆ THỐNG", T("tit", fontSize=16, spaceAfter=4, textColor=_HEADER, fontName="Helvetica-Bold")),
        Paragraph(f"Moto Gia Thịnh · {_vn_date(now)}", T("sub", fontSize=9, textColor=_GRAY, spaceAfter=12)),
    ]

    kpi = [["CHỈ SỐ", "GIÁ TRỊ"],
           ["Tổng học viên", str(len(students))],
           ["Tổng doanh thu", _money(total_rev) + " đ"],
           ["Số chi nhánh", str(len(branches))]] + \
          [[k.upper(), str(v)] for k, v in by_status.items()]
    t = Table(kpi, colWidths=[9*cm, 6*cm])
    t.setStyle(TableStyle(_tbl_style()))
    story += [t, Spacer(1, 0.5*cm),
              Paragraph("Theo chi nhánh", T("h2", fontSize=11, spaceAfter=4, textColor=_HEADER, fontName="Helvetica-Bold"))]

    brows = [["CHI NHÁNH", "HỌC VIÊN", "DOANH THU (đ)"]]
    brows += [[v["name"], str(v["students"]), _money(v["revenue"])] for v in by_branch.values()]
    t2 = Table(brows, colWidths=[8*cm, 4*cm, 6*cm])
    t2.setStyle(TableStyle(_tbl_style()))
    story.append(t2)

    doc.build(story)
    return _pdf_resp(buf, f"tongquan-{now.strftime('%Y%m%d')}.pdf")


# ─── 7-day PDF ──────────────────────────────────────────────────────────────
@router.get("/data.pdf")
async def data_pdf(current_user: CurrentUser, db: DB):
    now   = datetime.now(timezone.utc)
    since = now - timedelta(days=7)

    students_7 = (await db.execute(
        select(Student).where(Student.deleted_at.is_(None), Student.created_at >= since).order_by(Student.created_at.desc())
    )).scalars().all()
    payments_7 = (await db.execute(
        select(Payment).where(Payment.deleted_at.is_(None), Payment.collected_at >= since).order_by(Payment.collected_at.desc())
    )).scalars().all()

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=1.5*cm, rightMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
    T = ParagraphStyle
    story = [
        Paragraph("BÁO CÁO 7 NGÀY", T("tit", fontSize=14, spaceAfter=4, textColor=_HEADER, fontName="Helvetica-Bold")),
        Paragraph(f"{_vn_date(since)} – {_vn_date(now)}", T("sub", fontSize=9, textColor=_GRAY, spaceAfter=8)),
        Paragraph(f"Học viên đăng ký ({len(students_7)})", T("h2", fontSize=10, spaceAfter=4, textColor=_HEADER, fontName="Helvetica-Bold")),
    ]

    srows = [["MÃ HV", "HỌ TÊN", "SĐT", "BẰNG LÁI", "TRẠNG THÁI", "NGÀY ĐK"]]
    for s in students_7:
        srows.append([s.ma_hoc_vien, s.ten_hoc_vien, s.so_dien_thoai,
                      _enum_val(s.loai_bang_lai), _enum_val(s.trang_thai), _vn_date(s.created_at)])
    t = Table(srows, colWidths=[2.5*cm, 5*cm, 3*cm, 2*cm, 3*cm, 2.5*cm])
    t.setStyle(TableStyle(_tbl_style()))
    story += [t, Spacer(1, 0.4*cm)]

    total_p = sum(p.so_tien for p in payments_7 if p.so_tien > 0)
    story.append(Paragraph(f"Thanh toán ({len(payments_7)}) — Tổng: {_money(total_p)} đ",
                           T("h2", fontSize=10, spaceAfter=4, textColor=_HEADER, fontName="Helvetica-Bold")))
    prows = [["MÃ GD", "MÃ HV", "SỐ TIỀN (đ)", "PHƯƠNG THỨC", "NGÀY THU"]]
    for p in payments_7:
        prows.append([p.ma_giao_dich, str(p.student_id)[:8] + "…",
                      _money(p.so_tien), _enum_val(p.phuong_thuc), _vn_date(p.collected_at)])
    t2 = Table(prows, colWidths=[3.5*cm, 3*cm, 3.5*cm, 3*cm, 2.5*cm])
    t2.setStyle(TableStyle(_tbl_style()))
    story.append(t2)

    doc.build(story)
    return _pdf_resp(buf, f"baocao-7ngay-{now.strftime('%Y%m%d')}.pdf")


# ─── Full Excel ─────────────────────────────────────────────────────────────
@router.get("/data.xlsx")
async def data_xlsx(current_user: CurrentUser, db: DB):
    from app.models.branch import Branch

    students = (await db.execute(
        select(Student).where(Student.deleted_at.is_(None)).order_by(Student.created_at.desc())
    )).scalars().all()
    payments = (await db.execute(
        select(Payment).where(Payment.deleted_at.is_(None)).order_by(Payment.collected_at.desc())
    )).scalars().all()
    branches = (await db.execute(select(Branch))).scalars().all()
    branch_map = {b.id: b.ten_chi_nhanh for b in branches}

    ctvs      = (await db.execute(
        select(User).where(User.role == RoleName.collaborator, User.is_active == True, User.deleted_at.is_(None))
    )).scalars().all()
    ctv_map   = {u.id: u for u in ctvs}
    ctv_count: dict = {u.id: 0 for u in ctvs}
    for s in students:
        if s.responsible_staff_id and s.responsible_staff_id in ctv_count:
            ctv_count[s.responsible_staff_id] += 1
    ctv_ranked = sorted(ctv_count.items(), key=lambda x: x[1], reverse=True)[:123]

    wb = Workbook()

    ws1 = wb.active
    ws1.title = "Học viên"
    _xhdr(ws1, ["MÃ HV", "HỌ TÊN", "NGÀY SINH", "GIỚI TÍNH", "SỐ CCCD / MÃ QR CCCD",
                 "ĐIỆN THOẠI", "LOẠI BẰNG", "TRẠNG THÁI", "NGÀY ĐĂNG KÝ", "CHI NHÁNH", "GHI CHÚ"])
    for s in students:
        ws1.append([s.ma_hoc_vien, s.ten_hoc_vien, _vn_date(s.ngay_sinh),
                    _enum_val(s.gioi_tinh), s.cccd_number or "",
                    s.so_dien_thoai, _enum_val(s.loai_bang_lai), _enum_val(s.trang_thai),
                    _vn_date(s.created_at), branch_map.get(s.branch_id, ""), s.ghi_chu or ""])
    _autofit(ws1)

    ws2 = wb.create_sheet("Thanh toán")
    _xhdr(ws2, ["MÃ GD", "MÃ HV", "SỐ TIỀN (đ)", "PHƯƠNG THỨC", "LOẠI", "NGÀY THU", "SỐ BIÊN LAI", "GHI CHÚ"])
    for p in payments:
        ws2.append([p.ma_giao_dich, str(p.student_id), int(p.so_tien),
                    _enum_val(p.phuong_thuc), p.kind or "tuition",
                    _vn_date(p.collected_at), p.so_bien_lai or "", p.ghi_chu or ""])
    _autofit(ws2)

    ws3 = wb.create_sheet("CTV top 123")
    _xhdr(ws3, ["HẠNG", "TÊN CTV", "EMAIL", "CHI NHÁNH", "SỐ HỒ SƠ"])
    gold   = PatternFill("solid", fgColor="FFD700")
    silver = PatternFill("solid", fgColor="C0C0C0")
    bronze = PatternFill("solid", fgColor="CD7F32")
    cyan10 = PatternFill("solid", fgColor="E0F7FA")
    for rank, (uid, count) in enumerate(ctv_ranked, 1):
        u = ctv_map[uid]
        ws3.append([rank, u.full_name or u.email, u.email,
                    branch_map.get(u.branch_id, "") if u.branch_id else "Tất cả", count])
        fill = (gold if rank == 1 else silver if rank == 2 else bronze if rank == 3
                else (cyan10 if rank % 2 == 0 else None))
        if fill:
            for col in range(1, 6):
                ws3.cell(row=ws3.max_row, column=col).fill = fill
    _autofit(ws3)

    buf = BytesIO()
    wb.save(buf)
    return _xlsx_resp(buf, f"baocao-{datetime.now().strftime('%Y%m%d')}.xlsx")


# ─── xlsx helpers ─────────────────────────────────────────────────────────────
def _xhdr(ws, headers: list[str]) -> None:
    ws.append(headers)
    fill = PatternFill("solid", fgColor="0D3B52")
    font = Font(bold=True, color="FFFFFF", size=10)
    for col in range(1, len(headers) + 1):
        c = ws.cell(row=1, column=col)
        c.fill = fill; c.font = font
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _autofit(ws) -> None:
    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=8)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)
