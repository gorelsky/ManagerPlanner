import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const [activities, setActivities] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activitiesError, setActivitiesError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setUser(data.user)
    }
  }

  // Загружаем активности, когда есть user
  useEffect(() => {
    const loadActivities = async () => {
      if (!user) return

      setActivitiesLoading(true)
      setActivitiesError(null)

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('start_date', { ascending: false })

      setActivitiesLoading(false)

      if (error) {
        setActivitiesError(error.message)
      } else {
        setActivities(data || [])
      }
    }

    loadActivities()
  }, [user])

  if (!user) {
    return (
      <div style={{ maxWidth: 400, margin: '40px auto', fontFamily: 'sans-serif' }}>
        <h1>Вход в Manager Planner</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Привет, {user.email}</h1>

      <h2>Активности</h2>

      {activitiesLoading && <p>Загрузка активностей...</p>}
      {activitiesError && <p style={{ color: 'red' }}>{activitiesError}</p>}

      {!activitiesLoading && !activitiesError && activities.length === 0 && (
        <p>Пока нет активностей.</p>
      )}

      <ul>
        {activities.map((activity) => (
          <li key={activity.id}>
            <strong>{activity.title || activity.name}</strong>{' '}
            {activity.city_name && `— ${activity.city_name}`}{' '}
            {activity.start_date && `(с ${activity.start_date})`}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
