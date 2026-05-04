/**
 * Runtime configuration for Thinkora.
 *
 * These values are embedded in the built app. They are intentionally safe
 * to ship publicly:
 *   - SUPABASE_URL: public project URL
 *   - SUPABASE_ANON_KEY: public anon key (RLS protects data)
 *
 * Server-only secrets (Gemini API key, service role key) live in
 * Supabase Dashboard → Edge Functions → Secrets and never appear here.
 *
 * Fill these in after creating your Supabase project.
 */
export const SUPABASE_URL = 'https://tlklyotnzhlsxtvijpgc.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_odYWkHahyTTOchKXljgCMA_BVm4yrGK';

/** Name of the Edge Function that proxies Gemini calls. */
export const SUPABASE_GEMINI_FUNCTION = 'gemini';

/** Set true once the function is deployed to route AI calls through it. */
export const AI_PROXY_ENABLED = true;
