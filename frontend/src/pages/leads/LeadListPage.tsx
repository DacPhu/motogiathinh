import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Col, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined, UserAddOutlined } from '@ant-design/icons'
import toast from 'react-hot-toast'
import { leadsApi } from '@/api/leads'
import { useAuthStore } from '@/store/authStore'
import type { Lead } from '@/types'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const SOURCE_COLOR: Record<string, string> = {
  facebook: 'blue', walk_in: 'green', referral: 'purple',
  zalo: 'cyan', chatbot: 'orange', other: 'default',
}
const SOURCE_LABEL: Record<string, string> = {
  facebook: 'Facebook', walk_in: 'Đến trực tiếp', referral: 'Giới thiệu',
  zalo: 'Zalo', chatbot: 'Chatbot', other: 'Khác',
}
const STATUS_COLOR: Record<string, string> = {
  new: 'gold', contacted: 'blue', enrolled: 'green', lost: 'red', unclaimed: 'default',
}
const STATUS_LABEL: Record<string, string> = {
  new: 'Mới', contacted: 'Đã liên hệ', enrolled: 'Đã đăng ký', lost: 'Không chuyển', unclaimed: 'Chưa nhận',
}

const LeadListPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [unclaimedOnly, setUnclaimedOnly] = useState(false)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)
  const [licenseType, setLicenseType] = useState('A1')

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ['leads', unclaimedOnly],
    queryFn: () => leadsApi.list({ unclaimed_only: unclaimedOnly }).then(r => r.data),
    staleTime: 30_000,
  })

  const { data: unclaimedData } = useQuery({
    queryKey: ['unclaimed-leads'],
    queryFn: () => leadsApi.getUnclaimedCount().then(r => r.data),
  })

  const assignMutation = useMutation({
    mutationFn: (leadId: string) => leadsApi.assign(leadId, user!.id),
    onSuccess: () => {
      toast.success('Đã nhận lead')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['unclaimed-leads'] })
    },
  })

  const convertMutation = useMutation({
    mutationFn: ({ leadId, branchId }: { leadId: string; branchId: string }) =>
      leadsApi.convert(leadId, { branch_id: branchId, loai_bang_lai: licenseType }).then(r => r.data),
    onSuccess: (prefill) => {
      setConvertLead(null)
      navigate('/students/new', { state: { prefill } })
    },
    onError: () => toast.error('Lỗi chuyển đổi lead'),
  })

  const columns = [
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      render: (v: string) => <Text style={{ color: '#f0f6fc', fontWeight: 600 }}>{v ?? '—'}</Text>,
    },
    {
      title: 'SĐT',
      dataIndex: 'so_dien_thoai',
      key: 'so_dien_thoai',
      render: (v: string) => <Text style={{ color: '#8b949e' }}>{v ?? '—'}</Text>,
    },
    {
      title: 'Nguồn',
      dataIndex: 'lead_source',
      key: 'lead_source',
      render: (v: string) => <Tag color={SOURCE_COLOR[v]}>{SOURCE_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Quảng cáo',
      dataIndex: 'ad_name',
      key: 'ad_name',
      render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Nhận bởi',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      render: (v: string | null) => v ? <Text style={{ color: '#8b949e', fontSize: 12 }}>Đã nhận</Text> : <Tag color="gold">Chưa nhận</Tag>,
    },
    {
      title: 'Ngày vào',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 12 }}>{dayjs(v).format('DD/MM/YY HH:mm')}</Text>,
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, row: Lead) => (
        <Space>
          {!row.assigned_to && (
            <Button size="small" onClick={() => assignMutation.mutate(row.id)}
              style={{ background: '#1d2a3a', borderColor: '#1677ff30', color: '#4096ff', fontSize: 12 }}>
              Nhận
            </Button>
          )}
          {!row.converted_to && (
            <Button size="small" icon={<UserAddOutlined />} onClick={() => setConvertLead(row)}
              style={{ background: '#12261e', borderColor: '#52c41a30', color: '#52c41a', fontSize: 12 }}>
              Chuyển thành HV
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px 32px', fontFamily: "'Barlow', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}>
            QUẢN LÝ LEAD
          </Title>
          <Text style={{ color: '#8b949e', fontSize: 13 }}>
            {(unclaimedData?.count ?? 0) > 0 && (
              <Badge count={unclaimedData?.count} style={{ backgroundColor: '#f5a623', marginRight: 8 }} />
            )}
            Lead từ Facebook & các nguồn khác
          </Text>
        </div>
        <Space>
          <Button
            type={unclaimedOnly ? 'primary' : 'default'}
            onClick={() => setUnclaimedOnly(!unclaimedOnly)}
            style={unclaimedOnly ? {} : { background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc' }}
          >
            Chỉ chưa nhận
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ background: '#161b22', border: '1px solid #30363d', color: '#8b949e' }} />
        </Space>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #0d1117, #161b22)', border: '1px solid #21262d', borderRadius: 16, overflow: 'hidden' }}>
        <Table
          dataSource={leads ?? []}
          columns={columns}
          loading={isLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 30 }}
        />
      </div>

      {/* Convert modal */}
      <Modal
        open={!!convertLead}
        title={<span style={{ color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18 }}>Chuyển Lead thành Học viên</span>}
        onCancel={() => setConvertLead(null)}
        onOk={() => convertMutation.mutate({ leadId: convertLead!.id, branchId: user?.branch_id ?? '' })}
        confirmLoading={convertMutation.isPending}
        okText="Tạo học viên"
        styles={{ body: { background: '#161b22' }, content: { background: '#161b22', border: '1px solid #30363d' } }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text style={{ color: '#8b949e' }}>Họ tên: </Text>
          <Text style={{ color: '#f0f6fc', fontWeight: 600 }}>{convertLead?.ho_ten}</Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text style={{ color: '#8b949e' }}>SĐT: </Text>
          <Text style={{ color: '#f0f6fc' }}>{convertLead?.so_dien_thoai}</Text>
        </div>
        <div>
          <Text style={{ color: '#8b949e', display: 'block', marginBottom: 8 }}>Loại bằng:</Text>
          <Select value={licenseType} onChange={setLicenseType} style={{ width: '100%' }}
            options={['A1','A2','B1','B2','C'].map(v => ({ label: v, value: v }))} />
        </div>
      </Modal>
    </div>
  )
}

export default LeadListPage
