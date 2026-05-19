import re


def validate_vietnam_phone(phone: str) -> bool:
    """Vietnamese phone numbers: 10 digits starting with 0, or +84 prefix."""
    cleaned = phone.replace(" ", "").replace("-", "")
    pattern = r"^(0|\+84)(3[2-9]|5[6-9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$"
    return bool(re.match(pattern, cleaned))


def validate_cccd(cccd: str) -> bool:
    """Vietnamese CCCD: 12 digits."""
    return bool(re.match(r"^\d{12}$", cccd.strip()))


def validate_email(email: str) -> bool:
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def normalize_phone(phone: str) -> str:
    """Normalize to 0XXXXXXXXX format."""
    cleaned = phone.replace(" ", "").replace("-", "")
    if cleaned.startswith("+84"):
        cleaned = "0" + cleaned[3:]
    return cleaned
