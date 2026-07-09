import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Eye, Monitor, Loader } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'

const initialStats = [
  { label: 'Tổng lần chạy hôm nay', value: '0', sub: 'Chưa có dữ liệu', color: 'var(--blue)', bg: 'var(--blue-light)', stripe: 'var(--grad-blue)' },
  { label: 'Pass rate trung bình', value: '0%', sub: 'Chưa có dữ liệu', color: 'var(--green)', bg: 'var(--green-light)', stripe: 'var(--grad-green)' },
  { label: 'Website đang monitor', value: '0', sub: 'Chưa có dữ liệu', color: 'var(--purple)', bg: 'var(--purple-light)', stripe: 'var(--grad-purple)' },
  { label: 'Lần chạy cuối', value: '--:--', sub: 'Chưa có dữ liệu', color: 'var(--yellow)', bg: 'var(--yellow-light)', stripe: 'linear-gradient(135deg,#f59e0b,#d97706)' },
]

export default function ViewerDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState({ stats: initialStats, trendData: [], recentRuns: [], sites: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(API_ENDPOINTS.stats)
      .then(res => {
        if (!res.ok) throw new Error('API fetch error')
        return res.json()
      })
      .then(apiData => {
        setData({
          stats: initialStats.map((base, i) => {
            const be = (apiData.stats || [])[i]
            return be ? { ...base, ...be } : base
          }),
          trendData: (apiData.trendData || []).map(t => ({
            ...t,
            rate: t.pass + t.fail > 0 ? Math.round((t.pass / (t.pass + t.fail)) * 100) : 0
          })),
          recentRuns: apiData.recentRuns || [],
          sites: (() => {
            const unique = {}
              ; (apiData.recentRuns || []).forEach(r => {
                if (r.website && r.website !== 'N/A' && !unique[r.website]) {
                  const isFail = r.status === 'fail'
                  const isRun = r.status === 'running'
                  unique[r.website] = {
                    name: r.website.replace(/^https?:\/\//, '').split('/')[0],
                    env: r.env || 'Production',
                    status: isFail ? 'issue' : isRun ? 'running' : 'healthy',
                    uptime: isFail ? '98.5%' : '99.9%',
                    color: isFail ? 'var(--red)' : isRun ? 'var(--yellow)' : 'var(--green)',
                    bg: isFail ? 'var(--red-light)' : isRun ? 'var(--yellow-light)' : 'var(--green-light)'
                  }
                }
              })
            return Object.values(unique)
          })()
        })
        setLoading(false)
      })
      .catch(err => {
        console.log('Chưa có dữ liệu từ Backend:', err)
        setLoading(false)
      })
  }, [])
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Developer Dashboard</div>
          <div className="page-subtitle">Chỉ xem — Theo dõi kết quả kiểm thử</div>
        </div>
        <span className="badge badge-blue" style={{ padding: '6px 14px', fontSize: 12 }}>
          <Eye size={12} /> Developer / Viewer
        </span>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 24 }}>
        <Eye size={16} />
        Bạn đang xem ở chế độ Viewer. Liên hệ Admin hoặc QA để chạy test hoặc thay đổi cấu hình.
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {data.stats.map(s => (
          <div key={s.label} className={`stat-card${loading ? ' loading-pulse' : ''}`}>
            <div className="stat-stripe" style={{ background: s.stripe }} />
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Trend */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Tỷ lệ Pass theo ngày (%)</div>
          {data.trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" stroke="#cbd5e1" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis stroke="#cbd5e1" tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
                <Line type="monotone" dataKey="rate" stroke="var(--blue)" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Chưa có dữ liệu biểu đồ</div>
          )}
        </div>

        {/* Recent Runs */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Lịch sử chạy gần đây</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/test-runs')}>Toàn bộ</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.recentRuns.length > 0 ? data.recentRuns.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{r.id}</span>
                    <span className={`badge badge-${r.status === 'pass' ? 'green' : r.status === 'fail' ? 'red' : 'yellow'}`}>{r.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.website} • {r.time}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{r.pass}/{r.total} pass</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.duration}</div>
                </div>
              </div>
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border)' }}>Chưa có lần chạy nào gần đây</div>
            )}
          </div>
        </div>
      </div>

      {/* Sites status */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Monitor size={18} style={{ color: 'var(--blue)' }} /> Trạng thái các website
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {data.sites.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '30px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 8, border: '1px dashed var(--border)' }}>Chưa có website nào được theo dõi.</div>
          ) : (
            data.sites.map(site => (
              <div key={site.name} style={{ padding: 18, borderRadius: 8, background: site.bg, border: `1px solid ${site.status === 'issue' ? '#fecaca' : site.status === 'running' ? '#fde68a' : '#a7f3d0'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="badge badge-gray" style={{ fontSize: 10 }}>{site.env}</span>
                  <span className={`status-dot dot-${site.status === 'healthy' ? 'green' : site.status === 'issue' ? 'red' : 'yellow'}`} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{site.name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: site.color }}>{site.uptime}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>uptime</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
