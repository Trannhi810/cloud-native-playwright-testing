import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Activity, CheckCircle, AlertTriangle, Clock, DollarSign, ArrowUpRight } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'

const initialTrend = []
const initialPie = [{ name: 'Chưa có dữ liệu', value: 1, color: '#e2e8f0' }]
const initialRecent = []

const initialStats = [
  { id: 'today', label: 'Lần chạy hôm nay', value: '0', sub: 'Chưa có dữ liệu', color: 'var(--blue)', bg: 'var(--blue-light)', stripe: 'var(--grad-blue)', Icon: Activity },
  { id: 'passRate', label: 'Tỷ lệ Pass', value: '0%', sub: '0/0 test cases', color: 'var(--green)', bg: 'var(--green-light)', stripe: 'var(--grad-green)', Icon: CheckCircle },
  { id: 'running', label: 'Đang chạy', value: '0', sub: 'Không có tiến trình', color: 'var(--yellow)', bg: 'var(--yellow-light)', stripe: 'linear-gradient(135deg,#f59e0b,#d97706)', Icon: Clock, running: false },
  { id: 'errors', label: 'Lỗi nghiêm trọng', value: '0', sub: 'Hệ thống ổn định', color: 'var(--red)', bg: 'var(--red-light)', stripe: 'linear-gradient(135deg,#ef4444,#dc2626)', Icon: AlertTriangle, glow: 'glow-red' },
]

// Mini progress bar component
function MiniProgress({ pass, total, status }) {
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  const color = status === 'pass' ? '#10b981' : status === 'fail' ? '#ef4444' : '#f59e0b'
  return (
    <div>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{pass}/{total}</span>
      <div className="mini-progress">
        <div className="mini-progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// Radar ping dot for running status
function PingDot({ color }) {
  return <span className="ping-dot" style={{ color }} />
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    stats: initialStats,
    trendData: initialTrend,
    pieData: initialPie,
    recentRuns: initialRecent
  })

  useEffect(() => {
    // Gọi API /stats khi component mount
    fetch(API_ENDPOINTS.stats)
      .then(res => {
        if (!res.ok) throw new Error('API returns empty/error')
        return res.json()
      })
      .then(apiData => {
        // Backend cần trả về đúng cấu trúc này để tự động map vào giao diện
        // Ví dụ: { stats: [...], trendData: [...], pieData: [...], recentRuns: [...] }
        setData({
          stats: apiData.stats || initialStats,
          trendData: apiData.trendData || initialTrend,
          pieData: apiData.pieData || initialPie,
          recentRuns: apiData.recentRuns || initialRecent
        })
        setLoading(false)
      })
      .catch(err => {
        console.log('Chưa có dữ liệu từ Backend:', err)
        setLoading(false) // Vẫn hiển thị giao diện trống nếu lỗi
      })
  }, [])

  const totalPie = data.pieData.reduce((s, e) => s + e.value, 0)

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Admin Dashboard</div>
          <div className="page-subtitle">Tổng quan hệ thống • {new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}</div>
        </div>
      </div>

      {/* Stats — glow on red & purple */}
      <div className="stats-grid">
        {data.stats.map(({ id, label, value, sub, color, bg, stripe, Icon, glow, running }) => (
          <div key={id || label} className={`stat-card${glow ? ` ${glow}` : ''}${loading ? ' loading-pulse' : ''}`}>
            <div className="stat-stripe" style={{ background: stripe }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {running && <PingDot color="var(--yellow)" />}
                  <div className="stat-value" style={{ color }}>{value}</div>
                </div>
                <div className="stat-sub">{sub}</div>
              </div>
              <div className="stat-icon-box" style={{ background: bg }}>
                <Icon size={20} style={{ color }} strokeWidth={2} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Area chart */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Xu hướng 7 ngày</div>
            <span className="badge badge-blue">Tuần này</span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={data.trendData}>
              <defs>
                <linearGradient id="lgPass" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="lgFail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" stroke="#cbd5e1" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis stroke="#cbd5e1" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
              <Area type="monotone" dataKey="pass" stroke="#10b981" fill="url(#lgPass)" strokeWidth={2.5} name="Pass" />
              <Area type="monotone" dataKey="fail" stroke="#ef4444" fill="url(#lgFail)" strokeWidth={2.5} name="Fail" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart — animated sweep + rounded stroke */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Tỷ lệ Pass / Fail</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ResponsiveContainer width={170} height={170}>
              <PieChart>
                <Pie
                  data={data.pieData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={76}
                  dataKey="value"
                  strokeWidth={0}
                  isAnimationActive={true}
                  animationBegin={100}
                  animationDuration={900}
                  animationEasing="ease-out"
                  strokeLinecap="round"
                >
                  {data.pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div>
              {data.pieData.map(e => {
                const pct = Math.round((e.value / totalPie) * 100)
                return (
                  <div key={e.name} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: e.color }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{e.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.name === 'Chưa có dữ liệu' ? '' : `(${pct}%)`}</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{e.name === 'Chưa có dữ liệu' ? '-' : e.value}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Runs — progress bar in Cases column */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Các lần chạy gần nhất</div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/test-runs')}>
            Xem tất cả <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>ID</th><th>Website</th><th>Môi trường</th><th>Kết quả</th><th>Cases</th><th>Thời lượng</th><th>Lúc</th><th></th></tr>
            </thead>
            <tbody>
              {data.recentRuns.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Chưa có lần chạy nào.</td></tr>
              ) : (
                data.recentRuns.map(run => {
                  return (
                    <tr key={run.id}>
                      <td><span style={{ color: 'var(--blue)', fontWeight: 600, fontSize: 12 }}>{run.id}</span></td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{run.website}</td>
                      <td><span className={`badge badge-${run.env === 'Production' ? 'red' : run.env === 'Staging' ? 'yellow' : 'blue'}`}>{run.env}</span></td>
                      <td>
                        {run.status === 'pass' && <span className="badge badge-green">✓ Pass</span>}
                        {run.status === 'fail' && <span className="badge badge-red">✗ Fail</span>}
                        {run.status === 'running' && (
                          <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <PingDot color="var(--yellow)" />Running
                          </span>
                        )}
                      </td>
                      {/* Cases with progress bar */}
                      <td>
                        <MiniProgress pass={run.pass} total={run.total} status={run.status} />
                      </td>
                      <td>{run.duration}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{run.time}</td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => navigate(`/test-runs/${run.id}`)}>Chi tiết</button></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
