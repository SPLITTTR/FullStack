'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthedFetch } from '../../ui/api';

type DocResponse = {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export default function DocEditorPage() {
  const router = useRouter();
  const params = useParams();
  const docId = useMemo(() => String((params as any)?.id || ''), [params]);

  const authedFetch = useAuthedFetch();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [serverVersion, setServerVersion] = useState<number>(0);

  const [meId, setMeId] = useState<string>('');
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const lastContentRef = useRef<string>('');
  const isApplyingRemoteRef = useRef<boolean>(false);

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
      // If something goes out of bounds (rare concurrency edge), fall back to keeping base.
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
      // Non-fatal; collab can still run without a user id, but it is better with it.
      setMeId('');
    }
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
      ws.send(JSON.stringify({ type: 'join', documentId: docId, userId: meId }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        if (msg?.type === 'init') {
          const newContent = (msg?.content ?? '').toString();
          isApplyingRemoteRef.current = true;
          setContent(newContent);
          lastContentRef.current = newContent;
          isApplyingRemoteRef.current = false;
          return;
        }
        if (msg?.type === 'edit' && msg?.edit) {
          const op = msg.edit;
          // Apply remote edit to local state
          isApplyingRemoteRef.current = true;
          setContent((cur) => {
            const updated = applyEdit((cur ?? '').toString(), op);
            lastContentRef.current = updated;
            return updated;
          });
          isApplyingRemoteRef.current = false;
          return;
        }
      } catch {
        // ignore malformed
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
    try { ws?.close(); } catch {}
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
    } catch (e: any) {
      setError(e?.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const res = await authedFetch(`/v1/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const data: DocResponse = await res.json();
      setTitle(data.title || title);
      setContent(data.content || content);
      setServerVersion(data.version || serverVersion);
    } catch (e: any) {
      setError(e?.message || 'Failed to save document');
    } finally {
      setSaving(false);
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


  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
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
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #ddd',
            fontSize: 16,
          }}
        />

        {/* <button
          onClick={save}
          disabled={saving || loading}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #111',
            background: saving ? '#f5f5f5' : '#111',
            color: saving ? '#111' : '#fff',
            cursor: saving || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
          </button> */}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: '#666', fontSize: 13 }}>
        {/* <div>{loading ? 'Loading…' : `Version: ${serverVersion}`}</div> */}
        <div style={{ color: error ? '#b00020' : '#666' }}>{error ? error : ''}</div>
        <div style={{ opacity: 0.75 }}>Live: {wsStatus === 'connected' ? 'connected' : wsStatus === 'connecting' ? 'connecting' : 'off'}</div>
      </div>

      <textarea
        value={content}
        onChange={(e) => {
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
        }}
        placeholder="Start typing…"
        style={{
          width: '100%',
          minHeight: '70vh',
          padding: 14,
          borderRadius: 12,
          border: '1px solid #ddd',
          fontSize: 15,
          lineHeight: 1.45,
          resize: 'vertical',
        }}
      />
    </div>
  );
}
