"""OCR extraction for Vietnamese CCCD (Căn Cước Công Dân).

Uses Google Cloud Vision API (DOCUMENT_TEXT_DETECTION) — requires GOOGLE_VISION_API_KEY.
Falls back to VietOCR microservice if Vision key is not set or call fails.
No Tesseract fallback.
"""

import base64
import os
import re
import traceback

import httpx

GOOGLE_VISION_API_KEY = os.getenv("GOOGLE_VISION_API_KEY", "")
OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://ocr:8082")

_EMPTY = {
    "cccd_number": None, "full_name": None, "date_of_birth": None,
    "gender": None, "address": None, "issued_date": None,
    "issued_place": None, "raw_text": "",
}


async def extract_cccd_info(image_bytes: bytes) -> dict:
    # 1. Google Vision (if key configured)
    if GOOGLE_VISION_API_KEY:
        try:
            result = await _google_vision_extract(image_bytes)
            if result.get("cccd_number") or result.get("full_name"):
                return result
        except Exception:
            with open("/tmp/vision_error.txt", "w") as _f:
                _f.write(traceback.format_exc())

    # 2. VietOCR microservice
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{OCR_SERVICE_URL}/extract-cccd",
                files={"file": ("cccd.jpg", image_bytes, "image/jpeg")},
            )
            r.raise_for_status()
            result = r.json()
            if result.get("cccd_number") or result.get("full_name"):
                return result
    except Exception:
        pass

    return dict(_EMPTY)


async def _google_vision_extract(image_bytes: bytes) -> dict:
    """Call Google Vision DOCUMENT_TEXT_DETECTION and parse CCCD fields."""
    b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "requests": [{
            "image": {"content": b64},
            "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
            "imageContext": {"languageHints": ["vi"]},
        }]
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_VISION_API_KEY}",
            json=payload,
        )
        r.raise_for_status()
        data = r.json()

    raw_text = (
        data.get("responses", [{}])[0]
        .get("fullTextAnnotation", {})
        .get("text", "")
    )
    with open("/tmp/vision_raw.txt", "w") as f:
        f.write(raw_text)
    if not raw_text:
        return dict(_EMPTY)

    result = _parse_cccd_text(raw_text)
    result["raw_text"] = raw_text
    return result


def _parse_cccd_text(text: str) -> dict:
    """Parse CCCD fields from raw OCR text."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    result: dict = {
        "cccd_number": None,
        "full_name": None,
        "date_of_birth": None,
        "gender": None,
        "address": None,
        "issued_date": None,
        "issued_place": None,
        "raw_text": text,
    }

    full_text = " ".join(lines)

    id_match = re.search(r"\b(\d{12}|\d{9})\b", full_text)
    if id_match:
        result["cccd_number"] = id_match.group(1)

    dates = re.findall(r"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})", full_text)

    for i, line in enumerate(lines):
        upper = line.upper()

        if re.search(r"H[ỌO].*T[ÊE]N|HO.*TEN", upper) and not result["full_name"]:
            after_colon = re.split(r":\s*", line, maxsplit=1)
            candidate = after_colon[1].strip() if len(after_colon) > 1 and after_colon[1].strip() else ""
            if not candidate and i + 1 < len(lines):
                candidate = lines[i + 1]
            if candidate and not re.search(r"full name|date|birth|sex|place", candidate, re.I):
                result["full_name"] = candidate

        if re.search(r"NG[ÀA]Y.*SINH|SINH", upper) and not result["date_of_birth"]:
            date_match = re.search(r"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})", line)
            if date_match:
                result["date_of_birth"] = _normalize_date(date_match.group(1))

        if re.search(r"GI[ỚO]I.*T[ÍI]NH|GIOI.*TINH", upper) and not result["gender"]:
            if re.search(r"\bNAM\b", upper):
                result["gender"] = "male"
            elif re.search(r"N[Ữ\s]|NỮ|NU\b", upper):
                result["gender"] = "female"

        if re.search(r"TH[ƯU][ỜO]NG.*TR[ÚU]|N[ƠO]I.*TR[ÚU]", upper) and not result["address"]:
            after = re.split(r":\s*", line, maxsplit=1)
            addr = after[1].strip() if len(after) > 1 and after[1].strip() else ""
            if (not addr or len(addr) < 20) and i + 1 < len(lines):
                addr = (addr + " " + lines[i + 1]).strip()
            result["address"] = addr or None

        if re.search(r"NG[ÀA]Y.*C[ẤA]P|NGAY.*CAP", upper) and not result["issued_date"]:
            date_match = re.search(r"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})", line)
            if date_match:
                result["issued_date"] = _normalize_date(date_match.group(1))

        if re.search(r"N[ƠO]I.*C[ẤA]P|NOI.*CAP", upper) and not result["issued_place"]:
            after = re.split(r":\s*", line, maxsplit=1)
            place = after[1].strip() if len(after) > 1 and after[1].strip() else ""
            if not place and i + 1 < len(lines):
                place = lines[i + 1]
            result["issued_place"] = place or None

    if dates:
        if not result["date_of_birth"]:
            result["date_of_birth"] = _normalize_date(dates[0])
        if not result["issued_date"] and len(dates) >= 2:
            result["issued_date"] = _normalize_date(dates[-1])

    return result


def _normalize_date(date_str: str) -> str | None:
    parts = re.split(r"[/\-\.]", date_str)
    if len(parts) == 3:
        d, m, y = parts
        try:
            return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
        except ValueError:
            pass
    return None
