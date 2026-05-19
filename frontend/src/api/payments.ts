import { apiClient } from './client'
import type { Payment, PaymentPlan, StaffCollection } from '@/types'

export const paymentsApi = {
  recordPayment: (data: {
    payment_plan_id: string
    so_tien: number
    phuong_thuc: string
    loai_thanh_toan?: string
    ghi_chu?: string
  }) => apiClient.post<Payment>('/payments', data),

  createPlan: (data: {
    student_id: string
    class_enrollment_id: string
    payment_type: string
    total_amount: number
    discount_amount?: number
    discount_reason?: string
    due_date?: string
    ghi_chu?: string
  }) => apiClient.post<PaymentPlan>('/payments/plans', data),

  getStaffCollection: (params: { on_date?: string; branch_id?: string } = {}) =>
    apiClient.get<StaffCollection[]>('/payments/per-staff', { params }),

  getOverdue: (params: { branch_id?: string } = {}) =>
    apiClient.get<PaymentPlan[]>('/payments/overdue', { params }),

  waivePlan: (planId: string, reason: string) =>
    apiClient.post<PaymentPlan>(`/payments/plans/${planId}/waive`, null, {
      params: { reason },
    }),
}
