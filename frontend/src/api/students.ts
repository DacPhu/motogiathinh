import { apiClient } from './client'
import type { PaginatedResponse, Student, StudentListItem } from '@/types'

export interface StudentFilters {
  page?: number
  page_size?: number
  search?: string
  trang_thai?: string
  loai_bang_lai?: string
  is_repeat?: boolean
  branch_id?: string
}

export interface StudentCreateData {
  ten_hoc_vien: string
  ngay_sinh: string
  gioi_tinh: string
  cccd_number?: string
  so_dien_thoai: string
  dia_chi_email?: string
  dia_chi?: string
  phuong_xa?: string
  quan_huyen?: string
  tinh_thanh?: string
  loai_bang_lai: string
  lead_source?: string
  facebook_lead_id?: string
  zalo_number?: string
  health_cert_expiry?: string
  ghi_chu?: string
}

export const studentsApi = {
  list: (filters: StudentFilters = {}) =>
    apiClient.get<PaginatedResponse<StudentListItem>>('/students', { params: filters }),

  get: (id: string) => apiClient.get<Student>(`/students/${id}`),

  create: (data: StudentCreateData, force = false) =>
    apiClient.post('/students', data, { params: { force } }),

  update: (id: string, data: Partial<StudentCreateData>) =>
    apiClient.patch<Student>(`/students/${id}`, data),

  delete: (id: string) => apiClient.delete(`/students/${id}`),

  getDocsCompleteness: (id: string) =>
    apiClient.get<{ student_id: string; docs_complete: boolean }>(`/students/${id}/docs-completeness`),

  getQR: (id: string) =>
    apiClient.get(`/students/${id}/qr`, { responseType: 'blob' }),
}
