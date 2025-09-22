import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { CreatorDashboard } from './components/CreatorDashboard'
import { AdminDashboard } from './components/AdminDashboard'
import { apiCall } from './utils/api'

type LoginResponse = { 
  token: string; 
  user: { 
    id: string; 
    email: string; 
    name: string; 
    role: string;
    assignedAdmin?: {
      id: string;
      name: string;
      email: string;
    };
  } 
}
// Removed ValidateResponse as it's not needed in main App anymore

function App() {
  const [email, setEmail] = useState('creator@masaischool.com')
  const [password, setPassword] = useState('creator123')
  const [token, setToken] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem('cvp_token')
  })
  const [user, setUser] = useState<LoginResponse['user'] | null>(() => {
    // Initialize from localStorage
    const savedUser = localStorage.getItem('cvp_user')
    return savedUser ? JSON.parse(savedUser) : null
  })
  const [isValidatingToken, setIsValidatingToken] = useState(false)
  const isAuthed = useMemo(() => !!token && !!user, [token, user])

  useEffect(() => {
    apiCall('/health').catch(() => {})
    
    // Validate stored token on app startup
    if (token && user) {
      setIsValidatingToken(true)
      validateStoredToken().finally(() => setIsValidatingToken(false))
    }
  }, [])

  // Persist token to localStorage when it changes
  useEffect(() => {
    if (token) {
      localStorage.setItem('cvp_token', token)
    } else {
      localStorage.removeItem('cvp_token')
    }
  }, [token])

  // Persist user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('cvp_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('cvp_user')
    }
  }, [user])

  // Validate stored token by making a test API call
  const validateStoredToken = async () => {
    try {
      const res = await apiCall('/api/content', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        // Token is invalid, clear auth state
        logout()
      }
    } catch (error) {
      // Token validation failed, clear auth state
      logout()
    }
  }

  const login = async () => {
    const res = await apiCall('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      alert('Login failed')
      return
    }
    const data = (await res.json()) as LoginResponse
    setToken(data.token)
    setUser(data.user)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  // Validation logic moved to individual dashboard components

  // Show loading spinner while validating token
  if (isValidatingToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 mx-auto mb-4 text-blue-600">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-gray-600">Validating session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!isAuthed ? (
        <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Content Validation Platform</h1>
                <p className="text-sm sm:text-base text-gray-600">Sign in to access your dashboard</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <input 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                    placeholder="Email address" 
                    type="email"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                  />
                </div>
                <div>
                  <input 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                    placeholder="Password" 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                  />
                </div>
                <button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 sm:py-3 px-4 rounded-lg transition-colors duration-200 text-sm sm:text-base" 
                  onClick={login}
                >
                  Login
                </button>
                
                {/* Removed quick role buttons for deployment */}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Role-based Dashboard Routing
        user?.role === 'ADMIN' ? (
          <AdminDashboard user={user} token={token!} onLogout={logout} />
        ) : (
          <CreatorDashboard user={user!} token={token!} onLogout={logout} />
        )
      )}
    </div>
  )
}

export default App
