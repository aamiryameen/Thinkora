/**
 * Cloud sync service — uses raw fetch() against Supabase REST + Auth APIs.
 *
 * We intentionally avoid createClient() because the @supabase/supabase-js
 * RealtimeClient constructor mutates URL.protocol, which throws on Hermes
 * (React Native) where URL properties are read-only getters.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/env';
import { storage } from './storage';
import type {
  Note, Folder, Tag, Reminder, Task, TaskCategory, AppSettings,
} from '../types';

// ─── Storage key for persisting the session token ─────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'thinkora_sync_session';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncUser {
  id: string;
  email: string;
}

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
}

// ─── Session helpers ──────────────────────────────────────────────────────────

async function saveSession(session: SupabaseSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function loadSession(): Promise<SupabaseSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

async function getAccessToken(): Promise<string | null> {
  const session = await loadSession();
  if (!session) return null;

  // Try to refresh if we have a refresh token (simple heuristic: always refresh on load)
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        await saveSession({ ...data, user: data.user ?? session.user });
        return data.access_token;
      }
    }
  } catch {}

  return session.access_token;
}

function authHeaders(accessToken?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  };
  if (accessToken) h['Authorization'] = `Bearer ${accessToken}`;
  return h;
}

async function authedHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not signed in');
  return authHeaders(token);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export class EmailConfirmationRequired extends Error {
  constructor() { super('EMAIL_CONFIRMATION_REQUIRED'); }
}

export async function signUp(email: string, password: string): Promise<SyncUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.msg ?? 'Sign up failed');
  if (!data.user) throw new Error('Sign up failed. Please try again.');

  // Email confirmation required — no access_token issued yet
  if (!data.access_token) throw new EmailConfirmationRequired();

  await saveSession(data);
  return { id: data.user.id, email: data.user.email };
}

export async function signIn(email: string, password: string): Promise<SyncUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.msg ?? 'Sign in failed');
  await saveSession(data);
  return { id: data.user.id, email: data.user.email };
}

export async function signOut(): Promise<void> {
  try {
    const token = await getAccessToken();
    if (token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: authHeaders(token),
      });
    }
  } catch {}
  await clearSession();
}

export async function getCurrentUser(): Promise<SyncUser | null> {
  const session = await loadSession();
  if (!session) return null;
  return { id: session.user.id, email: session.user.email };
}

export async function resetPassword(email: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error_description ?? data.msg ?? 'Failed to send reset email');
  }
}

// ─── Backup ───────────────────────────────────────────────────────────────────

export interface BackupPayload {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  reminders: Reminder[];
  tasks: Task[];
  taskCategories: TaskCategory[];
  settings: AppSettings;
  backedUpAt: number;
  appVersion: string;
}

export async function backupToCloud(): Promise<void> {
  const session = await loadSession();
  if (!session) throw new Error('Not signed in');
  const token = await getAccessToken();
  if (!token) throw new Error('Session expired — please sign in again');

  const [notes, folders, tags, reminders, tasks, taskCategories, settings] = await Promise.all([
    storage.getNotes(),
    storage.getFolders(),
    storage.getTags(),
    storage.getReminders(),
    storage.getTasks(),
    storage.getTaskCategories(),
    storage.getSettings(),
  ]);

  const payload: BackupPayload = {
    notes, folders, tags, reminders, tasks, taskCategories, settings,
    backedUpAt: Date.now(),
    appVersion: '2.0',
  };

  // Upsert via PostgREST
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_backups`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: session.user.id,
      data: payload,
      backed_up_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Backup failed');
  }
}

export async function restoreFromCloud(): Promise<BackupPayload> {
  const session = await loadSession();
  if (!session) throw new Error('Not signed in');
  const token = await getAccessToken();
  if (!token) throw new Error('Session expired — please sign in again');

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_backups?user_id=eq.${session.user.id}&select=data,backed_up_at`,
    { headers: authHeaders(token) }
  );

  if (!res.ok) throw new Error('Could not fetch backup');

  const rows = await res.json();
  if (!rows || rows.length === 0) throw new Error('No backup found. Back up your data first.');
  const payload = rows[0].data as BackupPayload;

  await Promise.all([
    storage.setNotes(payload.notes ?? []),
    storage.setFolders(payload.folders ?? []),
    storage.setTags(payload.tags ?? []),
    storage.setReminders(payload.reminders ?? []),
    storage.setTasks(payload.tasks ?? []),
    storage.setTaskCategories(payload.taskCategories ?? []),
    storage.setSettings(payload.settings),
  ]);

  return payload;
}

export async function getLastBackupInfo(): Promise<{ backedUpAt: string } | null> {
  const session = await loadSession();
  if (!session) return null;
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_backups?user_id=eq.${session.user.id}&select=backed_up_at`,
      { headers: authHeaders(token) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows || rows.length === 0) return null;
    return { backedUpAt: rows[0].backed_up_at };
  } catch {
    return null;
  }
}
