import { useState, useEffect } from 'react'
import { Zap, AlertCircle, CheckCircle, Server, Activity, Box, ArrowRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { API_ENDPOINTS, apiFetch } from '../../config'


export default function ManualTrigger() {
  const [form, setForm] = useState({ website: '', env: 'Staging', suite: '', priority: 'normal' })
  const [status, setStatus] = useState(null) // null | 'running' | 'success' | 'error'
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [runId, setRunId] = useState('TR-NEW')
  const [suites, setSuites] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    apiFetch(API_ENDPOINTS.testSuites)
      .then(res => res.json())
      .then(data => {
        const dataArray = Array.isArray(data) ? data : data.items || []
        setSuites(dataArray)
      })
      .catch(err => console.error('Lỗi khi tải test suites:', err))
  }, [])

  const handleTrigger = async () => {
    if (!form.website || !form.suite) return
    setStatus('running'); setProgress(0); setErrorMsg('')

    try {
      const token = localStorage.getItem('token')

      const res = await apiFetch(API_ENDPOINTS.trigger, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          website: form.website,
          env: form.env,
          suite: form.suite,
          priority: form.priority,
        }),
      })

      if (!res.ok) throw new Error(`API trả về lỗi: ${res.status}`)

      const data = await res.json()
      // Backend trả về "task_id" (UUID), không phải "runId"
      if (data && data.task_id) {
        setRunId(data.task_id)
      }

      // Giả lập progress trong khi SQS/ECS xử lý
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(r => setTimeout(r, 400))
        setProgress(i)
      }
      setStatus('success')

    } catch (err) {
      console.error('Trigger API error:', err)
      setErrorMsg(err.message || 'Không thể kết nối tới API Gateway')
      setStatus('error')
    }
  }


  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Kích hoạt kiểm thử thủ công</div>
          <div className="page-subtitle">Chạy ngay mà không cần chờ lịch tự động</div>
        </div>
      </div>

      <div>
        {status === null && (
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* CỘT TRÁI: Form nhập liệu */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={22} style={{ color: 'var(--blue)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Cấu hình phiên kiểm thử</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Điền thông số để đẩy yêu cầu vào SQS</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">URL Website cần kiểm thử *</label>
                <input className="form-input" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://shop.company.com" />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Môi trường *</label>
                  <select className="form-select" value={form.env} onChange={e => setForm(f => ({ ...f, env: e.target.value }))}>
                    <option value="Dev">🟢 Development</option>
                    <option value="Staging">🟡 Staging</option>
                    <option value="Production">🔴 Production</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Độ ưu tiên</label>
                  <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Thấp</option>
                    <option value="normal">Bình thường</option>
                    <option value="high">Cao - Lên đầu hàng</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Kịch bản kiểm thử *</label>
                <select className="form-select" value={form.suite} onChange={e => setForm(f => ({ ...f, suite: e.target.value }))}>
                  <option value="">-- Chọn Test Suite --</option>
                  {suites.map(s => <option key={s.id || s.name || s} value={s.name || s}>{s.name || s}</option>)}
                </select>
              </div>

              {form.env === 'Production' && (
                <div className="alert alert-warning" style={{ marginBottom: 24 }}>
                  <AlertCircle size={16} />
                  <span>Cảnh báo: Đang chọn môi trường <strong>Production</strong>. Ảnh hưởng đến hệ thống thật.</span>
                </div>
              )}

              <button
                id="btn-trigger"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15 }}
                onClick={handleTrigger}
                disabled={!form.website || !form.suite}
              >
                <Zap size={18} /> Kích hoạt kiểm thử ngay
              </button>
            </div>

            {/* CỘT PHẢI: Infra & Ticket */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Khối 1: AWS Infra Status */}
              <div className="card" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={16} style={{ color: 'var(--blue)' }} /> Trạng thái Hạ tầng AWS
                </div>

                {/* Flow Diagram */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--blue-light)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', boxShadow: '0 2px 8px rgba(59,130,246,0.15)' }}><Zap size={20} /></div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>Dashboard</div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--purple-light)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', boxShadow: '0 2px 8px rgba(139,92,246,0.15)' }}><Box size={20} /></div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>SQS Queue</div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--orange-light)', color: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', boxShadow: '0 2px 8px rgba(249,115,22,0.15)' }}><Zap size={20} /></div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>Lambda</div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', boxShadow: '0 2px 8px rgba(16,185,129,0.15)' }}><Server size={20} /></div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>ECS Fargate</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 8, border: '1px dashed var(--border)' }}>
                  <span className="ping-dot" style={{ color: 'var(--green)', marginRight: 10, verticalAlign: 'middle' }}></span>
                  <strong style={{ color: 'var(--text-primary)' }}>Hệ thống sẵn sàng:</strong> Hàng đợi SQS đang trống • Fargate (0/5 Tasks Active)
                </div>
              </div>

              {/* Khối 2: Execution Ticket */}
              <div className="card" style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -11, left: 24, background: 'var(--bg-card)', padding: '0 10px', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Execution Ticket</div>

                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    ['Website Target', form.website || 'Chưa nhập URL...'],
                    ['Môi trường', <span key="env" className={`badge badge-${form.env === 'Production' ? 'red' : form.env === 'Staging' ? 'yellow' : 'green'}`}>{form.env}</span>],
                    ['Độ ưu tiên', form.priority === 'high' ? 'Cao' : form.priority === 'low' ? 'Thấp' : 'Bình thường'],
                    ['Test Suite', form.suite || 'Chưa chọn kịch bản...'],
                    ['Tài nguyên cấp phát', 'AWS ECS Fargate (2vCPU, 4GB RAM)'],
                    ['Ước tính thời gian', '~2-5 phút'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dotted var(--border)', paddingBottom: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{k}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', maxWidth: 220, wordBreak: 'break-all' }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* AI Hint */}
                <div style={{ marginTop: 20, background: 'rgba(168,85,247,0.08)', padding: 14, borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)', display: 'flex', gap: 10 }}>
                  <Sparkles size={18} style={{ color: '#a855f7', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>Mẹo từ AI Bedrock</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {form.env === 'Production'
                        ? 'Kiểm thử trên Production yêu cầu bộ test suite có độ ưu tiên cao để tránh nghẽn hàng đợi SQS. Hãy chắc chắn lịch trình không trùng giờ cao điểm.'
                        : 'Đảm bảo rằng webhook hoặc tài khoản test trong kịch bản .spec.js đã được cập nhật chính xác trong AWS Secrets Manager.'}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {status === 'running' && (
          <div className="card" style={{ textAlign: 'center', padding: 60, maxWidth: 680, margin: '0 auto' }}>
            <div style={{ fontSize: 56, marginBottom: 24 }} className="animate-pulse">🚀</div>
            <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 12, color: 'var(--text-primary)' }}>Đang khởi tạo hệ thống...</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>Yêu cầu đã được đưa vào hàng đợi SQS • ECS Fargate đang kéo Docker image</div>
            <div className="progress-bar" style={{ maxWidth: 400, margin: '0 auto 16px', height: 8 }}>
              <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--grad-blue)' }} />
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>{progress}% — {progress < 40 ? 'Xác thực thông tin...' : progress < 80 ? 'Đóng gói Payload...' : 'Đẩy vào SQS...'}</div>
          </div>
        )}

        {status === 'success' && (
          <div className="card" style={{ textAlign: 'center', padding: 60, maxWidth: 680, margin: '0 auto' }}>
            <CheckCircle size={64} style={{ color: 'var(--green)', margin: '0 auto 24px' }} />
            <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 12, color: 'var(--text-primary)' }}>Đã gửi yêu cầu vào hàng đợi!</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>Phiên kiểm thử đang được chạy ngầm trên ECS • Xem kết quả tại mục Lịch sử</div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate(`/test-runs/${runId}`)} style={{ padding: '12px 24px' }}>Xem báo cáo chi tiết</button>
              <button className="btn btn-secondary" onClick={() => { setStatus(null); setForm({ website: '', env: 'Staging', suite: '', priority: 'normal' }) }} style={{ padding: '12px 24px' }}>Chạy test mới</button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="card" style={{ textAlign: 'center', padding: 60, maxWidth: 680, margin: '0 auto' }}>
            <AlertCircle size={64} style={{ color: 'var(--red)', margin: '0 auto 24px' }} />
            <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 12, color: 'var(--text-primary)' }}>Kích hoạt thất bại!</div>
            <div style={{ color: 'var(--red)', marginBottom: 8, fontSize: 14, background: 'var(--red-light)', padding: '10px 20px', borderRadius: 8, display: 'inline-block' }}>{errorMsg}</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 14, marginTop: 12 }}>Kiểm tra lại API Gateway hoặc kết nối mạng</div>
            <button className="btn btn-secondary" onClick={() => setStatus(null)} style={{ padding: '12px 24px' }}>← Thử lại</button>
          </div>
        )}
      </div>
    </div>
  )
}
