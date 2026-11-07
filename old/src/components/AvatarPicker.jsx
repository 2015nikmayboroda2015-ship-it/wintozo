import { useState, useRef } from 'react'
import { supabase, mediaSupabase, MEDIA_BUCKETS, convertToWebP, registerMediaFile } from '../lib/supabase.js'
import { toast } from '../lib/toast.js'
import { CloseIcon, ImageIcon, TrashIcon, CheckIcon } from './Icons.jsx'

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease'
  },
  panel: {
    background: 'var(--bg)',
    borderRadius: '20px',
    padding: '24px',
    maxWidth: '380px',
    width: '92%',
    maxHeight: '82vh',
    overflowY: 'auto',
    animation: 'slideUp 0.3s ease'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  title: {
    fontSize: '18px',
    fontWeight: 700
  },
  sectionTitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    marginBottom: '10px',
    marginTop: '16px'
  },
  uploadBtn: {
    width: '100%',
    padding: '14px',
    background: 'var(--bg-secondary)',
    border: '2px dashed var(--border)',
    borderRadius: '16px',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease'
  },
  currentAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    margin: '0 auto 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    fontWeight: 700,
    color: 'white',
    background: 'var(--gradient)',
    position: 'relative',
    overflow: 'hidden'
  },
  currentAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '50%'
  }
}

/**
 * Выбор аватарки. В новой схеме WinChat есть только profiles.avatar_url,
 * поэтому поддерживается загрузка фото (как в новом интерфейсе).
 * Файл уходит в медиа-проект, в profiles пишется публичный URL.
 */
export default function AvatarPicker({ currentAvatar, onSelect, onClose }) {
  const [preview, setPreview] = useState(currentAvatar?.type === 'url' ? currentAvatar.value : null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  const MAX_SIZE = 5 * 1024 * 1024 // 5MB

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_TYPES.includes(file.type) && !['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      toast('Поддерживаемые форматы: PNG, JPG, JPEG, WEBP', 'error')
      e.target.value = ''
      return
    }

    if (file.size > MAX_SIZE) {
      toast('Размер файла не должен превышать 5 МБ', 'error')
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) throw new Error('Нет активной сессии')

      const uploadFile = file.type && file.type.startsWith('image/')
        ? await convertToWebP(file)
        : file

      const fileName = `${userId}_${Date.now()}.webp`

      const { error: uploadError } = await mediaSupabase.storage
        .from(MEDIA_BUCKETS.avatars)
        .upload(fileName, uploadFile, { upsert: true, contentType: 'image/webp' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = mediaSupabase.storage
        .from(MEDIA_BUCKETS.avatars)
        .getPublicUrl(fileName)

      await registerMediaFile({
        bucket: MEDIA_BUCKETS.avatars,
        path: fileName,
        url: publicUrl,
        mime: 'image/webp',
        size: uploadFile.size,
        username: localStorage.getItem('wintozo_username') || userId,
        kind: 'avatar'
      }).catch(() => {})

      // Сразу сохраняем аватарку в профиль — как в новом WinChat.
      const { error: saveError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)
      if (saveError) throw saveError

      setPreview(publicUrl)
      onSelect({ type: 'url', value: publicUrl })
      toast('Аватарка обновлена', 'success')
    } catch (err) {
      console.error('Ошибка загрузки аватарки:', err)
      toast('Не удалось загрузить аватарку: ' + (err?.message || String(err)), 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) throw new Error('Нет активной сессии')

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: preview })
        .eq('id', userId)

      if (error) throw error

      onSelect({ type: 'url', value: preview })
      toast('Аватарка сохранена', 'success')
      onClose()
    } catch (err) {
      console.error('Ошибка сохранения аватарки:', err)
      toast('Не удалось сохранить аватарку: ' + (err?.message || String(err)), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) throw new Error('Нет активной сессии')

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId)

      if (error) throw error

      setPreview(null)
      onSelect(null)
      toast('Аватарка удалена', 'success')
      onClose()
    } catch (err) {
      console.error('Ошибка удаления аватарки:', err)
      toast('Не удалось удалить аватарку: ' + (err?.message || String(err)), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.title}>Аватарка</div>
          <div style={{ cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)' }} onClick={onClose}>
            <CloseIcon size={20} />
          </div>
        </div>

        <div style={s.currentAvatar}>
          {preview ? (
            <img src={preview} alt="" style={s.currentAvatarImg} />
          ) : (
            (localStorage.getItem('wintozo_nickname') || localStorage.getItem('wintozo_username') || '?')[0]?.toUpperCase()
          )}
        </div>

        {uploading && (
          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Загрузка...
          </div>
        )}

        <div style={s.sectionTitle}>Фото профиля</div>
        <button style={s.uploadBtn} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon size={18} />
          {uploading ? 'Загружаем...' : 'Загрузить фото'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />

        <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
          <button className="btn-primary" onClick={handleSave} disabled={!preview || saving} style={{ animation: 'none' }}>
            <CheckIcon size={17} /> Сохранить
          </button>
          <button className="btn-secondary" onClick={handleRemove} disabled={saving} style={{ animation: 'none' }}>
            <TrashIcon size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}
