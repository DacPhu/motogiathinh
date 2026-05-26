"""
ocr_service/app.py — VietOCR-powered CCCD extraction microservice.

Pipeline:
  1. OpenCV preprocessing: grayscale → bilateral denoise → CLAHE → deskew
     (NO binary thresholding — modern CCCD has blue background + light text
      so adaptive threshold inverts and destroys text)
  2. Tesseract image_to_data on the grayscale image for line layout detection
  3. VietOCR transformer to recognise each cropped line (grayscale)
  4. CCCD field parser

Runs on Python 3.11 (VietOCR/PyTorch requirement).
"""

import re
from collections import defaultdict
from contextlib import asynccontextmanager

import cv2
import numpy as np
import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from pytesseract import Output
from vietocr.tool.config import Cfg
from vietocr.tool.predictor import Predictor

# ── Global predictor (loaded once on startup) ─────────────────────────────────
_predictor: Predictor | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _predictor
    print("Loading VietOCR model (vgg_transformer)…")
    cfg = Cfg.load_config_from_name("vgg_transformer")
    cfg["device"] = "cpu"
    cfg["predictor"]["beamsearch"] = False  # faster on CPU
    _predictor = Predictor(cfg)
    print("VietOCR predictor ready.")
    yield


app = FastAPI(title="OCR Service", lifespan=lifespan)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post("/extract-cccd")
async def extract_cccd(file: UploadFile = File(...)):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "File must be JPG, PNG, or WebP")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    try:
        return _extract(content)
    except Exception as exc:
        raise HTTPException(422, f"OCR failed: {exc}") from exc


@app.get("/health")
def health():
    return {"status": "ok", "model": "vgg_transformer", "ready": _predictor is not None}


# ── Core pipeline ─────────────────────────────────────────────────────────────

def _extract(image_bytes: bytes) -> dict:
    pil_img = _preprocess(image_bytes)
    print(f"OCR: img size={pil_img.size}", flush=True)
    crops = _get_line_crops(pil_img)
    print(f"OCR: {len(crops)} crops, sizes={[c.size for _,c in crops[:8]]}", flush=True)
    lines = _recognize_lines(crops)
    print(f"OCR: {len(lines)} lines: {lines[:5]}", flush=True)

    if not lines:
        # VietOCR found nothing — fall back to Tesseract image_to_string
        print("OCR: Tesseract fallback", flush=True)
        raw = pytesseract.image_to_string(pil_img, lang="vie")
        print(f"OCR: Tesseract raw={repr(raw[:400])}", flush=True)
        lines = [l.strip() for l in raw.split("\n") if l.strip()]

    return _parse_cccd(lines)


def _preprocess(image_bytes: bytes) -> Image.Image:
    """Resize to ≤1200px wide then convert to grayscale.

    No bilateral filter, no CLAHE, no deskew — those steps were
    distorting the image (deskew finds wrong contour on blue-background
    CCCD and rotates the card, destroying all text for Tesseract/VietOCR).
    Tesseract applies its own internal Otsu threshold; VietOCR is a neural
    net that handles grayscale natively.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    h, w = img.shape[:2]
    if w > 1200:
        scale = 1200 / w
        img = cv2.resize(img, (1200, int(h * scale)), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return Image.fromarray(gray)


def _get_line_crops(pil_img: Image.Image) -> list[tuple[int, Image.Image]]:
    """
    Return list of (y_top, cropped_line_image) sorted by vertical position.
    Uses Tesseract image_to_data on the grayscale image for layout detection
    (Tesseract applies its own internal Otsu threshold).
    Falls back to row-variance projection if Tesseract finds nothing.
    """
    try:
        data = pytesseract.image_to_data(pil_img, lang="vie", output_type=Output.DICT)
        lines: dict[tuple, list] = defaultdict(list)

        for i, word in enumerate(data["text"]):
            if not str(word).strip():
                continue
            conf = int(data["conf"][i])
            if conf < 0:
                continue
            key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
            lines[key].append(i)

        crops = []
        img_w, img_h = pil_img.size
        for key, indices in lines.items():
            xs = [data["left"][i] for i in indices]
            ys = [data["top"][i] for i in indices]
            ws = [data["width"][i] for i in indices]
            hs = [data["height"][i] for i in indices]
            x1 = max(0, min(xs) - 4)
            y1 = max(0, min(ys) - 4)
            x2 = min(img_w, max(x + w for x, w in zip(xs, ws)) + 4)
            y2 = min(img_h, max(y + h for y, h in zip(ys, hs)) + 4)
            if x2 - x1 < 20 or y2 - y1 < 6:
                continue
            crops.append((y1, pil_img.crop((x1, y1, x2, y2))))

        if crops:
            crops.sort(key=lambda t: t[0])
            return crops
    except Exception:
        pass

    return _projection_crops(pil_img)


def _projection_crops(pil_img: Image.Image) -> list[tuple[int, Image.Image]]:
    """Slice the image into fixed-height strips.

    When Tesseract layout detection fails completely, we fall back to
    naive horizontal slicing. VietOCR handles variable-width line images
    so each strip is a valid input even if it contains blank space.
    """
    w, h = pil_img.size
    strip_h = 45   # ~line height in a phone photo of a CCCD at 1200px wide
    overlap = 8
    crops = []
    y = 0
    while y < h:
        y2 = min(y + strip_h, h)
        if y2 - y > 10:
            crops.append((y, pil_img.crop((0, y, w, y2))))
        y += strip_h - overlap
    return crops


def _recognize_lines(crops: list[tuple[int, Image.Image]]) -> list[str]:
    """Run VietOCR predictor on each line crop."""
    if _predictor is None:
        return []
    lines = []
    for _, crop in crops:
        try:
            text = _predictor.predict(crop)
            if text and text.strip():
                lines.append(text.strip())
        except Exception:
            continue
    return lines


# ── CCCD field parser ─────────────────────────────────────────────────────────

_MISREAD = str.maketrans({
    "О": "O", "о": "o",   # Cyrillic O → Latin
    "\u200b": "",           # zero-width space
})


def _clean(s: str) -> str:
    return s.translate(_MISREAD).strip()


def _parse_cccd(lines: list[str]) -> dict:
    result: dict = {
        "cccd_number": None,
        "full_name": None,
        "date_of_birth": None,
        "gender": None,
        "address": None,
        "issued_date": None,
        "issued_place": None,
        "raw_text": "\n".join(lines),
    }

    full_text = " ".join(_clean(l) for l in lines)

    id_match = re.search(r"\b(\d{12}|\d{9})\b", full_text)
    if id_match:
        result["cccd_number"] = id_match.group(1)

    dates = re.findall(r"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})", full_text)

    for i, raw_line in enumerate(lines):
        line = _clean(raw_line)
        upper = line.upper()

        if not result["full_name"] and re.search(r"H[ỌO].*T[ÊE]N|HO.*TEN", upper):
            after = re.split(r":\s*", line, maxsplit=1)
            candidate = after[1].strip() if len(after) > 1 and after[1].strip() else ""
            if not candidate and i + 1 < len(lines):
                candidate = _clean(lines[i + 1])
            if candidate and not re.search(r"\d{4}", candidate) and not re.search(r"full name|date|birth|sex|place", candidate, re.I):
                result["full_name"] = candidate

        if not result["date_of_birth"] and re.search(r"NG[ÀA]Y.*SINH|SINH", upper):
            m = re.search(r"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})", line)
            if m:
                result["date_of_birth"] = _normalize_date(m.group(1))

        if not result["gender"] and re.search(r"GI[ỚO]I.*T[ÍI]NH|GIOI.*TINH", upper):
            if re.search(r"\bNAM\b", upper):
                result["gender"] = "male"
            elif re.search(r"N[Ữ\s]|NỮ|NU\b", upper):
                result["gender"] = "female"

        if not result["address"] and re.search(r"TH[ƯU][ỜO]NG.*TR[ÚU]|N[ƠO]I.*TR[ÚU]|THUONG.*TRU", upper):
            after = re.split(r":\s*", line, maxsplit=1)
            addr = after[1].strip() if len(after) > 1 else ""
            if (not addr or len(addr) < 20) and i + 1 < len(lines):
                addr = (addr + " " + _clean(lines[i + 1])).strip()
            if (len(addr) < 20) and i + 2 < len(lines):
                addr = (addr + " " + _clean(lines[i + 2])).strip()
            result["address"] = addr or None

        if not result["issued_date"] and re.search(r"NG[ÀA]Y.*C[ẤA]P|NGAY.*CAP", upper):
            m = re.search(r"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})", line)
            if m:
                result["issued_date"] = _normalize_date(m.group(1))

        if not result["issued_place"] and re.search(r"N[ƠO]I.*C[ẤA]P|NOI.*CAP", upper):
            after = re.split(r":\s*", line, maxsplit=1)
            place = after[1].strip() if len(after) > 1 and after[1].strip() else ""
            if not place and i + 1 < len(lines):
                place = _clean(lines[i + 1])
            result["issued_place"] = place or None

    if dates:
        if not result["date_of_birth"]:
            result["date_of_birth"] = _normalize_date(dates[0])
        if not result["issued_date"] and len(dates) >= 2:
            result["issued_date"] = _normalize_date(dates[-1])

    return result


def _normalize_date(date_str: str) -> str | None:
    """Convert D/M/YYYY or DD/MM/YYYY (with / - .) to YYYY-MM-DD."""
    parts = re.split(r"[/\-\.]", date_str)
    if len(parts) == 3:
        d, m, y = parts
        try:
            return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
        except ValueError:
            pass
    return None
