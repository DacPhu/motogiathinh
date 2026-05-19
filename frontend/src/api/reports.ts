import { apiClient } from './client'
import type { DashboardStats } from '@/types'

export const reportsApi = {
  getDashboard: (branch_id?: string) =>
    apiClient.get<DashboardStats>('/reports/dashboard', { params: { branch_id } }),

  getRevenue: (year: number, branch_id?: string) =>
    apiClient.get<Array<{ month: number; total: number }>>('/reports/revenue', {
      params: { year, branch_id },
    }),
}
