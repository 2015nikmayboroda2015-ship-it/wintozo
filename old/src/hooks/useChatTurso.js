import { useEffect, useState, useCallback, useRef } from 'react'
import {
  supabase,
  mediaSupabase,
  MEDIA_BUCKETS,
  messageToLegacy,
  idsToUsernames,
  usernameToId,
  ensureDirectChat
} from '../lib/supabase.js'
import { toast } from '../lib/toast.js'
import { showMessageNotificationIfHidden } from '../lib/notify.js'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Хук личных чатов Wintozo.
 * Работает напрямую с новой схемой WinChat:
 *   chats / chat_members / messages / profiles.
 * Текстовые сообщения и realtime → core Supabase.
 * Фото и голосовые файлы → media Supabase.
 */
export function useChatTurso() {
  const { user } = useAuth()
  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [activeChatUser, setActiveChatUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  const activeChatRef = useRef(null)
  const chatChannelRef = useRef(null)
  const myId = user?.id || null

  /** Дополнить строки сообщений именами отправителей и старым форматом. */
  const hydrateMessages = useCallback(async (rows) => {
    await idsToUsernames((rows || []).map((m) => m.sender_id))
    return (rows || []).map((m) => messageToLegacy(m))
  }, [])

  // ==================== REALTIME ====================
  const subscribeToChat = useCallback((chatId) => {
    if (chatChannelRef.current) {
      try { supabase.removeChannel(chatChannelRef.current) } catch { /* no-op */ }
      chatChannelRef.current = null
    }
    const channel = supabase
      .channel(`wintozo_chat:${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, async (payload) => {
        const [fresh] = await hydrateMessages([payload.new])
        if (!fresh?.id) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === fresh.id)) return prev
          return [...prev, fresh].sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
          )
        })

        // Уведомление о новом сообщении
        if (fresh.sender_id !== myId) {
          const senderName = fresh.sender_username || activeChatUser?.nickname || 'Собеседник'
          const body = fresh.media_type === 'photo' ? 'Фото'
            : fresh.media_type === 'audio' ? 'Голосовое'
            : fresh.media_type === 'video' ? 'Видео'
            : fresh.content || 'Новое сообщение'
          showMessageNotificationIfHidden({
            title: activeChatUser?.nickname || 'Wintozo',
            body: `${senderName}: ${body}`,
            tag: `chat-${chatId}`,
            url: '/messenger/phone/chat',
            chatId,
          })
        }
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          // фолбэк-поллинг, если realtime недоступен
          setTimeout(() => {
            if (activeChatRef.current === chatId) pollNewMessages(chatId)
          }, 1500)
        }
      })
    chatChannelRef.current = channel
  }, [hydrateMessages])

  const pollNewMessages = useCallback(async (chatId) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .gt('created_at', new Date(Date.now() - 4000).toISOString())
      if (data?.length) {
        const fresh = await hydrateMessages(data)
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id))
          const added = fresh.filter((m) => !ids.has(m.id))
          if (!added.length) return prev
          return [...prev, ...added].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        })
      }
    } catch { /* no-op */ }
  }, [hydrateMessages])

  // ==================== ЗАГРУЗКА ЧАТОВ ====================
  const loadChats = useCallback(async () => {
    if (!myId) { setChats([]); setLoading(false); return }

    try {
      const { data: mine } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', myId)

      const chatIds = (mine || []).map((m) => m.chat_id)
      if (!chatIds.length) {
        setChats([])
        setLoading(false)
        return
      }

      const [{ data: chatRows }, { data: memberRows }, { data: lastMessages }] = await Promise.all([
        supabase.from('chats').select('*').in('id', chatIds),
        supabase
          .from('chat_members')
          .select('chat_id, user_id, profiles(*)')
          .in('chat_id', chatIds),
        supabase
          .from('messages')
          .select('*')
          .in('chat_id', chatIds)
          .order('created_at', { ascending: false })
          .limit(500)
      ])

      // участники по чатам
      const membersByChat = new Map()
      for (const row of memberRows || []) {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        if (!p) continue
        const list = membersByChat.get(row.chat_id) || []
        list.push(p)
        membersByChat.set(row.chat_id, list)
      }

      // последнее сообщение по чату
      const lastByChat = new Map()
      for (const msg of lastMessages || []) {
        if (!lastByChat.has(msg.chat_id)) lastByChat.set(msg.chat_id, msg)
      }

      const list = []
      for (const c of chatRows || []) {
        if (c.is_group) continue // legacy-интерфейс — только личные диалоги
        const members = membersByChat.get(c.id) || []
        const partnerProfile = members.find((p) => p.id !== myId)
        if (!partnerProfile) continue

        const lastMsg = lastByChat.get(c.id)
        let display = 'Нет сообщений'
        if (lastMsg) {
          if (lastMsg.image_url) display = 'Фото'
          else if (lastMsg.audio_url) display = 'Голосовое'
          else if (lastMsg.video_url) display = 'Видео'
          else display = lastMsg.content || 'Сообщение'
        }

        list.push({
          chatId: c.id,
          partner: {
            id: partnerProfile.id,
            username: partnerProfile.username,
            nickname: partnerProfile.nickname,
            avatar_url: partnerProfile.avatar_url,
            description: partnerProfile.bio || ''
          },
          lastMessage: display,
          lastTime: lastMsg?.created_at || c.updated_at || null
        })
      }

      list.sort((a, b) => {
        if (!a.lastTime) return 1
        if (!b.lastTime) return -1
        return new Date(b.lastTime) - new Date(a.lastTime)
      })
      setChats(list)
      setLoading(false)
    } catch (err) {
      console.error('loadChats error:', err)
      setChats([])
      setLoading(false)
    }
  }, [myId])

  useEffect(() => { loadChats() }, [loadChats])

  // ==================== ОТКРЫТИЕ ЧАТА ====================
  const openChat = useCallback(async (chatId, partner) => {
    setActiveChat(chatId)
    setActiveChatUser(partner)
    activeChatRef.current = chatId

    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(200)
      setMessages(await hydrateMessages(data))
      subscribeToChat(chatId)
    } catch (err) {
      console.error('openChat error:', err)
    }
  }, [hydrateMessages, subscribeToChat])

  const closeChat = useCallback(() => {
    if (chatChannelRef.current) {
      try { supabase.removeChannel(chatChannelRef.current) } catch { /* no-op */ }
      chatChannelRef.current = null
    }
    setActiveChat(null); setActiveChatUser(null)
    setMessages([]); activeChatRef.current = null
  }, [])

  // ==================== ОТПРАВКА СООБЩЕНИЙ ====================
  const sendMessage = useCallback(async (content) => {
    if (!activeChatRef.current || !content.trim() || !myId) return

    try {
      const { data: newMsg } = await supabase.from('messages').insert({
        chat_id: activeChatRef.current,
        sender_id: myId,
        content: content.trim()
      }).select().single()

      if (newMsg) {
        const [legacy] = await hydrateMessages([newMsg])
        setMessages(prev => {
          if (prev.some(m => m.id === legacy.id)) return prev
          return [...prev, legacy]
        })
        loadChats()
      }
    } catch (err) {
      console.error('sendMessage error:', err)
    }
  }, [myId, hydrateMessages, loadChats])

  // ==================== ОТПРАВКА МЕДИА ====================
  const sendMediaMessage = useCallback(async (mediaData) => {
    if (!activeChatRef.current || !mediaData || !myId) return

    try {
      const payload = {
        chat_id: activeChatRef.current,
        sender_id: myId,
        content: mediaData.content || null
      }
      const type = mediaData.type
      if (type === 'photo' || type === 'image') payload.image_url = mediaData.url || null
      else if (type === 'audio' || type === 'voice') {
        payload.audio_url = mediaData.url || null
        payload.audio_duration = mediaData.duration || null
      } else if (type === 'video') {
        payload.video_url = mediaData.url || null
        payload.video_duration = mediaData.duration || null
      }

      const { data: newMsg } = await supabase.from('messages').insert(payload).select().single()

      if (newMsg) {
        const [legacy] = await hydrateMessages([newMsg])
        setMessages(prev => {
          if (prev.some(m => m.id === legacy.id)) return prev
          return [...prev, legacy]
        })
        loadChats()
      }
    } catch (err) {
      console.error('sendMediaMessage error:', err)
    }
  }, [myId, hydrateMessages, loadChats])

  const sendPhoto = useCallback(async (file) => {
    if (!activeChatRef.current || !file || !user) return

    try {
      const chatId = activeChatRef.current
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const fileName = `${chatId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await mediaSupabase.storage
        .from(MEDIA_BUCKETS.messageMedia)
        .upload(fileName, file, { contentType: file.type || 'image/jpeg', upsert: true })

      if (uploadError) {
        toast('Ошибка загрузки фото: ' + uploadError.message, 'error')
        return
      }

      const { data: urlData } = mediaSupabase.storage
        .from(MEDIA_BUCKETS.messageMedia)
        .getPublicUrl(fileName)

      await sendMediaMessage({ type: 'photo', url: urlData.publicUrl, content: null })
    } catch (err) {
      console.error('sendPhoto error:', err)
      toast('Не удалось отправить фото: ' + (err?.message || String(err)), 'error')
    }
  }, [sendMediaMessage])

  // ==================== СОЗДАНИЕ ЧАТА ====================
  const startChat = useCallback(async (partnerUsername) => {
    if (!myId || !partnerUsername) return null
    const p = partnerUsername.trim().toLowerCase()

    try {
      const partnerId = await usernameToId(p)
      if (!partnerId) return null

      const { data: partnerData } = await supabase
        .from('profiles')
        .select('id, username, nickname, avatar_url, bio')
        .eq('id', partnerId)
        .maybeSingle()

      const partner = partnerData
        ? {
            id: partnerData.id,
            username: partnerData.username,
            nickname: partnerData.nickname,
            avatar_url: partnerData.avatar_url,
            description: partnerData.bio || ''
          }
        : { id: partnerId, username: p, nickname: p }

      const chatRow = await ensureDirectChat(myId, partnerId)
      if (!chatRow?.id) return null

      await openChat(chatRow.id, partner)
      loadChats()
      return chatRow.id
    } catch (err) {
      console.error('startChat error:', err)
      return null
    }
  }, [myId, openChat, loadChats])

  return {
    chats,
    activeChat,
    activeChatUser,
    messages,
    loading,
    loadChats,
    openChat,
    closeChat,
    sendMessage,
    sendMediaMessage,
    sendPhoto,
    startChat,
    subscribeToChat
  }
}
