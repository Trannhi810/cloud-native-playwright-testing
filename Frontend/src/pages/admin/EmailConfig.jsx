import { useState, useEffect } from 'react'
import { Plus, Trash2, Mail, Globe, Loader, AlertCircle } from 'lucide-react'
import { API_ENDPOINTS } from '../../config'

export default function EmailConfig() {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')

  const refetch = () => {
    fetch(API_ENDPOINTS.emailConfig)
      .then(res => res.json())
      .then(data => setEmails(Array.isArray(data) ? data : data.items || []))
  }

  useEffect(() => {
    fetch(API_ENDPOINTS.emailConfig)
      .then(res => res.json())
      .then(data => {
        setEmails(Array.isArray(data) ? data : data.items || [])
        setLoading(false)
      })
  }, [])

  const addEmail = async () => {
    if (!newEmail) return
    const emailToSave = newEmail
    setEmails(prev => [...prev, { email_address: emailToSave, active: true }])
    setNewEmail('')
    
    try {
      await fetch(API_ENDPOINTS.emailConfig, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_address: emailToSave, active: true })
      })
    } catch (e) { console.error(e) }
  }

  const delEmail = async (email) => {
    setEmails(prev => prev.filter(e => e.email_address !== email))
    try {
      await fetch(`${API_ENDPOINTS.emailConfig}/${email}`, { method: 'DELETE' })
    } catch (e) { console.error(e) }
  }

  const toggleActive = async (email, currentActive) => {
    setEmails(prev => prev.map(e => e.email_address === email ? { ...e, active: !currentActive } : e))
    try {
      await fetch(API_ENDPOINTS.emailConfig, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_address: email, active: !currentActive })
      })
    } catch (e) { console.error(e) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Cấu hình Email thông báo</div>
          <div className="page-subtitle">Quản lý danh sách nhận thông báo kết quả qua Amazon SNS + SES</div>
        </div>
      </div>

      <div className="alert alert-info">
        <Mail size={16} />
        Email được gửi qua Amazon SES. Danh sách này nhận thông báo tổng hợp khi có thay đổi trạng thái kiểm thử.
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="form-input" style={{ flex: 1 }} placeholder="Nhập địa chỉ email mới..." value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEmail()} />
          <button className="btn btn-primary" onClick={addEmail}><Plus size={16} /> Thêm Email</button>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Email</th><th>Trạng thái nhận tin</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px' }}>Đang tải cấu hình...</td></tr>
              ) : emails.length === 0 ? (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px' }}>Chưa có email nào trong danh sách.</td></tr>
              ) : emails.map(e => (
                <tr key={e.email_address}>
                  <td style={{ fontWeight: 600 }}>{e.email_address}</td>
                  <td>
                    <span className={`badge badge-${e.active ? 'green' : 'gray'}`}>{e.active ? 'Đang nhận' : 'Tạm dừng'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(e.email_address, e.active)}>
                        {e.active ? 'Tạm dừng' : 'Kích hoạt'}
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => delEmail(e.email_address)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
