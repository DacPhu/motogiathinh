import React, { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Badge, Layout, Menu, Tooltip, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import {
  AuditOutlined, BankOutlined, CalendarOutlined, CarOutlined,
  DashboardOutlined, FileTextOutlined, LogoutOutlined, MessageOutlined,
  PieChartOutlined, SettingOutlined, TeamOutlined, TrophyOutlined, UserOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'
import { leadsApi } from '@/api/leads'

const { Sider, Content } = Layout
const { Text } = Typography

const DARK = {
  bg: '#0d1117',
  sider: '#161b22',
  border: '#21262d',
  text: '#c9d1d9',
  textMuted: '#8b949e',
  accent: '#1677ff',
  hover: '#1d2a3a',
}

const AppLayout: React.FC = () => {
  const location = useLocation()
  const { user, isAdmin, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const { data: unclaimedData } = useQuery({
    queryKey: ['unclaimed-leads'],
    queryFn: () => leadsApi.getUnclaimedCount().then(r => r.data),
    refetchInterval: 60_000,
  })
  const unclaimedCount = unclaimedData?.count ?? 0

  const selectedKey = '/' + location.pathname.split('/')[1]

  const menuItems = [
    { key: '/',          icon: <DashboardOutlined />, label: <Link to="/">Bảng điều khiển</Link> },
    { key: '/students',  icon: <TeamOutlined />,      label: <Link to="/students">Học viên</Link> },
    { key: '/classes',   icon: <AuditOutlined />,     label: <Link to="/classes">Lớp học</Link> },
    { key: '/schedule',  icon: <CalendarOutlined />,  label: <Link to="/schedule">Lịch học</Link> },
    { key: '/payments',  icon: <BankOutlined />,      label: <Link to="/payments">Thu học phí</Link> },
    { key: '/exams',     icon: <TrophyOutlined />,    label: <Link to="/exams">Thi bằng</Link> },
    { key: '/certificates', icon: <FileTextOutlined />, label: <Link to="/certificates">Chứng chỉ</Link> },
    {
      key: '/leads',
      icon: <MessageOutlined />,
      label: (
        <Link to="/leads" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Leads
          {unclaimedCount > 0 && (
            <Badge count={unclaimedCount} size="small" style={{ backgroundColor: '#f5a623' }} />
          )}
        </Link>
      ),
    },
    { key: '/reports',   icon: <PieChartOutlined />,  label: <Link to="/reports">Báo cáo</Link> },
    ...(isAdmin ? [
      { key: '/instructors', icon: <UserOutlined />, label: <Link to="/instructors">Giáo viên</Link> },
      { key: '/vehicles',    icon: <CarOutlined />,  label: <Link to="/vehicles">Phương tiện</Link> },
      { key: '/admin',       icon: <SettingOutlined />, label: <Link to="/admin">Quản trị</Link> },
    ] : []),
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: DARK.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');
        .ant-menu-dark { background: ${DARK.sider} !important; font-family: 'Barlow', sans-serif !important; }
        .ant-menu-dark .ant-menu-item { border-radius: 8px !important; margin: 2px 8px !important; width: calc(100% - 16px) !important; }
        .ant-menu-dark .ant-menu-item-selected { background: ${DARK.hover} !important; }
        .ant-menu-dark .ant-menu-item:hover { background: ${DARK.hover} !important; }
        .ant-menu-dark .ant-menu-item a { color: ${DARK.text} !important; }
        .ant-menu-dark .ant-menu-item-selected a { color: ${DARK.accent} !important; }
        .ant-layout-sider-trigger { background: ${DARK.border} !important; border-top: 1px solid ${DARK.border} !important; }
      `}</style>

      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{ background: DARK.sider, borderRight: `1px solid ${DARK.border}`, position: 'sticky', top: 0, height: '100vh' }}
      >
        {/* Logo */}
        <div style={{
          padding: collapsed ? '20px 0' : '20px 20px 16px',
          textAlign: collapsed ? 'center' : 'left',
          borderBottom: `1px solid ${DARK.border}`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #1677ff, #0958d9)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: collapsed ? 0 : 8,
          }}>
            <CarOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          {!collapsed && (
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#f0f6fc', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em', lineHeight: 1.2 }}>
              MOTO GIA THỊNH
            </div>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ border: 'none', marginTop: 8 }}
        />

        {/* User + Logout at bottom */}
        {!collapsed && (
          <div style={{
            position: 'absolute', bottom: 48, left: 0, right: 0,
            padding: '12px 16px',
            borderTop: `1px solid ${DARK.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ overflow: 'hidden' }}>
                <Text style={{ color: '#f0f6fc', fontSize: 13, fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.full_name ?? user?.email}
                </Text>
                <Text style={{ color: DARK.textMuted, fontSize: 11 }}>
                  {isAdmin ? 'Admin' : 'Nhân viên'}
                </Text>
              </div>
              <Tooltip title="Đăng xuất">
                <LogoutOutlined
                  onClick={logout}
                  style={{ color: DARK.textMuted, fontSize: 16, cursor: 'pointer' }}
                />
              </Tooltip>
            </div>
          </div>
        )}
      </Sider>

      <Layout style={{ background: DARK.bg }}>
        <Content style={{ background: DARK.bg }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
