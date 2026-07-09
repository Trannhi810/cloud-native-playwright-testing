import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Loader } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'


export default function TestRunHistory() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')

  useEffect(() => {
    apiFetch(API_ENDPOINTS.testRuns)
      .then(res => {
        if (!res.ok) throw new Error('API fetch error')
        return res.json()
      })
      .then(data => {
        // Fallback to array if data is wrapped
        const dataArray = Array.isArray(data) ? data : data.items || []
        setRuns(dataArray)
        setLoading(false)
      })
      .catch(err => {
        console.log('Chưa có dữ liệu từ Backend:', err)
        setLoading(false)
      })
  }, [])

  const lowerSearch = search.toLowerCase()
  const filtered = runs.filter(r =>
    (filterStatus === 'ALL' || r.status === filterStatus) &&
    ((r.website || '').toLowerCase().includes(lowerSearch) || (r.id || '').toLowerCase().includes(lowerSearch) || (r.suite || '').toLowerCase().includes(lowerSearch))
  )

  // Dùng full_id (UUID đầy đủ) để navigate, tránh lỗi DynamoDB get_item không tìm thấy item
  const goToDetail = (run) => navigate(`/test-runs/${run.full_id || run.id}`)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Lịch sử kiểm thử</div>
          <div className="page-subtitle">Toàn bộ lần chạy được lưu vĩnh viễn trong DynamoDB</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Tìm theo website, ID, suite..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="ALL">Tất cả trạng thái</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
            <option value="running">Running</option>
          </select>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr><th>ID</th><th>Website</th><th>Môi trường</th><th>Kết quả</th><th>Pass/Total</th><th>Thời lượng</th><th>Kích hoạt</th><th>Thời gian</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Đang tải dữ liệu...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Chưa có lần chạy kiểm thử nào.</td></tr>
              ) : (
                filtered.map(run => (
                  <tr key={run.id} style={{ cursor: 'pointer' }} onClick={() => goToDetail(run)}>
                    <td><code style={{ color: 'var(--accent-blue)', fontSize: 12 }}>{run.id}</code></td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>{run.website}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{run.suite}</div>
                    </td>
                    <td><span className={`badge badge-${run.env === 'Production' ? 'red' : run.env === 'Staging' ? 'yellow' : 'blue'}`}>{run.env}</span></td>
                    <td>
                      {run.status === 'pass' && <span className="badge badge-green">✓ Pass</span>}
                      {run.status === 'fail' && <span className="badge badge-red">✗ Fail</span>}
                      {run.status === 'running' && <span className="badge badge-yellow animate-pulse">⟳ Running</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 60 }}>
                          <div className="progress-fill" style={{ width: `${(run.pass / run.total) * 100}%`, background: run.fail > 0 ? '#ef4444' : '#10b981' }} />
                        </div>
                        <span style={{ fontSize: 12 }}>{run.pass}/{run.total}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{run.duration}</td>
                    <td>
                      <span className={`badge badge-${run.trigger === 'manual' ? 'blue' : 'purple'}`}>{run.trigger === 'manual' ? '👤 Manual' : '⏰ Schedule'}</span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{run.triggeredBy}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{run.time}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); goToDetail(run) }}>Chi tiết</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
          {filtered.length} / {runs.length} lần chạy
        </div>
      </div>
    </div>
  )
}
