import { useEffect, useRef, useState, type ReactElement } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowUp,
  CircleAlert,
  ImagePlus,
  Info,
  Loader2,
  MessageCircle,
  Mic,
  Star,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  chatSeed,
  isVerified,
  supabase,
  type ChatItem,
  type Message,
  type Profile,
  type VerifyLevel,
} from "../lib/supabase";
import { dateLabel, formatDuration, formatTime, isCircleVideoUrl, sameDay, uuid } from "../lib/utils";
import { filesUpload } from "../lib/blobStorage";
import { compressVideo } from "../lib/videoCompress";
import { loadSavedNotes, notifySavedNotesChanged, persistSavedNotes } from "../lib/savedNotes";
import { showMessageNotificationIfHidden } from "../lib/notify";
import Avatar from "./Avatar";
import AudioMessage from "./AudioMessage";
import VideoCircle from "./VideoCircle";
import VideoMessage from "./VideoMessage";
import Verified from "./Verified";
import { cn } from "../utils/cn";

const GROUP_WINDOW = 5 * 60 * 1000;

interface Props {
  me: Profile;
  chat: ChatItem;
  onlineIds: Set<string>;
  onBack: () => void;
  onActivity: (m: Message) => void;
  onOpenInfo: () => void;
  /** Режим WinChat You (Material You). */
  youMode?: boolean;
}

function TypingLabel({ who }: { who?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {who ? `${who} печатает` : "печатает"}
      <span className="inline-flex items-center gap-[3px]">
        <span className="typing-dot h-1 w-1 rounded-full bg-current" />
        <span className="typing-dot h-1 w-1 rounded-full bg-current" />
        <span className="typing-dot h-1 w-1 rounded-full bg-current" />
      </span>
    </span>
  );
}

export default function ChatView({
  me,
  chat,
  onlineIds,
  onBack,
  onActivity,
  onOpenInfo,
  youMode = false,
}: Props) {
  const chatId = chat.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressPct, setCompressPct] = useState(0);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [hasText, setHasText] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const uncontrolledText = useRef("");
  /** Актуальный список сообщений — для синхронного сохранения локальных заметок. */
  const messagesRef = useRef<Message[]>([]);

  // Запись голоса
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recTimer = useRef<number | undefined>(undefined);
  const cancelledRec = useRef(false);
  const recSecondsRef = useRef(0);

  // Запись видео (видеокружки)
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoRecSeconds, setVideoRecSeconds] = useState(0);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<BlobPart[]>([]);
  const videoRecTimer = useRef<number | undefined>(undefined);
  const videoCancelledRec = useRef(false);
  const videoRecSecondsRef = useRef(0);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const firstScroll = useRef(true);
  const typingTimer = useRef<number | undefined>(undefined);
  const lastTypingSent = useRef(0);
  const errTimer = useRef<number | undefined>(undefined);

  const memberById = new Map(chat.members.map((p) => [p.id, p]));
  const online = chat.isGroup
    ? chat.members.some((p) => p.id !== me.id && onlineIds.has(p.id))
    : !!chat.other && onlineIds.has(chat.other.id);

  /** Получить уровень галочки для профиля */
  const badgeLevel = (p?: Profile | null): Exclude<VerifyLevel, "user"> => {
    const lvl = p?.verify_status || "user";
    if (!["grey", "green", "full"].includes(lvl)) return "full";
    return lvl as Exclude<VerifyLevel, "user">;
  };

  /* ---------- история + realtime ---------- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    firstScroll.current = true;

    // «Избранное» — локальные заметки, без Supabase и realtime.
    if (chat.isSaved) {
      const sync = () => {
        if (cancelled) return;
        const notes = loadSavedNotes(me.id);
        messagesRef.current = notes;
        setMessages(notes);
      };
      sync();
      setLoading(false);
      const onSaved = (e: Event) => {
        const detail = (e as CustomEvent<{ userId?: string }>).detail;
        if (!detail?.userId || detail.userId === me.id) sync();
      };
      window.addEventListener("storage", sync);
      window.addEventListener("winchat:saved-notes", onSaved);
      return () => {
        cancelled = true;
        window.removeEventListener("storage", sync);
        window.removeEventListener("winchat:saved-notes", onSaved);
      };
    }

    supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(300)
      .then(({ data }) => {
        if (!cancelled) {
          setMessages((data as Message[]) || []);
          setLoading(false);
        }
      });

    const channel = supabase.channel(`chat:${chatId}`);
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id === me.id) {
            // свои сообщения не шлём себе в уведомления
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            setTypingName(null);
            onActivity(m);
            return;
          }
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          setTypingName(null);
          onActivity(m);

          const sender = memberById.get(m.sender_id) ?? chat.other ?? null;
          const senderName = sender?.nickname || "Собеседник";
          const chatTitle = chat.isGroup ? chat.title : "";
          const preview = m.content || m.audio_url ? "Голосовое" : m.image_url ? "Фото" : m.video_url ? "Видео" : "";
          const body = preview || m.content || "Новое сообщение";

          showMessageNotificationIfHidden({
            title: chatTitle ? `${chatTitle} · ${senderName}` : senderName,
            body,
            tag: `chat-${chatId}`,
            url: `/chats`,
            chatId,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setMessages((prev) => prev.filter((x) => x.id !== id));
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { user?: string; name?: string };
        if (p?.user === me.id) return;
        setTypingName(p?.name || "");
        window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTypingName(null), 2600);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      cancelled = true;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [chatId, me.id, chat.isSaved, onActivity]);

  /* ---------- автоскролл ---------- */
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (loading) return;
    if (firstScroll.current) {
      firstScroll.current = false;
      endRef.current?.scrollIntoView();
      return;
    }
    const box = boxRef.current;
    if (!box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 260;
    const lastOwn = messages[messages.length - 1]?.sender_id === me.id;
    if (nearBottom || lastOwn) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, me.id]);

  /* ---------- очистка записи ---------- */
  useEffect(
    () => () => {
      window.clearInterval(recTimer.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      window.clearInterval(videoRecTimer.current);
      videoRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  function flashError(msg: string, ms = 3600) {
    setSendError(msg);
    window.clearTimeout(errTimer.current);
    errTimer.current = window.setTimeout(() => setSendError(null), ms);
  }

  /* ---------- отправка ---------- */
  async function send(opts?: {
    image?: File;
    audio?: Blob;
    seconds?: number;
    video?: Blob;
    videoSeconds?: number;
    videoMime?: string;
    videoExt?: string;
    /** true — видеокружок (круглый), false — обычное видео из галереи. */
    videoCircle?: boolean;
  }) {
    const ta = textRef.current;
    // Читаем актуальное значение из DOM — на мобильных Android при IME-вводе
    // uncontrolledText может быть устаревшим, пока не сработает compositionend.
    const content = (ta?.value ?? uncontrolledText.current).trim();
    if (!content && !opts?.image && !opts?.audio && !opts?.video) return;
    if (sending) return;
    setSending(true);
    try {
      let image_url: string | null = null;
      let audio_url: string | null = null;
      let audio_duration: number | null = null;
      let video_url: string | null = null;
      let video_duration: number | null = null;
      const storageBase = chat.isSaved ? `saved/${me.id}` : chatId;

      if (opts?.image) {
        setUploading(true);
        const ext = (opts.image.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${storageBase}/${uuid()}.${ext}`;
        image_url = await filesUpload("attachments", path, opts.image, opts.image.type || "image/jpeg");
      }

      if (opts?.audio) {
        setUploading(true);
        const path = `${storageBase}/voice/${uuid()}.webm`;
        audio_url = await filesUpload("attachments", path, opts.audio, "audio/webm");
        audio_duration = opts.seconds ?? 0;
      }

      if (opts?.video) {
        setUploading(true);
        const mime = opts.videoMime || opts.video.type || "video/webm";
        const ext = opts.videoExt || (mime.includes("mp4") ? "mp4" : "webm");
        const path = `${storageBase}/video/${opts.videoCircle ? "circle" : "file"}/${uuid()}.${ext}`;
        video_url = await filesUpload("video-attachments", path, opts.video, mime);
        video_duration = Math.round(opts.videoSeconds ?? 0);
      }

      // Локальные заметки не пишем в базу — только в localStorage.
      if (chat.isSaved) {
        const m: Message = {
          id: uuid(),
          chat_id: chatId,
          sender_id: me.id,
          content: content || null,
          image_url,
          audio_url,
          audio_duration,
          video_url,
          video_duration,
          created_at: new Date().toISOString(),
        };
        // Сохраняем синхронно и сразу показываем — иначе событие синхронизации
        // успевало прочитать старый localStorage и откатить сообщение.
        const next = [...messagesRef.current, m];
        messagesRef.current = next;
        persistSavedNotes(me.id, next);
        setMessages(next);
        notifySavedNotesChanged(me.id);
        onActivity(m);
        if (!opts?.audio && !opts?.video) {
          uncontrolledText.current = "";
          setHasText(false);
          if (ta) {
            ta.value = "";
            ta.style.height = "auto";
          }
          autoResize();
        }
        return;
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: me.id,
          content: content || null,
          image_url,
          audio_url,
          audio_duration,
          video_url,
          video_duration,
        })
        .select()
        .single();
      if (error) throw error;

      const m = data as Message;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      onActivity(m);
      if (!opts?.audio && !opts?.video) {
        uncontrolledText.current = "";
        setHasText(false);
        if (ta) {
          ta.value = "";
          ta.style.height = "auto";
        }
        autoResize();
      }
    } catch {
      flashError(
        opts?.video
          ? "Не удалось отправить видео"
          : opts?.audio
            ? "Не удалось отправить голосовое"
            : opts?.image
              ? "Не удалось отправить фото"
              : "Не удалось отправить сообщение"
      );
    } finally {
      setSending(false);
      setUploading(false);
    }
  }

  /* ---------- видео из галереи: сжимаем перед отправкой ---------- */
  async function sendVideoFile(file: File) {
    if (sending || compressing) return;
    if (file.size > 250 * 1024 * 1024) {
      return flashError("Видео больше 250 МБ — выберите файл поменьше", 6000);
    }
    setCompressing(true);
    setCompressPct(0);
    try {
      const result = await compressVideo(file, (p) => setCompressPct(p));
      await send({
        video: result.blob,
        videoSeconds: result.duration,
        videoMime: result.mime,
        videoExt: result.ext,
      });
    } catch (err) {
      flashError(
        err instanceof Error && err.message
          ? err.message
          : "Не удалось обработать видео — попробуйте другой файл",
        6000
      );
    } finally {
      setCompressing(false);
      setCompressPct(0);
    }
  }

  /* ---------- голосовые ---------- */
  async function startRecording() {
    if (recording) return;

    /* В Electron-обёртке (EXE/APK) нет HTTPS-ограничения — проверяем только API */
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return flashError(
        "Запись голоса недоступна в этом браузере. Откройте WinChat в актуальном Chrome, Safari или Firefox — а не во встроенном браузере мессенджера или соцсети.",
        9000
      );
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      cancelledRec.current = false;

      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(recTimer.current);
        const seconds = recSecondsRef.current;
        setRecording(false);
        setRecSeconds(0);
        if (cancelledRec.current) return;
        if (seconds < 1) return flashError("Слишком короткое сообщение");
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        send({ audio: blob, seconds });
      };

      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      recSecondsRef.current = 0;
      recTimer.current = window.setInterval(() => {
        recSecondsRef.current += 1;
        setRecSeconds(recSecondsRef.current);
        if (recSecondsRef.current >= 120) stopRecording();
      }, 1000);
    } catch (err) {
      const name = (err as DOMException)?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        flashError(
          "Доступ к микрофону запрещён. Разрешите его: иконка замка слева от адреса сайта → Микрофон → «Разрешить», затем попробуйте снова.",
          9000
        );
      } else if (name === "NotFoundError") {
        flashError("Микрофон не найден — подключите устройство и попробуйте снова.", 6000);
      } else if (name === "NotReadableError" || name === "AbortError") {
        flashError("Микрофон занят другим приложением. Закройте его и повторите.", 6000);
      } else {
        flashError("Не удалось получить доступ к микрофону.", 5000);
      }
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function cancelRecording() {
    cancelledRec.current = true;
    stopRecording();
  }

  /* ---------- видеокружки ---------- */
  async function startVideoRecording() {
    if (videoRecording) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      return flashError(
        "Запись видео недоступна. Откройте WinChat в актуальном Chrome, Safari или Firefox.",
        9000
      );
    }

    try {
      // audio: { echoCancellation: true } — на Android при audio:true без
      // ограничений WebView иногда не отдаёт аудио-трек в поток.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: { echoCancellation: true, noiseSuppression: false },
      });
      videoStreamRef.current = stream;

      // Проверяем, что аудио-дорожка реально получена
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        return flashError(
          "Нет доступа к микрофону. Дайте разрешёние микрофона и повторите запись.",
          7000
        );
      }

      // Подключаем поток к превью
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      // Явно собираем микс видео + аудио, чтобы MediaRecorder гарантированно
      // писал звуковую дорожку (в WebView some devices теряют audio из raw stream).
      let recStream: MediaStream = stream;
      const audioTracks = stream.getAudioTracks();
      const videoTrack = stream.getVideoTracks()[0];
      if (audioTracks.length > 0 && typeof AudioContext !== "undefined") {
        try {
          const ctx = new AudioContext();
          const src = ctx.createMediaStreamSource(new MediaStream(audioTracks));
          const dest = ctx.createMediaStreamDestination();
          src.connect(dest);
          const mixed = new MediaStream();
          if (videoTrack) mixed.addTrack(videoTrack);
          dest.stream.getAudioTracks().forEach((t) => mixed.addTrack(t));
          recStream = mixed;
        } catch {
          recStream = stream;
        }
      }

      // Подбираем mimeType с аудиокодеком Opus — без него Chrome на Android
      // пишет webm только с видеодорожкой.
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : MediaRecorder.isTypeSupported("video/webm;codecs=h264,aac")
            ? "video/webm;codecs=h264,aac"
            : "video/webm";
      const rec = new MediaRecorder(recStream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
      videoChunksRef.current = [];
      videoCancelledRec.current = false;

      rec.ondataavailable = (e) => e.data.size > 0 && videoChunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
        window.clearInterval(videoRecTimer.current);
        const seconds = videoRecSecondsRef.current;
        setVideoRecording(false);
        setVideoRecSeconds(0);
        if (videoCancelledRec.current) return;
        if (seconds < 1) return flashError("Слишком короткое сообщение");
        const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
        send({ video: blob, videoSeconds: seconds, videoCircle: true });
      };

      videoRecorderRef.current = rec;
      rec.start(250); // ondataavailable каждые 250мс — надёжнее для звука
      setVideoRecording(true);
      setVideoRecSeconds(0);
      videoRecSecondsRef.current = 0;
      videoRecTimer.current = window.setInterval(() => {
        videoRecSecondsRef.current += 1;
        setVideoRecSeconds(videoRecSecondsRef.current);
        if (videoRecSecondsRef.current >= 60) stopVideoRecording();
      }, 1000);
    } catch (err) {
      const name = (err as DOMException)?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        flashError(
          "Доступ к камере запрещён. Разрешите его, затем попробуйте снова.",
          9000
        );
      } else if (name === "NotFoundError") {
        flashError("Камера не найдена.", 6000);
      } else {
        flashError("Не удалось получить доступ к камере.", 5000);
      }
    }
  }

  function stopVideoRecording() {
    if (videoRecorderRef.current?.state === "recording") videoRecorderRef.current.stop();
  }

  function cancelVideoRecording() {
    videoCancelledRec.current = true;
    stopVideoRecording();
  }

  function removeMessage(id: string) {
    if (chat.isSaved) {
      const next = messagesRef.current.filter((x) => x.id !== id);
      messagesRef.current = next;
      persistSavedNotes(me.id, next);
      setMessages(next);
      notifySavedNotesChanged(me.id);
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== id));
    supabase
      .from("messages")
      .delete()
      .eq("id", id)
      .then(() => undefined);
  }

  function notifyTyping() {
    if (chat.isSaved) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user: me.id, name: chat.isGroup ? me.nickname : "" },
    });
  }

  function autoResize() {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }

  /* ---------- лента ---------- */
  const rows: ReactElement[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const own = m.sender_id === me.id;
    const sender = memberById.get(m.sender_id) ?? chat.other ?? null;
    const showDate = !prev || !sameDay(prev.created_at, m.created_at);
    const groupedPrev =
      !!prev &&
      prev.sender_id === m.sender_id &&
      sameDay(prev.created_at, m.created_at) &&
      +new Date(m.created_at) - +new Date(prev.created_at) < GROUP_WINDOW;
    const groupedNext =
      !!next &&
      next.sender_id === m.sender_id &&
      sameDay(next.created_at, m.created_at) &&
      +new Date(next.created_at) - +new Date(m.created_at) < GROUP_WINDOW;

    if (showDate) {
      rows.push(
        <div key={`d-${m.id}`} className="my-5 flex justify-center">
          <span
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[11px] font-bold",
              youMode
                ? "you-date-chip"
                : "bg-black/6 text-black/50"
            )}
          >
            {dateLabel(m.created_at)}
          </span>
        </div>
      );
    }

    rows.push(
      <div
        key={m.id}
        className={cn(
          "group flex items-end gap-2",
          own ? "justify-end" : "justify-start",
          groupedNext ? "mb-1" : "mb-3.5"
        )}
      >
        {!own &&
          (groupedNext ? (
            <div className="w-9 shrink-0" />
          ) : (
            <Avatar profile={sender} size="sm" className="mb-0.5" />
          ))}

        {own && (
          <button
            onClick={() => removeMessage(m.id)}
            className="mb-2 rounded-full p-1.5 text-black/25 opacity-100 transition hover:bg-red-500/10 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Удалить сообщение"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="animate-msg-in max-w-[78%] sm:max-w-[65%]">
          <div
            className={cn(
              "overflow-hidden rounded-[20px] text-[15px] leading-relaxed font-medium",
              m.image_url || m.audio_url || m.video_url ? "p-1.5" : "px-4 py-2.5",
              own
                ? youMode
                  ? "you-msg-own"
                  : "rounded-br-lg bg-ink text-white"
                : youMode
                  ? "you-msg-other"
                  : "rounded-bl-lg bg-white text-ink shadow-sm ring-1 ring-black/8"
            )}
          >
            {chat.isGroup && !own && !groupedPrev && (
              <p
                className={cn(
                  "mb-0.5 flex items-center gap-1 text-[12px] font-bold",
                  youMode ? "text-[var(--you-primary)]" : "text-accent",
                  (m.image_url || m.audio_url || m.video_url) && "px-2.5 pt-1"
                )}
              >
                {sender?.nickname || "Участник"}
                {isVerified(sender) && <Verified size="xs" className="h-3 w-3" level={badgeLevel(sender)} />}
              </p>
            )}

            {m.audio_url && (
              <div className="px-1.5">
                <AudioMessage
                  src={m.audio_url}
                  duration={m.audio_duration}
                  seed={m.id}
                  own={own}
                />
              </div>
            )}

            {m.video_url && (
              <div className="px-1.5">
                {isCircleVideoUrl(m.video_url) ? (
                  <VideoCircle
                    src={m.video_url}
                    duration={m.video_duration}
                    own={own}
                  />
                ) : (
                  <VideoMessage
                    src={m.video_url}
                    duration={m.video_duration}
                    own={own}
                  />
                )}
              </div>
            )}

            {m.image_url && (
              <button
                onClick={() => setLightbox(m.image_url)}
                className="relative block cursor-zoom-in overflow-hidden rounded-2xl"
              >
                <img
                  src={m.image_url}
                  alt="Фотография"
                  loading="lazy"
                  className="max-h-72 w-auto max-w-full object-cover transition hover:opacity-95"
                />
                {!m.content && (
                  <span className="absolute right-2.5 bottom-2.5 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[10px] text-white">
                    {formatTime(m.created_at)}
                  </span>
                )}
              </button>
            )}

            {m.content && (
              <p
                className={cn(
                  "break-words whitespace-pre-wrap",
                  (m.image_url || m.audio_url || m.video_url) && "px-2.5 pt-1.5 pb-1"
                )}
              >
                {m.content}
                <span
                  className={cn(
                    "float-right mt-3 ml-3 font-mono text-[10px]",
                    own ? "text-white/45" : "text-black/35"
                  )}
                >
                  {formatTime(m.created_at)}
                </span>
              </p>
            )}

            {m.audio_url && !m.content && (
              <p
                className={cn(
                  "px-3 pb-1 text-right font-mono text-[10px]",
                  own ? "text-white/45" : "text-black/35"
                )}
              >
                {formatTime(m.created_at)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  });

  const statusLine = chat.isSaved ? (
    "Личные заметки — хранятся на этом устройстве"
  ) : typingName ? (
    <TypingLabel who={chat.isGroup ? typingName || undefined : undefined} />
  ) : chat.isGroup ? (
    `${chat.members.length} участников`
  ) : online ? (
    "в сети"
  ) : (
    `@${chat.other?.username ?? ""}`
  );

  return (
    <div className={cn("flex h-full flex-col", youMode ? "you-chat" : "bg-paper")}>
      {/* Шапка */}
      <header
        className={cn(
          "flex items-center gap-3 px-4 py-3 backdrop-blur",
          youMode
            ? "you-appbar rounded-b-[24px] border-b"
            : "border-b border-black/8 bg-white/70"
        )}
      >
        <button
          onClick={onBack}
          className={cn(
            "-ml-1 rounded-full p-2 transition md:hidden",
            youMode
              ? "you-fab h-10 w-10 shrink-0"
              : "hover:bg-black/5"
          )}
          aria-label="Назад к чатам"
        >
          <ArrowLeft className={youMode ? "h-5 w-5" : "h-5 w-5"} />
        </button>
        <button
          onClick={onOpenInfo}
          disabled={chat.isSaved}
          className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
        >
          <Avatar
            name={chat.title}
            avatarUrl={chat.avatarUrl}
            seed={chatSeed(chat)}
            group={chat.isGroup}
            online={chat.isGroup || chat.isSaved ? null : online}
          />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1 text-[16px] font-extrabold tracking-tight">
              {chat.isSaved && (
                <Star
                  className="mr-0.5 h-4 w-4 shrink-0 text-amber-500"
                  fill="currentColor"
                  strokeWidth={1.8}
                />
              )}
              {chat.isGroup && <Users className="mr-0.5 h-3.5 w-3.5 shrink-0 text-black/40" />}
              <span className="truncate">{chat.title}</span>
              {!chat.isGroup && !chat.isSaved && isVerified(chat.other) && (
                <Verified size="sm" level={badgeLevel(chat.other)} />
              )}
            </p>
            <p
              className={cn(
                "truncate text-xs font-semibold",
                typingName !== null
                  ? youMode
                    ? "text-[var(--you-primary)]"
                    : "text-accent"
                  : online && !chat.isGroup
                    ? youMode
                      ? "text-[var(--you-on-surface-variant)]"
                      : "text-emerald-600"
                    : "text-black/40"
              )}
            >
              {statusLine}
            </p>
          </div>
        </button>
        {chat.isSaved ? (
          <span
            className="rounded-full p-2 text-amber-500"
            title="Заметки хранятся только на этом устройстве"
            aria-label="Локальные заметки"
          >
            <Star className="h-5 w-5" fill="currentColor" strokeWidth={1.8} />
          </span>
        ) : (
          <button
            onClick={onOpenInfo}
            className={cn(
              "rounded-full p-2 transition",
              youMode
                ? "text-[var(--you-on-surface-variant)] hover:bg-[var(--you-secondary-container)] hover:text-[var(--you-on-secondary-container)]"
                : "text-black/40 hover:bg-black/5 hover:text-ink"
            )}
            aria-label="Информация о чате"
          >
            <Info className="h-5 w-5" strokeWidth={1.9} />
          </button>
        )}
      </header>

      {/* Лента */}
      <div ref={boxRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-[820px]">
          {loading ? (
            <div
              className={cn(
                "flex items-center justify-center gap-2.5 pt-24 text-sm font-semibold",
                youMode ? "text-[var(--you-on-surface-variant)]" : "text-black/40"
              )}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Загружаем переписку…
            </div>
          ) : messages.length === 0 ? (
            <div className="animate-fade-in flex flex-col items-center pt-20 text-center">
              <div
                className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-[26px] shadow-lg",
                  youMode
                    ? "you-logo"
                    : "bg-white shadow-sm ring-1 ring-black/8"
                )}
              >
                <MessageCircle
                  className={cn("h-8 w-8", youMode ? "text-white" : "text-black/30")}
                  strokeWidth={1.6}
                />
              </div>
              <p className="mt-4 text-[17px] font-extrabold tracking-tight">
                {chat.isSaved ? "Заметок пока нет" : "Сообщений пока нет"}
              </p>
              <p
                className={cn(
                  "mt-1 max-w-[280px] text-[13px] leading-relaxed font-medium",
                  youMode ? "text-[var(--you-on-surface-variant)]" : "text-black/45"
                )}
              >
                {chat.isSaved
                  ? "Пишите сюда всё, что не хотите потерять. Заметки хранятся только на этом устройстве."
                  : chat.isGroup
                    ? `Начните обсуждение в группе «${chat.title}»`
                    : `Напишите первым — ${chat.title} будет приятно`}
              </p>
            </div>
          ) : (
            rows
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Ввод */}
      <footer
        className={cn(
          "px-4 py-3 backdrop-blur sm:px-8",
          youMode
            ? "you-bottombar rounded-t-[28px] border-t"
            : "border-t border-black/8 bg-white/70"
        )}
      >
        <div className="mx-auto max-w-[820px]">
          {sendError && (
            <p className="animate-fade-in mx-auto mb-2 flex max-w-lg items-start justify-center gap-1.5 text-center text-xs leading-relaxed font-bold text-red-600">
              <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{sendError}</span>
            </p>
          )}

          {videoRecording ? (
            /* --- Панель записи видеокружка --- */
            <div className="animate-fade-in flex items-center gap-3 rounded-[22px] border border-purple-500/25 bg-purple-500/8 px-4 py-2.5">
              {/* Миниатюра превью */}
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-black">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Таймер */}
              <span className="font-mono text-sm font-bold text-purple-600 tabular-nums">
                {formatDuration(videoRecSeconds)}
              </span>
              {/* Анимированные полоски */}
              <span className="flex flex-1 items-center gap-[3px] overflow-hidden">
                {Array.from({ length: 28 }).map((_, i) => (
                  <span
                    key={i}
                    className="typing-dot w-[3px] rounded-full bg-purple-500/60"
                    style={{
                      height: `${8 + ((i * 7 + videoRecSeconds * 3) % 18)}px`,
                      animationDelay: `${i * 0.04}s`,
                    }}
                  />
                ))}
              </span>
              {/* Отмена */}
              <button
                onClick={cancelVideoRecording}
                className="rounded-full p-2 text-black/45 transition hover:bg-black/5 hover:text-ink"
                aria-label="Отменить запись видео"
              >
                <X className="h-4.5 w-4.5" />
              </button>
              {/* Отправить */}
              <button
                onClick={stopVideoRecording}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500 text-white transition hover:bg-purple-600 active:scale-95"
                aria-label="Отправить видеокружок"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
          ) : recording ? (
            <div className="animate-fade-in flex items-center gap-3 rounded-[22px] border border-red-500/25 bg-red-500/8 px-4 py-2.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="font-mono text-sm font-bold text-red-600 tabular-nums">
                {formatDuration(recSeconds)}
              </span>
              <span className="flex flex-1 items-center gap-[3px] overflow-hidden">
                {Array.from({ length: 28 }).map((_, i) => (
                  <span
                    key={i}
                    className="typing-dot w-[3px] rounded-full bg-red-500/60"
                    style={{
                      height: `${8 + ((i * 7 + recSeconds * 3) % 18)}px`,
                      animationDelay: `${i * 0.04}s`,
                    }}
                  />
                ))}
              </span>
              <button
                onClick={cancelRecording}
                className="rounded-full p-2 text-black/45 transition hover:bg-black/5 hover:text-ink"
                aria-label="Отменить запись"
              >
                <X className="h-4.5 w-4.5" />
              </button>
              <button
                onClick={stopRecording}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600 active:scale-95"
                aria-label="Отправить голосовое"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div
                className={cn(
                  "flex flex-1 items-end gap-1 px-2 py-1.5 transition",
                  youMode
                    ? "you-composer"
                    : "rounded-[22px] border border-black/10 bg-white shadow-sm focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10"
                )}
              >
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || compressing || sending}
                  className={cn(
                    "rounded-full p-2.5 transition disabled:opacity-50",
                    youMode
                      ? "text-[var(--you-on-surface-variant)] hover:text-[var(--you-primary)]"
                      : "text-black/40 hover:bg-black/5 hover:text-accent"
                  )}
                  aria-label="Прикрепить фото или видео"
                  title="Фото или видео"
                >
                  {uploading || compressing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" strokeWidth={1.8} />
                  )}
                </button>
                <textarea
                  ref={textRef}
                  rows={1}
                  defaultValue=""
                  enterKeyHint="send"
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    uncontrolledText.current = target.value;
                    setHasText(target.value.trim().length > 0);
                    autoResize();
                    notifyTyping();
                  }}
                  onCompositionEnd={(e) => {
                    // После подтверждения IME (Gboard предиктивный ввод) — обновляем состояние
                    const target = e.target as HTMLTextAreaElement;
                    uncontrolledText.current = target.value;
                    setHasText(target.value.trim().length > 0);
                  }}
                  onFocus={() => {
                    // При возврате фокуса — синхронизируем с DOM
                    if (textRef.current) {
                      uncontrolledText.current = textRef.current.value;
                      setHasText(textRef.current.value.trim().length > 0);
                    }
                  }}
                  onKeyDown={(e) => {
                    // Enter во время IME-ввода (предиктивный ввод) не отправляет сообщение
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={chat.isSaved ? "Заметка" : "Сообщение"}
                  className={cn(
                    "max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] font-medium outline-none",
                    youMode
                      ? "placeholder:text-[var(--you-on-surface-variant)]"
                      : "placeholder:text-black/30"
                  )}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.type.startsWith("video/")) sendVideoFile(f);
                      else send({ image: f });
                    }
                    e.target.value = "";
                  }}
                />
              </div>

              {hasText ? (
                <button
                  onClick={() => send()}
                  disabled={sending || compressing}
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center transition active:scale-95 disabled:opacity-25",
                    youMode ? "you-fab" : "rounded-full bg-ink text-white hover:bg-black"
                  )}
                  aria-label="Отправить сообщение"
                >
                  {sending && !uploading ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={startVideoRecording}
                    disabled={sending || compressing}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center transition active:scale-95 disabled:opacity-40",
                      youMode
                        ? "you-fab-tonal"
                        : "rounded-full bg-purple-500 text-white hover:bg-purple-600"
                    )}
                    aria-label="Записать видеокружок"
                    title="Видеокружок"
                  >
                    <Video className="h-5 w-5" strokeWidth={1.9} />
                  </button>
                  <button
                    onClick={startRecording}
                    disabled={sending || compressing}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center transition active:scale-95 disabled:opacity-40",
                      youMode ? "you-fab" : "rounded-full bg-ink text-white hover:bg-black"
                    )}
                    aria-label="Записать голосовое сообщение"
                    title="Голосовое сообщение"
                  >
                    {sending ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      <Mic className="h-5 w-5" strokeWidth={1.9} />
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          <p className="mt-2 text-center font-mono text-[10px] tracking-wide text-black/30">
            {compressing
              ? `сжимаем видео… ${Math.round(compressPct * 100)}%`
              : uploading
                ? "загрузка вложения…"
                : recording
                  ? "идёт запись — нажмите стрелку, чтобы отправить"
                  : chat.isSaved
                    ? "Заметки видны только вам и хранятся на этом устройстве"
                    : "Enter — отправить · микрофон — голосовое"}
          </p>
        </div>
      </footer>

      {/* Просмотр фото */}
      {lightbox && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/88 p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-5 right-5 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="Закрыть просмотр"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightbox}
            alt="Фотография"
            className="animate-scale-in max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
