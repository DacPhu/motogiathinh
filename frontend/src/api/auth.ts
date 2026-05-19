import { apiClient } from './client'
import type { User } from '@/types'

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ access_token: string; refresh_token: string; token_type: string }>(
      '/auth/login',
      { email, password }
    ),

  logout: () => apiClient.post('/auth/logout'),

  me: () => apiClient.get<User>('/auth/me'),

  refresh: (refresh_token: string) =>
    apiClient.post<{ access_token: string; refresh_token: string }>('/auth/refresh', {
      refresh_token,
    }),
}
