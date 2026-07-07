import { useState, useEffect } from 'react'
import { Plus, Trash2, Mail, Globe, Loader } from 'lucide-react'
import { API_ENDPOINTS } from '../../config'

export default function EmailConfig() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [newEmail, setNewEmail] = useState('')
  const [newWebsite, setNewWebsite] = useState('')

  useEffect(() => {
    fetch(API_ENDPOINTS.emailConfig)
      .then(res => {
        if (!res.ok) throw new Error('API fetch error')
        return res.json()
      })
      .then(data => {
        const dataArray = Array.isArray(data) ? data : data.items || []
        setGroups(dataArray)
        setLoading(false)
      })
      .catch(err => {
        console.log('Chưa có dữ liệu từ Backend:', err)
        setLoading(false)
      })
  }, [])

  const addEmail = (groupId) => {
    if (!newEmail) return
    setGroups(g => g.map(x => x.id === groupId ? { ...x, emails: [...x.emails, newEmail] } : x))
    setNewEmail('')
  }
  const removeEmail = (groupId, email) => setGroups(g => g.map(x => x.id === groupId ? { ...x, emails: x.emails.filter(e => e !== email) } : x))
  const toggleNotify = (groupId, type) => setGroups(g => g.map(x => x.id === groupId ? { ...x, [type]: !x[type] } : x))
  const addGroup = () => {
    if (!newWebsite) return
    setGroups(g => [...g, { id: Date.now(), website: newWebsite, emails: [], notifyPass: true, notifyFail: true }])
    setNewWebsite(''); setShowModal(false)
  }
  const delGroup = (id) => setGroups(g => g.filter(x => x.id !== id))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Cấu hình Email thông báo</div>
          <div className="page-subtitle">Quản lý danh sách nhận thông báo kết quả qua Amazon SNS + SES</div>
        </div>
        <button className="btn btn-primary" id="btn-add-email-group" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Thêm nhóm website
        </button>
      </div>

      <div className="alert alert-info">
        <Mail size={16} />
        Email được gửi qua Amazon SES. Mỗi website có danh sách nhận thông báo riêng, không gửi chung cho toàn công ty.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                  Đang tải cấu hình Email...
                </div>
              ) : groups.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                  Chưa có cấu hình nhận Email nào được thiết lập.
                </div>
              ) : (
                groups.map(group => (
                  <div key={group.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Globe size={18} style={{ color: 'var(--accent-cyan)' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{group.website}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.emails.length} người nhận</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={group.notifyPass} onChange={() => toggleNotify(group.id, 'notifyPass')} />
                          <span className="badge badge-green">Gửi khi Pass</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={group.notifyFail} onChange={() => toggleNotify(group.id, 'notifyFail')} />
                          <span className="badge badge-red">Gửi khi Fail</span>
                        </label>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => delGroup(group.id)}><Trash2 size={13} /></button>
                      </div>
                    </div>

            {/* Tags Input style */}
            <div className="form-input" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px', height: 'auto', minHeight: '44px', alignItems: 'center' }}>
              {group.emails.map(email => (
                <div key={email} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 8px 4px 10px', fontSize: 13, color: 'var(--text-primary)' }}>
                  <Mail size={12} style={{ color: 'var(--blue)' }} />
                  {email}
                  <button onClick={() => removeEmail(group.id, email)} style={{ background: 'var(--border)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4, transition: 'all 0.15s' }} onMouseOver={e => e.currentTarget.style.background='#fecaca'} onMouseOut={e => e.currentTarget.style.background='var(--border)'}>✕</button>
                </div>
              ))}
              
              <input
                style={{ flex: 1, minWidth: 150, border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: 14, padding: '4px' }}
                placeholder={group.emails.length === 0 ? "Nhập email và nhấn Enter..." : "Thêm email..."}
                value={selectedGroup === group.id ? newEmail : ''}
                onFocus={() => setSelectedGroup(group.id)}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEmail(group.id)}
              />
            </div>
          </div>
        ))
      )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Thêm nhóm website mới</div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">URL Website</label>
              <input className="form-input" value={newWebsite} onChange={e => setNewWebsite(e.target.value)} placeholder="website.company.com" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={addGroup}>Tạo nhóm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
