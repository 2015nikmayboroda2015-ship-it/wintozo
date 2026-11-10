import { useEffect, useRef } from "react";
import { LoaderCircle, Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import Avatar from "./Avatar";
import { chatSeed, type Profile } from "../lib/supabase";
import { formatDuration } from "../lib/utils";
import { cn } from "../utils/cn";
import type { CallKind, CallStatus } from "../hooks/useCalls";

interface Props {
  status: CallStatus;
  kind: CallKind;
  peer: Profile | null;
  title?: string | null;
  peerStream: MediaStream | null;
  localStream: MediaStream | null;
  elapsed: number;
  muted: boolean;
  camOff: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

function CallAvatar({ peer, kind }: { peer: Profile | null; kind: CallKind }) {
  const size = kind === "video" ? "xl" : "lg";
  const seed = peer
    ? chatSeed({
        id: peer.id,
        isGroup: false,
        title: peer.nickname,
        description: null,
        avatarUrl: peer.avatar_url,
        other: peer,
        members: [peer],
        ownerId: peer.id,
        lastMessage: null,
        updatedAt: "",
      })
    : "winchat";
  return (
    <div className="relative flex h-40 w-40 items-center justify-center sm:h-44 sm:w-44">
      <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
      <span className="absolute inset-0 animate-ping rounded-full bg-white/10 [animation-delay:0.7s]" />
      <Avatar profile={peer} name={peer?.nickname} avatarUrl={peer?.avatar_url} seed={seed} size={size} online={null} />
    </div>
  );
}

export default function CallOverlay({
  status,
  kind,
  peer,
  title,
  peerStream,
  localStream,
  elapsed,
  muted,
  camOff,
  error,
  onAccept,
  onDecline,
  onCancel,
  onEnd,
  onToggleMute,
  onToggleCamera,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.srcObject = peerStream;
      if (peerStream) el.play().catch(() => undefined);
    }
  }, [peerStream]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el) {
      el.srcObject = localStream;
      if (localStream) el.play().catch(() => undefined);
    }
  }, [localStream]);

  if (status === "idle") return null;

  const displayName = title ?? peer?.nickname ?? "Звонок";
  const subtitle = title ? `@${peer?.username ?? ""}` : kind === "video" ? "Видеозвонок" : "Голосовой звонок";
  const endBtn = (
    <button
      onClick={onEnd}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-95"
      aria-label="Завершить звонок"
    >
      <PhoneOff className="h-6 w-6" />
    </button>
  );
  const muteBtn = (
    <button
      onClick={onToggleMute}
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95",
        muted ? "bg-white/15 text-white" : "bg-white/10 text-white hover:bg-white/20"
      )}
      aria-label={muted ? "Включить микрофон" : "Выключить микрофон"}
    >
      {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
    </button>
  );
  const camBtn = (
    <button
      onClick={onToggleCamera}
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95",
        camOff ? "bg-white/15 text-white" : "bg-white/10 text-white hover:bg-white/20"
      )}
      aria-label={camOff ? "Включить камеру" : "Выключить камеру"}
    >
      {camOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
    </button>
  );

  /* ---------- Входящий звонок ---------- */
  if (status === "incoming") {
    return (
      <div className="animate-fade-in fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-ink px-6 text-white">
        <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-6">
          <CallAvatar peer={peer} kind={kind} />
          <div className="text-center">
            <p className="text-2xl font-extrabold tracking-tight">{displayName}</p>
            <p className="mt-1.5 text-sm font-semibold text-white/60">{subtitle}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onDecline}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-95"
              aria-label="Отклонить звонок"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
            <button
              onClick={onAccept}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-600 active:scale-95"
              aria-label="Принять звонок"
            >
              {kind === "video" ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Исходящий звонок (создание/ожидание) ---------- */
  if (status === "outgoing") {
    return (
      <div className="animate-fade-in fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-ink px-6 text-white">
        <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-6">
          <CallAvatar peer={peer} kind={kind} />
          <div className="text-center">
            <p className="text-2xl font-extrabold tracking-tight">{kind === "video" ? "Видеозвонок…" : "Звонок…"}</p>
            <p className="mt-1.5 text-sm font-semibold text-white/60">Подключение…</p>
          </div>
          <button
            onClick={onCancel}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-95"
            aria-label="Отменить звонок"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Соединение ---------- */
  if (status === "connecting") {
    return (
      <div className="animate-fade-in fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-ink px-6 text-white">
        <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-6">
          <CallAvatar peer={peer} kind={kind} />
          <LoaderCircle className="h-10 w-10 animate-spin text-white/80" />
          <p className="text-sm font-semibold text-white/70">Подключение…</p>
        </div>
      </div>
    );
  }

  /* ---------- Активный звонок ---------- */
  if (status === "active") {
    if (kind === "video") {
      return (
        <div className="animate-fade-in fixed inset-0 z-[90] overflow-hidden bg-black text-white">
          <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-4">
            <div className="flex items-center gap-3">
              <Avatar
                profile={peer}
                name={peer?.nickname}
                avatarUrl={peer?.avatar_url}
                seed={
                  peer
                    ? chatSeed({
                        id: peer.id,
                        isGroup: false,
                        title: peer.nickname,
                        description: null,
                        avatarUrl: peer.avatar_url,
                        other: peer,
                        members: [peer],
                        ownerId: peer.id,
                        lastMessage: null,
                        updatedAt: "",
                      })
                    : "winchat"
                }
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-extrabold text-white">{displayName}</p>
                <p className="font-mono text-[12px] font-semibold text-white/60">{formatDuration(elapsed)}</p>
              </div>
            </div>
          </div>
          {peerStream && localStream && (
            <div className="absolute right-4 top-20 h-20 w-28 overflow-hidden rounded-2xl shadow-xl ring-2 ring-white/30 sm:right-6 sm:top-24 sm:h-28 sm:w-36">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ transform: "scaleX(-1)" }}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-4">
            {muteBtn}
            {camBtn}
            {endBtn}
          </div>
        </div>
      );
    }

    /* ---------- Активный голосовой звонок ---------- */
    return (
      <div className="animate-fade-in fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-ink px-6 text-white">
        <div className="flex h-full w-full max-w-md flex-col items-center justify-between py-16">
          <CallAvatar peer={peer} kind={kind} />
          <p className="font-mono text-6xl font-bold tabular-nums text-white">{formatDuration(elapsed)}</p>
          <div className="flex items-center gap-4">{muteBtn}{endBtn}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-ink px-6 text-white">
        <p className="text-center text-sm font-bold text-red-400">{error}</p>
      </div>
    );
  }

  return null;
}
