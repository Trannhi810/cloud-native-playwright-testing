import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, CheckCircle, XCircle, Clock, Camera } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'

export default function TestRunDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch(`${API_ENDPOINTS.testRuns}/${id}`)
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

  if (loading) return <div className="page" style={{ padding: 40, textAlign: 'center' }}>Đang tải dữ liệu...</div>
  if (error) return <div className="page" style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Lỗi: {error}</div>
  if (!data) return <div className="page" style={{ padding: 40, textAlign: 'center' }}>Không tìm thấy kết quả</div>

  const { runDetail = {}, testCases = [], logs = [] } = data
  const passRate = runDetail.total ? Math.round((runDetail.pass / runDetail.total) * 100) : 0

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => navigate('/test-runs')}><ArrowLeft size={16} /></button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <code style={{ color: 'var(--accent-blue)', fontSize: 14, fontWeight: 700 }}>{runDetail.id}</code>
            <span className="badge badge-red">✗ Fail</span>
            <span className={`badge badge-${runDetail.env === 'Production' ? 'red' : 'yellow'}`}>{runDetail.env}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{runDetail.website} • {runDetail.suite}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm"><Download size={14} /> JSON</button>
          <button className="btn btn-primary btn-sm"><ExternalLink size={14} /> Xem báo cáo HTML</button>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Tổng cases', value: runDetail.total, color: 'var(--text-primary)' },
          { label: 'Pass', value: runDetail.pass, color: '#10b981' },
          { label: 'Fail', value: runDetail.fail, color: '#ef4444' },
          { label: 'Tỷ lệ đạt', value: passRate + '%', color: passRate >= 80 ? '#10b981' : '#ef4444' },
          { label: 'Thời lượng', value: runDetail.duration, color: 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      <div className="card" style={{ marginBottom: 24, borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>AI Summary (AWS Bedrock)</span>
          <span className="badge badge-purple">AI Generated</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14 }}>{runDetail.aiSummary}</p>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Test Cases */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chi tiết Test Cases ({testCases.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {testCases.map(tc => (
              <div key={tc.id} style={{ padding: '12px', borderRadius: 8, background: 'var(--bg-primary)', border: `1px solid ${tc.status === 'fail' ? 'rgba(239,68,68,0.2)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {tc.status === 'pass' ? <CheckCircle size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} /> : <XCircle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: tc.status === 'fail' ? '#fca5a5' : 'var(--text-primary)' }}>{tc.name}</div>
                    {tc.error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontFamily: 'monospace' }}>{tc.error}</div>}
                    {tc.screenshot && (
                      <button className="btn btn-secondary btn-sm" style={{ marginTop: 6, padding: '3px 8px', fontSize: 11 }}>
                        <Camera size={10} /> Xem ảnh lỗi
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{tc.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>CloudWatch Logs</div>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 12, maxHeight: 420, overflowY: 'auto' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{log.time}</span>
                <span style={{ color: log.level === 'FAIL' ? '#ef4444' : log.level === 'PASS' ? '#10b981' : '#7dd3fc', flexShrink: 0, width: 40 }}>[{log.level}]</span>
                <span style={{ color: 'var(--text-secondary)' }}>{log.msg}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Thông tin thực thi</div>
            {[
              ['Bắt đầu', runDetail.startTime], ['Kết thúc', runDetail.endTime],
              ['Kích hoạt bởi', runDetail.triggeredBy], ['Hạ tầng', 'AWS ECS Fargate'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 12 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
