import { Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Layout from './components/Layout'
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import ScheduleManagement from './pages/admin/ScheduleManagement'
import EmailConfig from './pages/admin/EmailConfig'
import AuditLog from './pages/admin/AuditLog'
import QADashboard from './pages/qa/QADashboard'
import TestSuiteManagement from './pages/qa/TestSuiteManagement'
import ManualTrigger from './pages/qa/ManualTrigger'
import TestRunHistory from './pages/qa/TestRunHistory'
import TestRunDetail from './pages/qa/TestRunDetail'
import ViewerDashboard from './pages/viewer/ViewerDashboard'
import AIInsights from './pages/AIInsights'
import ReportViewer from './pages/viewer/ReportViewer'
import { AuthContext } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

// Trang 403 — Không có quyền truy cập
function Forbidden() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 64 }}>🚫</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Không có quyền truy cập</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Tài khoản của bạn không có quyền vào trang này.</div>
      <button onClick={() => window.history.back()} style={{ marginTop: 8, padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
        ← Quay lại
      </button>
    </div>
  )
}

// Trang 404
function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 64 }}>🔍</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Trang không tồn tại</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Đường dẫn bạn truy cập không hợp lệ.</div>
      <a href="/dashboard" style={{ marginTop: 8, padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14, textDecoration: 'none' }}>
        🏠 Về trang chủ
      </a>
    </div>
  )
}

export default function App() {
  // Bắt đầu với user = null → bắt buộc đăng nhập
  const [user, setUser] = useState(null)

  return (
    <ThemeProvider>
      <AuthContext.Provider value={{ user, setUser }}>
        <Routes>
          {/* Trang Login — chỉ cho người chưa đăng nhập */}
          <Route path="/login" element={
            <GuestRoute><LoginPage /></GuestRoute>
          } />

          {/* Redirect gốc "/" */}
          <Route index element={<Navigate to="/login" replace />} />

          {/* Layout wrapper — phải đăng nhập mới vào được */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            {/* ── ADMIN ONLY ── */}
            <Route path="dashboard" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="schedules" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ScheduleManagement />
              </ProtectedRoute>
            } />
            <Route path="email-config" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <EmailConfig />
              </ProtectedRoute>
            } />
            <Route path="audit-log" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AuditLog />
              </ProtectedRoute>
            } />

            {/* ── QA + ADMIN ── */}
            <Route path="qa-dashboard" element={
              <ProtectedRoute allowedRoles={['admin', 'qa']}>
                <QADashboard />
              </ProtectedRoute>
            } />
            <Route path="test-suites" element={
              <ProtectedRoute allowedRoles={['admin', 'qa']}>
                <TestSuiteManagement />
              </ProtectedRoute>
            } />
            <Route path="trigger" element={
              <ProtectedRoute allowedRoles={['admin', 'qa']}>
                <ManualTrigger />
              </ProtectedRoute>
            } />
            <Route path="test-runs" element={
              <ProtectedRoute allowedRoles={['admin', 'qa']}>
                <TestRunHistory />
              </ProtectedRoute>
            } />
            <Route path="test-runs/:id" element={
              <ProtectedRoute allowedRoles={['admin', 'qa']}>
                <TestRunDetail />
              </ProtectedRoute>
            } />

            {/* ── TẤT CẢ ROLES ── */}
            <Route path="viewer" element={
              <ProtectedRoute allowedRoles={['admin', 'qa', 'developer']}>
                <ViewerDashboard />
              </ProtectedRoute>
            } />
            <Route path="report/:id" element={
              <ProtectedRoute allowedRoles={['admin', 'qa', 'developer']}>
                <ReportViewer />
              </ProtectedRoute>
            } />
            <Route path="ai-insights" element={
              <ProtectedRoute allowedRoles={['admin', 'qa', 'developer']}>
                <AIInsights />
              </ProtectedRoute>
            } />


            {/* 403 */}
            <Route path="forbidden" element={<Forbidden />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthContext.Provider>
    </ThemeProvider>
  )
}
