const IS_DEV = import.meta.env.DEV

export const API_BASE_URL = IS_DEV
  ? 'http://localhost:3001'
  : 'https://8bsb7jbhu7.execute-api.ap-southeast-1.amazonaws.com'

export const COGNITO_CONFIG = {
  region: 'ap-southeast-1',
  userPoolId: 'ap-southeast-1_DXMd3Q6ee',
  clientId: '492jkd32vd241c2tuv1v160g4o',
}

export const API_ENDPOINTS = {
  trigger: `${API_BASE_URL}/trigger`,
  testRuns: `${API_BASE_URL}/test-runs`,
  stats: `${API_BASE_URL}/stats`,
  testSuites: `${API_BASE_URL}/test-suites`,
  schedules: `${API_BASE_URL}/schedules`,
  emailConfig: `${API_BASE_URL}/email-config`,
  users: `${API_BASE_URL}/users`,
  auditLogs: `${API_BASE_URL}/audit-logs`,
  reports: `${API_BASE_URL}/reports`,
  chatgptInsights: `${API_BASE_URL}/chatgpt-insights`,
}

export async function apiFetch(url, options = {}) {
  const token = sessionStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) headers['Authorization'] = token

  const res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    sessionStorage.removeItem('token')
    window.location.href = '/login'
  }

  return res
}
