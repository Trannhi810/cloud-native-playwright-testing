import { useState, useEffect } from 'react'
import { Search, Loader, Shield, User, Eye } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'

const roleInfo = {
  admin: { label: 'Admin', icon: Shield, color: 'purple', desc: 'Toàn quyền hệ thống' },
  qa: { label: 'QA/Tester', icon: User, color: 'green', desc: 'Quản lý & chạy test' },
  developer: { label: 'Developer', icon: Eye, color: 'blue', desc: 'Chỉ xem kết quả' },
}

export default function AuditLog() {
  // Users state
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userError, setUserError] = useState(null)

  useEffect(() => {
    // Fetch Users
    apiFetch(API_ENDPOINTS.users)
      .then(res => res.json())
      .then(data => { 
        if (data.message || data.error) {
          setUserError(data.message || data.error)
          setUsers([])
        } else {
          setUsers(Array.isArray(data) ? data : data.items || [])
        }
        setLoadingUsers(false) 
      })
      .catch(err => { setUserError(err.message); setLoadingUsers(false) })
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Quản lý người dùng</div>
          <div className="page-subtitle">Quản lý danh sách người dùng trên hệ thống</div>
        </div>
      </div>

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
              ) : userError ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#ef4444' }}>Lỗi: {userError}</td></tr>
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
    </div>
  )
}
