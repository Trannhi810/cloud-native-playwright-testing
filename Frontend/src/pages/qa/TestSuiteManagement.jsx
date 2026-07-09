import { useState, useEffect } from 'react'
import { Plus, Upload, Edit2, Trash2, Download, TestTube, Loader } from 'lucide-react'
import { API_ENDPOINTS, apiFetch } from '../../config'


export default function TestSuiteManagement() {
  const [suites, setSuites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', website: '', description: '' })
  const [editing, setEditing] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [scriptFile, setScriptFile] = useState(null)
  const [scriptContent, setScriptContent] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    apiFetch(API_ENDPOINTS.testSuites)
      .then(res => {
        if (!res.ok) throw new Error('API fetch error')
        return res.json()
      })
      .then(data => {
        const dataArray = Array.isArray(data) ? data : data.items || []
        setSuites(dataArray)
        setLoading(false)
      })
      .catch(err => {
        console.log('Chưa có dữ liệu từ Backend:', err)
        setLoading(false)
      })
  }, [])

  const refetch = () => {
    apiFetch(API_ENDPOINTS.testSuites)
      .then(r => r.json())
      .then(data => setSuites(Array.isArray(data) ? data : data.items || []))
      .catch(() => { })
  }

  const readFile = (file) => {
    if (!file) return
    setScriptFile(file)
    if (!form.name) {
      setForm(f => ({ ...f, name: file.name }))
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      setScriptContent(e.target.result)
    }
    reader.readAsText(file)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  const handleSave = async () => {
    setUploading(true)

    const tempId = editing || Date.now().toString()
    if (editing) {
      setSuites(s => s.map(x => (x.id === editing || x.suite_id === editing) ? { ...x, ...form } : x))
    } else {
      setSuites(s => [...s, { ...form, id: tempId, suite_id: tempId, cases: 0, size: scriptFile ? `${(scriptFile.size / 1024).toFixed(1)} KB` : '—', updatedAt: 'Vừa xong', status: 'active' }])
    }

    setShowModal(false); setEditing(null)
    setForm({ name: '', website: '', description: '' })
    setScriptFile(null); setScriptContent('')

    try {
      const url = editing ? `${API_ENDPOINTS.testSuites}/${tempId}` : API_ENDPOINTS.testSuites
      const method = editing ? 'PUT' : 'POST'
      const payload = {
        name: form.name,
        target_url: form.website,
        description: form.description,
        test_script: scriptContent || ''
      }
      const res = await apiFetch(url, {
        method: method,
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Lỗi từ backend khi lưu suite:', err)
        refetch()
      } else {
        refetch()
      }
    } catch (err) {
      console.error('Lỗi khi lưu suite:', err)
      refetch()
    } finally {
      setUploading(false)
    }
  }

  const del = async (id) => {
    try {
      const res = await apiFetch(`${API_ENDPOINTS.testSuites}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('API delete failed')
      setSuites(s => s.filter(x => x.id !== id))
    } catch (err) {
      console.error('Lỗi khi xóa suite:', err)
      refetch()
    }
  }

  const openEdit = (s) => { setForm({ name: s.name, website: s.website, description: s.description }); setEditing(s.id); setShowModal(true) }

  const openModal = () => {
    setEditing(null)
    setForm({ name: '', website: '', description: '' })
    setScriptFile(null)
    setScriptContent('')
    setShowModal(true)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Quản lý Test Suite</div>
          <div className="page-subtitle">Upload và quản lý kịch bản Playwright • Lưu trữ trên Amazon S3</div>
        </div>
        <button className="btn btn-primary" id="btn-add-suite" onClick={openModal}>
          <Plus size={16} /> Thêm Test Suite
        </button>
      </div>

      <div
        className="card"
        style={{ borderStyle: 'dashed', borderColor: dragOver ? 'var(--blue)' : 'var(--border)', background: dragOver ? 'rgba(59,130,246,0.05)' : 'transparent', cursor: 'pointer', textAlign: 'center', marginBottom: 24, transition: 'all 0.2s' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) { readFile(file); setShowModal(true) }
        }}
        onClick={openModal}
      >
        <Upload size={32} style={{ margin: '0 auto 12px', color: dragOver ? 'var(--blue)' : 'var(--text-muted)' }} />
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Kéo thả file .spec.js / .spec.ts vào đây</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>hoặc click để chọn file • Hỗ trợ: .js, .ts, .zip</div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          Đang tải kịch bản...
        </div>
      ) : suites.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          Chưa có Test Suite nào. Hãy tải lên một file kịch bản mới.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {suites.map(suite => (
            <div key={suite.id} className="card" style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 16, right: 16 }}>
                <span className={`badge badge-${suite.status === 'active' ? 'green' : 'gray'}`}>{suite.status === 'active' ? 'Active' : 'Draft'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TestTube size={18} style={{ color: 'var(--purple)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{suite.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--cyan)' }}>{suite.website}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>{suite.description}</p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div><div style={{ fontSize: 18, fontWeight: 800 }}>{suite.cases}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Test Cases</div></div>
                <div><div style={{ fontSize: 18, fontWeight: 800 }}>{suite.size}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kích thước</div></div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Cập nhật: {suite.updatedAt}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm btn-icon" title="Tải về"><Download size={13} /></button>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(suite)}><Edit2 size={13} /></button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => del(suite.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Chỉnh sửa Test Suite' : 'Thêm Test Suite mới'}</div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setShowModal(false); setEditing(null) }}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Tên file</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="checkout-flow.spec.js" />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="shop.company.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Mô tả</label>
              <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả kịch bản kiểm thử..." style={{ minHeight: 80 }} />
            </div>
            {!editing && (
              <div className="form-group">
                <label className="form-label">Upload file kịch bản</label>
                <input type="file" className="form-input" accept=".js,.ts,.zip" onChange={handleFileChange} />
                {scriptFile && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)' }}>
                    ✅ Đã chọn: {scriptFile.name} ({(scriptFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null) }}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={uploading}>
                {uploading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Đang lưu...</> : (editing ? 'Lưu' : 'Upload')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
