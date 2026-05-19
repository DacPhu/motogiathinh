import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Button, Input, Select, Space, Table, Tag, Tooltip, Badge,
  Row, Col, Typography,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, CheckCircleOutlined,
  WarningOutlined, ReloadOutlined, FileExcelOutlined,
} from '@ant-design/icons'
import { studentsApi } from '@/api/students'
import { useAuthStore } from '@/store/authStore'
import type { StudentListItem, LicenseType, StudentStatus } from '@/types'
import dayjs from 'dayjs'

const { Text } = Typography

const STATUS_COLOR: Record<StudentStatus, string> = {
  pending: 'gold', active: 'green', suspended: 'red', completed: 'blue', dropped: 'default',
}
const STATUS_LABEL: Record<StudentStatus, string> = {
  pending: 'Chờ duyệt', active: 'Đang học', suspended: 'Tạm dừng',
  completed: 'Hoàn thành', dropped: 'Nghỉ học',
}

const StudentListPage: React.FC = () => {
  const navigate = useNavigate()
  const branchId = useAuthStore(s => s.branchId())

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StudentStatus | ''>('')
  const [licenseType, setLicenseType] = useState<LicenseType | ''>('')
  const [isRepeat, setIsRepeat] = useState<boolean | undefined>()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['students', page, search, status, licenseType, isRepeat, branchId],
    queryFn: () =>
      studentsApi.list({
        page, page_size: 20,
        search: search || undefined,
        trang_thai: status || undefined,
        loai_bang_lai: licenseType || undefined,
        is_repeat: isRepeat,
      }).then(r => r.data),
    staleTime: 30_000,
  })

  const columns = [
    {
      title: 'Mã HV',
      dataIndex: 'ma_hoc_vien',
      key: 'ma_hoc_vien',
      render: (v: string, row: StudentListItem) => (
        <Link to={`/students/${row.id}`} style={{ color: '#4096ff', fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15 }}>
          {v}
        </Link>
      ),
      width: 110,
    },
    {
      title: 'Họ tên',
      dataIndex: 'ten_hoc_vien',
      key: 'ten_hoc_vien',
      render: (v: string, row: StudentListItem) => (
        <div>
          <div style={{ color: '#f0f6fc', fontWeight: 600 }}>{v}</div>
          <div style={{ color: '#8b949e', fontSize: 12 }}>{row.so_dien_thoai}</div>
        </div>
      ),
    },
    {
      title: 'Bằng lái',
      dataIndex: 'loai_bang_lai',
      key: 'loai_bang_lai',
      render: (v: LicenseType) => (
        <Tag style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700 }}>{v}</Tag>
      ),
      width: 80,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      render: (v: StudentStatus) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
      width: 120,
    },
    {
      title: 'Hồ sơ',
      dataIndex: 'docs_complete',
      key: 'docs_complete',
      render: (v: boolean | null) =>
        v === null ? null : v ? (
          <Tooltip title="Đầy đủ hồ sơ"><CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} /></Tooltip>
        ) : (
          <Tooltip title="Thiếu hồ sơ"><WarningOutlined style={{ color: '#f5a623', fontSize: 16 }} /></Tooltip>
        ),
      width: 70,
      align: 'center' as const,
    },
    {
      title: 'HV cũ',
      dataIndex: 'is_repeat_student',
      key: 'is_repeat_student',
      render: (v: boolean) => v ? <Tag color="purple">Tái đăng ký</Tag> : null,
      width: 110,
    },
    {
      title: 'Ngày đăng ký',
      dataIndex: 'ngay_dang_ky',
      key: 'ngay_dang_ky',
      render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 13 }}>{dayjs(v).format('DD/MM/YYYY')}</Text>,
      width: 130,
    },
  ]

  return (
    <div style={{ padding: '24px 32px', fontFamily: "'Barlow', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '0.03em' }}>
            DANH SÁCH HỌC VIÊN
          </h2>
          <Text style={{ color: '#8b949e', fontSize: 13 }}>
            {data?.total ?? 0} học viên • trang {page}/{data?.pages ?? 1}
          </Text>
        </div>
        <Space>
          <Button icon={<FileExcelOutlined />} style={{ background: '#12261e', borderColor: '#52c41a30', color: '#52c41a' }}>
            Xuất Excel
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/students/new')}
            style={{ background: 'linear-gradient(135deg, #1677ff, #0958d9)', border: 'none', fontWeight: 600 }}
          >
            Thêm học viên
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Input
            prefix={<SearchOutlined style={{ color: '#8b949e' }} />}
            placeholder="Tìm tên, SĐT, mã HV, CCCD..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc', borderRadius: 8 }}
            allowClear
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Select
            value={status || undefined}
            onChange={v => { setStatus(v ?? ''); setPage(1) }}
            placeholder="Trạng thái"
            allowClear
            style={{ width: '100%' }}
            options={[
              { label: 'Chờ duyệt', value: 'pending' },
              { label: 'Đang học', value: 'active' },
              { label: 'Tạm dừng', value: 'suspended' },
              { label: 'Hoàn thành', value: 'completed' },
              { label: 'Nghỉ học', value: 'dropped' },
            ]}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Select
            value={licenseType || undefined}
            onChange={v => { setLicenseType(v ?? ''); setPage(1) }}
            placeholder="Bằng lái"
            allowClear
            style={{ width: '100%' }}
            options={['A1','A2','B1','B2','C','D'].map(v => ({ label: v, value: v }))}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Select
            value={isRepeat}
            onChange={v => { setIsRepeat(v); setPage(1) }}
            placeholder="Loại HV"
            allowClear
            style={{ width: '100%' }}
            options={[{ label: 'HV mới', value: false }, { label: 'Tái đăng ký', value: true }]}
          />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ background: '#161b22', border: '1px solid #30363d', color: '#8b949e' }} />
        </Col>
      </Row>

      {/* Table */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1117, #161b22)',
        border: '1px solid #21262d',
        borderRadius: 16, overflow: 'hidden',
      }}>
        <Table
          dataSource={data?.items ?? []}
          columns={columns}
          loading={isLoading}
          rowKey="id"
          size="middle"
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total ?? 0,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => <Text style={{ color: '#8b949e' }}>Tổng {total} học viên</Text>,
            style: { padding: '12px 16px' },
          }}
          onRow={row => ({ onClick: () => navigate(`/students/${row.id}`) })}
          style={{ cursor: 'pointer' }}
        />
      </div>
    </div>
  )
}

export default StudentListPage
