// Thinkora — Gemini proxy Edge Function.
// Holds the Gemini API key server-side, rate limits per device, and
// forwards AI requests to Google's Gemini 1.5 Flash endpoint.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const DAILY_LIMIT = 20;
// `gemini-flash-latest` tracks Google's current-best Flash model, so we
// automatically benefit from upgrades without code changes. As of 2026
// this resolves to gemini-2.5-flash.
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type Action = 'summarize' | 'rewrite' | 'grammar' | 'tone' | 'subtasks';
type ToneStyle = 'formal' | 'casual' | 'friendly' | 'concise';

interface RequestBody {
  deviceId: string;
  action: Action;
  text: string;
  tone?: ToneStyle;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function buildPrompt(action: Action, text: string, tone?: ToneStyle): string {
  switch (action) {
    case 'summarize':
      return `Summarize the following note in 2-3 concise bullet points. Return only the bullets, no preamble.\n\n${text}`;
    case 'rewrite':
      return `Rewrite the following note to be clearer and better organized. Preserve all facts and meaning. Return only the rewritten text, no preamble.\n\n${text}`;
    case 'grammar':
      return `Fix grammar, spelling, and punctuation in the following text. Keep the original wording and tone as much as possible. Return only the corrected text, no preamble.\n\n${text}`;
    case 'tone': {
      const styles: Record<ToneStyle, string> = {
        formal: 'professional and formal',
        casual: 'casual and conversational',
        friendly: 'warm and friendly',
        concise: 'significantly shorter while keeping all key points',
      };
      const style = tone && styles[tone] ? styles[tone] : styles.friendly;
      return `Rewrite the following text in a ${style} tone. Preserve all facts. Return only the rewritten text, no preamble.\n\n${text}`;
    }
    case 'subtasks':
      return `Break the following task into 3 to 6 concrete, actionable subtasks.
Rules:
- Each subtask starts with an imperative verb (e.g. "Write", "Design", "Review", "Call").
- Each subtask is under 60 characters.
- Order them in the sequence they should be done.
- Return ONLY the subtasks, one per line, no numbering, no bullets, no preamble, no explanation.

Task:
${text}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Validate payload
  let payload: RequestBody;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { deviceId, action, text, tone } = payload ?? {};
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 128) {
    return jsonResponse({ error: 'Invalid deviceId' }, 400);
  }
  if (!action || !['summarize', 'rewrite', 'grammar', 'tone', 'subtasks'].includes(action)) {
    return jsonResponse({ error: 'Invalid action' }, 400);
  }
  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    return jsonResponse({ error: 'Text is too short' }, 400);
  }
  if (text.length > 8000) {
    return jsonResponse({ error: 'Text is too long (max 8000 chars)' }, 400);
  }

  // Rate limit via Postgres
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }
  if (!geminiKey) {
    return jsonResponse({ error: 'Gemini key not configured on server' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: newCount, error: rpcError } = await supabase.rpc('increment_ai_usage', {
    p_device_id: deviceId,
    p_daily_limit: DAILY_LIMIT,
  });

  if (rpcError) {
    console.error('rate limit rpc error', rpcError);
    return jsonResponse({ error: 'Rate limit check failed' }, 500);
  }
  if (newCount === -1) {
    return jsonResponse(
      { error: 'Daily AI limit reached. Try again tomorrow or add your own Gemini key in Settings.', limit: DAILY_LIMIT },
      429,
    );
  }

  // Call Gemini (with one automatic retry on transient errors)
  const prompt = buildPrompt(action, text.trim(), tone);
  const temperature =
    action === 'grammar' ? 0.2 :
    action === 'subtasks' ? 0.3 :
    action === 'rewrite' ? 0.6 : 0.4;
  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: 1024 },
  });

  async function callGemini(): Promise<Response> {
    return fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(geminiKey!)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });
  }

  let geminiRes: Response;
  try {
    geminiRes = await callGemini();
    // Retry once on transient failures (503 overloaded, 500 internal)
    if (geminiRes.status === 503 || geminiRes.status === 500) {
      console.warn(`gemini returned ${geminiRes.status}, retrying once after 1s`);
      await new Promise((r) => setTimeout(r, 1000));
      geminiRes = await callGemini();
    }
  } catch (err) {
    console.error('gemini fetch error', err);
    return jsonResponse({ error: 'Upstream AI request failed' }, 502);
  }

  if (geminiRes.status === 429) {
    return jsonResponse({ error: 'AI service is busy. Try again in a minute.' }, 429);
  }
  if (geminiRes.status === 503) {
    return jsonResponse(
      { error: 'AI is temporarily overloaded. Please try again in a few seconds.' },
      503,
    );
  }
  if (!geminiRes.ok) {
    const body = await geminiRes.text().catch(() => '');
    console.error('gemini error', geminiRes.status, body);
    return jsonResponse({ error: `Gemini error (${geminiRes.status})` }, 502);
  }

  const json = await geminiRes.json().catch(() => null);
  const candidate = json?.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish === 'SAFETY' || finish === 'RECITATION') {
    return jsonResponse({ error: 'Request declined for safety reasons.' }, 422);
  }
  const result: string | undefined = candidate?.content?.parts
    ?.map((p: { text?: string }) => p?.text ?? '')
    .join('')
    .trim();

  if (!result) {
    return jsonResponse({ error: 'Empty response from AI' }, 502);
  }

  return jsonResponse({
    result,
    usage: { used: newCount, limit: DAILY_LIMIT, remaining: DAILY_LIMIT - newCount },
  });
});
