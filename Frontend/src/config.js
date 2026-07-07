// ===== CẤU HÌNH AWS =====
// Cập nhật các giá trị này sau khi deploy lên AWS

export const API_BASE_URL = 'https://8bsb7jbhu7.execute-api.ap-southeast-1.amazonaws.com'

export const COGNITO_CONFIG = {
  region: 'ap-southeast-1',
  userPoolId: 'ap-southeast-1_DXMd3Q6ee',
  clientId: '492jkd32vd241c2tuv1v160g4o',
}

// Các endpoint API
export const API_ENDPOINTS = {
  // 1. Nhóm Quản lý Chạy Test & Lịch sử
  trigger:    `${API_BASE_URL}/trigger`,
  testRuns:   `${API_BASE_URL}/test-runs`, // Cả GET danh sách và GET /{id}
  stats:      `${API_BASE_URL}/stats`,

  // 2. Nhóm Quản lý Kịch bản Test
  testSuites: `${API_BASE_URL}/test-suites`,

  // 3. Nhóm Quản lý Hẹn giờ Tự động
  schedules:  `${API_BASE_URL}/schedules`,

  // 4. Nhóm Cấu hình Thông báo
  emailConfig:`${API_BASE_URL}/email-config`,

  // 5. Nhóm Quản trị Hệ thống
  users:      `${API_BASE_URL}/users`,
  auditLogs:  `${API_BASE_URL}/audit-logs`,

  // 6. Nhóm Báo cáo & AI
  reports:         `${API_BASE_URL}/reports`,
  chatgptInsights: `${API_BASE_URL}/chatgpt-insights`,
}
