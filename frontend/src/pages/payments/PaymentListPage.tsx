import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import toast from 'react-hot-toast'
import { paymentsApi } from '@/api/payments'
import { useAuthStore } from '@/store/authStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const formatVND = (v: number) => new Intl.NumberFormat('vi-VN').format(v) + 'đ'

const PaymentListPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form] = Form.useForm()
  const branchId = useAuthStore(s => s.branchId())

  const { data: overdue, isLoading: overdueLoading } = useQuery({
    queryKey: ['payments-overdue', branchId],
    queryFn: () => paymentsApi.getOverdue({ branch_id: branchId ?? undefined }).then(r => r.data),
  })

  const { data: staffSummary } = useQuery({
    queryKey: ['staff-collection', branchId, dayjs().format('YYYY-MM-DD')],
    queryFn: () => paymentsApi.getStaffCollection({ on_date: dayjs().format('YYYY-MM-DD'), branch_id: branchId ?? undefined }).then(r => r.data),
  })

  const recordMutation = useMutation({
    mutationFn: (data: any) => paymentsApi.recordPayment(data),
    onSuccess: () => {
      toast.success('Ghi nhận thanh toán thành công!')
      queryClient.invalidateQueries({ queryKey: ['payments-overdue'] })
      queryClient.invalidateQueries({ queryKey: ['staff-collection'] })
      setShowForm(false)
      form.resetFields()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Lỗi ghi nhận'),
  })

  const overdueColumns = [
    {
      title: 'Học viên',
      dataIndex: 'student_id',
      key: 'student_id',
      render: (v: string) => <Text style={{ color: '#8b949e', fontSize: 12 }}>{v.slice(0, 8)}...</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'payment_type',
      key: 'payment_type',
      render: (v: string) => <Tag>{v === 'installment' ? 'Trả góp' : v === 'full' ? 'Toàn phần' : 'Miễn giảm'}</Tag>,
    },
    {
      title: 'Còn nợ',
      dataIndex: 'remaining_amount',
      key: 'remaining_amount',
      render: (v: number) => <Text style={{ color: '#ff4d4f', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700 }}>{formatVND(v)}</Text>,
    },
    {
      title: 'Hạn',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (v: string) => <Text style={{ color: '#f5a623', fontSize: 13 }}>{v ? dayjs(v).format('DD/MM/YYYY') : '—'}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'payment_status',
      key: 'payment_status',
      render: (v: string) => <Tag color={v === 'overdue' ? 'red' : v === 'partial' ? 'gold' : 'default'}>{v === 'overdue' ? 'Quá hạn' : v === 'partial' ? 'Chưa đủ' : v}</Tag>,
    },
  ]

  return (
    <div style={{ padding: '24px 32px', fontFamily: "'Barlow', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <Title level={3} style={{ margin: 0, color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}>
          QUẢN LÝ HỌC PHÍ
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)}
          style={{ background: 'linear-gradient(135deg, #1677ff, #0958d9)', border: 'none', fontWeight: 600 }}>
          Ghi nhận thanh toán
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <div style={{ background: 'linear-gradient(135deg, #0d1117, #161b22)', border: '1px solid #21262d', borderRadius: 16, padding: 24 }}>
            <div style={{ color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '0.03em' }}>
              CÒN NỢ / QUÁ HẠN
            </div>
            <Table
              dataSource={overdue ?? []}
              columns={overdueColumns}
              loading={overdueLoading}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 15 }}
            />
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <div style={{ background: 'linear-gradient(135deg, #0d1117, #161b22)', border: '1px solid #21262d', borderRadius: 16, padding: 24 }}>
            <div style={{ color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              THU TIỀN HÔM NAY
            </div>
            {staffSummary?.map(s => (
              <div key={s.user_id} style={{ padding: '10px 0', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text style={{ color: '#f0f6fc', fontWeight: 600, display: 'block' }}>{s.full_name ?? s.email}</Text>
                  <Text style={{ color: '#8b949e', fontSize: 12 }}>{s.payment_count} giao dịch</Text>
                </div>
                <Text style={{ color: '#52c41a', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700 }}>
                  {formatVND(s.total_collected)}
                </Text>
              </div>
            ))}
            {(!staffSummary || staffSummary.length === 0) && (
              <Text style={{ color: '#8b949e' }}>Chưa có giao dịch hôm nay</Text>
            )}
          </div>
        </Col>
      </Row>

      {/* Record payment modal */}
      <Modal
        open={showForm}
        title={<span style={{ color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>GHI NHẬN THANH TOÁN</span>}
        onCancel={() => { setShowForm(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={recordMutation.isPending}
        okText="Lưu"
        styles={{ body: { background: '#161b22' }, content: { background: '#161b22', border: '1px solid #30363d' } }}
      >
        <Form form={form} layout="vertical" onFinish={v => recordMutation.mutate(v)} requiredMark={false}>
          <Form.Item name="payment_plan_id" label={<Text style={{ color: '#8b949e' }}>Mã kế hoạch thanh toán *</Text>} rules={[{ required: true }]}>
            <Input placeholder="UUID kế hoạch" style={{ background: '#0d1117', border: '1px solid #30363d', color: '#f0f6fc', borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="so_tien" label={<Text style={{ color: '#8b949e' }}>Số tiền (đ) *</Text>} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#f0f6fc', borderRadius: 8 }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              placeholder="1.500.000" min={1000} />
          </Form.Item>
          <Form.Item name="phuong_thuc" label={<Text style={{ color: '#8b949e' }}>Phương thức *</Text>} rules={[{ required: true }]}>
            <Select options={[
              { label: 'Tiền mặt', value: 'cash' }, { label: 'Chuyển khoản', value: 'bank_transfer' },
              { label: 'VNPay', value: 'vnpay' }, { label: 'MoMo', value: 'momo' }, { label: 'ZaloPay', value: 'zalopay' },
            ]} placeholder="Chọn phương thức" />
          </Form.Item>
          <Form.Item name="loai_thanh_toan" label={<Text style={{ color: '#8b949e' }}>Loại khoản thu</Text>}>
            <Select allowClear options={[
              { label: 'Học phí', value: 'tuition' }, { label: 'Phí thi', value: 'exam_fee' },
              { label: 'Phí chứng chỉ', value: 'certificate' }, { label: 'Khác', value: 'other' },
            ]} placeholder="Chọn" />
          </Form.Item>
          <Form.Item name="ghi_chu" label={<Text style={{ color: '#8b949e' }}>Ghi chú</Text>}>
            <Input.TextArea rows={2} style={{ background: '#0d1117', border: '1px solid #30363d', color: '#f0f6fc', borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PaymentListPage
