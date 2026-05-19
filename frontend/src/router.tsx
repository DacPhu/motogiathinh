import React from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import StudentListPage from '@/pages/students/StudentListPage'

// Lazy pages
const StudentDetailPage = React.lazy(() => import('@/pages/students/StudentDetailPage'))
const StudentCreatePage = React.lazy(() => import('@/pages/students/StudentCreatePage'))
const LeadListPage = React.lazy(() => import('@/pages/leads/LeadListPage'))
const PaymentListPage = React.lazy(() => import('@/pages/payments/PaymentListPage'))
const ReportsPage = React.lazy(() => import('@/pages/reports/ReportsPage'))

const ProtectedRoute: React.FC = () => {
  const token = useAuthStore(s => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/students', element: <StudentListPage /> },
          { path: '/students/new', element: <React.Suspense fallback={null}><StudentCreatePage /></React.Suspense> },
          { path: '/students/:id', element: <React.Suspense fallback={null}><StudentDetailPage /></React.Suspense> },
          { path: '/leads', element: <React.Suspense fallback={null}><LeadListPage /></React.Suspense> },
          { path: '/payments', element: <React.Suspense fallback={null}><PaymentListPage /></React.Suspense> },
          { path: '/reports', element: <React.Suspense fallback={null}><ReportsPage /></React.Suspense> },
          // Placeholder routes — to be implemented
          { path: '/classes', element: <div style={{padding:40,color:'#8b949e'}}>Classes — coming soon</div> },
          { path: '/schedule', element: <div style={{padding:40,color:'#8b949e'}}>Schedule — coming soon</div> },
          { path: '/exams', element: <div style={{padding:40,color:'#8b949e'}}>Exams — coming soon</div> },
          { path: '/certificates', element: <div style={{padding:40,color:'#8b949e'}}>Certificates — coming soon</div> },
          { path: '/instructors', element: <div style={{padding:40,color:'#8b949e'}}>Instructors — coming soon</div> },
          { path: '/vehicles', element: <div style={{padding:40,color:'#8b949e'}}>Vehicles — coming soon</div> },
          { path: '/admin/*', element: <div style={{padding:40,color:'#8b949e'}}>Admin — coming soon</div> },
          { path: '/profile', element: <div style={{padding:40,color:'#8b949e'}}>Profile — coming soon</div> },
        ],
      },
    ],
  },
])
