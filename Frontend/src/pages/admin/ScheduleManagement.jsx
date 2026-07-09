import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Clock, Play, Pause, Loader } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'


export default function ScheduleManagement() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', website: '', env: 'Production', cron: '0 2 * * *', testSuite: '' })
  const [editing, setEditing] = useState(null)
  const [testSuites, setTestSuites] = useState([])

  useEffect(() => {
    apiFetch(API_ENDPOINTS.schedules)
      .then(res => {
        if (!res.ok) throw new Error('API fetch error')
        return res.json()
      })
      .then(data => {
        const dataArray = Array.isArray(data) ? data : data.items || []
        setSchedules(dataArray)
        setLoading(false)
      })
      .catch(err => {
        console.log('Chưa có dữ liệu từ Backend:', err)
        setLoading(false)
      })

    // Fetch Test Suites for dropdown
    apiFetch(API_ENDPOINTS.testSuites)
      .then(res => res.ok ? res.json() : [])
      .then(data => setTestSuites(Array.isArray(data) ? data : data.items || []))
      .catch(err => console.log('Không thể tải test suites', err))
  }, [])

  const refetch = () => {
    apiFetch(API_ENDPOINTS.schedules)
      .then(r => r.json())
      .then(data => {
        if (data.message || data.error) {
          setScheduleError(data.message || data.error)
          setSchedules([])
        } else {
          setSchedules(Array.isArray(data) ? data : data.Schedules || data.items || [])
        }
        setLoading(false)
      })
      .catch(err => { setScheduleError(err.message); setLoading(false) })
  }

  const handleSave = async () => {
    try {
      const url = editing ? `${API_ENDPOINTS.schedules}/${editing}` : API_ENDPOINTS.schedules
      const method = editing ? 'PUT' : 'POST'
      const res = await apiFetch(url, {
        method: method,
        body: JSON.stringify(form)
      })
      
      const data = await res.json()
      if (!res.ok || data.error || data.message?.includes('Lỗi')) {
        throw new Error(data.error || data.message || 'Lỗi không xác định từ server')
      }
      
      // Thành công
      setShowModal(false)
      setEditing(null)
      setForm({ name: '', website: '', env: 'Production', cron: '0 2 * * *', testSuite: '' })
      refetch() // Gọi lại API để load danh sách mới chuẩn nhất
    } catch (err) {
      console.error('Lỗi khi lưu lịch:', err)
      setScheduleError('Không thể lưu lịch: ' + err.message)
    }
  }

  const toggleStatus = (id) => setSchedules(s => s.map(x => x.id === id ? { ...x, status: x.status === 'active' ? 'paused' : 'active' } : x))

  const del = async (id) => {
    try {
      const res = await apiFetch(`${API_ENDPOINTS.schedules}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('API delete failed')
      setSchedules(s => s.filter(x => x.id !== id))
    } catch (err) {
      console.error('Lỗi khi xóa lịch:', err)
      refetch()
    }
  }

  const openEdit = (sc) => { setForm({ name: sc.name, website: sc.website, env: sc.env, cron: sc.cron, testSuite: sc.testSuite || '' }); setEditing(sc.id); setShowModal(true) }


  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Lịch kiểm thử tự động</div>
          <div className="page-subtitle">Cấu hình Amazon EventBridge • {schedules.length} lịch đang được thiết lập</div>
        </div>
        <button className="btn btn-primary" id="btn-add-schedule" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Thêm lịch mới
        </button>
      </div>

      <div className="alert alert-info">
        <Clock size={16} />
        Lịch trình được quản lý qua Amazon EventBridge. Mọi thay đổi sẽ đồng bộ lên AWS trong vòng 60 giây.
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Tên lịch</th><th>Website</th><th>Môi trường</th><th>Kịch bản</th><th>Lịch chạy</th><th>Trạng thái</th><th>Lần cuối</th><th>Lần kế tiếp</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Đang tải dữ liệu cấu hình...</td></tr>
              ) : scheduleError ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#ef4444' }}>Lỗi: {scheduleError}</td></tr>
              ) : schedules.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Chưa có lịch trình kiểm thử nào được thiết lập.</td></tr>
              ) : (
                schedules.map(sc => (
                  <tr key={sc.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sc.name}</td>
                    <td style={{ color: 'var(--accent-cyan)', fontSize: 13 }}>{sc.website}</td>
                    <td><span className={`badge badge-${sc.env === 'Production' ? 'red' : sc.env === 'Staging' ? 'yellow' : 'blue'}`}>{sc.env}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text-primary)' }}>{testSuites.find(t => t.id === sc.testSuite)?.name || sc.testSuite || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 13 }}>{sc.humanCron || '—'}</div>
                      <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sc.cron}</code>
                    </td>
                    <td>
                      <span className={`badge badge-${sc.status === 'active' ? 'green' : 'gray'}`}>
                        {sc.status === 'active' ? '● Đang hoạt động' : '○ Tạm dừng'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{sc.lastRun}</td>
                    <td style={{ fontSize: 13 }}>{sc.nextRun}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" title={sc.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'} onClick={() => toggleStatus(sc.id)}>
                          {sc.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(sc)}><Edit2 size={13} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => del(sc.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Chỉnh sửa lịch' : 'Thêm lịch mới'}</div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setShowModal(false); setEditing(null) }}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Tên lịch</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Kiểm thử đêm Production" />
            </div>
            <div className="form-group">
              <label className="form-label">URL Website</label>
              <input className="form-input" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="shop.company.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Kịch bản kiểm thử (Test Suite)</label>
              <select className="form-select" value={form.testSuite} onChange={e => setForm(f => ({ ...f, testSuite: e.target.value }))} required>
                <option value="" disabled>-- Chọn một kịch bản --</option>
                {testSuites.map(ts => (
                  <option key={ts.id} value={ts.id}>{ts.name}</option>
                ))}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Môi trường</label>
                <select className="form-select" value={form.env} onChange={e => setForm(f => ({ ...f, env: e.target.value }))}>
                  <option>Production</option><option>Staging</option><option>Dev</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Biểu thức Cron</label>
                <input className="form-input" value={form.cron} onChange={e => setForm(f => ({ ...f, cron: e.target.value }))} placeholder="0 2 * * *" />
                {(() => {
                  let hint = 'Đang phân tích biểu thức...';
                  const c = form.cron.trim();
                  if (c === '0 2 * * *') hint = 'Mỗi ngày lúc 02:00 sáng';
                  else if (c === '0 6 * * 6') hint = 'Mỗi Thứ Bảy lúc 06:00 sáng';
                  else if (c === '0 8 * * 1-5') hint = 'Thứ 2 đến Thứ 6 lúc 08:00 sáng';
                  else if (c === '* * * * *') hint = 'Mỗi phút một lần';
                  else {
                    const parts = c.split(' ').filter(Boolean);
                    if (parts.length === 5) {
                      const [m, h, d, mo, w] = parts;
                      if (!isNaN(m) && !isNaN(h)) {
                        hint = `Chạy lúc ${h.padStart(2, '0')}:${m.padStart(2, '0')} ${w !== '*' ? (w.includes('-') ? 'từ ' + w.replace('-', ' đến ') : 'vào Thứ ' + (w === '0' ? 'CN' : (parseInt(w) + 1))) : 'mỗi ngày'}`;
                      } else hint = 'Biểu thức tùy chỉnh';
                    } else if (c.length > 0) hint = 'Biểu thức chưa hoàn chỉnh';
                  }
                  return (
                    <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} /> {hint}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null) }}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Lưu thay đổi' : 'Tạo lịch'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
