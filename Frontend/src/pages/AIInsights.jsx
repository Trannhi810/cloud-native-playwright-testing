import { useState, useEffect } from 'react'
import { Bot, AlertTriangle } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../config'

export default function AIInsights() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch(API_ENDPOINTS.chatgptInsights)
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
  }, [])

  if (loading) return <div className="page" style={{ padding: 40, textAlign: 'center' }}>Đang phân tích dữ liệu AI...</div>
  if (error) return <div className="page" style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Lỗi: {error}</div>

  const insights = data || {}
  const totalRuns = insights.totalRuns || 0
  const avgPassRate = insights.avgPassRate || 0
  const worstModule = insights.worstModule || '—'
  const repeatingErrors = insights.repeatingErrors || 0
  const repeatingErrorPatterns = insights.repeatingErrorPatterns || []
  const moduleScores = insights.moduleScores || []

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">AI Insights</div>
          <div className="page-subtitle">Phân tích chuyên sâu từ ChatGPT</div>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 24 }}>
        <Bot size={16} />
        <span>AI phân tích dữ liệu từ <strong>30 ngày</strong> gần nhất. Dữ liệu được tạo bởi ChatGPT.</span>
      </div>

      <div className="grid-2">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ fontWeight: 700, fontSize: 15, width: '100%', marginBottom: 'auto' }}>Điểm ổn định theo Module</div>
          {moduleScores.length > 0 ? (
            <div style={{ width: '100%', marginTop: 20 }}>
              {moduleScores.map(m => (
                <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <span>{m.name}</span>
                  <span style={{ fontWeight: 600, color: m.score < 70 ? '#ef4444' : '#10b981' }}>{m.score}/100</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>Chưa có dữ liệu để phân tích</div>
          )}
          <div style={{ marginTop: 'auto', width: '100%' }}></div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Tổng quan 30 ngày</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Tổng lần chạy</span>
              <span style={{ fontWeight: 600 }}>{totalRuns}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Tỷ lệ Pass TB</span>
              <span style={{ fontWeight: 600 }}>{avgPassRate}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Module hay lỗi nhất</span>
              <span style={{ fontWeight: 600 }}>{worstModule}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Lỗi lặp lại (&gt;3 lần)</span>
              <span style={{ fontWeight: 600, color: repeatingErrors > 0 ? '#ef4444' : 'inherit' }}>{repeatingErrors} patterns</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <AlertTriangle size={18} style={{ color: 'var(--accent-yellow)' }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>Lỗi lặp lại — Cần chú ý</div>
        </div>
        
        {repeatingErrorPatterns.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {repeatingErrorPatterns.map((err, i) => (
              <div key={i} style={{ padding: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>{err.pattern}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Lặp lại: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{err.count} lần</span> — Lần cuối: {err.lastSeen}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-hover)', borderRadius: 12, border: '1px dashed var(--border)' }}>
            Chưa phát hiện mẫu lỗi (pattern) lặp lại nào trong 30 ngày qua.
          </div>
        )}
      </div>
    </div>
  )
}
