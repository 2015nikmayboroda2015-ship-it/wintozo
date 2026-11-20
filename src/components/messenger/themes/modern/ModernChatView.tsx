import { useEffect, useRef, useState, type ReactElement } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  CircleAlert,
  Download,
  ImagePlus,
  Info,
  Loader2,
  Megaphone,
  MessageCircle,
  Mic,
  Pencil,
  Phone,
  Plus,
  Star,
  Sticker,
  Terminal,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  canPostInChat,
  chatSeed,
  isGlobalAdmin,
  isVerified,
  supabase,
  type ChatItem,
  type Message,
  type Profile,
  type VerifyLevel,
} from "../../../../lib/supabase";
import { dateLabel, formatDuration, formatTime, isCircleVideoUrl, sameDay, uuid } from "../../../../lib/utils";
import { filesUpload } from "../../../../lib/blobStorage";
import { compressVideo } from "../../../../lib/videoCompress";
import { loadSavedNotes, notifySavedNotesChanged, persistSavedNotes } from "../../../../lib/savedNotes";
import { useCalls } from "../../../../hooks/useCalls";
import { devLog } from "../../../../lib/devLogs";
import { downloadMedia } from "../../../../lib/mediaDownload";
import CallOverlay from "../../../CallOverlay";
import Avatar from "../../../Avatar";
import AudioMessage from "../../../AudioMessage";
import VideoCircle from "../../../VideoCircle";
import VideoMessage from "../../../VideoMessage";
import Verified from "../../../Verified";
import { cn } from "../../../../utils/cn";
import StickerPanel from "../../../StickerPanel";

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
  /** Глобальный админ — показывает админ-терминал в шапке. */
  isAdmin?: boolean;
  onOpenTerminal?: () => void;
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
  isAdmin = false,
  onOpenTerminal,
}: Props) {
  const chatId = chat.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerToSave, setStickerToSave] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressPct, setCompressPct] = useState(0);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const savedHintTimer = useRef<number | undefined>(undefined);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [hasText, setHasText] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
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
  /** В каналах писать могут только владелец/админы (и глобальный @admin). */
  const canPost = canPostInChat(chat, me);

  /* ---------- звонки ---------- */
  const calls = useCalls(chat, me);
  const callPeer: Profile | null =
    calls.status === "incoming" && calls.incoming ? calls.incoming.from : chat.other;

  /** Получить уровень галочки для профиля */
  const badgeLevel = (p?: Profile | null): Exclude<VerifyLevel, "user"> => {
    const lvl = p?.verify_status || "user";
    if (!["grey", "green", "full"].includes(lvl)) return "full";
    return lvl as Exclude<VerifyLevel, "user">;
  };

  /* ---------- логи режима разработчика ---------- */
  useEffect(() => {
    devLog(`loading chat.tsx (chat ${chatId})`);
  }, [chatId]);

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
      devLog(`chat.tsx loaded from notes (${messagesRef.current.length} messages)`);
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
          devLog(`chat.tsx loaded (${(data as Message[] | null)?.length ?? 0} messages)`);
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
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
          // Не трогаем превью в сайдбаре: изменено может быть не последнее сообщение.
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
    /** Готовая ссылка на стикер с sticker-сервера. */
    stickerUrl?: string;
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
    if (!content && !opts?.image && !opts?.stickerUrl && !opts?.audio && !opts?.video) return;
    if (!canPost) return flashError("В канале писать могут только администраторы");
    if (sending) return;
    const kind = opts?.image
      ? "photo"
      : opts?.video
        ? "video"
        : opts?.audio
          ? "voice"
          : opts?.stickerUrl
            ? "sticker"
            : "text";
    devLog(`sending message (${kind}, chat ${chatId})`);
    setSending(true);
    try {
      let image_url: string | null = null;
      let sticker_url: string | null = opts?.stickerUrl ?? null;
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
          sticker_url,
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
        devLog(`message sent (${kind}, chat ${chatId}, local notes)`);
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
          sticker_url,
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
      devLog(`message sent (${kind}, chat ${chatId})`);
      if (!opts?.audio && !opts?.video) {
        uncontrolledText.current = "";
        setHasText(false);
        if (ta) {
          ta.value = "";
          ta.style.height = "auto";
        }
        autoResize();
      }
    } catch (err) {
      devLog(
        `failed to send message (${kind}, chat ${chatId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
        "error"
      );
      flashError(
        opts?.stickerUrl
          ? "Не удалось отправить стикер"
          : opts?.video
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

  /* ---------- редактирование сообщений ---------- */
  function startEdit(m: Message) {
    setEditingId(m.id);
    setEditingText(m.content ?? "");
    setSendError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function saveEdit(m: Message) {
    const text = editingText.trim();
    if (!text && !m.image_url && !m.audio_url && !m.video_url) {
      return flashError("Сообщение не может быть пустым");
    }
    setEditBusy(true);
    try {
      if (chat.isSaved) {
        const editedAt = new Date().toISOString();
        const next = messagesRef.current.map((x) =>
          x.id === m.id ? { ...x, content: text || null, edited_at: editedAt } : x
        );
        messagesRef.current = next;
        persistSavedNotes(me.id, next);
        setMessages(next);
        notifySavedNotesChanged(me.id);
        cancelEdit();
        return;
      }

      const { data, error } = await supabase.rpc("edit_wintozo_message", {
        _user_id: me.id,
        _message_id: m.id,
        _content: text,
      });
      if (error) throw error;

      const res = data as {
        ok: boolean;
        content?: string | null;
        edited_at?: string;
        error?: string;
      };
      if (!res.ok) return flashError(res.error || "Не удалось изменить сообщение");

      const editedAt = res.edited_at ?? new Date().toISOString();
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id
            ? { ...x, content: res.content ?? (text || null), edited_at: editedAt }
            : x
        )
      );
      cancelEdit();
    } catch {
      flashError("Не удалось изменить сообщение");
    } finally {
      setEditBusy(false);
    }
  }

  function notifyTyping() {
    if (chat.isSaved || !canPost) return;
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
        <div key={`d-${m.id}`} className="my-4 flex items-center justify-center gap-3 px-2">
          {youMode ? (
            <span className="yc-date">{dateLabel(m.created_at)}</span>
          ) : (
            <>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
              <span className="modern-date-chip rounded-full border border-black/8 bg-white/75 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-black/45 shadow-sm backdrop-blur">
                {dateLabel(m.created_at)}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
            </>
          )}
        </div>
      );
    }

    rows.push(
      <div
        key={m.id}
        className={cn(
          "group flex items-end gap-2",
          own ? "justify-end" : "justify-start",
          groupedNext ? "mb-1" : "mb-3.5",
          youMode && "yc-msg-row"
        )}
      >
        {!own &&
          (groupedNext ? (
            <div className="w-9 shrink-0" />
          ) : (
            <Avatar
              profile={sender}
              size="sm"
              className={cn("mb-0.5", youMode && "yc-msg-avatar")}
            />
          ))}

        {own && (
          <div
            className={cn(
              "mb-1 flex items-center gap-1 transition md:opacity-0 md:group-hover:opacity-100",
              youMode
                ? "opacity-100"
                : "rounded-2xl border border-black/8 bg-white/85 p-1 shadow-sm backdrop-blur-sm"
            )}
          >
            {m.content && (
              <button
                onClick={() => startEdit(m)}
                className={cn(
                  "transition",
                  youMode
                    ? "yc-msg-action rounded-full p-1.5"
                    : "flex h-8 w-8 items-center justify-center rounded-xl text-black/40 hover:bg-accent/10 hover:text-accent active:scale-95 md:h-7 md:w-7"
                )}
                aria-label="Редактировать сообщение"
                title="Редактировать"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => removeMessage(m.id)}
              className={cn(
                "transition",
                youMode
                  ? "yc-msg-action yc-msg-action-danger rounded-full p-1.5"
                  : "flex h-8 w-8 items-center justify-center rounded-xl text-black/40 hover:bg-red-500/10 hover:text-red-500 active:scale-95 md:h-7 md:w-7"
              )}
              aria-label="Удалить сообщение"
              title="Удалить"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="modern-pop max-w-[84%] sm:max-w-[68%] md:max-w-[62%]">
          <div
            className={cn(
              "overflow-hidden text-[15px] leading-relaxed font-medium transition-shadow",
              m.sticker_url
                ? "bg-transparent p-0"
                : cn(
                    m.image_url || m.audio_url || m.video_url ? "p-1.5" : "px-4 py-3",
                    own
                      ? youMode
                        ? cn(
                            "yc-bubble yc-bubble-own",
                            groupedPrev && "yc-stack-own",
                            !groupedNext && "yc-tail-own"
                          )
                        : cn(
                            "modern-bubble modern-bubble-own rounded-[26px] text-white shadow-lg",
                            groupedPrev ? "rounded-tr-[14px]" : "",
                            !groupedNext ? "rounded-br-[8px]" : "rounded-br-[14px]"
                          )
                      : youMode
                        ? cn(
                            "yc-bubble yc-bubble-other",
                            groupedPrev && "yc-stack-other",
                            !groupedNext && "yc-tail-other"
                          )
                        : cn(
                            "modern-bubble modern-bubble-other rounded-[26px] border border-black/6 text-ink shadow-md",
                            groupedPrev ? "rounded-tl-[14px]" : "",
                            !groupedNext ? "rounded-bl-[8px]" : "rounded-bl-[14px]"
                          )
                  )
            )}
          >
            {chat.isGroup && !own && !groupedPrev && (
              <p
                className={cn(
                  "mb-0.5 flex items-center gap-1 text-[12px] font-bold",
                  youMode ? "yc-sender" : "text-accent",
                  (m.image_url || m.audio_url || m.video_url) && "px-2.5 pt-1"
                )}
              >
                {sender?.nickname || "Участник"}
                {isVerified(sender) && <Verified size="xs" className="h-3 w-3" level={badgeLevel(sender)} />}
              </p>
            )}

            {m.sticker_url && (
              <button
                type="button"
                onClick={() => setStickerToSave(m.sticker_url!)}
                className="group/sticker relative block cursor-pointer"
                title="Сохранить стикер себе"
                aria-label="Сохранить стикер себе"
              >
                <img
                  src={m.sticker_url}
                  alt="Стикер"
                  loading="lazy"
                  className="h-32 w-32 object-contain drop-shadow-md transition group-hover/sticker:scale-[1.03] sm:h-40 sm:w-40"
                />
                <span className="absolute right-1 bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/75 text-white opacity-0 backdrop-blur-sm transition group-hover/sticker:opacity-100">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </button>
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
                    onDownload={() => void saveMediaFile(m.video_url!, "video")}
                  />
                ) : (
                  <VideoMessage
                    src={m.video_url}
                    duration={m.video_duration}
                    own={own}
                    onDownload={() => void saveMediaFile(m.video_url!, "video")}
                  />
                )}
              </div>
            )}

            {m.image_url && (
              <div className="group/image relative overflow-hidden rounded-2xl">
                <button
                  onClick={() => setLightbox(m.image_url)}
                  className="relative block cursor-zoom-in overflow-hidden"
                  aria-label="Открыть фотографию"
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void saveMediaFile(m.image_url!, "photo");
                  }}
                  disabled={downloading === m.image_url}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-100 backdrop-blur-sm transition hover:bg-black/75 disabled:opacity-60 sm:opacity-0 sm:group-hover/image:opacity-100"
                  aria-label="Скачать фото в DCIM/WinChat/Photos"
                  title="Скачать в DCIM/WinChat/Photos"
                >
                  {downloading === m.image_url ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}

            {editingId === m.id ? (
              <div
                className={cn(
                  "px-2.5 pt-1.5 pb-1",
                  !(m.image_url || m.audio_url || m.video_url) && "px-3"
                )}
              >
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  rows={Math.min(5, Math.max(2, Math.ceil(editingText.length / 42)))}
                  autoFocus
                  className={cn(
                    "w-full resize-none rounded-xl px-2.5 py-2 text-[14px] font-medium outline-none",
                    own
                      ? "bg-white/10 text-white placeholder:text-white/40"
                      : "bg-paper text-ink placeholder:text-black/35"
                  )}
                  placeholder="Текст сообщения"
                />
                <div className="mt-1.5 flex justify-end gap-1.5">
                  <button
                    onClick={cancelEdit}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-bold transition",
                      own ? "text-white/70 hover:bg-white/10" : "text-black/50 hover:bg-black/5"
                    )}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => saveEdit(m)}
                    disabled={editBusy}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50",
                      own ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-black"
                    )}
                  >
                    {editBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Сохранить
                  </button>
                </div>
              </div>
            ) : (
              m.content && (
                <p
                  className={cn(
                    "break-words whitespace-pre-wrap",
                    (m.image_url || m.audio_url || m.video_url || m.sticker_url) &&
                      "px-2.5 pt-1.5 pb-1"
                  )}
                >
                  {m.content}
                  <span
                    className={cn(
                      "float-right mt-3 ml-3 font-mono text-[10px]",
                      youMode
                        ? "yc-bubble-time"
                        : m.sticker_url
                          ? "text-black/40"
                          : own
                            ? "text-white/45"
                            : "text-black/35"
                    )}
                  >
                    {formatTime(m.created_at)}
                    {m.edited_at ? " · изм." : ""}
                  </span>
                </p>
              )
            )}

            {m.audio_url && !m.content && (
              <p
                className={cn(
                  "px-3 pb-1 text-right font-mono text-[10px]",
                  youMode
                    ? "yc-bubble-time"
                    : own
                      ? "text-white/45"
                      : "text-black/35"
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

  const saveMediaFile = async (url: string, kind: "photo" | "video") => {
    setDownloading(url);
    try {
      const result = await downloadMedia(url, kind);
      setSavedHint(result.message);
      window.clearTimeout(savedHintTimer.current);
      savedHintTimer.current = window.setTimeout(() => setSavedHint(null), 3600);
    } finally {
      setDownloading(null);
    }
  };

  useEffect(
    () => () => {
      window.clearTimeout(savedHintTimer.current);
    },
    []
  );

  const statusLine = chat.isSaved ? (
    "Личные заметки — хранятся на этом устройстве"
  ) : typingName ? (
    <TypingLabel who={chat.isGroup ? typingName || undefined : undefined} />
  ) : chat.isChannel ? (
    `${chat.members.length} подписчиков${canPost ? "" : " · только администраторы пишут"}`
  ) : chat.isGroup ? (
    `${chat.members.length} участников`
  ) : online ? (
    "в сети"
  ) : (
    `@${chat.other?.username ?? ""}`
  );

  return (
    <div className={cn("flex h-full flex-col", youMode ? "you-chat yc-chat" : "bg-paper")}>
      {/* Шапка */}
      <header
        className={cn(
          "relative z-10 flex items-center gap-2 backdrop-blur sm:gap-3",
          youMode
            ? "yc-appbar"
            : "border-b border-black/8 bg-white/72 px-2.5 py-2 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] sm:px-5 sm:py-2.5"
        )}
      >
        <button
          onClick={onBack}
          className={cn(
            "md:hidden",
            youMode
              ? "yc-appbar-back"
              : "flex h-10 w-10 items-center justify-center rounded-2xl bg-black/[0.04] text-ink transition hover:bg-black/[0.08] active:scale-95"
          )}
          aria-label="Назад к чатам"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <button
          onClick={onOpenInfo}
          disabled={chat.isSaved}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default",
            !youMode && "rounded-[20px] px-1 py-1 transition hover:bg-black/[0.03]"
          )}
        >
          <Avatar
            name={chat.title}
            avatarUrl={chat.avatarUrl}
            seed={chatSeed(chat)}
            group={chat.isGroup}
            channel={chat.isChannel}
            online={chat.isGroup || chat.isSaved ? null : online}
            className={youMode ? "yc-appbar-avatar" : "rounded-[18px] shadow-sm"}
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "flex min-w-0 items-center gap-1.5 text-[15px] font-extrabold tracking-tight sm:text-[16px]",
                youMode && "yc-appbar-title"
              )}
            >
              {chat.isSaved && (
                <Star className="mr-0.5 h-4 w-4 shrink-0 text-amber-500" fill="currentColor" strokeWidth={1.8} />
              )}
              {chat.isGroup && (
                chat.isChannel ? (
                  <Megaphone className="mr-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" />
                ) : (
                  <Users className="mr-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" />
                )
              )}
              <span className="truncate">{chat.title}</span>
              {chat.verified && <Verified size="sm" level="full" />}
              {!chat.isGroup && !chat.isSaved && isVerified(chat.other) && (
                <Verified size="sm" level={badgeLevel(chat.other)} />
              )}
            </p>
            <p
              className={cn(
                youMode
                  ? cn(
                      "yc-appbar-status",
                      typingName !== null && "is-typing",
                      typingName === null && online && !chat.isGroup && !chat.isSaved && "is-online"
                    )
                  : cn(
                      "truncate text-xs font-semibold",
                      typingName !== null ? "text-accent" : online && !chat.isGroup ? "text-emerald-600" : "text-black/40"
                    )
              )}
            >
              {youMode && typingName === null && online && !chat.isGroup && !chat.isSaved && <span className="yc-status-dot" aria-hidden />}
              {statusLine}
            </p>
          </div>
        </button>

        {/* Действия: перегруппированы */}
        <div className={cn("flex items-center gap-1", !youMode && "rounded-[18px] border border-black/8 bg-white/70 p-1 shadow-sm")}>
          {!chat.isSaved && !chat.isGroup && chat.other && isGlobalAdmin(me) && (
            <>
              <button
                onClick={() => void calls.startCall("voice")}
                className={cn("transition", youMode ? "yc-appbar-action" : "flex h-9 w-9 items-center justify-center rounded-xl text-black/45 hover:bg-accent/10 hover:text-accent active:scale-95")}
                aria-label="Голосовой звонок"
                title="Голосовой звонок"
              >
                <Phone className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              <button
                onClick={() => void calls.startCall("video")}
                className={cn("transition", youMode ? "yc-appbar-action" : "flex h-9 w-9 items-center justify-center rounded-xl text-black/45 hover:bg-accent/10 hover:text-accent active:scale-95")}
                aria-label="Видеозвонок"
                title="Видеозвонок"
              >
                <Video className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </>
          )}
          {chat.isSaved ? (
            <span
              className={cn("flex h-9 w-9 items-center justify-center", youMode ? "yc-appbar-action yc-appbar-action-gold" : "rounded-xl bg-amber-400/12 text-amber-600")}
              title="Заметки хранятся только на этом устройстве"
              aria-label="Локальные заметки"
            >
              <Star className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={1.8} />
            </span>
          ) : (
            <button
              onClick={onOpenInfo}
              className={cn("transition", youMode ? "yc-appbar-action" : "flex h-9 w-9 items-center justify-center rounded-xl text-black/45 hover:bg-black/5 hover:text-ink active:scale-95")}
              aria-label="Информация о чате"
            >
              <Info className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Админ-терминал в правом верхнем углу (десктоп, только для админа) */}
        {isAdmin && onOpenTerminal && (
          <button
            onClick={onOpenTerminal}
            className="ml-1 hidden h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200/80 bg-emerald-50/90 text-emerald-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-md active:scale-95 md:flex"
            aria-label="Admin Terminal"
            title="Admin Terminal"
          >
            <Terminal className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        )}
      </header>

      {/* Лента */}
      <div
        ref={boxRef}
        className={cn(
          "flex-1 overflow-y-auto scroll-smooth",
          youMode ? "yc-feed px-4 py-5 sm:px-7" : "modern-feed px-3 py-5 sm:px-8 sm:py-6"
        )}
      >
        <div className={cn("mx-auto max-w-[820px]", youMode && "yc-feed-inner")}>
          {loading ? (
            youMode ? (
              <div className="flex items-center justify-center gap-2.5 pt-24 text-sm font-semibold text-[var(--you-on-surface-variant)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загружаем переписку…
              </div>
            ) : (
              <div className="modern-fade-in space-y-4 pt-6">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                    <div className={cn("max-w-[78%] space-y-2 rounded-[26px] border border-black/5 bg-white/70 p-3 shadow-sm", i % 2 === 0 ? "rounded-bl-lg" : "rounded-br-lg")}>
                      {i % 3 === 0 && <div className="modern-skeleton h-28 w-56 max-w-full rounded-2xl" />}
                      <div className={cn("modern-skeleton h-3.5 rounded-full", i % 2 === 0 ? "w-48" : "w-40")} />
                      <div className={cn("modern-skeleton h-3 rounded-full", i % 2 === 0 ? "w-32" : "w-24")} />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : messages.length === 0 ? (
            <div className="modern-fade-in flex flex-col items-center pt-16 text-center sm:pt-24">
              {youMode ? (
                <>
                  <div className="yc-empty-mark flex items-center justify-center">
                    <img src="/logo.jpg" alt="" className="yc-empty-logo" aria-hidden />
                  </div>
                  <p className="yc-empty-title-lg mt-5 text-[17px] font-extrabold tracking-tight">
                    {chat.isSaved ? "Заметок пока нет" : "Сообщений пока нет"}
                  </p>
                  <p className="yc-empty-sub-lg mt-1 max-w-[280px] text-[13px] leading-relaxed font-medium">
                    {chat.isSaved
                      ? "Пишите сюда всё, что не хотите потерять. Заметки хранятся только на этом устройстве."
                      : chat.isChannel
                        ? canPost ? `Напишите первое сообщение в канале «${chat.title}»` : `В канале «${chat.title}» пока нет сообщений`
                        : chat.isGroup ? `Начните обсуждение в группе «${chat.title}»` : `Напишите первым — ${chat.title} будет приятно`}
                  </p>
                </>
              ) : (
                <div className="relative w-full max-w-sm rounded-[32px] border border-white/70 bg-white/70 p-8 shadow-[0_24px_70px_-30px_rgba(16,18,20,0.3)] backdrop-blur-xl">
                  <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
                  <span className="pointer-events-none absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-ink/5 blur-2xl" />
                  <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-ink to-ink/80 text-white shadow-xl shadow-ink/20">
                    <MessageCircle className="h-9 w-9" strokeWidth={1.7} />
                  </div>
                  <p className="relative mt-5 text-[18px] font-extrabold tracking-tight text-ink">
                    {chat.isSaved ? "Заметок пока нет" : "Начните диалог"}
                  </p>
                  <p className="relative mt-2 text-[13px] leading-relaxed font-medium text-black/50">
                    {chat.isSaved
                      ? "Пишите сюда всё, что не хотите потерять. Заметки хранятся только на этом устройстве."
                      : chat.isChannel
                        ? canPost ? `Напишите первое сообщение в канале «${chat.title}»` : `В канале «${chat.title}» пока нет сообщений`
                        : chat.isGroup ? `Начните обсуждение в группе «${chat.title}»` : `Напишите первым — ${chat.title} будет приятно`}
                  </p>
                </div>
              )}
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
          "relative z-10",
          youMode
            ? "yc-bottom"
            : "border-t border-black/8 bg-white/72 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl sm:px-6 sm:py-2.5"
        )}
      >
        <div className="mx-auto max-w-[820px]">
          {sendError && (
            <p className="animate-fade-in mx-auto mb-2 flex max-w-lg items-start justify-center gap-1.5 text-center text-xs leading-relaxed font-bold text-red-600">
              <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{sendError}</span>
            </p>
          )}

          {!canPost ? (
            <div
              className={cn(
                "flex items-center justify-center gap-2 text-center text-[13px] font-semibold",
                youMode
                  ? "yc-notice"
                  : "rounded-[22px] border border-black/8 bg-black/[0.03] px-4 py-4 text-black/45"
              )}
            >
              <Megaphone className="h-4 w-4 shrink-0" />
              Только администраторы канала могут писать
            </div>
          ) : videoRecording ? (
            /* --- Панель записи видеокружка --- */
            <div
              className={cn(
                "animate-fade-in flex items-center gap-2 rounded-[22px] border border-purple-500/25 bg-purple-500/8 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5",
                youMode && "yc-record-panel"
              )}
            >
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
              <span className="shrink-0 font-mono text-sm font-bold text-purple-600 tabular-nums">
                {formatDuration(videoRecSeconds)}
              </span>
              {/* Анимированные полоски */}
              <span className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
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
                className="shrink-0 rounded-full p-1.5 text-black/45 transition hover:bg-black/5 hover:text-ink sm:p-2"
                aria-label="Отменить запись видео"
              >
                <X className="h-4.5 w-4.5" />
              </button>
              {/* Отправить */}
              <button
                onClick={stopVideoRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white transition hover:bg-purple-600 active:scale-95 sm:h-10 sm:w-10"
                aria-label="Отправить видеокружок"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
          ) : recording ? (
            <div
              className={cn(
                "animate-fade-in flex items-center gap-2 rounded-[22px] border border-red-500/25 bg-red-500/8 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5",
                youMode && "yc-record-panel"
              )}
            >
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
              <span className="shrink-0 font-mono text-sm font-bold text-red-600 tabular-nums">
                {formatDuration(recSeconds)}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
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
                className="shrink-0 rounded-full p-1.5 text-black/45 transition hover:bg-black/5 hover:text-ink sm:p-2"
                aria-label="Отменить запись"
              >
                <X className="h-4.5 w-4.5" />
              </button>
              <button
                onClick={stopRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600 active:scale-95 sm:h-10 sm:w-10"
                aria-label="Отправить голосовое"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
          ) : (
            <div className={cn("flex items-end gap-2", !youMode && "modern-fade-in")}>
              {youMode ? (
                <>
                  <div className="flex min-w-0 flex-1 items-end yc-composer">
                    <button onClick={() => fileRef.current?.click()} disabled={uploading || compressing || sending} className="yc-composer-icon shrink-0 disabled:opacity-50" aria-label="Прикрепить фото или видео" title="Фото или видео">
                      {uploading || compressing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" strokeWidth={1.8} />}
                    </button>
                    <button onClick={() => setStickerPickerOpen(true)} disabled={compressing || sending} className="yc-composer-icon shrink-0 disabled:opacity-50" aria-label="Открыть меню стикеров" title="Стикеры">
                      <Sticker className="h-5 w-5" strokeWidth={1.8} />
                    </button>
                    <textarea
                      ref={textRef}
                      rows={1}
                      defaultValue=""
                      enterKeyHint="send"
                      onInput={(e) => { const target = e.target as HTMLTextAreaElement; uncontrolledText.current = target.value; setHasText(target.value.trim().length > 0); autoResize(); notifyTyping(); }}
                      onCompositionEnd={(e) => { const target = e.target as HTMLTextAreaElement; uncontrolledText.current = target.value; setHasText(target.value.trim().length > 0); }}
                      onFocus={() => { if (textRef.current) { uncontrolledText.current = textRef.current.value; setHasText(textRef.current.value.trim().length > 0); } }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                      placeholder={chat.isSaved ? "Заметка" : "Сообщение"}
                      className="yc-composer-input max-h-32 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-[15px] font-medium outline-none sm:px-2"
                    />
                    <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.type.startsWith("video/")) sendVideoFile(f); else send({ image: f }); } e.target.value = ""; }} />
                  </div>
                  {hasText ? (
                    <button onClick={() => send()} disabled={sending || compressing} className="yc-send shrink-0 transition" aria-label="Отправить сообщение">
                      {sending && !uploading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.4} />}
                    </button>
                  ) : (
                    <>
                      <button onClick={startVideoRecording} disabled={sending || compressing} className="yc-send yc-send-tonal shrink-0 transition" aria-label="Записать видеокружок" title="Видеокружок"><Video className="h-5 w-5" strokeWidth={1.9} /></button>
                      <button onClick={startRecording} disabled={sending || compressing} className="yc-send shrink-0 transition" aria-label="Записать голосовое сообщение" title="Голосовое сообщение">{sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Mic className="h-5 w-5" strokeWidth={1.9} />}</button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* Одна пилюля: вложения + поле ввода */}
                  <div className="modern-composer flex min-w-0 flex-1 items-end gap-0.5 rounded-[26px] border border-black/8 px-1.5 py-1.5 shadow-sm">
                    <button onClick={() => fileRef.current?.click()} disabled={uploading || compressing || sending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black/45 transition hover:bg-accent/10 hover:text-accent active:scale-95 disabled:opacity-50" aria-label="Прикрепить фото или видео" title="Фото или видео">
                      {uploading || compressing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" strokeWidth={1.8} />}
                    </button>
                    <button onClick={() => setStickerPickerOpen(true)} disabled={compressing || sending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black/45 transition hover:bg-accent/10 hover:text-accent active:scale-95 disabled:opacity-50" aria-label="Открыть меню стикеров" title="Стикеры">
                      <Sticker className="h-5 w-5" strokeWidth={1.8} />
                    </button>
                    <textarea
                      ref={textRef}
                      rows={1}
                      defaultValue=""
                      enterKeyHint="send"
                      onInput={(e) => { const target = e.target as HTMLTextAreaElement; uncontrolledText.current = target.value; setHasText(target.value.trim().length > 0); autoResize(); notifyTyping(); }}
                      onCompositionEnd={(e) => { const target = e.target as HTMLTextAreaElement; uncontrolledText.current = target.value; setHasText(target.value.trim().length > 0); }}
                      onFocus={() => { if (textRef.current) { uncontrolledText.current = textRef.current.value; setHasText(textRef.current.value.trim().length > 0); } }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                      placeholder={chat.isSaved ? "Напишите заметку…" : "Напишите сообщение…"}
                      className="max-h-32 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-[15px] font-medium outline-none placeholder:text-black/30"
                    />
                    <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.type.startsWith("video/")) sendVideoFile(f); else send({ image: f }); } e.target.value = ""; }} />
                  </div>

                  {hasText ? (
                    <button onClick={() => send()} disabled={sending || compressing} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition hover:-translate-y-0.5 hover:brightness-105 active:scale-95 disabled:opacity-30" aria-label="Отправить сообщение">
                      {sending && !uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.4} />}
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button onClick={startVideoRecording} disabled={sending || compressing} className="hidden h-11 w-11 items-center justify-center rounded-full border border-black/8 bg-white/85 text-accent shadow-sm transition hover:-translate-y-0.5 hover:bg-white active:scale-95 disabled:opacity-40 sm:flex" aria-label="Записать видеокружок" title="Видеокружок">
                        <Video className="h-5 w-5" strokeWidth={1.9} />
                      </button>
                      <button onClick={startRecording} disabled={sending || compressing} className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition hover:-translate-y-0.5 hover:brightness-105 active:scale-95 disabled:opacity-40" aria-label="Записать голосовое сообщение" title="Голосовое">
                        {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Mic className="h-5 w-5" strokeWidth={1.9} />}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <p
            className={cn(
              "text-center",
              youMode
                ? "yc-hint"
                : "mt-1.5 font-mono text-[9px] tracking-wide text-black/30 sm:mt-2 sm:text-[10px]"
            )}
          >
            {compressing
              ? `сжимаем видео… ${Math.round(compressPct * 100)}%`
              : uploading
                ? "загрузка вложения…"
                : recording
                  ? "идёт запись — нажмите стрелку, чтобы отправить"
                  : !canPost
                    ? "Писать в канал могут только администраторы"
                    : chat.isSaved
                      ? "Заметки видны только вам и хранятся на этом устройстве"
                      : "Enter — отправить · микрофон — голосовое"}
          </p>
        </div>
      </footer>

      {/* Меню стикеров */}
      {stickerPickerOpen && (
        <StickerPanel
          meId={me.id}
          mode="picker"
          onClose={() => setStickerPickerOpen(false)}
          onSend={(url) => void send({ stickerUrl: url })}
          onSaved={(message) => {
            setSavedHint(message);
            window.clearTimeout(savedHintTimer.current);
            savedHintTimer.current = window.setTimeout(() => setSavedHint(null), 3600);
          }}
        />
      )}

      {/* Сохранить полученный стикер себе */}
      {stickerToSave && (
        <StickerPanel
          meId={me.id}
          mode="save"
          saveUrl={stickerToSave}
          onClose={() => setStickerToSave(null)}
          onSaved={(message) => {
            setSavedHint(message);
            window.clearTimeout(savedHintTimer.current);
            savedHintTimer.current = window.setTimeout(() => setSavedHint(null), 3600);
          }}
        />
      )}

      {/* Просмотр фото */}
      {lightbox && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/88 p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="absolute top-5 right-5 flex items-center gap-2">
            <button
              className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                if (lightbox) void saveMediaFile(lightbox, "photo");
              }}
              aria-label="Скачать фотографию в DCIM/WinChat/Photos"
              title="Скачать в DCIM/WinChat/Photos"
            >
              {downloading === lightbox ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Скачать</span>
            </button>
            <button
              className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
              onClick={() => setLightbox(null)}
              aria-label="Закрыть просмотр"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <img
            src={lightbox}
            alt="Фотография"
            className="animate-scale-in max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Подсказка о сохранении файла */}
      {savedHint && (
        <div className="animate-slide-up pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-center text-[12px] font-bold text-white shadow-2xl">
          {savedHint}
        </div>
      )}

      {/* Экран звонка */}
      {calls.status !== "idle" && (
        <CallOverlay
          status={calls.status}
          kind={calls.kind}
          peer={callPeer}
          title={chat.isGroup ? chat.title : null}
          peerStream={calls.peerStream}
          localStream={calls.localStream}
          elapsed={calls.elapsed}
          muted={calls.muted}
          camOff={calls.camOff}
          error={calls.error}
          onAccept={() => void calls.acceptCall()}
          onDecline={() => calls.declineCall()}
          onCancel={() => calls.endCall()}
          onEnd={() => calls.endCall()}
          onToggleMute={() => calls.toggleMute()}
          onToggleCamera={() => calls.toggleCamera()}
        />
      )}
    </div>
  );
}
