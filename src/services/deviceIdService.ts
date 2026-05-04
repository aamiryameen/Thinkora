import { storage } from './storage';
import { generateId } from '../utils/id';

const DEVICE_ID_KEY = 'thinkora_device_id';

let cached: string | null = null;

/**
 * Returns a stable per-install device ID. Generated on first call and
 * persisted locally. Used for AI rate limiting — not personally identifying.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const existing = await storage.getSetting<string | null>(DEVICE_ID_KEY, null);
  if (existing && typeof existing === 'string' && existing.length >= 8) {
    cached = existing;
    return existing;
  }
  const fresh = `dev_${generateId()}${generateId().slice(0, 8)}`;
  await storage.setSetting(DEVICE_ID_KEY, fresh);
  cached = fresh;
  return fresh;
}
