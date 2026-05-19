import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { Toaster } from 'react-hot-toast'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

const antdTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    colorBgBase: '#0d1117',
    colorBgContainer: '#161b22',
    colorBorder: '#30363d',
    colorText: '#f0f6fc',
    colorTextSecondary: '#8b949e',
    borderRadius: 8,
    fontFamily: "'Barlow', -apple-system, sans-serif",
  },
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={antdTheme}>
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#161b22',
              color: '#f0f6fc',
              border: '1px solid #30363d',
              fontFamily: "'Barlow', sans-serif",
            },
          }}
        />
      </ConfigProvider>
    </QueryClientProvider>
  )
}
