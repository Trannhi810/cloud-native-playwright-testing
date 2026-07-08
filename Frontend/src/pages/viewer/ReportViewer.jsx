import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Lock, FileText, AlertTriangle } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'

export default function ReportViewer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch(`${API_ENDPOINTS.reports}/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('API fetch error')
        return res.json()
      })
      .then(apiData => {
        setData(apiData)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="page" style={{ padding: 40, textAlign: 'center' }}>Đang tải báo cáo...</div>
  if (error) return <div className="page" style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Lỗi: {error}</div>
  if (!data) return <div className="page" style={{ padding: 40, textAlign: 'center' }}>Không tìm thấy báo cáo</div>

  const expiresAt = data.expiresAt ? new Date(data.expiresAt).toLocaleString('vi-VN') : 'Không xác định'
  const summary = data.summary || []
  const aiSummary = data.aiSummary || 'Chưa có dữ liệu AI.'
  const s3Link = data.s3Link || ''
  const s3BucketPath = data.s3BucketPath || ''
  const title = data.title || `Báo cáo ${id}`
  const subtitle = data.subtitle || ''

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{subtitle}</div>
        </div>
      </div>

      <div className="alert alert-warning" style={{ marginBottom: 24 }}>
        <Lock size={16} />
        <span>Link này sử dụng <strong>S3 Presigned URL</strong> có thời hạn. Hết hạn lúc: <strong>{expiresAt}</strong>. Không chia sẻ link với người ngoài danh sách.</span>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} style={{ color: 'var(--accent-blue)' }} /> Tóm tắt kết quả
          </div>
          {summary.length > 0 ? summary.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 140, flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: 13 }}>
                {v === 'Pass' || v === '✓ Pass' ? <span className="badge badge-green">✓ Pass</span> : 
                 v === 'Fail' || v === '✗ Fail' ? <span className="badge badge-red">✗ Fail</span> : v}
              </span>
            </div>
          )) : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chưa có thông tin tóm tắt</div>}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            🤖 AI Summary
          </div>
          <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: 16, fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {aiSummary}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Được tạo bởi AI Model</div>
        </div>
      </div>

      {/* Embedded report placeholder */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Playwright HTML Report</div>
          {s3Link && <button className="btn btn-primary btn-sm" onClick={() => window.open(s3Link, '_blank')}><ExternalLink size={14} /> Mở toàn màn hình</button>}
        </div>
        
        {s3Link ? (
          <iframe 
            src={s3Link} 
            title="Playwright Report" 
            style={{ width: '100%', height: 600, border: 'none', background: '#fff' }} 
          />
        ) : (
          <div style={{ height: 500, background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <AlertTriangle size={48} style={{ color: 'var(--text-muted)' }} />
            <div style={{ fontWeight: 600, fontSize: 16 }}>Không tải được báo cáo HTML</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>
              Báo cáo có thể đã hết hạn hoặc không tồn tại trên S3<br />
              {s3BucketPath && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s3BucketPath}</span>}
            </div>
            {s3Link && <button className="btn btn-primary" onClick={() => window.open(s3Link, '_blank')}><ExternalLink size={16} /> Mở báo cáo HTML</button>}
          </div>
        )}
      </div>
    </div>
  )
}
