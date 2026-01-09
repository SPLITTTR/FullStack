'use client';

import { useEffect, useMemo, useState } from 'react';
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

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await authedFetch(`/v1/docs/${docId}`);
      const data: DocResponse = await res.json();
      setTitle(data.title || 'Untitled');
      setContent(data.content || '');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

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

        <button
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
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: '#666', fontSize: 13 }}>
        <div>{loading ? 'Loading…' : `Version: ${serverVersion}`}</div>
        <div style={{ color: error ? '#b00020' : '#666' }}>{error ? error : ''}</div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
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
