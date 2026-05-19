export type RoleName = 'admin' | 'staff'

export type LicenseType = 'A1' | 'A2' | 'B1' | 'B2' | 'C' | 'D' | 'E' | 'F'
export type StudentStatus = 'pending' | 'active' | 'suspended' | 'completed' | 'dropped'
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'waived' | 'refunded'
export type PaymentType = 'full' | 'installment' | 'waived'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'vnpay' | 'momo' | 'zalopay'
export type LeadSource = 'facebook' | 'walk_in' | 'referral' | 'zalo' | 'chatbot' | 'other'
export type LeadStatus = 'new' | 'contacted' | 'enrolled' | 'lost' | 'unclaimed'
export type ClassStatus = 'upcoming' | 'enrolling' | 'in_progress' | 'completed' | 'cancelled'

export interface User {
  id: string
  email: string
  phone: string | null
  full_name: string | null
  role: RoleName
  branch_id: string | null
  is_active: boolean
}

export interface Branch {
  id: string
  ma_chi_nhanh: string
  ten_chi_nhanh: string
  dia_chi: string | null
  is_active: boolean
}

export interface Student {
  id: string
  branch_id: string
  ma_hoc_vien: string
  ten_hoc_vien: string
  ngay_sinh: string
  gioi_tinh: 'male' | 'female' | 'other'
  cccd_number: string | null
  so_dien_thoai: string
  dia_chi_email: string | null
  dia_chi: string | null
  phuong_xa: string | null
  quan_huyen: string | null
  tinh_thanh: string | null
  loai_bang_lai: LicenseType
  trang_thai: StudentStatus
  is_repeat_student: boolean
  repeat_count: number
  lead_source: LeadSource | null
  health_cert_expiry: string | null
  qr_code_url: string | null
  zalo_number: string | null
  ghi_chu: string | null
  ngay_dang_ky: string
  created_at: string
  updated_at: string
}

export interface StudentListItem {
  id: string
  ma_hoc_vien: string
  ten_hoc_vien: string
  so_dien_thoai: string
  loai_bang_lai: LicenseType
  trang_thai: StudentStatus
  is_repeat_student: boolean
  ngay_dang_ky: string
  branch_id: string
  docs_complete: boolean | null
}

export interface PaymentPlan {
  id: string
  branch_id: string
  student_id: string
  class_enrollment_id: string
  payment_type: PaymentType
  total_amount: number
  discount_amount: number
  net_amount: number
  paid_amount: number
  remaining_amount: number
  payment_status: PaymentStatus
  due_date: string | null
  ghi_chu: string | null
}

export interface Payment {
  id: string
  branch_id: string
  payment_plan_id: string
  student_id: string
  ma_giao_dich: string
  so_tien: number
  phuong_thuc: PaymentMethod
  loai_thanh_toan: string | null
  collected_by: string
  collected_at: string
  payment_status: PaymentStatus
  payment_date: string | null
  so_bien_lai: string | null
  ghi_chu: string | null
}

export interface Lead {
  id: string
  branch_id: string | null
  ho_ten: string | null
  so_dien_thoai: string | null
  email: string | null
  lead_source: LeadSource
  facebook_lead_id: string | null
  ad_name: string | null
  form_name: string | null
  trang_thai: LeadStatus
  assigned_to: string | null
  converted_to: string | null
  ghi_chu: string | null
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface DashboardStats {
  cash_today: number
  revenue_mtd: number
  outstanding: number
  student_counts: Record<StudentStatus, number>
  staff_collections_today: StaffCollection[]
  generated_at: string
}

export interface StaffCollection {
  user_id: string
  full_name: string | null
  email: string
  total_collected: number
  payment_count: number
  date: string | null
}
