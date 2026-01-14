'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthedFetch } from '../../ui/api';
import { useUser } from "@clerk/nextjs";

type DocResponse = {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  access?: string;
  canWrite?: boolean;
};

type ActiveUser = { userId: string; username?: string; cursorPosition: number };

type Toast = {
  id: string;
  text: string;
  expiresAt: number;
};

function hashToHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

function colorForUser(userId: string): string {
  return `hsl(${hashToHue(userId)} 75% 45%)`;
}

function shortId(userId: string): string {
  if (!userId) return '';
  return userId.length <= 8 ? userId : `${userId.slice(0, 4)}…${userId.slice(-3)}`;
}

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function DocEditorPage() {
  const router = useRouter();
  const params = useParams();
  const docId = useMemo(() => String((params as any)?.id || ''), [params]);

  const authedFetch = useAuthedFetch();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [canWrite, setCanWrite] = useState<boolean>(true);
  const [serverVersion, setServerVersion] = useState<number>(0);

  const [meId, setMeId] = useState<string>('');
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const lastContentRef = useRef<string>('');
  const isApplyingRemoteRef = useRef<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const cursorSendRef = useRef<{ lastPos: number; lastSent: number; timer: any }>({ lastPos: -1, lastSent: 0, timer: null });

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, number>>({});
  const [remoteUsernames, setRemoteUsernames] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [overlayInset, setOverlayInset] = useState<{ left: number; top: number; lineHeight: number }>({ left: 1, top: 1, lineHeight: 18 });
  const [scrollTick, setScrollTick] = useState(0);

  const { user } = useUser();
  const myUsername = user?.username ?? user?.primaryEmailAddress?.emailAddress ?? "unknown";

  function pushToast(text: string) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const expiresAt = Date.now() + 2500;
    setToasts((t) => [...t, { id, text, expiresAt }]);
  }

  // Toast GC
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setToasts((xs) => xs.filter((x) => x.expiresAt > now));
    }, 250);
    return () => clearInterval(t);
  }, []);

  // Persist title changes (does not overwrite content)
  async function saveTitle(nextTitle: string) {
    if (!canWrite) return;
    const trimmed = (nextTitle || '').trim();
    try {
      await authedFetch(`/v1/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed.length ? trimmed : 'Untitled' }),
      });
    } catch (e) {
      // Best-effort; keep local title even if request fails
    }
  }

  function applyEdit(base: string, op: any): string {
    const type = op?.type;
    const pos = Number(op?.position ?? 0);
    const text = (op?.content ?? '').toString();
    const del = Number(op?.deleteCount ?? 0);

    try {
      if (type === 'insert') return base.slice(0, pos) + text + base.slice(pos);
      if (type === 'delete') return base.slice(0, pos) + base.slice(pos + del);
      if (type === 'replace') return base.slice(0, pos) + text + base.slice(pos + del);
      return base;
    } catch {
      return base;
    }
  }

  function computeEdit(prev: string, next: string) {
    if (prev === next) return null;

    let start = 0;
    while (start < prev.length && start < next.length && prev[start] === next[start]) start++;

    let endPrev = prev.length - 1;
    let endNext = next.length - 1;
    while (endPrev >= start && endNext >= start && prev[endPrev] === next[endNext]) {
      endPrev--;
      endNext--;
    }

    const deleteCount = Math.max(0, endPrev - start + 1);
    const inserted = next.slice(start, endNext + 1);

    let type: 'insert' | 'delete' | 'replace' = 'replace';
    if (deleteCount === 0 && inserted.length > 0) type = 'insert';
    else if (inserted.length === 0 && deleteCount > 0) type = 'delete';

    return {
      userId: meId,
      type,
      position: start,
      content: inserted,
      deleteCount,
      clientVersion: serverVersion,
    };
  }

  async function loadMe() {
    try {
      const res = await authedFetch('/v1/me');
      const data = await res.json().catch(() => ({} as any));
      const id = (data?.id || data?.userId || data?.clerkUserId || '').toString();
      setMeId(id);
    } catch {
      setMeId('');
    }
  }

  function sendCursor(pos: number) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !docId || !meId) return;

    const now = Date.now();
    const minIntervalMs = 60;

    // If same cursor pos, don't spam (but still allow occasional refresh).
    if (pos === cursorSendRef.current.lastPos && now - cursorSendRef.current.lastSent < 500) return;

    const nextAllowed = cursorSendRef.current.lastSent + minIntervalMs;
    if (now < nextAllowed) {
      if (cursorSendRef.current.timer) return;
      cursorSendRef.current.timer = window.setTimeout(() => {
        cursorSendRef.current.timer = null;
        sendCursor(pos);
      }, nextAllowed - now);
      return;
    }

    cursorSendRef.current.lastPos = pos;
    cursorSendRef.current.lastSent = now;

    try {
      ws.send(JSON.stringify({ type: 'cursor', documentId: docId, userId: meId, username: myUsername, cursorPosition: pos }));
    } catch {
      // ignore
    }
  }

  function sendCursorFromTextarea() {
    const ta = textareaRef.current;
    if (!ta) return;
    sendCursor(ta.selectionStart ?? 0);
  }

  function updateMirrorStyles() {
    const ta = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return;

    const cs = window.getComputedStyle(ta);

    // Mirror should match textarea content box (padding + font + width)
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflow = 'hidden';
    mirror.style.font = cs.font;
    mirror.style.fontSize = cs.fontSize;
    mirror.style.fontFamily = cs.fontFamily;
    mirror.style.fontWeight = cs.fontWeight;
    mirror.style.fontStyle = cs.fontStyle;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.style.lineHeight = cs.lineHeight;
    mirror.style.padding = cs.padding;
    mirror.style.width = `${ta.clientWidth}px`;

    const bLeft = parseFloat(cs.borderLeftWidth || '0') || 0;
    const bTop = parseFloat(cs.borderTopWidth || '0') || 0;
    const lh = parseFloat(cs.lineHeight || '0') || Math.round((parseFloat(cs.fontSize || '14') || 14) * 1.4);
    setOverlayInset({ left: bLeft, top: bTop, lineHeight: lh });
  }

  function getCaretCoords(pos: number): { left: number; top: number } | null {
    const ta = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return null;

    const full = (ta.value ?? '').toString();
    const p = Math.max(0, Math.min(pos, full.length));
    const before = full.slice(0, p);

    // Build mirror HTML. pre-wrap preserves whitespace; replace newline for reliable DOM flow.
    const html = escapeHtml(before).replace(/\n/g, '<br/>');

    mirror.innerHTML = `${html}<span id="__caret_marker__">\u200b</span>`;
    const marker = mirror.querySelector('#__caret_marker__') as HTMLElement | null;
    if (!marker) return null;

    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    return {
      left: markerRect.left - mirrorRect.left,
      top: markerRect.top - mirrorRect.top,
    };
  }

  function connectWs() {
    if (!docId) return;
    if (!meId) return;

    const base =
      (process.env.NEXT_PUBLIC_DOCS_WS_URL as string | undefined) ||
      'ws://localhost:8082/ws/docs';

    // Avoid duplicate connections
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setWsStatus('connecting');
    const ws = new WebSocket(base);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      ws.send(JSON.stringify({ type: 'join', documentId: docId, userId: meId, username: myUsername }));

      // Send initial cursor (best-effort)
      window.setTimeout(() => {
        try {
          sendCursorFromTextarea();
        } catch {}
      }, 50);
    };

    ws.onmessage = (ev) => {
      const msg = safeJsonParse(ev.data || '{}');
      if (!msg?.type) return;

      if (msg.type === 'init') {
        const newContent = (msg?.content ?? '').toString();
        isApplyingRemoteRef.current = true;
        setContent(newContent);
        lastContentRef.current = newContent;
        isApplyingRemoteRef.current = false;

        const users: ActiveUser[] = Array.isArray(msg?.activeUsers) ? msg.activeUsers : [];
        setActiveUsers(users);

        // Build initial cursor map excluding me
        const cursorMap: Record<string, number> = {};
        const nameMap: Record<string, string> = {};
        for (const u of users) {
          if (!u?.userId) continue;
          if (u.userId === meId) continue;
          cursorMap[u.userId] = Number(u.cursorPosition ?? 0);
          if (u.username) nameMap[u.userId] = String(u.username);
        }
        setRemoteCursors(cursorMap);
        if (Object.keys(nameMap).length) setRemoteUsernames((m) => ({ ...m, ...nameMap }));
        return;
      }

      if (msg.type === 'edit' && msg?.edit) {
        const op = msg.edit;
        isApplyingRemoteRef.current = true;
        setContent((cur) => {
          const updated = applyEdit((cur ?? '').toString(), op);
          lastContentRef.current = updated;
          return updated;
        });
        isApplyingRemoteRef.current = false;
        return;
      }

      if (msg.type === 'cursor') {
        const uid = (msg?.userId ?? '').toString();
        if (!uid || uid === meId) return;
        const pos = Number(msg?.cursorPosition ?? 0);
        const uname = (msg?.username ?? '').toString();
        if (uname) setRemoteUsernames((m) => ({ ...m, [uid]: uname }));
        setRemoteCursors((cur) => ({ ...cur, [uid]: pos }));
        return;
      }

      if (msg.type === 'user_joined') {
        const uid = (msg?.userId ?? '').toString();
        const uname = (msg?.username ?? '').toString();
        if (uid && uid !== meId) pushToast(`${uname || shortId(uid)} joined`);
        if (uname) setRemoteUsernames((m) => ({ ...m, [uid]: uname }));

        const users: ActiveUser[] = Array.isArray(msg?.activeUsers) ? msg.activeUsers : [];
        if (users.length) {
          setActiveUsers(users);
          const cursorMap: Record<string, number> = {};
          const nameMap: Record<string, string> = {};
          for (const u of users) {
            if (!u?.userId) continue;
            if (u.userId === meId) continue;
            cursorMap[u.userId] = Number(u.cursorPosition ?? 0);
            if (u.username) nameMap[u.userId] = String(u.username);
          }
          setRemoteCursors(cursorMap);
          if (Object.keys(nameMap).length) setRemoteUsernames((m) => ({ ...m, ...nameMap }));
        } else if (uid && uid !== meId) {
          // Best-effort if backend didn't send list
          setRemoteCursors((cur) => ({ ...cur, [uid]: cur[uid] ?? 0 }));
        }
        return;
      }

      if (msg.type === 'user_left') {
        const uid = (msg?.userId ?? '').toString();
        const uname = (msg?.username ?? '').toString();
        if (uid && uid !== meId) pushToast(`${uname || shortId(uid)} left`);
        if (uname) setRemoteUsernames((m) => ({ ...m, [uid]: uname }));
        if (uid) {
          setRemoteCursors((cur) => {
            const n = { ...cur };
            delete n[uid];
            return n;
          });
          setRemoteUsernames((cur) => {
            const n = { ...cur };
            delete n[uid];
            return n;
          });
          setActiveUsers((cur) => cur.filter((u) => u.userId !== uid));
        }
        return;
      }

      if (msg.type === 'error' && msg?.error) {
        pushToast(`Live error: ${(msg.error ?? '').toString()}`);
      }
    };

    ws.onerror = () => {
      setWsStatus('disconnected');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      wsRef.current = null;
    };
  }

  function disconnectWs() {
    const ws = wsRef.current;
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave', documentId: docId, userId: meId }));
      }
    } catch {}
    try {
      ws?.close();
    } catch {}
    wsRef.current = null;
    setWsStatus('disconnected');
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await authedFetch(`/v1/docs/${docId}`);
      const data: DocResponse = await res.json();
      setTitle(data.title || 'Untitled');
      setContent(data.content || '');
      lastContentRef.current = data.content || '';
      setServerVersion(data.version || 0);
      setCanWrite(data.canWrite !== false);
    } catch (e: any) {
      setError(e?.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!docId) return;
    load();
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  useEffect(() => {
    if (!docId || !meId) return;
    connectWs();
    return () => {
      disconnectWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, meId]);

  useEffect(() => {
    // Recompute mirror styles when textarea mounts or window resizes.
    const onResize = () => updateMirrorStyles();
    window.addEventListener('resize', onResize);
    updateMirrorStyles();
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const remoteCursorEntries = Object.entries(remoteCursors).filter(([uid]) => uid && uid !== meId);

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      {/* Toasts */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 1000,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: 'rgba(0,0,0,0.85)',
              color: '#fff',
              padding: '8px 10px',
              borderRadius: 10,
              fontSize: 13,
              maxWidth: 260,
              boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
            }}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Hidden mirror for caret measurements */}
      <div
        ref={mirrorRef}
        style={{
          position: 'absolute',
          left: -10000,
          top: 0,
          visibility: 'hidden',
        }}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Back
        </button>

        <input
          value={title}
          readOnly={!canWrite}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveTitle(title)}
          placeholder="Untitled"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            fontSize: 16,
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: '#666', fontSize: 13 }}>
        <div style={{ color: error ? '#b00020' : '#666' }}>{error ? error : ''}</div>
        <div style={{ opacity: 0.75 }}>Live: {wsStatus === 'connected' ? 'connected' : wsStatus === 'connecting' ? 'connecting' : 'off'}</div>
      </div>

      <div style={{ position: 'relative' }}>
        {/* Remote cursors overlay */}
        {wsStatus === 'connected' && remoteCursorEntries.length > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 2,
              left: overlayInset.left,
              top: overlayInset.top,
            }}
          >
            {remoteCursorEntries.map(([uid, pos]) => {
              // Force recompute on scroll via scrollTick
              void scrollTick;
              const coords = getCaretCoords(pos);
              if (!coords) return null;

              const ta = textareaRef.current;
              const scrollLeft = ta?.scrollLeft ?? 0;
              const scrollTop = ta?.scrollTop ?? 0;

              const left = coords.left - scrollLeft;
              const top = coords.top - scrollTop;

              const clr = colorForUser(uid);

              return (
                <div key={uid} style={{ position: 'absolute', left, top }}>
                  <div style={{ width: 2, height: overlayInset.lineHeight, background: clr }} />
                  <div
                    style={{
                      marginTop: 2,
                      padding: '2px 6px',
                      borderRadius: 999,
                      fontSize: 11,
                      background: clr,
                      color: '#fff',
                      maxWidth: 140,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {remoteUsernames[uid] || shortId(uid)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <textarea
          ref={textareaRef}
          readOnly={!canWrite}
          value={content}
          onChange={(e) => {
            if (!canWrite) return;
            const next = e.target.value;
            const prev = lastContentRef.current;

            setContent(next);
            lastContentRef.current = next;

            // Send a minimal edit op over WebSocket (best-effort).
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN && !isApplyingRemoteRef.current) {
              const op = computeEdit(prev, next);
              if (op) {
                ws.send(JSON.stringify({ type: 'edit', documentId: docId, userId: meId, edit: op }));
              }
            }

            // Also send cursor after change (best-effort).
            sendCursorFromTextarea();
          }}
          onKeyUp={() => sendCursorFromTextarea()}
          onMouseUp={() => sendCursorFromTextarea()}
          onSelect={() => sendCursorFromTextarea()}
          onScroll={() => {
            // Repaint overlay on scroll
            setScrollTick((x) => x + 1);
          }}
          onFocus={() => {
            updateMirrorStyles();
            sendCursorFromTextarea();
          }}
          placeholder={loading ? 'Loading…' : 'Start typing…'}
          style={{
            width: '100%',
            minHeight: '70vh',
            padding: 14,
            borderRadius: 12,
            border: '1px solid #ddd',
            fontSize: 15,
            lineHeight: 1.45,
            resize: 'vertical',
            position: 'relative',
            zIndex: 1,
          }}
        />
      </div>

      <div style={{ marginTop: 10, color: '#888', fontSize: 12 }}>
        Active: {Math.max(1, activeUsers.length || 1)}
      </div>
    </div>
  );
}
