import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Column } from '@ant-design/charts'
import { Button, Col, Row, Select, Spin, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { reportsApi } from '@/api/reports'
import { useAuthStore } from '@/store/authStore'
import { useBranchStore } from '@/store/branchStore'

const { Title, Text } = Typography
const formatVND = (v: number) => new Intl.NumberFormat('vi-VN').format(v) + 'đ'
const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']

const ReportsPage: React.FC = () => {
  const isAdmin = useAuthStore(s => s.isAdmin())
  const branchId = useAuthStore(s => s.branchId())
  const { selectedBranchId } = useBranchStore()
  const [year, setYear] = useState(new Date().getFullYear())

  const effectiveBranch = isAdmin ? (selectedBranchId ?? undefined) : (branchId ?? undefined)

  const { data: revenue, isLoading } = useQuery({
    queryKey: ['revenue', year, effectiveBranch],
    queryFn: () => reportsApi.getRevenue(year, effectiveBranch).then(r => r.data),
  })

  const chartData = MONTHS.map((month, i) => ({
    month, 'Doanh thu': revenue?.find(r => r.month === i + 1)?.total ?? 0,
  }))
  const totalRevenue = revenue?.reduce((sum, r) => sum + r.total, 0) ?? 0

  return (
    <div style={{ padding: '24px 32px', fontFamily: "'Barlow', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}>
            BÁO CÁO & THỐNG KÊ
          </Title>
          <Text style={{ color: '#8b949e', fontSize: 13 }}>Tổng doanh thu {year}: <strong style={{ color: '#52c41a' }}>{formatVND(totalRevenue)}</strong></Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Select
            value={year}
            onChange={setYear}
            options={[2024, 2025, 2026].map(y => ({ label: `Năm ${y}`, value: y }))}
            style={{ width: 120 }}
          />
          <Button icon={<DownloadOutlined />} style={{ background: '#12261e', borderColor: '#52c41a30', color: '#52c41a' }}>
            Xuất Excel
          </Button>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <div style={{ background: 'linear-gradient(135deg, #0d1117, #161b22)', border: '1px solid #21262d', borderRadius: 16, padding: 24 }}>
            <div style={{ color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '0.03em' }}>
              DOANH THU THEO THÁNG — {year}
            </div>
            <Spin spinning={isLoading}>
              <div style={{ height: 340 }}>
                <Column
                  data={chartData}
                  xField="month"
                  yField="Doanh thu"
                  color="#1677ff"
                  columnStyle={{ radius: [4,4,0,0], fill: 'l(90) 0:#4096ff 1:#1677ff' }}
                  label={false}
                  tooltip={{ formatter: (d: any) => ({ name: 'Doanh thu', value: formatVND(d['Doanh thu']) }) }}
                  xAxis={{ label: { style: { fill: '#8b949e', fontFamily: "'Barlow', sans-serif" } }, line: { style: { stroke: '#21262d' } }, tickLine: null }}
                  yAxis={{ label: { formatter: (v: string) => `${(+v/1_000_000).toFixed(0)}tr`, style: { fill: '#8b949e', fontFamily: "'Barlow', sans-serif" } }, grid: { line: { style: { stroke: '#21262d', lineDash: [4,4] } } } }}
                  theme={{ backgroundColor: 'transparent' }}
                />
              </div>
            </Spin>
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default ReportsPage
