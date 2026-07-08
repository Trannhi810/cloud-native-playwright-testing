import { useState, useEffect } from 'react'
import { Search, Filter, Loader } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { 'Authorization': token } : {}
}

const actionColors = {
  CREATE_SCHEDULE: 'blue', TRIGGER_TEST: 'green', UPDATE_USER: 'yellow',
  UPLOAD_SUITE: 'purple', DELETE_SCHEDULE: 'red', UPDATE_EMAIL_CONFIG: 'blue',
  VIEW_REPORT: 'gray',
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('ALL')

  useEffect(() => {
    fetch(API_ENDPOINTS.auditLogs, { headers: getAuthHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('API fetch error')
        return res.json()
      })
      .then(data => {
        const dataArray = Array.isArray(data) ? data : data.items || []
        setLogs(dataArray)
        setLoading(false)
      })
      .catch(err => {
        console.log('Chưa có dữ liệu từ Backend:', err)
        setLoading(false)
      })
  }, [])

  const filtered = logs.filter(l =>
    (filterAction === 'ALL' || l.action === filterAction) &&
    (l.user.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase()) || l.target.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-subtitle">Lịch sử thao tác được lưu trong Amazon DynamoDB • Bất biến, không thể xóa</div>
        </div>
      </div>

      <div className="alert alert-warning">
        🔒 Mọi thao tác thay đổi hệ thống đều được ghi lại tự động với UserID, Timestamp và ActionType. Dữ liệu này không thể chỉnh sửa hoặc xóa.
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Tìm kiếm theo người dùng, hành động..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 200 }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="ALL">Tất cả hành động</option>
            {[...new Set(logs.map(l => l.action))].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="table-container">
          <table>
            <thead><tr><th>#</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>IP</th><th>Thời gian</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Đang tải nhật ký hệ thống...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Chưa có bản ghi nhật ký nào.</td></tr>
              ) : (
                filtered.map((log, i) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{log.user}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.role}</div>
                    </td>
                    <td><span className={`badge badge-${actionColors[log.action] || 'gray'}`}>{log.action}</span></td>
                    <td style={{ fontSize: 13, maxWidth: 280 }}>{log.target}</td>
                    <td><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.ip}</code></td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{log.time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
          Hiển thị {filtered.length}/{logs.length} bản ghi
        </div>
      </div>
    </div>
  )
}
