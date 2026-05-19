import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Column, Pie } from '@ant-design/charts'
import {
  Alert,
  Avatar,
  Badge,
  Card,
  Col,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  AlertOutlined,
  ArrowUpOutlined,
  BankOutlined,
  CalendarOutlined,
  CarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  ExclamationCircleOutlined,
  FireOutlined,
  RiseOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { reportsApi } from '@/api/reports'
import { leadsApi } from '@/api/leads'
import { useAuthStore } from '@/store/authStore'
import { useBranchStore } from '@/store/branchStore'
import type { StaffCollection } from '@/types'

const { Text, Title } = Typography

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

const MONTHS_VI = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']

const STATUS_COLORS: Record<string, string> = {
  pending:   '#f5a623',
  active:    '#52c41a',
  suspended: '#ff4d4f',
  completed: '#1677ff',
  dropped:   '#8c8c8c',
}
const STATUS_LABELS: Record<string, string> = {
  pending:   'Chờ duyệt',
  active:    'Đang học',
  suspended: 'Tạm dừng',
  completed: 'Hoàn thành',
  dropped:   'Nghỉ học',
}

// ─── Animated KPI Card ────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  accent: string
  trend?: number
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, subtitle, icon, accent, trend }) => (
  <div
    style={{
      background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
      border: `1px solid ${accent}30`,
      borderRadius: 16,
      padding: '24px 28px',
      position: 'relative',
      overflow: 'hidden',
      height: '100%',
      boxShadow: `0 0 32px ${accent}15, inset 0 1px 0 ${accent}20`,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'default',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLElement
      el.style.transform = 'translateY(-2px)'
      el.style.boxShadow = `0 8px 40px ${accent}25, inset 0 1px 0 ${accent}20`
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLElement
      el.style.transform = 'translateY(0)'
      el.style.boxShadow = `0 0 32px ${accent}15, inset 0 1px 0 ${accent}20`
    }}
  >
    {/* Decorative arc */}
    <div style={{
      position: 'absolute', top: -40, right: -40,
      width: 120, height: 120, borderRadius: '50%',
      border: `2px solid ${accent}20`,
    }} />
    <div style={{
      position: 'absolute', top: -20, right: -20,
      width: 80, height: 80, borderRadius: '50%',
      border: `1px solid ${accent}15`,
    }} />

    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#8b949e', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif", fontWeight: 500 }}>
          {title}
        </Text>
        <div style={{
          color: '#f0f6fc',
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: '-0.5px',
          marginTop: 6,
          lineHeight: 1.1,
        }}>
          {value}
        </div>
        {subtitle && (
          <Text style={{ color: '#8b949e', fontSize: 12, marginTop: 4, display: 'block' }}>
            {subtitle}
          </Text>
        )}
        {trend !== undefined && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpOutlined style={{ color: trend >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 11 }} />
            <Text style={{ color: trend >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
              {Math.abs(trend)}% so với hôm qua
            </Text>
          </div>
        )}
      </div>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${accent}18`,
        border: `1px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, fontSize: 22, flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>

    {/* Bottom accent line */}
    <div style={{
      position: 'absolute', bottom: 0, left: 0,
      height: 3, width: '40%',
      background: `linear-gradient(90deg, ${accent}, transparent)`,
      borderRadius: '0 0 0 16px',
    }} />
  </div>
)

// ─── Dashboard Page ───────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const user      = useAuthStore(s => s.user)
  const isAdmin   = useAuthStore(s => s.isAdmin())
  const branchId  = useAuthStore(s => s.branchId())
  const { selectedBranchId, setSelectedBranch } = useBranchStore()

  const effectiveBranch = isAdmin ? (selectedBranchId ?? undefined) : (branchId ?? undefined)
  const currentYear = new Date().getFullYear()

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', effectiveBranch],
    queryFn: () => reportsApi.getDashboard(effectiveBranch).then(r => r.data),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  })

  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['revenue', currentYear, effectiveBranch],
    queryFn: () => reportsApi.getRevenue(currentYear, effectiveBranch).then(r => r.data),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  })

  const { data: unclaimedData } = useQuery({
    queryKey: ['unclaimed-leads'],
    queryFn: () => leadsApi.getUnclaimedCount().then(r => r.data),
    refetchInterval: 2 * 60 * 1000,
  })

  const unclaimedCount = unclaimedData?.count ?? 0

  // ── Chart Data ───────────────────────────────────────────────────────────
  const revenueChartData = MONTHS_VI.map((month, i) => ({
    month,
    'Doanh thu': revenue?.find(r => r.month === i + 1)?.total ?? 0,
  }))

  const studentCounts = dashboard?.student_counts ?? {}
  const statusPieData = Object.entries(studentCounts)
    .filter(([, v]) => v > 0)
    .map(([status, count]) => ({
      type: STATUS_LABELS[status] ?? status,
      value: count,
      color: STATUS_COLORS[status] ?? '#8c8c8c',
    }))

  // ── Staff Table ──────────────────────────────────────────────────────────
  const staffColumns = [
    {
      title: 'Nhân viên',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name: string, row: StaffCollection) => (
        <Space>
          <Avatar
            size={32}
            style={{ background: '#1677ff', fontSize: 13, fontFamily: "'Barlow', sans-serif" }}
          >
            {(name || row.email)[0].toUpperCase()}
          </Avatar>
          <div>
            <div style={{ color: '#f0f6fc', fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
              {name || '—'}
            </div>
            <div style={{ color: '#8b949e', fontSize: 11 }}>{row.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Số GD',
      dataIndex: 'payment_count',
      key: 'payment_count',
      align: 'center' as const,
      render: (v: number) => (
        <Tag
          style={{
            background: '#1d2a3a', borderColor: '#1677ff40', color: '#4096ff',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
          }}
        >
          {v}
        </Tag>
      ),
    },
    {
      title: 'Tổng thu',
      dataIndex: 'total_collected',
      key: 'total_collected',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{
          color: '#52c41a', fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px',
        }}>
          {formatVND(v)}
        </span>
      ),
    },
  ]

  // ── Column Chart Config ──────────────────────────────────────────────────
  const columnConfig = {
    data: revenueChartData,
    xField: 'month',
    yField: 'Doanh thu',
    color: '#1677ff',
    columnStyle: {
      radius: [4, 4, 0, 0],
      fill: 'l(90) 0:#4096ff 1:#1677ff',
    },
    label: false,
    tooltip: {
      formatter: (d: { 'Doanh thu': number }) => ({
        name: 'Doanh thu',
        value: formatVND(d['Doanh thu']),
      }),
    },
    xAxis: {
      label: { style: { fill: '#8b949e', fontSize: 12, fontFamily: "'Barlow', sans-serif" } },
      line: { style: { stroke: '#21262d' } },
      tickLine: null,
    },
    yAxis: {
      label: {
        formatter: (v: string) => `${(+v / 1_000_000).toFixed(0)}tr`,
        style: { fill: '#8b949e', fontSize: 11, fontFamily: "'Barlow', sans-serif" },
      },
      grid: { line: { style: { stroke: '#21262d', lineDash: [4, 4] } } },
    },
    theme: {
      backgroundColor: 'transparent',
    },
    animation: { appear: { animation: 'wave-in', duration: 800 } },
    interactions: [{ type: 'element-active' }],
    state: {
      active: { style: { fill: '#4096ff', opacity: 0.85 } },
    },
  }

  // ── Pie Chart Config ─────────────────────────────────────────────────────
  const pieConfig = {
    data: statusPieData,
    angleField: 'value',
    colorField: 'type',
    color: statusPieData.map(d => d.color),
    radius: 0.85,
    innerRadius: 0.62,
    label: false,
    legend: {
      position: 'bottom' as const,
      itemName: { style: { fill: '#8b949e', fontSize: 12, fontFamily: "'Barlow', sans-serif" } },
    },
    statistic: {
      title: {
        style: { color: '#8b949e', fontSize: 12, fontFamily: "'Barlow', sans-serif" },
        content: 'Tổng',
      },
      content: {
        style: {
          color: '#f0f6fc', fontSize: 26, fontWeight: 700,
          fontFamily: "'Barlow Condensed', sans-serif",
        },
        content: String(Object.values(studentCounts).reduce((a, b) => a + b, 0)),
      },
    },
    tooltip: {
      formatter: (d: { type: string; value: number }) => ({ name: d.type, value: `${d.value} HV` }),
    },
    theme: { backgroundColor: 'transparent' },
    animation: { appear: { animation: 'zoom-in', duration: 600 } },
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      fontFamily: "'Barlow', sans-serif",
      padding: '0 0 48px',
    }}>
      {/* Import fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800&display=swap');

        .ant-table { background: transparent !important; }
        .ant-table-thead > tr > th {
          background: #161b22 !important;
          border-bottom: 1px solid #21262d !important;
          color: #8b949e !important;
          font-family: 'Barlow', sans-serif !important;
          font-size: 11px !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
          font-weight: 600 !important;
        }
        .ant-table-tbody > tr > td {
          background: transparent !important;
          border-bottom: 1px solid #21262d !important;
          padding: 12px 16px !important;
        }
        .ant-table-tbody > tr:hover > td {
          background: #161b22 !important;
        }
        .ant-table-tbody > tr:last-child > td { border-bottom: none !important; }
        .ant-select-selector {
          background: #161b22 !important;
          border-color: #30363d !important;
          color: #f0f6fc !important;
          border-radius: 8px !important;
        }
        .ant-select-arrow { color: #8b949e !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
        borderBottom: '1px solid #21262d',
        padding: '20px 32px',
        marginBottom: 0,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, #1677ff, #0958d9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px #1677ff40',
              }}>
                <DashboardOutlined style={{ color: '#fff', fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{
                  margin: 0, color: '#f0f6fc',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  letterSpacing: '0.02em', fontWeight: 700, lineHeight: 1.2,
                }}>
                  BẢNG ĐIỀU KHIỂN
                </Title>
                <Text style={{ color: '#8b949e', fontSize: 12 }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  Cập nhật mỗi 5 phút • {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Unclaimed leads badge */}
              {unclaimedCount > 0 && (
                <Link to="/leads" style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#2d1b0e', border: '1px solid #f5a62340',
                    borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}>
                    <Badge count={unclaimedCount} size="small" style={{ backgroundColor: '#f5a623' }}>
                      <AlertOutlined style={{ color: '#f5a623', fontSize: 15 }} />
                    </Badge>
                    <Text style={{ color: '#f5a623', fontSize: 13, fontWeight: 600 }}>
                      {unclaimedCount} lead chưa nhận
                    </Text>
                  </div>
                </Link>
              )}

              {/* Branch selector (admin only) */}
              {isAdmin && (
                <Select
                  value={selectedBranchId ?? 'all'}
                  onChange={v => setSelectedBranch(v === 'all' ? null : v)}
                  style={{ width: 200 }}
                  options={[
                    { label: '🏢 Tất cả chi nhánh', value: 'all' },
                    // TODO: populate from branches API
                  ]}
                  placeholder="Chọn chi nhánh"
                  suffixIcon={<BankOutlined style={{ color: '#8b949e' }} />}
                />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar
                  size={36}
                  style={{
                    background: 'linear-gradient(135deg, #1677ff, #722ed1)',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  }}
                >
                  {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
                </Avatar>
                <div>
                  <div style={{ color: '#f0f6fc', fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                    {user?.full_name ?? user?.email}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: 11 }}>
                    {isAdmin ? '👑 Quản trị viên' : '🧑‍💼 Nhân viên'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 32px 0' }}>

        {/* Unclaimed leads alert (large) */}
        {unclaimedCount > 0 && (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message={
              <span style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
                Có <strong style={{ color: '#f5a623' }}>{unclaimedCount} lead</strong> từ Facebook chưa được nhận xử lý
              </span>
            }
            action={
              <Link to="/leads">
                <span style={{ color: '#f5a623', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}>
                  Xem ngay →
                </span>
              </Link>
            }
            style={{
              background: '#1c1608', border: '1px solid #f5a62330',
              borderRadius: 10, marginBottom: 24,
            }}
            closable
          />
        )}

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <Spin spinning={dashLoading} tip="Đang tải...">
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <KpiCard
                title="Thu hôm nay"
                value={formatVND(dashboard?.cash_today ?? 0)}
                subtitle="Đã thu trong ngày"
                icon={<FireOutlined />}
                accent="#f5a623"
                trend={12}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <KpiCard
                title="Doanh thu tháng"
                value={formatVND(dashboard?.revenue_mtd ?? 0)}
                subtitle={`Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`}
                icon={<RiseOutlined />}
                accent="#52c41a"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <KpiCard
                title="Còn nợ"
                value={formatVND(dashboard?.outstanding ?? 0)}
                subtitle="Chưa thanh toán đủ"
                icon={<WarningOutlined />}
                accent="#ff4d4f"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <KpiCard
                title="Học viên đang học"
                value={String(dashboard?.student_counts?.active ?? 0)}
                subtitle="Trạng thái active"
                icon={<TeamOutlined />}
                accent="#1677ff"
              />
            </Col>
          </Row>
        </Spin>

        {/* ── Charts Row ────────────────────────────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {/* Revenue Bar Chart */}
          <Col xs={24} lg={16}>
            <div style={{
              background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
              border: '1px solid #21262d',
              borderRadius: 16,
              padding: '24px 24px 16px',
              height: '100%',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{
                    color: '#f0f6fc', fontSize: 16, fontWeight: 700,
                    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
                  }}>
                    DOANH THU {currentYear}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>Theo tháng (đơn vị: triệu đồng)</div>
                </div>
                <Tag
                  icon={<CalendarOutlined />}
                  style={{
                    background: '#1d2a3a', borderColor: '#1677ff30', color: '#4096ff',
                    fontFamily: "'Barlow', sans-serif",
                  }}
                >
                  {currentYear}
                </Tag>
              </div>
              <Spin spinning={revLoading}>
                <div style={{ height: 260 }}>
                  <Column {...columnConfig} />
                </div>
              </Spin>
            </div>
          </Col>

          {/* Student Status Donut */}
          <Col xs={24} lg={8}>
            <div style={{
              background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
              border: '1px solid #21262d',
              borderRadius: 16,
              padding: '24px 24px 16px',
              height: '100%',
            }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  color: '#f0f6fc', fontSize: 16, fontWeight: 700,
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
                }}>
                  HỌC VIÊN
                </div>
                <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>Phân bổ theo trạng thái</div>
              </div>
              <Spin spinning={dashLoading}>
                <div style={{ height: 260 }}>
                  {statusPieData.length > 0 ? (
                    <Pie {...pieConfig} />
                  ) : (
                    <div style={{
                      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#8b949e', fontSize: 14,
                    }}>
                      Chưa có dữ liệu
                    </div>
                  )}
                </div>
              </Spin>
            </div>
          </Col>
        </Row>

        {/* ── Per-Staff Collection Table ─────────────────────────────────────── */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <div style={{
              background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
              border: '1px solid #21262d',
              borderRadius: 16,
              padding: '24px',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{
                    color: '#f0f6fc', fontSize: 16, fontWeight: 700,
                    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
                  }}>
                    THU TIỀN THEO NHÂN VIÊN
                  </div>
                  <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>
                    Hôm nay — {new Date().toLocaleDateString('vi-VN')}
                  </div>
                </div>
                <Tag
                  icon={<UserOutlined />}
                  style={{
                    background: '#12261e', borderColor: '#52c41a30', color: '#52c41a',
                    fontFamily: "'Barlow', sans-serif",
                  }}
                >
                  {(dashboard?.staff_collections_today ?? []).length} nhân viên
                </Tag>
              </div>

              <Spin spinning={dashLoading}>
                {(dashboard?.staff_collections_today?.length ?? 0) > 0 ? (
                  <Table
                    dataSource={dashboard?.staff_collections_today ?? []}
                    columns={staffColumns}
                    rowKey="user_id"
                    pagination={false}
                    size="small"
                    style={{ background: 'transparent' }}
                    summary={pageData => {
                      const total = pageData.reduce((sum, row) => sum + (row.total_collected ?? 0), 0)
                      const txns = pageData.reduce((sum, row) => sum + (row.payment_count ?? 0), 0)
                      return (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0}>
                            <Text style={{ color: '#f0f6fc', fontWeight: 700, fontSize: 13 }}>Tổng cộng</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="center">
                            <Text style={{ color: '#4096ff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700 }}>{txns}</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right">
                            <Text style={{ color: '#52c41a', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700 }}>
                              {formatVND(total)}
                            </Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )
                    }}
                  />
                ) : (
                  <div style={{
                    textAlign: 'center', padding: '40px 0',
                    color: '#8b949e', fontSize: 14,
                  }}>
                    <CarOutlined style={{ fontSize: 32, display: 'block', marginBottom: 12, opacity: 0.4 }} />
                    Chưa có giao dịch hôm nay
                  </div>
                )}
              </Spin>
            </div>
          </Col>

          {/* Quick Status Breakdown */}
          <Col xs={24} lg={10}>
            <div style={{
              background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
              border: '1px solid #21262d',
              borderRadius: 16,
              padding: '24px',
              height: '100%',
            }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  color: '#f0f6fc', fontSize: 16, fontWeight: 700,
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.03em',
                }}>
                  CHI TIẾT HỌC VIÊN
                </div>
                <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>Số lượng theo trạng thái</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(studentCounts).map(([status, count]) => {
                  const total = Object.values(studentCounts).reduce((a, b) => a + b, 0)
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  const color = STATUS_COLORS[status] ?? '#8c8c8c'
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <Text style={{ color: '#c9d1d9', fontSize: 13 }}>
                            {STATUS_LABELS[status] ?? status}
                          </Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Text style={{ color: '#8b949e', fontSize: 12 }}>{pct}%</Text>
                          <Text style={{
                            color: color, fontFamily: "'Barlow Condensed', sans-serif",
                            fontSize: 16, fontWeight: 700, minWidth: 32, textAlign: 'right',
                          }}>
                            {count}
                          </Text>
                        </div>
                      </div>
                      <div style={{ height: 4, background: '#21262d', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                          borderRadius: 2,
                          transition: 'width 0.8s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}

                {Object.keys(studentCounts).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#8b949e' }}>
                    Chưa có dữ liệu
                  </div>
                )}
              </div>

              {/* Total */}
              {Object.keys(studentCounts).length > 0 && (
                <div style={{
                  marginTop: 20, paddingTop: 16,
                  borderTop: '1px solid #21262d',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <Text style={{ color: '#8b949e', fontSize: 13 }}>Tổng học viên</Text>
                  <Text style={{
                    color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 24, fontWeight: 700,
                  }}>
                    {Object.values(studentCounts).reduce((a, b) => a + b, 0)}
                  </Text>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </div>
    </div>
  )
}

export default DashboardPage
