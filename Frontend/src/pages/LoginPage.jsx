import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, User, Lock } from 'lucide-react'



/* ─── SVG pattern: dot grid + hex overlay (AWS/cloud tech feel) ─── */
const BgPattern = () => (
  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
    <defs>
      {/* dot grid */}
      <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.12)" />
      </pattern>
      {/* diagonal lines */}
      <pattern id="lines" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M0 60 L60 0" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#lines)" />
    <rect width="100%" height="100%" fill="url(#dots)" />

    {/* Large glowing circles */}
    <circle cx="70%" cy="30%" r="220" fill="none" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
    <circle cx="70%" cy="30%" r="170" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
    <circle cx="70%" cy="30%" r="120" fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth="1" />

    {/* Bottom-right rings */}
    <circle cx="85%" cy="80%" r="160" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="1" />
    <circle cx="85%" cy="80%" r="110" fill="none" stroke="rgba(16,185,129,0.10)" strokeWidth="1" />

    {/* Glowing blobs */}
    <ellipse cx="68%" cy="28%" rx="180" ry="140" fill="rgba(79,70,229,0.18)" />
    <ellipse cx="82%" cy="72%" rx="140" ry="110" fill="rgba(16,185,129,0.12)" />
    <ellipse cx="40%" cy="60%" rx="100" ry="80" fill="rgba(59,130,246,0.08)" />

    {/* Node dots on rings */}
    {[0, 60, 120, 180, 240, 300].map((deg, i) => {
      const rad = (deg * Math.PI) / 180
      const cx = 70 + 22 * Math.cos(rad)
      const cy = 30 + 14 * Math.sin(rad)
      return <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r="4" fill="rgba(129,140,248,0.6)" />
    })}
    {[30, 90, 150, 210, 270, 330].map((deg, i) => {
      const rad = (deg * Math.PI) / 180
      const cx = 85 + 16 * Math.cos(rad)
      const cy = 80 + 11 * Math.sin(rad)
      return <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r="3" fill="rgba(52,211,153,0.5)" />
    })}

    {/* Floating AWS-style icons (hexagons) */}
    {[
      { x: '55%', y: '18%', s: 28 },
      { x: '78%', y: '12%', s: 18 },
      { x: '88%', y: '42%', s: 22 },
      { x: '62%', y: '70%', s: 20 },
      { x: '45%', y: '82%', s: 16 },
    ].map(({ x, y, s }, i) => (
      <polygon key={i}
        points={`0,${s * 0.5} ${s * 0.25},0 ${s * 0.75},0 ${s},${s * 0.5} ${s * 0.75},${s} ${s * 0.25},${s}`}
        fill="none" stroke="rgba(165,180,252,0.25)" strokeWidth="1.2"
        transform={`translate(${x === '55%' ? 550 : x === '78%' ? 780 : x === '88%' ? 880 : x === '62%' ? 620 : 450},
                    ${y === '18%' ? 100 : y === '12%' ? 65 : y === '42%' ? 250 : y === '70%' ? 430 : 500})`}
      />
    ))}
  </svg>
)

import { CognitoUserPool, AuthenticationDetails, CognitoUser } from 'amazon-cognito-identity-js'
import { COGNITO_CONFIG } from '../config'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isNewPasswordReq, setIsNewPasswordReq] = useState(false)
  const [cognitoUserObj, setCognitoUserObj] = useState(null)
  
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const { setUser } = useAuth()
  const navigate    = useNavigate()

  const handleLogin = (e) => {
    e.preventDefault()
    setLoading(true); setError('')

    if (isNewPasswordReq && cognitoUserObj) {
      cognitoUserObj.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess: (result) => {
          localStorage.setItem('token', result.getIdToken().getJwtToken())
          fetchUserAttributesAndLogin(cognitoUserObj)
        },
        onFailure: (err) => { setError(err.message || 'Lỗi đổi mật khẩu'); setLoading(false) }
      })
      return
    }

    const poolData = { UserPoolId: COGNITO_CONFIG.userPoolId, ClientId: COGNITO_CONFIG.clientId }
    const userPool = new CognitoUserPool(poolData)
    const authenticationDetails = new AuthenticationDetails({ Username: email, Password: password })
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool })

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        localStorage.setItem('token', result.getIdToken().getJwtToken())
        fetchUserAttributesAndLogin(cognitoUser)
      },
      onFailure: (err) => { setError(err.message || 'Email hoặc mật khẩu không đúng'); setLoading(false) },
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        setIsNewPasswordReq(true)
        setCognitoUserObj(cognitoUser)
        setLoading(false)
      }
    })
  }

  const fetchUserAttributesAndLogin = (cognitoUser) => {
    cognitoUser.getUserAttributes((err, attributes) => {
      let role = 'viewer'
      let name = email.split('@')[0]
      
      if (!err && attributes) {
        attributes.forEach(attr => {
          if (attr.Name === 'custom:role') role = attr.Value
          if (attr.Name === 'name') name = attr.Value
        })
      }
      
      // Fallback roles based on email if no custom attributes are set in Cognito
      if (email.toLowerCase().includes('admin')) role = 'admin'
      else if (email.toLowerCase().includes('qa')) role = 'qa'

      setUser({ email, name, role })
      setLoading(false)
      navigate('/dashboard')
    })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}>

      {/* ── LEFT: decorative panel (55%) ── */}
      <div style={{
        flex: '0 0 70%',
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(145deg, #0b1120 0%, #0f1e3a 45%, #0d2b4e 100%)',
        display: 'flex', alignItems: 'flex-end',
        padding: '56px 64px',
      }}>
        <BgPattern />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 76, fontWeight: 900, color: '#fff', letterSpacing: '-3px', lineHeight: 1, marginBottom: 14 }}>
            Welcome.
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', maxWidth: 360, lineHeight: 1.8 }}>
            Playwright · AWS ECS Fargate
          </p>
        </div>
      </div>

      {/* ── RIGHT: login form (45%) ── */}
      <div style={{
        flex: '0 0 30%',
        background: '#ffffff',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '48px 64px',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.06)',
        zIndex: 1,
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚀</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>PlayTest</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Cloud Native</div>
            </div>
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f1f5f9', border: '2.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={36} style={{ color: '#94a3b8' }} />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 18 }}>⚠️ {error}</div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Email */}
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="USERNAME" required
                style={{ width: '100%', padding: '14px 14px 14px 42px', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 14, color: '#0f172a', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Password */}
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ width: '100%', padding: '14px 42px 14px 42px', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 14, color: '#0f172a', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {isNewPasswordReq && (
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="MẬT KHẨU MỚI (BẮT BUỘC)" required
                  style={{ width: '100%', padding: '14px 42px 14px 42px', border: '1.5px solid #3b82f6', borderRadius: 12, fontSize: 14, color: '#0f172a', background: '#eff6ff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {/* Button */}
            <button id="btn-login" type="submit" disabled={loading}
              style={{ marginTop: 4, padding: '14px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: 1.5, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading
                ? <><span className="animate-spin" style={{ display: 'inline-block', width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }} /> Đang xác thực...</>
                : 'LOGIN'}
            </button>
          </form>


          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 30 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === 1 ? '#3b82f6' : '#e2e8f0' }} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
