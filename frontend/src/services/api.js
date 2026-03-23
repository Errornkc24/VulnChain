import axios from 'axios'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

const api = {
  auth: {
    login: (data) => instance.post('/auth/login', data),
    register: (data) => instance.post('/auth/register', data),
    getProfile: () => instance.get('/auth/profile'),
  },
  cve: {
    list: () => instance.get('/cve'),
    get: (id) => instance.get(`/cve/${id}`),
    create: (data) => instance.post('/cve', data),
    update: (id, data) => instance.put(`/cve/${id}`, data),
    updateStatus: (id, status, notes) => instance.put(`/cve/${id}/status`, { status, notes }),
    getHistory: (id) => instance.get(`/cve/${id}/history`),
    search: (params) => instance.get('/cve/search', { params }),
  },
  governance: {
    listProposals: (params) => instance.get('/governance/proposals', { params }),
    getProposal: (id) => instance.get(`/governance/proposals/${id}`),
    createProposal: (data) => instance.post('/governance/proposals', data),
    activateProposal: (id) => instance.put(`/governance/proposals/${id}/activate`),
    vote: (id, data) => instance.post(`/governance/proposals/${id}/vote`, data),
    tally: (id) => instance.post(`/governance/proposals/${id}/tally`),
  },
  analytics: {
    getSummary: () => instance.get('/analytics/summary'),
    getTrends: () => instance.get('/analytics/trends'),
    getOrgStats: () => instance.get('/analytics/orgs'),
  },
}

export default api
