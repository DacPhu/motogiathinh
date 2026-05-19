import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Descriptions, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { studentsApi } from '@/api/students'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  pending: 'gold', active: 'green', suspended: 'red', completed: 'blue', dropped: 'default',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt', active: 'Đang học', suspended: 'Tạm dừng', completed: 'Hoàn thành', dropped: 'Nghỉ học',
}

const StudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>
  if (!student) return <div style={{ padding: 40, color: '#8b949e' }}>Không tìm thấy học viên.</div>

  return (
    <div style={{ padding: '24px 32px', fontFamily: "'Barlow', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');`}</style>

      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 20, background: '#161b22', border: '1px solid #30363d', color: '#f0f6fc' }}>
        Quay lại
      </Button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#f0f6fc', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}>
          {student.ten_hoc_vien}
        </Title>
        <Text style={{ color: '#8b949e', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18 }}>
          #{student.ma_hoc_vien}
        </Text>
        <Tag color={STATUS_COLOR[student.trang_thai]}>{STATUS_LABEL[student.trang_thai]}</Tag>
        <Tag style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700 }}>{student.loai_bang_lai}</Tag>
        {student.is_repeat_student && <Tag color="purple">Tái đăng ký ({student.repeat_count}x)</Tag>}
      </div>

      <div style={{ background: 'linear-gradient(135deg, #0d1117, #161b22)', border: '1px solid #21262d', borderRadius: 16, padding: 24 }}>
        <Descriptions
          column={{ xs: 1, sm: 2, md: 3 }}
          labelStyle={{ color: '#8b949e', fontSize: 13 }}
          contentStyle={{ color: '#f0f6fc', fontWeight: 500 }}
        >
          <Descriptions.Item label="Ngày sinh">{dayjs(student.ngay_sinh).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="Giới tính">
            {student.gioi_tinh === 'male' ? 'Nam' : student.gioi_tinh === 'female' ? 'Nữ' : 'Khác'}
          </Descriptions.Item>
          <Descriptions.Item label="CCCD">{student.cccd_number ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{student.so_dien_thoai}</Descriptions.Item>
          <Descriptions.Item label="Email">{student.dia_chi_email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Zalo">{student.zalo_number ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ" span={2}>{[student.dia_chi, student.phuong_xa, student.quan_huyen, student.tinh_thanh].filter(Boolean).join(', ') || '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày đăng ký">{dayjs(student.ngay_dang_ky).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="Nguồn">{student.lead_source ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Sức khoẻ đến">{student.health_cert_expiry ? dayjs(student.health_cert_expiry).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
          {student.ghi_chu && <Descriptions.Item label="Ghi chú" span={3}>{student.ghi_chu}</Descriptions.Item>}
        </Descriptions>
      </div>
    </div>
  )
}

export default StudentDetailPage
