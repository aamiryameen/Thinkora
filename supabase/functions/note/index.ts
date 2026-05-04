/**
 * Public Note Viewer — returns a styled HTML page for a shared note.
 *
 * URL pattern: /functions/v1/note?id=<share_id>
 * Anyone with the link can view; the owner can revoke by deleting the row.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlPage(title: string, body: string, createdAt: string): string {
  const safeTitle = escapeHtml(title || 'Untitled');
  const safeBody = escapeHtml(body || '').replace(/\n/g, '<br>');
  const date = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} · Thinkora</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #6366F1 0%, #A855F7 100%);
      min-height: 100vh; color: #0F172A;
    }
    .wrap { max-width: 720px; margin: 0 auto; }
    .brand {
      display: flex; align-items: center; gap: 8px;
      color: #FFF; font-weight: 800; letter-spacing: 0.5px;
      font-size: 14px; margin-bottom: 24px;
    }
    .brand .dot {
      width: 28px; height: 28px; border-radius: 14px;
      background: #FBBF24; display: inline-flex;
      align-items: center; justify-content: center;
      font-size: 16px;
    }
    .card {
      background: #FFF; border-radius: 24px; padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    h1 {
      margin: 0 0 8px; font-size: 32px; font-weight: 900;
      line-height: 1.2; color: #0F172A;
    }
    .date {
      font-size: 13px; color: #94A3B8; font-weight: 600;
      margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px;
    }
    .body {
      font-size: 17px; line-height: 1.7; color: #1E293B;
      white-space: pre-wrap; word-wrap: break-word;
    }
    .footer {
      margin-top: 32px; padding-top: 20px;
      border-top: 1px solid #E2E8F0;
      font-size: 13px; color: #94A3B8; text-align: center;
    }
    .footer a { color: #6366F1; font-weight: 700; text-decoration: none; }
    @media (max-width: 600px) {
      body { padding: 16px; }
      .card { padding: 24px; border-radius: 16px; }
      h1 { font-size: 24px; }
      .body { font-size: 16px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <span class="dot">💡</span>
      <span>THINKORA</span>
    </div>
    <div class="card">
      <h1>${safeTitle}</h1>
      <div class="date">${date}</div>
      <div class="body">${safeBody}</div>
      <div class="footer">
        Shared with <a href="https://play.google.com/store/apps/details?id=com.thinkora">Thinkora</a> · Your second brain
      </div>
    </div>
  </div>
</body>
</html>`;
}

function notFoundPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Note not found</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>body{font-family:system-ui;margin:0;padding:48px;background:#0F172A;color:#F8FAFC;text-align:center}</style>
  </head><body><h1>Note not found</h1><p>This link has expired or been revoked.</p></body></html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const shareId = url.searchParams.get('id');
  if (!shareId) {
    return new Response(notFoundPage(), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const { data, error } = await supabase
    .from('public_shared_notes')
    .select('title, content, created_at, expires_at')
    .eq('share_id', shareId)
    .single();

  if (error || !data) {
    return new Response(notFoundPage(), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return new Response(notFoundPage(), {
      status: 410,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  // Increment view count (fire and forget)
  supabase.rpc('increment_share_view', { p_share_id: shareId }).then(() => {}).catch(() => {});

  return new Response(htmlPage(data.title, data.content, data.created_at), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
});
