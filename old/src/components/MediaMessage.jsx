import { useState, useRef, useEffect } from 'react'
import { PlayIcon, PauseIcon } from '../components/Icons.jsx'

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MediaMessage({ message, isSelf }) {
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef(null)

  useEffect(() => {
    const audio = new Audio(message.content)
    audioRef.current = audio
    audio.preload = 'metadata'

    audio.onloadedmetadata = () => {
      // У webm иногда duration = Infinity, фиксим
      if (audio.duration === Infinity || isNaN(audio.duration)) {
        audio.currentTime = 1e101
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null
          audio.currentTime = 0
          setDuration(audio.duration)
        }
      } else {
        setDuration(audio.duration)
      }
    }

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime)
    }

    audio.onended = () => {
      setPlaying(false)
      setCurrentTime(0)
    }

    return () => {
      audio.pause()
    }
  }, [message.content])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div style={{
      maxWidth: '230px',
      background: isSelf ? 'var(--gradient)' : 'var(--bg-tertiary)',
      borderRadius: isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
      padding: '10px 14px',
      color: isSelf ? 'var(--accent-text)' : 'var(--text)',
      animation: 'msgIn 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: isSelf ? '0 3px 12px var(--accent-glow)' : 'var(--shadow)'
    }}>
      <button
        onClick={toggle}
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          border: 'none',
          background: isSelf ? 'rgba(255,255,255,0.25)' : 'var(--accent)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'transform 0.15s ease'
        }}
      >
        {playing ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          height: '4px',
          borderRadius: '4px',
          overflow: 'hidden',
          background: isSelf ? 'rgba(255,255,255,0.25)' : 'var(--border)'
        }}>
          <div style={{
            height: '100%',
            borderRadius: '4px',
            background: isSelf ? 'rgba(255,255,255,0.9)' : 'var(--accent)',
            width: `${progress}%`,
            transition: 'width 0.1s linear'
          }} />
        </div>
        <p style={{
          fontSize: '11px',
          marginTop: '3px',
          opacity: 0.7
        }}>
          {formatDuration(playing ? currentTime : (duration || message.duration || 0))}
        </p>
      </div>
    </div>
  )
}
