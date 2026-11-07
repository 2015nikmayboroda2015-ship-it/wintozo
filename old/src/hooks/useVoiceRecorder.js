import { useState, useRef, useCallback } from 'react'
import { mediaSupabase, MEDIA_BUCKETS, registerMediaFile } from '../lib/supabase.js'
import { toast } from '../lib/toast.js'

/**
 * Хук записи голосовых как в Telegram.
 * Зажал кнопку → запись → отпустил → авто-загрузка + отправка.
 * Логика загрузки из старого проекта (wintozo-voice).
 * Файлы голосовых уходят в ПЕРВЫЙ Supabase (медиа-проект).
 */
export function useVoiceRecorder(onComplete, activeChat, user) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const animRef = useRef(null)
  const cancelledRef = useRef(false)
  const startTimeRef = useRef(0)

  const stopAnalyser = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
  }, [])

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    stopAnalyser()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [stopAnalyser])

  // Зажать кнопку — начать запись
  const startRecording = useCallback(async () => {
    if (isRecording) return
    cancelledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      streamRef.current = stream

      // Анализатор громкости для визуализации
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        setAudioLevel(Math.min(1, sum / (dataArray.length * 80)))
        animRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(250)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setRecordingTime(0)
      startTimeRef.current = Date.now()

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setRecordingTime(elapsed)
        if (elapsed >= 120) {
          stopRecording()
        }
      }, 200)
    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err)
      toast('Нет доступа к микрофону. Разрешите доступ в настройках браузера.', 'error')
    }
  }, [isRecording])

  // Отпустить кнопку — остановить запись + загрузить + отправить
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      cleanup()
      setIsRecording(false)
      return
    }

    const recorder = mediaRecorderRef.current
    const wasCancelled = cancelledRef.current

    const blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
      }
      recorder.stop()
    })

    const finalDuration = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
    cleanup()
    setIsRecording(false)
    setAudioLevel(0)

    if (wasCancelled || blob.size < 500) return

    // Загрузка в ПЕРВЫЙ Supabase (медиа) — логика из старого проекта
    setUploading(true)
    try {
      const fileName = `voice_${user?.username || 'unknown'}_${Date.now()}.webm`

      const { error: uploadError } = await mediaSupabase.storage
        .from(MEDIA_BUCKETS.messageMedia)
        .upload(fileName, blob, { contentType: 'audio/webm' })

      if (uploadError) {
        toast('Ошибка загрузки: ' + uploadError.message, 'error')
        return
      }

      const { data: urlData } = mediaSupabase.storage
        .from(MEDIA_BUCKETS.messageMedia)
        .getPublicUrl(fileName)

      await registerMediaFile({
        bucket: MEDIA_BUCKETS.messageMedia,
        path: fileName,
        url: urlData.publicUrl,
        mime: 'audio/webm',
        size: blob.size,
        username: user?.username || 'unknown',
        kind: 'voice'
      }).catch(() => {})

      onComplete?.({
        type: 'audio',
        url: urlData.publicUrl,
        duration: finalDuration
      })
    } catch (err) {
      console.error('upload error:', err)
      toast('Ошибка: ' + (err?.message || String(err)), 'error')
    }
    setUploading(false)
  }, [cleanup, user, onComplete])

  // Отменить запись (увёл палец с кнопки)
  const cancelRecording = useCallback(() => {
    cancelledRef.current = true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    cleanup()
    setIsRecording(false)
    setAudioLevel(0)
    setRecordingTime(0)
  }, [cleanup])

  return {
    isRecording,
    recordingTime,
    uploading,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording
  }
}
