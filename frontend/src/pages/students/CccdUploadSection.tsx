import React, { useState } from 'react'
import { Button, Image, Spin, Typography, Upload } from 'antd'
import { CameraOutlined, CheckCircleOutlined, IdcardOutlined, ScanOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import { studentsApi, OcrCccdResult } from '@/api/students'

const { Text } = Typography

interface Props {
  form: FormInstance
  onFilesReady: (front: File | null, back: File | null) => void
}

const CccdUploadSection: React.FC<Props> = ({ form, onFilesReady }) => {
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OcrCccdResult | null>(null)

  const handleUpload = (file: File, side: 'front' | 'back') => {
    const url = URL.createObjectURL(file)
    if (side === 'front') {
      setFrontFile(file)
      setFrontPreview(url)
      runOcr(file)
    } else {
      setBackFile(file)
      setBackPreview(url)
    }
    onFilesReady(
      side === 'front' ? file : frontFile,
      side === 'back' ? file : backFile,
    )
  }

  const runOcr = async (file: File) => {
    setOcrLoading(true)
    try {
      const { data } = await studentsApi.ocrCccd(file)
      setOcrResult(data)
      toast.success('Đã nhận dạng CCCD!')
    } catch {
      toast.error('Không thể nhận dạng. Vui lòng nhập tay.')
    } finally {
      setOcrLoading(false)
    }
  }

  const parseVietnameseAddress = (address: string) => {
    const parts = address.split(/,\s*/).map(p => p.trim()).filter(Boolean)
    if (parts.length >= 4) {
      return {
        dia_chi:    parts.slice(0, parts.length - 3).join(', '),
        phuong_xa:  parts[parts.length - 3],
        quan_huyen: parts[parts.length - 2],
        tinh_thanh: parts[parts.length - 1],
      }
    }
    if (parts.length === 3) {
      return { dia_chi: parts[0], phuong_xa: parts[1], quan_huyen: parts[2], tinh_thanh: undefined }
    }
    if (parts.length === 2) {
      return { dia_chi: parts[0], phuong_xa: undefined, quan_huyen: parts[1], tinh_thanh: undefined }
    }
    return { dia_chi: address, phuong_xa: undefined, quan_huyen: undefined, tinh_thanh: undefined }
  }

  const applyOcr = () => {
    if (!ocrResult) return
    const values: Record<string, any> = {}
    if (ocrResult.cccd_number) values.cccd_number = ocrResult.cccd_number
    if (ocrResult.full_name) values.ten_hoc_vien = ocrResult.full_name
    if (ocrResult.date_of_birth) values.ngay_sinh = dayjs(ocrResult.date_of_birth)
    if (ocrResult.gender) values.gioi_tinh = ocrResult.gender
    if (ocrResult.address) {
      const addr = parseVietnameseAddress(ocrResult.address)
      if (addr.dia_chi)    values.dia_chi    = addr.dia_chi
      if (addr.phuong_xa)  values.phuong_xa  = addr.phuong_xa
      if (addr.quan_huyen) values.quan_huyen = addr.quan_huyen
      if (addr.tinh_thanh) values.tinh_thanh = addr.tinh_thanh
    }
    if (ocrResult.issued_date) values.cccd_issued_date = dayjs(ocrResult.issued_date)
    if (ocrResult.issued_place) values.cccd_issued_place = ocrResult.issued_place
    form.setFieldsValue(values)
    toast.success('Đã điền tự động!')
  }

  const slotStyle = {
    flex: 1,
    minWidth: 140,
    background: 'var(--mgt-bg-base)',
    border: '1px dashed var(--mgt-border-strong)',
    borderRadius: 10,
    padding: 12,
    textAlign: 'center' as const,
    cursor: 'pointer',
  }

  return (
    <div style={{
      background: 'var(--mgt-gradient-card)',
      border: '1px solid var(--mgt-border)',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 24,
    }}>
      <div style={{ color: 'var(--mgt-text-primary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: '0.03em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <IdcardOutlined /> QUÉT CCCD ĐỂ ĐIỀN TỰ ĐỘNG
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {/* CCCD Front */}
        <div style={slotStyle}>
          <Text style={{ color: 'var(--mgt-text-secondary)', fontSize: 11, display: 'block', marginBottom: 8 }}>CCCD mặt trước</Text>
          {frontPreview ? (
            <Image src={frontPreview} alt="CCCD front" style={{ maxHeight: 100, objectFit: 'contain', borderRadius: 6 }} />
          ) : (
            <Upload showUploadList={false} accept="image/jpeg,image/png,image/webp"
              beforeUpload={f => { handleUpload(f, 'front'); return false }}>
              <div style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--mgt-text-secondary)', gap: 4 }}>
                <CameraOutlined style={{ fontSize: 22 }} />
                <span style={{ fontSize: 11 }}>Tải ảnh lên</span>
              </div>
            </Upload>
          )}
          {frontPreview && (
            <Upload showUploadList={false} accept="image/jpeg,image/png,image/webp"
              beforeUpload={f => { handleUpload(f, 'front'); return false }}>
              <Button size="small" style={{ marginTop: 6, fontSize: 11 }}>Đổi ảnh</Button>
            </Upload>
          )}
        </div>

        {/* CCCD Back */}
        <div style={slotStyle}>
          <Text style={{ color: 'var(--mgt-text-secondary)', fontSize: 11, display: 'block', marginBottom: 8 }}>CCCD mặt sau</Text>
          {backPreview ? (
            <Image src={backPreview} alt="CCCD back" style={{ maxHeight: 100, objectFit: 'contain', borderRadius: 6 }} />
          ) : (
            <Upload showUploadList={false} accept="image/jpeg,image/png,image/webp"
              beforeUpload={f => { handleUpload(f, 'back'); return false }}>
              <div style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--mgt-text-secondary)', gap: 4 }}>
                <CameraOutlined style={{ fontSize: 22 }} />
                <span style={{ fontSize: 11 }}>Tải ảnh lên</span>
              </div>
            </Upload>
          )}
          {backPreview && (
            <Upload showUploadList={false} accept="image/jpeg,image/png,image/webp"
              beforeUpload={f => { handleUpload(f, 'back'); return false }}>
              <Button size="small" style={{ marginTop: 6, fontSize: 11 }}>Đổi ảnh</Button>
            </Upload>
          )}
        </div>
      </div>

      {/* OCR status + apply */}
      {ocrLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mgt-text-secondary)', fontSize: 13 }}>
          <Spin size="small" /> Đang nhận dạng CCCD...
        </div>
      )}
      {ocrResult && !ocrLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={applyOcr}
            style={{ background: 'linear-gradient(135deg, #1677ff, #0958d9)', border: 'none', fontWeight: 600 }}>
            Điền tự động
          </Button>
          <Text style={{ color: 'var(--mgt-text-secondary)', fontSize: 12 }}>
            {[ocrResult.full_name, ocrResult.cccd_number, ocrResult.date_of_birth].filter(Boolean).join(' • ') || 'Không nhận dạng được'}
          </Text>
          <Button size="small" icon={<ScanOutlined />} onClick={() => frontFile && runOcr(frontFile)}
            style={{ fontSize: 11, color: 'var(--mgt-text-secondary)' }}>
            Quét lại
          </Button>
        </div>
      )}
    </div>
  )
}

export default CccdUploadSection
