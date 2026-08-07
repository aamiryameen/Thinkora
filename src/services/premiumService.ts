import { useCallback, useEffect, useState } from 'react';
import { REVENUECAT_ENTITLEMENT } from '../core/env';
import {
  addCustomerInfoListener,
  configurePurchases,
  fetchCustomerInfo,
  hasEntitlement,
} from './purchasesService';
import type { CustomerInfo } from 'react-native-purchases';

export type PremiumFeature =
  | 'planner_weekly'
  | 'planner_templates'
  | 'planner_custom_templates'
  | 'planner_auto_blocking'
  | 'planner_optimize'
  | 'planner_analytics'
  | 'planner_export'
  | 'planner_themes'
  | 'notebooks_unlimited'
  | 'notebooks_nested'
  | 'budget_limits'
  | 'budget_recurring'
  | 'budget_reports'
  | 'medicine_family'
  | 'medicine_inventory'
  | 'medicine_reports'
  | 'medicine_analytics'
  | 'medicine_sounds'
  | 'medicine_export'
  | 'whiteboard_unlimited'
  | 'whiteboard_export'
  | 'whiteboard_images'
  | 'whiteboard_layers'
  | 'whiteboard_align'
  | 'whiteboard_backgrounds'
  | 'whiteboard_templates'
  | 'whiteboard_versions'
  | 'whiteboard_presentation'
  | 'whiteboard_password'
  | 'whiteboard_archive'
  | 'note_fonts';

export const PREMIUM_FEATURE_LABELS: Record<PremiumFeature, string> = {
  planner_weekly: 'Weekly Planner',
  planner_templates: 'Planner Templates',
  planner_custom_templates: 'Custom Templates',
  planner_auto_blocking: 'Auto Time Blocking',
  planner_optimize: 'Smart Schedule Optimization',
  planner_analytics: 'Advanced Analytics',
  planner_export: 'PDF / Print Export',
  planner_themes: 'Premium Themes & Widgets',
  notebooks_unlimited: 'Unlimited Notebooks',
  notebooks_nested: 'Nested Folders',
  budget_limits: 'Budgets',
  budget_recurring: 'Recurring Expenses',
  budget_reports: 'Spending Reports',
  medicine_family: 'Family Profiles',
  medicine_inventory: 'Medicine Inventory',
  medicine_reports: 'Doctor Reports',
  medicine_analytics: 'Adherence Analytics',
  medicine_sounds: 'Reminder Sounds',
  medicine_export: 'Import & Export',
  whiteboard_unlimited: 'Unlimited Boards',
  whiteboard_export: 'Board Export',
  whiteboard_images: 'Unlimited Images',
  whiteboard_layers: 'Unlimited Layers',
  whiteboard_align: 'Alignment Tools',
  whiteboard_backgrounds: 'Custom Backgrounds',
  whiteboard_templates: 'Board Templates',
  whiteboard_versions: 'Version History',
  whiteboard_presentation: 'Presentation Mode',
  whiteboard_password: 'Protected Boards',
  whiteboard_archive: 'Duplicate & Archive',
  note_fonts: 'Premium Fonts',
};

interface Entitlement {
  active: boolean;
  since: number | null;
  source: 'none' | 'store';
}

const DEFAULT_ENTITLEMENT: Entitlement = { active: false, since: null, source: 'none' };

let cached: Entitlement | null = null;
let inFlight: Promise<Entitlement> | null = null;
const listeners = new Set<(e: Entitlement) => void>();

function emit(entitlement: Entitlement): void {
  cached = entitlement;
  listeners.forEach(fn => fn(entitlement));
}

function toEntitlement(info: CustomerInfo | null): Entitlement {
  if (!hasEntitlement(info)) return DEFAULT_ENTITLEMENT;

  const detail = info!.entitlements.active[REVENUECAT_ENTITLEMENT];
  const parsed = detail?.latestPurchaseDateMillis ?? null;

  return {
    active: true,
    since: typeof parsed === 'number' && !Number.isNaN(parsed) ? parsed : null,
    source: 'store',
  };
}

async function fetchEntitlement(): Promise<Entitlement> {
  return toEntitlement(await fetchCustomerInfo());
}

async function loadEntitlement(): Promise<Entitlement> {
  if (cached) return cached;
  if (!inFlight) {
    inFlight = fetchEntitlement()
      // A fresher result from a purchase already wrote `cached`; don't undo it.
      .then(e => { if (!cached) emit(e); return cached ?? e; })
      .catch(() => DEFAULT_ENTITLEMENT)
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

/** Call once during startup. Safe to call more than once. */
export async function initPremium(): Promise<void> {
  addCustomerInfoListener(info => {
    const next = toEntitlement(info);
    // Subscribers stay in `loading` until something is emitted, so always
    // emit the first answer even when it matches the default.
    if (cached && cached.active === next.active) return;
    emit(next);
  });

  await configurePurchases();
  await loadEntitlement();
}

export async function getEntitlement(): Promise<Entitlement> {
  return loadEntitlement();
}

export async function isPremium(): Promise<boolean> {
  return (await loadEntitlement()).active;
}

/** Re-read from the store, bypassing the cache. Use after purchase or restore. */
export async function refreshPremium(): Promise<boolean> {
  const next = await fetchEntitlement();
  emit(next);
  return next.active;
}

export function usePremium() {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(cached);

  useEffect(() => {
    let alive = true;
    loadEntitlement().then(e => { if (alive) setEntitlement(e); });
    const listener = (e: Entitlement) => setEntitlement(e);
    listeners.add(listener);
    return () => { alive = false; listeners.delete(listener); };
  }, []);

  const refresh = useCallback(async () => { await refreshPremium(); }, []);

  return {
    /** null while loading. */
    isPremium: entitlement?.active ?? null,
    /** false while loading, so nothing leaks. */
    hasPremium: entitlement?.active === true,
    loading: entitlement === null,
    since: entitlement?.since ?? null,
    refresh,
  };
}
