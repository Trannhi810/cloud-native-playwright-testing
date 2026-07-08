import { useState, useEffect } from 'react'
import { Search, Loader, Shield, User, Eye } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'

const actionColors = {
  CREATE_SCHEDULE: 'blue', TRIGGER_TEST: 'green', UPDATE_USER: 'yellow',
  UPLOAD_SUITE: 'purple', DELETE_SCHEDULE: 'red', UPDATE_EMAIL_CONFIG: 'blue',
  VIEW_REPORT: 'gray',
}

const roleInfo = {
  admin: { label: 'Admin', icon: Shield, color: 'purple', desc: 'Toàn quyền hệ thống' },
  qa: { label: 'QA/Tester', icon: User, color: 'green', desc: 'Quản lý & chạy test' },
  developer: { label: 'Developer', icon: Eye, color: 'blue', desc: 'Chỉ xem kết quả' },
}

export default function AuditLog() {
  const [activeTab, setActiveTab] = useState('logs') // 'logs' | 'users'
  
  // Logs state
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [searchLog, setSearchLog] = useState('')
  const [filterAction, setFilterAction] = useState('ALL')

  // Users state
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  useEffect(() => {
    // Fetch Logs
    apiFetch(API_ENDPOINTS.auditLogs)
      .then(res => res.json())
      .then(data => { setLogs(Array.isArray(data) ? data : data.items || []); setLoadingLogs(false) })
      .catch(err => { console.log(err); setLoadingLogs(false) })

    // Fetch Users
    apiFetch(API_ENDPOINTS.users)
      .then(res => res.json())
      .then(data => { setUsers(Array.isArray(data) ? data : data.items || []); setLoadingUsers(false) })
      .catch(err => { console.log(err); setLoadingUsers(false) })
  }, [])

  const filteredLogs = logs.filter(l =>
    (filterAction === 'ALL' || l.action === filterAction) &&
    (l.user?.toLowerCase().includes(searchLog.toLowerCase()) || l.action?.toLowerCase().includes(searchLog.toLowerCase()) || l.target?.toLowerCase().includes(searchLog.toLowerCase()))
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log & Users</div>
          <div className="page-subtitle">Quản lý người dùng và nhật ký hệ thống AWS</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 15, marginBottom: 24 }}>
        <button className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('logs')}>
          Nhật ký hệ thống (Audit Log)
        </button>
        <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('users')}>
          Danh sách người dùng
        </button>
      </div>

      {activeTab === 'logs' ? (
        <>
          <div className="alert alert-warning">
            🔒 Mọi thao tác thay đổi hệ thống đều được ghi lại tự động với UserID, Timestamp và ActionType. Dữ liệu này không thể chỉnh sửa hoặc xóa.
          </div>
          <div className="card">
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Tìm kiếm theo người dùng, hành động..." value={searchLog} onChange={e => setSearchLog(e.target.value)} />
              </div>
              <select className="form-select" style={{ width: 200 }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                <option value="ALL">Tất cả hành động</option>
                {[...new Set(logs.map(l => l.action))].filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className="table-container">
              <table>
                <thead><tr><th>#</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>IP</th><th>Thời gian</th></tr></thead>
                <tbody>
                  {loadingLogs ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Đang tải nhật ký...</td></tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Chưa có bản ghi nào.</td></tr>
                  ) : (
                    filteredLogs.map((log, i) => (
                      <tr key={log.id || i}>
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
              Hiển thị {filteredLogs.length}/{logs.length} bản ghi
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 24 }}>
            {Object.entries(roleInfo).map(([key, info]) => {
              const Icon = info.icon
              const count = users.filter(u => u.role === key).length
              return (
                <div key={key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(${key === 'admin' ? '139,92,246' : key === 'qa' ? '16,185,129' : '59,130,246'},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} style={{ color: `var(--accent-${info.color})` }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{count}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{info.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{info.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <div className="table-container">
              <table>
                <thead><tr><th>Người dùng</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Lần đăng nhập cuối</th></tr></thead>
                <tbody>
                  {loadingUsers ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Đang tải người dùng...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Chưa có người dùng nào.</td></tr>
                  ) : (
                    users.map(u => {
                      const role = roleInfo[u.role] || roleInfo.developer
                      return (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: `var(--accent-${role.color})22`, color: `var(--accent-${role.color})` }}>{u.name?.[0] || 'U'}</div>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td><span className={`badge badge-${role.color}`}>{role.label}</span></td>
                          <td><span className={`badge badge-${u.status === 'active' ? 'green' : 'gray'}`}>{u.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}</span></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.lastLogin || '—'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
