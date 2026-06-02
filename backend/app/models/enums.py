import enum


class LicenseType(str, enum.Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C = "C"
    D = "D"
    E = "E"
    F = "F"


class GenderType(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class StudentStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"
    completed = "completed"
    dropped = "dropped"


class ClassStatus(str, enum.Enum):
    upcoming = "upcoming"
    enrolling = "enrolling"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class SessionType(str, enum.Enum):
    theory = "theory"
    practice = "practice"
    exam_prep = "exam_prep"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    partial = "partial"
    paid = "paid"
    overdue = "overdue"
    waived = "waived"
    refunded = "refunded"


class PaymentTypeEnum(str, enum.Enum):
    full = "full"
    installment = "installment"
    waived = "waived"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    bank_transfer = "bank_transfer"
    momo = "momo"
    zalopay = "zalopay"


class ExamResult(str, enum.Enum):
    pass_ = "pass"
    fail = "fail"
    absent = "absent"
    pending = "pending"


class VehicleStatus(str, enum.Enum):
    active = "active"
    maintenance = "maintenance"
    retired = "retired"


class CertificateStatus(str, enum.Enum):
    pending = "pending"
    issued = "issued"
    submitted_to_authority = "submitted_to_authority"
    revoked = "revoked"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    excused = "excused"


class RoleName(str, enum.Enum):
    admin = "admin"
    staff = "staff"
    guest = "guest"


class LeadSource(str, enum.Enum):
    facebook = "facebook"
    walk_in = "walk_in"
    referral = "referral"
    zalo = "zalo"
    chatbot = "chatbot"
    other = "other"


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    enrolled = "enrolled"
    lost = "lost"
    unclaimed = "unclaimed"


class NotifTrigger(str, enum.Enum):
    payment_due = "payment_due"
    session_reminder = "session_reminder"
    exam_reminder = "exam_reminder"
    certificate_ready = "certificate_ready"
    document_incomplete = "document_incomplete"
