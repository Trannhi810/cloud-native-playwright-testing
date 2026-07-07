import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Shield, User, Eye, Loader } from 'lucide-react'
import { API_ENDPOINTS } from '../../config'

const roleInfo = {
  admin: { label: 'Admin', icon: Shield, color: 'purple', desc: 'Toàn quyền hệ thống' },
  qa: { label: 'QA/Tester', icon: User, color: 'green', desc: 'Quản lý & chạy test' },
  developer: { label: 'Developer', icon: Eye, color: 'blue', desc: 'Chỉ xem kết quả' },
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'qa', password: '' })
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    fetch(API_ENDPOINTS.users)
      .then(res => {
        if (!res.ok) throw new Error('API fetch error')
        return res.json()
      })
      .then(data => {
        const dataArray = Array.isArray(data) ? data : data.items || []
        setUsers(dataArray)
        setLoading(false)
      })
      .catch(err => {
        console.log('Chưa có dữ liệu từ Backend:', err)
        setLoading(false)
      })
  }, [])

  const handleSave = () => {
    if (editing) {
      setUsers(u => u.map(x => x.id === editing ? { ...x, ...form } : x))
    } else {
      setUsers(u => [...u, { ...form, id: Date.now(), status: 'active', lastLogin: '—' }])
    }
    setShowModal(false); setEditing(null); setForm({ name: '', email: '', role: 'qa', password: '' })
  }
  const del = (id) => setUsers(u => u.filter(x => x.id !== id))
  const openEdit = (u) => { setForm({ name: u.name, email: u.email, role: u.role, password: '' }); setEditing(u.id); setShowModal(true) }
  const toggleActive = (id) => setUsers(u => u.map(x => x.id === id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Quản lý người dùng</div>
          <div className="page-subtitle">Phân quyền nội bộ (RBAC) • {users.filter(u => u.status === 'active').length} tài khoản đang hoạt động</div>
        </div>
        <button className="btn btn-primary" id="btn-add-user" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Thêm người dùng
        </button>
      </div>

      {/* Role Summary */}
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
            <thead><tr><th>Người dùng</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Lần đăng nhập cuối</th><th>Thao tác</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Đang tải danh sách người dùng...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Chưa có người dùng nào.</td></tr>
              ) : (
                users.map(u => {
                  const role = roleInfo[u.role]
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: `var(--accent-${role.color})22`, color: `var(--accent-${role.color})` }}>{u.name[0]}</div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td><span className={`badge badge-${role.color}`}>{role.label}</span></td>
                      <td><span className={`badge badge-${u.status === 'active' ? 'green' : 'gray'}`}>{u.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.lastLogin}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(u.id)}>{u.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}</button>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(u)}><Edit2 size={13} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => del(u.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}</div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setShowModal(false); setEditing(null) }}>✕</button>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Họ và tên</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nguyễn Văn A" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@company.com" />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Vai trò</label>
                <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="qa">QA/Tester</option>
                  <option value="developer">Developer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mật khẩu {editing && '(để trống = không đổi)'}</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
            <div className="alert alert-info">
              <Shield size={14} />
              <span><strong>{roleInfo[form.role]?.label}</strong>: {roleInfo[form.role]?.desc}</span>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null) }}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
