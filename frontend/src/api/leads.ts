import { apiClient } from './client'
import type { Lead } from '@/types'

export const leadsApi = {
  list: (params: { unclaimed_only?: boolean; branch_id?: string } = {}) =>
    apiClient.get<Lead[]>('/leads', { params }),

  getUnclaimedCount: () => apiClient.get<{ count: number }>('/leads/unclaimed-count'),

  assign: (leadId: string, assignedTo: string) =>
    apiClient.post(`/leads/${leadId}/assign`, { assigned_to: assignedTo }),

  convert: (leadId: string, data: { branch_id: string; loai_bang_lai: string }) =>
    apiClient.post(`/leads/${leadId}/convert`, data),
}
