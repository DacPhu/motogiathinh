import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const store = useAuthStore()
  const navigate = useNavigate()

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password)
    store.setTokens(data.access_token, data.refresh_token)
    const { data: user } = await authApi.me()
    store.setUser(user)
    navigate('/')
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {}
    store.logout()
    navigate('/login')
  }

  return {
    user: store.user,
    isAdmin: store.isAdmin(),
    branchId: store.branchId(),
    isAuthenticated: !!store.accessToken,
    login,
    logout,
  }
}
