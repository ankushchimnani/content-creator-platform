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
  const [email, setEmail] = useState('creator1@example.com')
  const [password, setPassword] = useState('Creator@123')
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<LoginResponse['user'] | null>(null)
  const isAuthed = useMemo(() => !!token && !!user, [token, user])

  useEffect(() => {
    apiCall('/health').catch(() => {})
  }, [])

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
