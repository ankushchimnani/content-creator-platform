import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { AdminDashboard } from './components/AdminDashboard'
import { CreatorDashboard } from './components/CreatorDashboard'
import { SuperAdminDashboard } from './components/SuperAdminDashboard'
import { ContentCreation } from './components/ContentCreation'
import { Settings } from './components/Settings'
import { DashboardLayout } from './components/DashboardLayout'
import { LoaderOverlay, Loader } from './components/Loader'
import { Logo } from './components/Logo'
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
  const [isNavigating, setIsNavigating] = useState(false)
  const [currentView, setCurrentView] = useState<'dashboard' | 'create-content' | 'settings'>('dashboard')
  const [taskData, setTaskData] = useState<any>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const isAuthed = useMemo(() => !!token && !!user, [token, user])

  // Navigation helper functions
  const navigateToView = (view: 'dashboard' | 'create-content' | 'settings', taskData?: any) => {
    setIsNavigating(true)

    // Small delay to show loader animation
    setTimeout(() => {
      setCurrentView(view)
      setTaskData(taskData || null)

      // Update URL without causing a page reload
      const url = new URL(window.location.href)
      url.hash = ''

      if (view === 'create-content') {
        url.hash = '#/create-content'
        if (taskData) {
          url.searchParams.set('task', encodeURIComponent(JSON.stringify(taskData)))
        }
      } else if (view === 'settings') {
        url.hash = '#/settings'
      } else {
        url.hash = '#/dashboard'
      }

      // Use pushState to add to history stack for proper back navigation
      window.history.pushState(null, '', url.toString())

      setIsNavigating(false)
    }, 300)
  }

  const navigateBack = () => {
    // Use browser's back functionality
    window.history.back()
  }

  useEffect(() => {
    apiCall('/health').catch(() => {})
    
    // Validate stored token on app startup
    if (token && user) {
      setIsValidatingToken(true)
      validateStoredToken().finally(() => setIsValidatingToken(false))
    }

    // Handle URL routing with proper browser navigation support
    const handleRouteChange = () => {
      setIsNavigating(true)

      setTimeout(() => {
        const hash = window.location.hash
        const urlParams = new URLSearchParams(window.location.search)

        if (hash.includes('#/create-content')) {
          const taskParam = urlParams.get('task')
          if (taskParam) {
            try {
              const decodedTaskData = JSON.parse(decodeURIComponent(taskParam))
              setTaskData(decodedTaskData)
              setCurrentView('create-content')
            } catch (error) {
              console.error('Failed to parse task data:', error)
              setCurrentView('dashboard')
            }
          } else {
            setCurrentView('create-content')
            setTaskData(null)
          }
        } else if (hash.includes('#/settings')) {
          setCurrentView('settings')
          setTaskData(null)
        } else {
          setCurrentView('dashboard')
          setTaskData(null)
        }

        setIsNavigating(false)
      }, 300)
    }

    // Listen for both hash changes and popstate events (browser back/forward)
    window.addEventListener('hashchange', handleRouteChange)
    window.addEventListener('popstate', handleRouteChange)
    
    // Check initial route
    handleRouteChange()

    return () => {
      window.removeEventListener('hashchange', handleRouteChange)
      window.removeEventListener('popstate', handleRouteChange)
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
    try {
      const res = await apiCall('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Login failed:', res.status, errorText);
        alert(`Login failed: ${res.status} - ${errorText}`);
        return;
      }

      const data = (await res.json()) as LoginResponse;
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      alert(`Login error: ${error}`);
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const handleForgotPassword = async () => {
    try {
      const res = await apiCall('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        alert(`Failed to send reset email: ${errorText}`);
        return;
      }

      setResetSuccess(true);
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetSuccess(false);
        setForgotPasswordEmail('');
      }, 3000);
    } catch (error) {
      console.error('Forgot password error:', error);
      alert('Failed to send reset email. Please try again.');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      login()
    }
  }

  // Show loading spinner while validating token
  if (isValidatingToken) {
    return <LoaderOverlay type="guardrail" size="lg" />
  }

  // Show loader during navigation
  if (isNavigating) {
    return <LoaderOverlay type="guardrail" size="lg" />
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 m-0 p-0">
      {!isAuthed ? (
        <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="w-full max-w-4xl">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-2 lg:grid-cols-2 min-h-[400px]">
              {/* Left Side - Animation */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 sm:p-12 flex flex-col items-center justify-center text-white">
                <div className="mb-8">
                  <Logo size="lg" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center">GUARD RAIL</h1>
                <p className="text-lg text-blue-100 text-center mb-8">Namma Content Validation Platform</p>
                <div className="w-full max-w-sm">
                  <Loader type="guardrail" size="lg" />
                </div>
              </div>

              {/* Right Side - Login Form */}
              <div className="p-8 sm:p-12 flex flex-col justify-center">
                {!showForgotPassword ? (
                  <>
                    <div className="mb-8">
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                      <p className="text-gray-600">Please sign in to your account</p>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                        <input
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                          placeholder="Enter your email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={handleKeyDown}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                          placeholder="Enter your password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={handleKeyDown}
                        />
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          onClick={() => setShowForgotPassword(true)}
                        >
                          Forgot Password?
                        </button>
                      </div>

                      <button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
                        onClick={login}
                      >
                        Sign In
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-8">
                      <button
                        className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setForgotPasswordEmail('');
                          setResetSuccess(false);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Login
                      </button>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Reset Password</h2>
                      <p className="text-gray-600">Enter your email to receive a password reset link</p>
                    </div>

                    {!resetSuccess ? (
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                          <input
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="Enter your email"
                            type="email"
                            value={forgotPasswordEmail}
                            onChange={(e) => setForgotPasswordEmail(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleForgotPassword();
                              }
                            }}
                          />
                        </div>

                        <button
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
                          onClick={handleForgotPassword}
                        >
                          Send Reset Link
                        </button>
                      </div>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-green-800 font-medium">
                            Password reset link has been sent to your email!
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Route between different views
        currentView === 'create-content' ? (
          <DashboardLayout
            user={user!}
            activeView="create-content"
            onNavigate={(view) => {
              // Handle navigation back to dashboard
              navigateToView('dashboard')
            }}
            onLogout={logout}
          >
            <ContentCreation
              user={user!}
              token={token!}
              onBack={navigateBack}
              taskData={taskData}
            />
          </DashboardLayout>
        ) : currentView === 'settings' ? (
          <Settings
            user={user!}
            token={token!}
            onBack={navigateBack}
          />
        ) : (
          // Role-based dashboard routing
          user!.role === 'SUPER_ADMIN' ? (
            <SuperAdminDashboard 
              user={user!} 
              token={token!} 
              onLogout={logout}
            />
          ) : user!.role === 'ADMIN' ? (
            <AdminDashboard 
              user={user!} 
              token={token!} 
              onLogout={logout}
            />
          ) : (
            <CreatorDashboard 
              user={user!} 
              token={token!} 
              onLogout={logout}
              onNavigateToContentCreation={(taskData) => {
                navigateToView('create-content', taskData)
              }}
            />
          )
        )
      )}
    </div>
  )
}

export default App
