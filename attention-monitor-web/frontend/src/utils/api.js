import axios from 'axios'

// Use runtime config if available, fallback to build-time env, then to /api
const getApiUrl = () => {
  if (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.API_URL && window.RUNTIME_CONFIG.API_URL !== '__API_URL__') {
    return window.RUNTIME_CONFIG.API_URL
  }
  return import.meta.env.VITE_API_URL || '/api'
}

const API_BASE = getApiUrl()

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export async function createSession() {
  const response = await api.post('/sessions')
  return response.data
}

export async function updateSession(sessionId, data) {
  const response = await api.put(`/sessions/${sessionId}`, data)
  return response.data
}

export async function getSessions() {
  const response = await api.get('/sessions')
  return response.data
}

export async function getSession(sessionId) {
  const response = await api.get(`/sessions/${sessionId}`)
  return response.data
}

export async function endSession(sessionId) {
  const response = await api.post(`/sessions/${sessionId}/end`)
  return response.data
}

export default api
