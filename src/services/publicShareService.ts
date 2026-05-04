/**
 * Public Note Share — generates a shareable web link to a note. Uses raw
 * fetch() against Supabase REST + Auth APIs (no SDK; same approach as
 * syncService.ts to avoid the Hermes URL.protocol issue).
 *
 * Backend: see supabase/migrations/20260502000000_public_shared_notes.sql
 *           and supabase/functions/note/index.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/env';

const SESSION_KEY = 'thinkora_sync_session';

interface Session {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
}

async function getSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function shortId(): string {
  // 10-char URL-safe ID. Alphabet excludes ambiguous chars.
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 10; i++) id += alpha[Math.floor(Math.random() * alpha.length)];
  return id;
}

export interface PublicShare {
  share_id: string;
  url: string;
}

/** Create a public share for a note. Returns the share URL. */
export async function createPublicShare(
  noteTitle: string,
  noteText: string,
): Promise<PublicShare> {
  const session = await getSession();
  if (!session) throw new Error('Sign in to share notes via public link.');

  const shareId = shortId();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/public_shared_notes`, {
    method: 'POST',
    headers: {
      ...authHeaders(session.access_token),
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      share_id: shareId,
      user_id: session.user.id,
      title: noteTitle,
      content: noteText,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Could not create share link');
  }

  const url = `${SUPABASE_URL}/functions/v1/note?id=${shareId}`;
  return { share_id: shareId, url };
}

/** Revoke a previously-created public share. */
export async function revokePublicShare(shareId: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Not signed in');

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/public_shared_notes?share_id=eq.${shareId}`,
    {
      method: 'DELETE',
      headers: authHeaders(session.access_token),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Could not revoke share');
  }
}

/** List all of the user's active public shares. */
export async function listPublicShares(): Promise<{
  share_id: string; title: string; created_at: string; view_count: number;
}[]> {
  const session = await getSession();
  if (!session) return [];

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/public_shared_notes?user_id=eq.${session.user.id}&select=share_id,title,created_at,view_count&order=created_at.desc`,
    { headers: authHeaders(session.access_token) },
  );
  if (!res.ok) return [];
  return await res.json();
}
