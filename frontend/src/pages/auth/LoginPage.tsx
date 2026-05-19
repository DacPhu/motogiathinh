import React, { useState } from 'react'
import { Form, Input, Button, Alert } from 'antd'
import { CarOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'

const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      await login(values.email, values.password)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Barlow', sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');`}</style>

      <div style={{
        width: 400,
        background: 'linear-gradient(135deg, #161b22, #0d1117)',
        border: '1px solid #30363d',
        borderRadius: 20,
        padding: '48px 40px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #1677ff, #0958d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px #1677ff40',
          }}>
            <CarOutlined style={{ color: '#fff', fontSize: 30 }} />
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 26, fontWeight: 800, color: '#f0f6fc',
            letterSpacing: '0.05em',
          }}>
            MOTO GIA THỊNH
          </div>
          <div style={{ color: '#8b949e', fontSize: 13, marginTop: 4 }}>
            Hệ thống quản lý trường lái xe
          </div>
        </div>

        {error && <Alert type="error" message={error} style={{ marginBottom: 20, borderRadius: 8 }} />}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="email" rules={[{ required: true, message: 'Nhập email' }]}>
            <Input
              prefix={<MailOutlined style={{ color: '#8b949e' }} />}
              placeholder="Email"
              size="large"
              style={{
                background: '#0d1117', border: '1px solid #30363d',
                borderRadius: 10, color: '#f0f6fc',
              }}
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: '#8b949e' }} />}
              placeholder="Mật khẩu"
              size="large"
              style={{
                background: '#0d1117', border: '1px solid #30363d',
                borderRadius: 10, color: '#f0f6fc',
              }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary" htmlType="submit" size="large"
              loading={loading} block
              style={{
                height: 48, borderRadius: 10, fontSize: 15, fontWeight: 700,
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em',
                background: 'linear-gradient(135deg, #1677ff, #0958d9)',
                border: 'none', boxShadow: '0 4px 16px #1677ff40',
              }}
            >
              ĐĂNG NHẬP
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default LoginPage
