"""Excel workbook sheet builders — called exclusively by reports.py:data_xlsx."""

from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime, timezone

from openpyxl.styles import Alignment, Font, PatternFill

# ── Style constants ────────────────────────────────────────────────────────────
_FILL_HDR   = PatternFill("solid", fgColor="0D3B52")
_FILL_SECT  = PatternFill("solid", fgColor="1A5C7A")
_FILL_ALT   = PatternFill("solid", fgColor="F0F7FB")
_FILL_CYAN  = PatternFill("solid", fgColor="00E5FF")
_FILL_LIME  = PatternFill("solid", fgColor="B6FF3C")
_FILL_PINK  = PatternFill("solid", fgColor="FF3D8A")

_FONT_HDR   = Font(bold=True, color="FFFFFF", size=10)
_FONT_TITLE = Font(bold=True, color="FFFFFF", size=13)
_FONT_SECT  = Font(bold=True, color="FFFFFF", size=10)

# ── Vietnamese display maps ────────────────────────────────────────────────────
_GENDER_VN = {"male": "Nam", "female": "Nữ", "other": "Khác"}
_STATUS_VN = {
    "pending": "Chờ xử lý", "active": "Đang học", "suspended": "Tạm nghỉ",
    "completed": "Đã tốt nghiệp", "dropped": "Nghỉ học",
}
_CLASS_STATUS_VN = {
    "upcoming": "Sắp khai giảng", "enrolling": "Đang tuyển sinh",
    "in_progress": "Đang diễn ra", "completed": "Đã kết thúc", "cancelled": "Đã hủy",
}
_METHOD_VN = {
    "cash": "Tiền mặt", "bank_transfer": "Chuyển khoản",
    "momo": "MoMo", "zalopay": "ZaloPay",
}
_KIND_VN = {"tuition": "Học phí", "rental": "Thuê xe"}


# ── Small formatters ───────────────────────────────────────────────────────────
def _ev(v) -> str:
    return str(v.value if hasattr(v, "value") else (v or ""))

def _vn_date(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%d/%m/%Y") if hasattr(dt, "strftime") else str(dt)

def _vn_label(mapping: dict, val) -> str:
    return mapping.get(_ev(val), _ev(val))

def _pay_status_vn(paid: int, total_fee) -> str:
    committed = int(total_fee or 0)
    if committed == 0:    return "Chưa xác định"
    if paid >= committed: return "Đã nộp đủ"
    if paid > 0:          return "Còn nợ"
    return "Chưa nộp"

def _reconstruct_qr(s) -> str:
    """Rebuild an approximate CCCD-QR string from stored fields (legacy students),
    using the OLD on-CCCD address (dia_chi_cccd)."""
    if not s.cccd_number:
        return ""
    dob = s.ngay_sinh.strftime("%d%m%Y") if s.ngay_sinh else ""
    iss = s.cccd_issued_date.strftime("%d%m%Y") if s.cccd_issued_date else ""
    addr = getattr(s, "dia_chi_cccd", None) or s.dia_chi or ""
    return "|".join([s.cccd_number, "", s.ten_hoc_vien or "", dob, _GENDER_VN.get(_ev(s.gioi_tinh), ""), addr, iss])


# ── Low-level sheet primitives ─────────────────────────────────────────────────
def _xhdr(ws, headers: list[str]) -> None:
    ws.append(headers)
    for col in range(1, len(headers) + 1):
        c = ws.cell(1, col)
        c.fill = _FILL_HDR
        c.font = _FONT_HDR
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

def _autofit(ws, max_w: int = 40) -> None:
    for col in ws.columns:
        w = max((len(str(c.value or "")) for c in col), default=8)
        ws.column_dimensions[col[0].column_letter].width = min(w + 4, max_w)

_SHEET_TITLE_BAD = str.maketrans({c: "-" for c in r"\/?*[]:"})

def _safe_title(title: str) -> str:
    """Strip characters Excel rejects in sheet names (max 31 chars)."""
    return title.translate(_SHEET_TITLE_BAD)[:31]

def _sect_hdr(ws, label: str) -> int:
    ws.append([label])
    r = ws.max_row
    ws.cell(r, 1).fill = _FILL_SECT
    ws.cell(r, 1).font = _FONT_SECT
    ws.cell(r, 1).alignment = Alignment(vertical="center")
    ws.row_dimensions[r].height = 22
    return r


# ── Sheet 1: Tổng quan (summary) ──────────────────────────────────────────────
def summary_sheet(ws, now_dt, branches, students, classes,
                  branch_map, branch_revenue, branch_students,
                  branch_students_month, branch_outstanding,
                  status_counts, total_paid, total_outstanding, active_classes) -> None:
    # Title
    ws.append(["BÁO CÁO TỔNG QUAN — MOTO GIA THỊNH"])
    ws.cell(1, 1).fill = _FILL_HDR
    ws.cell(1, 1).font = _FONT_TITLE
    ws.cell(1, 1).alignment = Alignment(vertical="center")
    ws.row_dimensions[1].height = 30

    ws.append([f"Ngày xuất: {now_dt.strftime('%d/%m/%Y %H:%M')}"])
    ws.cell(2, 1).font = Font(italic=True, color="555555", size=9)
    ws.append([])

    # KPI section
    _sect_hdr(ws, "CHỈ SỐ CHUNG")
    ws.append(["CHỈ SỐ", "GIÁ TRỊ"])
    hdr_r = ws.max_row
    for col in [1, 2]:
        ws.cell(hdr_r, col).fill = _FILL_HDR
        ws.cell(hdr_r, col).font = _FONT_HDR
        ws.cell(hdr_r, col).alignment = Alignment(horizontal="center")

    kpis = [
        ("Tổng học viên", len(students)),
        ("Đang học", status_counts.get("active", 0)),
        ("Đã tốt nghiệp", status_counts.get("completed", 0)),
        ("Chờ xử lý", status_counts.get("pending", 0)),
        ("Tạm nghỉ & Nghỉ học", status_counts.get("suspended", 0) + status_counts.get("dropped", 0)),
        ("Tổng doanh thu đã thu (đ)", total_paid),
        ("Tổng còn nợ (đ)", total_outstanding),
        ("Số chi nhánh", len(branches)),
        ("Số lớp đang hoạt động", active_classes),
    ]
    for i, (label, val) in enumerate(kpis):
        ws.append([label, val])
        r = ws.max_row
        if i % 2 == 1:
            for col in [1, 2]:
                ws.cell(r, col).fill = _FILL_ALT
        if "(đ)" in label:
            ws.cell(r, 2).number_format = "#,##0"

    ws.append([])

    # Branch performance section
    _sect_hdr(ws, "HIỆU SUẤT THEO CHI NHÁNH")
    b_hdrs = ["CHI NHÁNH", "TỔNG HV", "HV THÁNG NÀY", "DOANH THU ĐÃ THU (đ)", "CÒN NỢ (đ)"]
    ws.append(b_hdrs)
    hdr_r2 = ws.max_row
    for col in range(1, len(b_hdrs) + 1):
        ws.cell(hdr_r2, col).fill = _FILL_HDR
        ws.cell(hdr_r2, col).font = _FONT_HDR
        ws.cell(hdr_r2, col).alignment = Alignment(horizontal="center")

    for i, b in enumerate(branches):
        ws.append([
            b.ten_chi_nhanh,
            branch_students.get(b.id, 0),
            branch_students_month.get(b.id, 0),
            branch_revenue.get(b.id, 0),
            branch_outstanding.get(b.id, 0),
        ])
        r = ws.max_row
        if i % 2 == 1:
            for col in range(1, 6):
                ws.cell(r, col).fill = _FILL_ALT
        ws.cell(r, 4).number_format = "#,##0"
        ws.cell(r, 5).number_format = "#,##0"

    for letter, w in [("A", 34), ("B", 13), ("C", 16), ("D", 26), ("E", 18)]:
        ws.column_dimensions[letter].width = w


# ── Sheet 2: Học viên (enriched) ──────────────────────────────────────────────
def student_sheet(ws, students, branch_map, user_map, pos_paid, class_map) -> None:
    _xhdr(ws, [
        "MÃ HV", "HỌ TÊN", "NGÀY SINH", "GIỚI TÍNH", "SỐ CCCD",
        "Nơi thường trú - trên CCCD", "Nơi thường trú - địa chỉ mới", "Mã QR CCCD",
        "ĐIỆN THOẠI", "LOẠI BẰNG", "TRẠNG THÁI",
        "NGÀY ĐĂNG KÝ", "CHI NHÁNH", "LỚP HỌC",
        "ĐÃ THANH TOÁN (đ)", "CÒN LẠI (đ)", "TRẠNG THÁI THANH TOÁN",
        "NGƯỜI TẠO", "GHI CHÚ",
    ])
    ws.freeze_panes = "A2"

    for i, s in enumerate(students):
        paid      = pos_paid.get(s.id, 0)
        balance   = max(0, int(s.total_fee or 0) - paid)
        staff     = user_map.get(s.responsible_staff_id)
        staff_name = (staff.full_name or staff.email) if staff else ""

        ws.append([
            s.ma_hoc_vien, s.ten_hoc_vien, _vn_date(s.ngay_sinh),
            _vn_label(_GENDER_VN, s.gioi_tinh), s.cccd_number or "",
            getattr(s, "dia_chi_cccd", None) or "",                 # F: OLD address (on CCCD)
            s.dia_chi or "",                                        # G: NEW address (diachi-converted)
            getattr(s, "cccd_qr_raw", None) or _reconstruct_qr(s),  # H: raw QR (rebuilt for legacy)
            s.so_dien_thoai, _ev(s.loai_bang_lai),
            _vn_label(_STATUS_VN, s.trang_thai),
            _vn_date(s.ngay_dang_ky or s.created_at),
            branch_map.get(s.branch_id, ""),
            class_map.get(s.id, ""),                           # N: Lớp học
            paid, balance, _pay_status_vn(paid, s.total_fee),
            staff_name, s.ghi_chu or "",
        ])
        r = ws.max_row
        if i % 2 == 1:
            for col in range(1, 20):
                ws.cell(r, col).fill = _FILL_ALT
        ws.cell(r, 15).number_format = "#,##0"
        ws.cell(r, 16).number_format = "#,##0"

    _autofit(ws)


# ── Sheet 3: Thanh toán (fixed) ───────────────────────────────────────────────
def payment_sheet(ws, payments, student_map, branch_map) -> None:
    _xhdr(ws, [
        "MÃ GD", "MÃ HV", "TÊN HỌC VIÊN", "CHI NHÁNH",
        "SỐ TIỀN (đ)", "PHƯƠNG THỨC", "LOẠI",
        "NGÀY THU", "SỐ BIÊN LAI", "GHI CHÚ",
    ])
    ws.freeze_panes = "A2"

    for i, p in enumerate(payments):
        s = student_map.get(p.student_id)
        ws.append([
            p.ma_giao_dich,
            s.ma_hoc_vien if s else "",
            s.ten_hoc_vien if s else "",
            branch_map.get(p.branch_id, ""),
            int(p.so_tien) if p.so_tien else 0,
            _vn_label(_METHOD_VN, p.phuong_thuc),
            _vn_label(_KIND_VN, p.kind or "tuition"),
            _vn_date(p.collected_at),
            p.so_bien_lai_id or p.so_bien_lai or "",
            p.ghi_chu or "",
        ])
        r = ws.max_row
        if i % 2 == 1:
            for col in range(1, 11):
                ws.cell(r, col).fill = _FILL_ALT
        ws.cell(r, 5).number_format = "#,##0"

    _autofit(ws)


# ── Sheet 4: Lớp học ──────────────────────────────────────────────────────────
def class_sheet(ws, classes, branch_map) -> None:
    _xhdr(ws, [
        "MÃ LỚP", "TÊN LỚP", "CHI NHÁNH",
        "NGÀY KHAI GIẢNG", "NGÀY KẾT THÚC",
        "SỨC CHỨA", "ĐÃ ĐĂNG KÝ", "TRẠNG THÁI", "GHI CHÚ",
    ])
    ws.freeze_panes = "A2"

    for i, cls in enumerate(classes):
        ws.append([
            cls.ma_lop, cls.ten_lop,
            branch_map.get(cls.branch_id, ""),
            _vn_date(cls.ngay_khai_giang),
            _vn_date(cls.ngay_ket_thuc),
            cls.so_luong_toi_da, cls.so_luong_hien_tai,
            _vn_label(_CLASS_STATUS_VN, cls.trang_thai),
            cls.ghi_chu or "",
        ])
        if i % 2 == 1:
            for col in range(1, 10):
                ws.cell(ws.max_row, col).fill = _FILL_ALT

    _autofit(ws)


# ── Sheets 5 & 6: CTV student details (month-scoped) ─────────────────────────
def ctv_students_sheet(ws, month: int, year: int,
                       students, branch_map, user_map,
                       ctv_ids: set) -> None:
    """Month-scoped CTV performance sheet.

    Shows only CTV-sourced students registered in the given calendar month.
    Columns: MÃ HV · HỌ TÊN · LOẠI BẰNG · NGÀY ĐĂNG KÝ · CHI NHÁNH ·
             NGƯỜI GIỚI THIỆU · HẠNG · SỐ HỒ SƠ
    Pre-sorted: HẠNG ASC (rank 1 = most profiles), then NGÀY ĐĂNG KÝ ASC.
    Row fills: rank 1 = cyan #00E5FF, rank 2 = lime #B6FF3C, rank 3 = pink #FF3D8A,
               rank 4+ = alternating alt/white.
    """
    _, last_day = monthrange(year, month)
    m_start = date(year, month, 1)
    m_end   = date(year, month, last_day)

    def _reg(s):
        if s.ngay_dang_ky:
            return s.ngay_dang_ky
        ca = s.created_at
        if ca and hasattr(ca, "date"):
            return ca.date()
        return None

    month_students = [s for s in students if (r := _reg(s)) and m_start <= r <= m_end]

    ctv_count: dict = {}
    for s in month_students:
        uid = s.responsible_staff_id
        if uid and uid in ctv_ids:
            ctv_count[uid] = ctv_count.get(uid, 0) + 1

    ranked_ctv = sorted(ctv_count.items(), key=lambda x: x[1], reverse=True)
    ctv_rank = {uid: rank for rank, (uid, _) in enumerate(ranked_ctv, 1)}

    rows = [s for s in month_students if s.responsible_staff_id in ctv_rank]
    rows.sort(key=lambda s: (ctv_rank[s.responsible_staff_id], _reg(s) or date.min))

    _xhdr(ws, [
        "MÃ HV", "HỌ TÊN", "LOẠI BẰNG", "NGÀY ĐĂNG KÝ",
        "CHI NHÁNH", "NGƯỜI TẠO", "SỐ HỒ SƠ", "HẠNG",
    ])
    ws.freeze_panes = "A2"

    for i, s in enumerate(rows):
        rank  = ctv_rank[s.responsible_staff_id]
        staff = user_map.get(s.responsible_staff_id)
        ws.append([
            s.ma_hoc_vien, s.ten_hoc_vien,
            _ev(s.loai_bang_lai),
            _vn_date(s.ngay_dang_ky or s.created_at),
            branch_map.get(s.branch_id, ""),
            (staff.full_name or staff.email) if staff else "",
            ctv_count[s.responsible_staff_id],
            f"TOP {rank}",
        ])
        fill = (
            _FILL_CYAN if rank == 1
            else _FILL_LIME if rank == 2
            else _FILL_PINK if rank == 3
            else (_FILL_ALT if i % 2 == 1 else None)
        )
        if fill:
            r = ws.max_row
            for col in range(1, 9):
                ws.cell(r, col).fill = fill

    _autofit(ws)
