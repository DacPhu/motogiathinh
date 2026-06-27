from app.models.branch import Branch
from app.models.certificate import Certificate
from app.models.class_model import Class, ClassEnrollment
from app.models.course import CourseType
from app.models.exam import ExamRegistration, ExamSession
from app.models.fee_plan import FeePlan
from app.models.instructor import Instructor, InstructorAvailability
from app.models.notification import AuditLog, Notification, SystemSetting
from app.models.payment import Payment, PaymentGatewayLog, PaymentPlan
from app.models.session_model import Attendance, Session, SessionLog
from app.models.student import DocumentType, Student, StudentContact, StudentDocument, StudentHealthCheck
from app.models.promotion import Promotion
from app.models.user import AuthToken, User
from app.models.user_assignment import UserBranchAssignment, UserClassAssignment
from app.models.user_permission import UserPermission
from app.models.vehicle import Vehicle, VehicleMaintenance

__all__ = [
    "Branch",
    "User",
    "AuthToken",
    "UserBranchAssignment",
    "UserClassAssignment",
    "UserPermission",
    "Student",
    "StudentContact",
    "StudentHealthCheck",
    "DocumentType",
    "StudentDocument",
    "Instructor",
    "InstructorAvailability",
    "Vehicle",
    "VehicleMaintenance",
    "CourseType",
    "Class",
    "ClassEnrollment",
    "Session",
    "Attendance",
    "SessionLog",
    "ExamSession",
    "ExamRegistration",
    "PaymentPlan",
    "Payment",
    "PaymentGatewayLog",
    "Certificate",
    "Notification",
    "AuditLog",
    "SystemSetting",
    "Promotion",
    "FeePlan",
]
