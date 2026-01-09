'use client';

import { useAuth } from '@clerk/nextjs';

export type ItemType = 'FOLDER' | 'FILE' | 'DOC';

export interface ItemDto {
  id: string;
  parentId: string | null;
  type: ItemType;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  updatedAt: string;
}

function apiBase(): string {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!v) throw new Error('Missing NEXT_PUBLIC_API_BASE_URL in .env.local');
  return v;
}

export function useAuthedFetch() {
  const { getToken } = useAuth();

  return async function authedFetch(path: string, init?: RequestInit) {
    const token = await getToken();
    const headers = new Headers(init?.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // default JSON headers only if body is JSON; caller can override
    const res = await fetch(`${apiBase()}${path}`, { ...init, headers });

    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j: any = await res.json();
          msg = j?.error || j?.message || msg;
        } else {
          const t = await res.text();
          if (t) msg = t;
        }
      } catch {}
      throw new Error(msg);
    }

    return res;
  };
}
