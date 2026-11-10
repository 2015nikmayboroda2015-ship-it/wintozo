import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isGlobalAdmin, type ChatItem, type Profile } from "../lib/supabase";
import { uuid } from "../lib/utils";

/** Вид звонка: голосовой или с камерой. */
export type CallKind = "voice" | "video";

/** Состояния звонка. */
export type CallStatus = "idle" | "outgoing" | "incoming" | "connecting" | "active";

export interface IncomingCall {
  callId: string;
  from: Profile;
  kind: CallKind;
}

/** Сигнал через Supabase Realtime Broadcast. */
export interface CallSignal {
  type: "call_offer" | "call_answer" | "call_candidate" | "call_end";
  callId: string;
  from: string;
  to: string;
  kind?: CallKind;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

/** Длительность «дозвона» до автоотмены/автоотка. */
const CALL_TIMEOUT_MS = 60_000;

/** Получить медиastream нужного вида (микрофон / микрофон + камера). */
async function acquireMedia(kind: CallKind): Promise<MediaStream> {
  const audio: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true };
  const stream =
    kind === "video"
      ? await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio,
        })
      : await navigator.mediaDevices.getUserMedia({ audio });
  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("no-audio");
  }
  return stream;
}

/**
 * Сессия звонка для одного чата.
 *
 * Сигнализация — через Supabase Realtime Broadcast (канал `call:{chatId}`),
 * медиа — через WebRTC (RTCPeerConnection) между участниками личного чата.
 */
export function useCalls(chat: ChatItem, me: Profile) {
  const [status, setStatusState] = useState<CallStatus>("idle");
  const statusRef = useRef<CallStatus>("idle");
  const setStatus = useCallback((s: CallStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const [kind, setKindState] = useState<CallKind>("voice");
  const kindRef = useRef<CallKind>("voice");
  const setKind = useCallback((k: CallKind) => {
    kindRef.current = k;
    setKindState(k);
  }, []);

  const [incoming, setIncomingState] = useState<IncomingCall | null>(null);
  const incomingRef = useRef<IncomingCall | null>(null);
  const setIncoming = useCallback((v: IncomingCall | null) => {
    incomingRef.current = v;
    setIncomingState(v);
  }, []);

  const [peerStream, setPeerStreamState] = useState<MediaStream | null>(null);
  const peerStreamRef = useRef<MediaStream | null>(null);
  const setPeerStream = useCallback((s: MediaStream | null) => {
    peerStreamRef.current = s;
    setPeerStreamState(s);
  }, []);

  const [localStream, setLocalStreamState] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const setLocalStream = useCallback((s: MediaStream | null) => {
    localStreamRef.current = s;
    setLocalStreamState(s);
  }, []);

  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const callIdRef = useRef<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingOfferRef = useRef<{ sdp: string; callId: string; kind: CallKind } | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timersRef = useRef<number[]>([]);

  const meRef = useRef(me);
  meRef.current = me;
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const peerIdRef = useRef<string>(me.id);
  peerIdRef.current = chat.other?.id ?? me.id;

  /** Завершить медиа/сигнализацию текущей сессии. */
  const cleanup = useCallback(() => {
    callIdRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    peerStreamRef.current = null;
    setPeerStream(null);
    const pc = pcRef.current;
    pcRef.current = null;
    pc?.close();
    const stream = localStreamRef.current;
    localStreamRef.current = null;
    setLocalStream(null);
    stream?.getTracks().forEach((t) => t.stop());
    setStatus("idle");
    setElapsed(0);
  }, [setLocalStream, setPeerStream, setStatus]);

  const sendSignal = useCallback((sig: CallSignal) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: "broadcast", event: sig.type, payload: sig });
  }, []);

  /* ---------- входящий звонок от собеседника ---------- */
  useEffect(() => {
    if (chat.isSaved) return;
    const channel = supabase.channel(`call:${chat.id}`);
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "call_offer" }, async (p) => {
        const sig = p as unknown as CallSignal;
        if (sig.from === meRef.current.id) return;
        if (callIdRef.current && sig.callId !== callIdRef.current) return;
        // Для принимающей стороны фиксируем id звонка, чтобы корректно
        // ответить и завершить сессию (call_end) позже.
        callIdRef.current = sig.callId;
        const inc: IncomingCall = {
          callId: sig.callId,
          from: resolveProfile(chatRef.current, sig.from),
          kind: sig.kind ?? "voice",
        };
        setIncoming(inc);
        pendingOfferRef.current = { sdp: sig.sdp ?? "", callId: sig.callId, kind: inc.kind };
        setKind(inc.kind);
        setStatus("incoming");
      })
      .on("broadcast", { event: "call_answer" }, async (p) => {
        const sig = p as unknown as CallSignal;
        const callId = callIdRef.current;
        if (!callId || sig.callId !== callId) return;
        if (statusRef.current !== "outgoing" && statusRef.current !== "connecting") return;
        const pc = pcRef.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription({ type: "answer", sdp: sig.sdp ?? "" });
        } catch {
          return;
        }
        setStatus("active");
      })
      .on("broadcast", { event: "call_candidate" }, async (p) => {
        const sig = p as unknown as CallSignal;
        const callId = callIdRef.current;
        if (!callId || sig.callId !== callId) return;
        const pc = pcRef.current;
        if (!pc) return;
        try {
          if (pc.remoteDescription) await pc.addIceCandidate(sig.candidate ?? {});
          else pendingCandidatesRef.current.push(sig.candidate ?? {});
        } catch {
          /* ignore */
        }
      })
      .on("broadcast", { event: "call_end" }, (p) => {
        const sig = p as unknown as CallSignal;
        if (sig.from === meRef.current.id) return;
        if (callIdRef.current && sig.callId !== callIdRef.current) return;
        cleanup();
        setIncoming(null);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chat.id, chat.isSaved, cleanup, sendSignal]);

  /* ---------- таймауты звонка ---------- */
  useEffect(() => {
    const timers: number[] = [];
    timersRef.current = timers;
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };
    if (status === "incoming") {
      later(() => {
        sendSignal({ type: "call_end", callId: callIdRef.current ?? "", from: meRef.current.id, to: peerIdRef.current, kind: kindRef.current });
        cleanup();
        setIncoming(null);
      }, CALL_TIMEOUT_MS);
    }
    if (status === "outgoing") {
      later(() => cleanup(), CALL_TIMEOUT_MS);
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [status, cleanup, sendSignal]);

  /* ---------- таймер длительности звонка ---------- */
  useEffect(() => {
    if (status !== "active") return;
    setElapsed(0);
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [status]);

  /* ---------- выход из сессии при размонтировании ---------- */
  useEffect(
    () => () => {
      const ch = channelRef.current;
      if (ch) supabase.removeChannel(ch);
      channelRef.current = null;
      cleanup();
    },
    [cleanup]
  );

  /* ---------- начать исходящий звонок ---------- */
  const startCall = useCallback(
    async (k: CallKind) => {
      if (statusRef.current !== "idle") return;
      const c = chatRef.current;
      const peer = c.other;
      if (!peer || c.isGroup || c.isSaved) return;
      if (!isGlobalAdmin(meRef.current)) return;
      setError(null);
      setMuted(false);
      setCamOff(false);
      const callId = uuid();
      callIdRef.current = callId;
      kindRef.current = k;
      setKind(k);
      setStatus("outgoing");
      try {
        const stream = await acquireMedia(k);
        localStreamRef.current = stream;
        setLocalStream(stream);
        const pc = new RTCPeerConnection();
        pcRef.current = pc;
        pc.onicecandidate = (e) => {
          const cand = e.candidate;
          const id = callIdRef.current;
          if (!cand || !id) return;
          sendSignal({ type: "call_candidate", callId: id, from: meRef.current.id, to: peer.id, candidate: cand.toJSON() });
        };
        pc.ontrack = (e) => setPeerStream(e.streams[0] ?? null);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({ type: "call_offer", callId, from: meRef.current.id, to: peer.id, kind: k, sdp: offer.sdp ?? "" });
      } catch {
        cleanup();
        setError("Не удалось получить доступ к микрофону/камере. Проверьте разрешения в настройках браузера.");
      }
    },
    [cleanup, sendSignal, setKind, setLocalStream, setPeerStream, setStatus]
  );

  /* ---------- принять входящий звонок ---------- */
  const acceptCall = useCallback(async () => {
    if (statusRef.current !== "incoming") return;
    const inc = incomingRef.current;
    if (!inc) return;
    setStatus("connecting");
    try {
      const stream = await acquireMedia(inc.kind);
      localStreamRef.current = stream;
      setLocalStream(stream);
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.onicecandidate = (e) => {
        const cand = e.candidate;
        const id = callIdRef.current;
        if (!cand || !id) return;
        sendSignal({ type: "call_candidate", callId: id, from: meRef.current.id, to: inc.from.id, candidate: cand.toJSON() });
      };
      pc.ontrack = (e) => setPeerStream(e.streams[0] ?? null);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const pending = pendingOfferRef.current;
      if (!pending || pending.callId !== inc.callId) throw new Error("no pending offer");
      await pc.setRemoteDescription({ type: "offer", sdp: pending.sdp });
      const queued = pendingCandidatesRef.current;
      pendingCandidatesRef.current = [];
      for (const c of queued) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          /* ignore */
        }
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal({ type: "call_answer", callId: inc.callId, from: meRef.current.id, to: inc.from.id, kind: inc.kind, sdp: answer.sdp ?? "" });
      setStatus("active");
    } catch {
      cleanup();
      setIncoming(null);
    }
  }, [cleanup, sendSignal, setIncoming, setKind, setLocalStream, setPeerStream, setStatus]);

  /** Отклонить входящий звонок. */
  const declineCall = useCallback(() => {
    if (statusRef.current !== "incoming") return;
    const inc = incomingRef.current;
    const callId = inc?.callId ?? callIdRef.current ?? "";
    sendSignal({ type: "call_end", callId, from: meRef.current.id, to: peerIdRef.current, kind: kindRef.current });
    cleanup();
    setIncoming(null);
  }, [cleanup, sendSignal]);

  /** Завершить/отменить звонок (вызов, отмена, сброс). */
  const endCall = useCallback(() => {
    if (statusRef.current === "idle") return;
    const callId = callIdRef.current ?? "";
    sendSignal({ type: "call_end", callId, from: meRef.current.id, to: peerIdRef.current, kind: kindRef.current });
    cleanup();
    setIncoming(null);
  }, [cleanup, sendSignal]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !camOff;
    setCamOff(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
  }, [camOff]);

  return {
    status,
    kind,
    incoming,
    peerStream,
    localStream,
    muted,
    camOff,
    elapsed,
    error,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}

/** Собеседник по id внутри чата (личный диалог — собеседник; группа — не используется для звонков). */
function resolveProfile(chat: ChatItem, userId: string): Profile {
  const found = chat.members.find((p) => p.id === userId);
  const base = found ?? chat.other;
  if (base) return base;
  return {
    id: userId,
    username: userId,
    nickname: "Звонок",
    avatar_url: null,
    bio: null,
    created_at: "",
  };
}
