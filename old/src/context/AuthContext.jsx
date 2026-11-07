import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase, emailFor, profileToLegacyUser } from '../lib/supabase.js'

const AuthContext = createContext(null)

/**
 * Legacy-сессия Wintozo = сессия WinChat.
 * Новый интерфейс и legacy-iframe живут на одном origin, поэтому Supabase
 * Auth сам подхватывает токен из localStorage. Профиль читаем из profiles,
 * а данные отдаём в старом формате (description, banned и т.д.).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [regData, setRegData] = useState({ nickname: '', username: '', password: '' })
  const initialized = useRef(false)

  const applyProfile = useCallback((p) => {
    if (!p) {
      setUser(null)
      return null
    }
    const legacy = profileToLegacyUser(p)
    setUser(legacy)
    return legacy
  }, [])

  const loadProfileById = useCallback(async (id) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    return applyProfile(data)
  }, [applyProfile])

  const loadProfileByUsername = useCallback(async (username) => {
    if (!username) return null
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', username)
      .maybeSingle()
    return applyProfile(data)
  }, [applyProfile])

  /** Загрузить профиль по текущей Supabase-сессии. */
  const loadSession = useCallback(async (session) => {
    if (!session?.user) {
      // Нет сессии — возможно, bridge уже положил username в localStorage.
      const saved = localStorage.getItem('wintozo_username')
      if (saved) {
        const legacy = await loadProfileByUsername(saved)
        if (legacy) {
          setLoading(false)
          return
        }
      }
      setUser(null)
      setLoading(false)
      return
    }

    let legacy = await loadProfileById(session.user.id)
    if (!legacy) {
      // Триггер handle_new_user мог ещё не сработать — создаём профиль сами.
      const meta = session.user.user_metadata || {}
      await supabase.from('profiles').upsert({
        id: session.user.id,
        username: String(meta.username || `user_${session.user.id.slice(0, 6)}`).toLowerCase(),
        nickname: meta.nickname || 'Пользователь'
      })
      legacy = await loadProfileById(session.user.id)
    }
    setLoading(false)
  }, [loadProfileById, loadProfileByUsername])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    supabase.auth.getSession().then(({ data }) => {
      void loadSession(data.session)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadSession(session)
    })

    return () => subscription.unsubscribe()
  }, [loadSession])

  /**
   * Legacy-мост: родительский WinChat присылает username/ник/аватар.
   * Сессия Supabase уже общая, поэтому достаточно запомнить данные и
   * (при необходимости) перечитать профиль.
   */
  useEffect(() => {
    const onMsg = async (event) => {
      const d = event?.data
      if (!d || typeof d !== 'object' || d.type !== 'wintozo-legacy-session') return
      if (!d.username) return
      localStorage.setItem('wintozo_username', d.username)
      if (d.passwordHash) localStorage.setItem('wintozo_password_hash', d.passwordHash)
      if (d.nickname) localStorage.setItem('wintozo_nickname', d.nickname)
      if (d.avatarUrl) localStorage.setItem('wintozo_avatar', d.avatarUrl)
      if (d.device) localStorage.setItem('wintozo_device', d.device)

      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        await loadSession(data.session)
      } else {
        const legacy = await loadProfileByUsername(d.username)
        if (!legacy) {
          setUser({
            username: d.username,
            nickname: d.nickname || d.username,
            avatar_url: d.avatarUrl || null,
            description: '',
            banned: false,
            legacy_bridge: true
          })
        }
        setLoading(false)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [loadSession, loadProfileByUsername])

  async function signUp(nickname, username, password) {
    const trimmedUsername = username.trim().toLowerCase()
    const trimmedNickname = nickname.trim()

    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', trimmedUsername)
      .maybeSingle()
    if (taken) return { error: { message: 'Этот юзернейм уже занят' } }

    const { data, error } = await supabase.auth.signUp({
      email: emailFor(trimmedUsername),
      password,
      options: { data: { username: trimmedUsername, nickname: trimmedNickname } }
    })
    if (error) return { error }

    // Confirm email выключен на сервере — сессия должна прийти сразу.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailFor(trimmedUsername),
        password
      })
      if (signInError) return { error: signInError }
    }

    localStorage.setItem('wintozo_username', trimmedUsername)
    const legacy = await loadProfileByUsername(trimmedUsername)
    return { data: legacy }
  }

  async function signIn(username, password) {
    const trimmedUsername = username.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailFor(trimmedUsername),
      password
    })
    if (error) {
      return { error: { message: 'Неверный username или пароль' } }
    }
    localStorage.setItem('wintozo_username', trimmedUsername)
    const legacy = await loadProfileById(data.user.id)
    return { data: legacy }
  }

  async function signOut() {
    localStorage.removeItem('wintozo_username')
    localStorage.removeItem('wintozo_password_hash')
    setUser(null)
    await supabase.auth.signOut()
  }

  const value = {
    user,
    loading,
    regData,
    setRegData,
    signUp,
    signIn,
    signOut,
    setUser,
    refreshProfile: async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) return loadProfileById(data.session.user.id)
      return loadProfileByUsername(localStorage.getItem('wintozo_username'))
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
