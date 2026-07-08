import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TestTube, Zap, TrendingUp, Clock, ArrowUpRight, Loader } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'


const initialStats = [
  { label: 'Test Suites', value: '0', sub: 'Chưa có website', color: 'var(--blue)', bg: 'var(--blue-light)', Icon: TestTube, stripe: 'var(--grad-blue)' },
  { label: 'Chạy tuần này', value: '0', sub: '0 pass • 0 fail', color: 'var(--green)', bg: 'var(--green-light)', Icon: TrendingUp, stripe: 'var(--grad-green)' },
  { label: 'Thời gian TB', value: '0s', sub: 'Chưa tính được', color: 'var(--purple)', bg: 'var(--purple-light)', Icon: Clock, stripe: 'var(--grad-purple)' },
  { label: 'Hàng đợi (SQS)', value: '0', sub: 'Trống, sẵn sàng', color: 'var(--yellow)', bg: 'var(--yellow-light)', Icon: Zap, stripe: 'linear-gradient(135deg,#f59e0b,#d97706)' },
]

export default function QADashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState({ stats: initialStats, weekData: [], suites: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(API_ENDPOINTS.stats)
      .then(res => {
        if (!res.ok) throw new Error('API fetch error')
        return res.json()
      })
      .then(apiData => {
        // Backend /stats trả về: { stats, pieData, trendData, recentRuns }
        // Map sang format mà QADashboard dùng
        setData({
          stats: apiData.stats || initialStats,      // dùng "stats" (có sẵn từ backend)
          weekData: apiData.trendData || [],          // "trendData" → weekData cho biểu đồ
          suites: apiData.recentRuns?.slice(0, 3) || [] // 3 run gần nhất làm preview suite
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
          <div className="page-title">QA Dashboard</div>
          <div className="page-subtitle">Tổng quan kiểm thử của QA/Tester team</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/trigger')}>
          <Zap size={15} /> Chạy test ngay
        </button>
      </div>

      <div className="stats-grid">
        {data.stats.map(({ label, value, sub, color, bg, Icon, stripe }) => (
          <div key={label} className={`stat-card${loading ? ' loading-pulse' : ''}`}>
            <div className="stat-stripe" style={{ background: stripe }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{ color }}>{value}</div>
                <div className="stat-sub">{sub}</div>
              </div>
              <div className="stat-icon-box" style={{ background: bg }}>
                <Icon size={20} style={{ color }} strokeWidth={2} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Pass / Fail theo ngày</div>
          {data.weekData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.weekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#cbd5e1" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis stroke="#cbd5e1" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="pass" stackId="a" fill="var(--accent-green)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="fail" stackId="a" fill="var(--accent-red)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu biểu đồ...</div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Test Suites của tôi</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/test-suites')}>Tất cả</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.suites.length > 0 ? data.suites.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.cases} cases</div>
                </div>
                <button className="btn btn-primary btn-sm btn-icon" onClick={() => navigate('/trigger')}><Zap size={13} /></button>
              </div>
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border)' }}>Chưa có suite nào được giao</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Thao tác nhanh</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/trigger')}><Zap size={15} /> Kích hoạt kiểm thử</button>
          <button className="btn btn-secondary" onClick={() => navigate('/test-suites')}><TestTube size={15} /> Quản lý Test Suite</button>
          <button className="btn btn-secondary" onClick={() => navigate('/test-runs')}><Clock size={15} /> Lịch sử kiểm thử</button>
        </div>
      </div>
    </div>
  )
}
