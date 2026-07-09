import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  LayoutDashboard, Calendar, Users, Mail, FileText,
  TestTube, Zap, History, Eye, BarChart3, Bot, LogOut, Bell, Search,
  Moon, Sun, Sparkles
} from 'lucide-react'

const adminNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/schedules', icon: Calendar, label: 'Lịch kiểm thử' },
  { to: '/email-config', icon: Mail, label: 'Cấu hình Email' },
  { to: '/audit-log', icon: FileText, label: 'Người dùng' },
]
const qaNav = [
  { to: '/qa-dashboard', icon: BarChart3, label: 'QA Dashboard' },
  { to: '/test-suites', icon: TestTube, label: 'Test Suites' },
  { to: '/trigger', icon: Zap, label: 'Chạy thủ công' },
  { to: '/test-runs', icon: History, label: 'Lịch sử' },
]
const viewerNav = [
  { to: '/developer', icon: Eye, label: 'Developer' },
]
const aiNav = [
  { to: '/ai-insights', icon: Bot, label: 'AI Insights' },
]


const roleStyle = {
  admin: { bg: 'var(--purple-light)', color: '#7c3aed', label: 'Admin' },
  qa: { bg: 'var(--green-light)', color: '#059669', label: 'QA/Tester' },
  developer: { bg: 'var(--blue-light)', color: 'var(--blue)', label: 'Developer' },
}

const pageTitles = {
  '/dashboard': 'Dashboard', '/schedules': 'Lịch kiểm thử',
  '/email-config': 'Cấu hình Email',
  '/audit-log': 'Quản lý Người dùng', '/qa-dashboard': 'QA Dashboard',
  '/test-suites': 'Test Suites', '/trigger': 'Kích hoạt thủ công',
  '/test-runs': 'Lịch sử kiểm thử', '/developer': 'Developer Dashboard',
}

export default function Layout() {
  const { user, setUser } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const role = roleStyle[user?.role] || roleStyle.developer
  const pageTitle = pageTitles[location.pathname] || 'PlayTest Cloud'

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-box">🚀</div>
          <div>
            <div className="logo-text">PlayTest Cloud<small>AWS Native</small></div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {user?.role === 'admin' && (
            <>
              <div className="nav-section">Admin</div>
              {adminNav.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <Icon size={16} strokeWidth={1.8} />{label}
                </NavLink>
              ))}
            </>
          )}

          {['admin', 'qa'].includes(user?.role) && (
            <>
              <div className="nav-section">QA / Tester</div>
              {qaNav.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <Icon size={16} strokeWidth={1.8} />{label}
                </NavLink>
              ))}
            </>
          )}

          <div className="nav-section">Developer</div>
          {viewerNav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon size={16} strokeWidth={1.8} />{label}
            </NavLink>
          ))}

          <div className="nav-section" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} style={{ color: '#a855f7' }} /> 
            <span style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Insights</span>
          </div>
          {aiNav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item nav-ai${isActive ? ' active' : ''}`}>
              <Icon size={16} strokeWidth={1.8} className="ai-icon" />
              <span className="ai-text">{label}</span>
            </NavLink>
          ))}

        </nav>

        <div className="sidebar-footer">
          <div className="user-card" onClick={() => { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); setUser(null); navigate('/login') }}>
            <div className="avatar" style={{ background: role.bg, color: role.color }}>
              {user?.name?.[0] || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div className="user-role">{role.label}</div>
            </div>
            <LogOut size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="breadcrumb">
              <span>PlayTest</span>
              <span style={{ color: 'var(--border)' }}>/</span>
              <span className="breadcrumb-active">{pageTitle}</span>
            </div>
          </div>
          <div className="topbar-right">

            <button className="btn btn-secondary btn-icon btn-sm" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="avatar-small" style={{ background: role.bg, color: role.color, fontWeight: 700 }}>
              {user?.name?.[0] || 'U'}
            </div>
          </div>
        </header>

        {/* Page outlet */}
        <Outlet />
      </div>
    </div>
  )
}
