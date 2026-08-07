import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { REVENUECAT_ANDROID_KEY, REVENUECAT_ENTITLEMENT } from '../core/env';

let configurePromise: Promise<boolean> | null = null;
let configured = false;
/** Reason configure failed, if it did. Read by `lastOfferingsError`. */
let configureError: string | null = null;

type CustomerInfoListener = (info: CustomerInfo) => void;
const listeners = new Set<CustomerInfoListener>();

export function configurePurchases(): Promise<boolean> {
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    if (Platform.OS !== 'android') {
      configureError = `Not Android (${Platform.OS}).`;
      return false;
    }
    if (!REVENUECAT_ANDROID_KEY) {
      configureError = 'REVENUECAT_ANDROID_KEY is empty in this build.';
      return false;
    }

    try {
      // DEBUG everywhere: store problems only ever show up on a real
      // Play-installed build, so the full request/response trace has to be
      // available there — a silent SDK is why an empty paywall gave nothing
      // to go on.
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY });

      Purchases.addCustomerInfoUpdateListener(info => {
        listeners.forEach(fn => fn(info));
      });

      configured = true;
      return true;
    } catch (e: any) {
      // Recorded, not just logged: if configure fails, every purchase path
      // returns 'unavailable' and the paywall looks merely empty rather than
      // broken. The reason is shown in the sheet.
      configureError = `configure() threw: ${e?.message ?? String(e)}`;
      console.warn('[purchases]', configureError);
      return false;
    }
  })();

  return configurePromise;
}

export function isPurchasesConfigured(): boolean {
  return configured;
}

export function addCustomerInfoListener(fn: CustomerInfoListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function hasEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return info.entitlements.active[REVENUECAT_ENTITLEMENT] !== undefined;
}

/** Returns null when the store is unreachable, distinct from "not premium". */
export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  if (!(await configurePurchases())) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/**
 * Why the last offerings fetch came back empty.
 *
 * Surfaced in the paywall because this device class suppresses app logcat
 * output, so an on-screen reason is the only way to tell a configuration
 * failure apart from a genuine network problem.
 */
let lastOfferingsError: string | null = null;

/** Read through a function so callers always see the current value. */
export function getLastOfferingsError(): string | null {
  return lastOfferingsError;
}

export async function fetchOfferingPackages(): Promise<PurchasesPackage[]> {
  lastOfferingsError = null;
  if (!(await configurePurchases())) {
    lastOfferingsError = configureError ?? 'Store not configured (no API key or not Android).';
    return [];
  }
  try {
    const offerings = await Purchases.getOfferings();
    const current: PurchasesOffering | null = offerings.current;
    const packages = current?.availablePackages ?? [];

    // An empty result is almost never a code fault — it means Play returned no
    // products for this build (products not Active, app not installed from a
    // Play track, or the package name not matching the Play listing).
    //
    // Visible via `adb logcat -s ReactNativeJS` on devices that expose it.
    if (packages.length === 0) {
      lastOfferingsError =
        `Store returned no products. offering="${current?.identifier ?? 'none'}"`
        + ` all=[${Object.keys(offerings.all ?? {}).join(',')}]`;
      console.warn('[purchases]', lastOfferingsError);
    }
    return packages;
  } catch (e: any) {
    lastOfferingsError =
      `getOfferings failed: ${e?.underlyingErrorMessage ?? e?.message ?? String(e)}`;
    console.warn('[purchases]', lastOfferingsError);
    return [];
  }
}

export type PurchaseResult =
  | { status: 'success'; isPremium: true }
  /** Purchase succeeded but granted no entitlement — a dashboard misconfiguration. */
  | { status: 'no_entitlement' }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!(await configurePurchases())) return { status: 'unavailable' };

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (hasEntitlement(customerInfo)) return { status: 'success', isPremium: true };
    return { status: 'no_entitlement' };
  } catch (e: any) {
    if (e?.userCancelled) return { status: 'cancelled' };
    return { status: 'error', message: e?.message ?? 'Purchase could not be completed.' };
  }
}

export type RestoreResult =
  | { status: 'restored' }
  | { status: 'nothing_to_restore' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export async function restorePurchases(): Promise<RestoreResult> {
  if (!(await configurePurchases())) return { status: 'unavailable' };

  try {
    const info = await Purchases.restorePurchases();
    return hasEntitlement(info) ? { status: 'restored' } : { status: 'nothing_to_restore' };
  } catch (e: any) {
    return { status: 'error', message: e?.message ?? 'Could not restore purchases.' };
  }
}
