import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Trang mặc định cho từng role sau khi đăng nhập
const roleHomePage = {
  admin: '/dashboard',
  qa: '/qa-dashboard',
  developer: '/developer',
}

// Route chỉ cho người đã đăng nhập
// allowedRoles: ['admin', 'qa', 'developer'] hoặc bỏ trống = tất cả roles
export function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth()

  // Chưa đăng nhập → về trang login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Đã đăng nhập nhưng không đúng role → về trang chủ của role đó
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const home = roleHomePage[user.role] || '/login'
    return <Navigate to={home} replace />
  }

  return children
}

// Route chỉ cho người CHƯA đăng nhập (trang Login)
// Nếu đã login rồi → về trang chủ của role đó
export function GuestRoute({ children }) {
  const { user } = useAuth()

  if (user) {
    const home = roleHomePage[user.role] || '/dashboard'
    return <Navigate to={home} replace />
  }

  return children
}
