/**
 * Entitlement logic tests.
 *
 * These cover the paths where a mistake costs real money or wrongly locks
 * a paying user out: reading the right entitlement, failing closed when
 * the store is unreachable, and mapping every purchase outcome correctly.
 *
 * The RevenueCat SDK is mocked — these assert our logic, not theirs.
 */

const mockPurchases = {
  configure: jest.fn(),
  setLogLevel: jest.fn().mockResolvedValue(undefined),
  addCustomerInfoUpdateListener: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
};

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockPurchases,
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

// react-native-config ships untranspiled and reads values injected at build
// time, so `.env` is stubbed here with the shape env.ts expects.
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    REVENUECAT_ANDROID_KEY: 'goog_test_key',
    REVENUECAT_ENTITLEMENT: 'premium',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
  },
}));

const ENTITLEMENT = 'premium';

/** A CustomerInfo whose named entitlements are active. */
function customerInfo(activeKeys: string[], purchaseMillis = 1_700_000_000_000) {
  const active: Record<string, any> = {};
  for (const key of activeKeys) {
    active[key] = {
      identifier: key,
      latestPurchaseDateMillis: purchaseMillis,
      latestPurchaseDate: new Date(purchaseMillis).toISOString(),
    };
  }
  return { entitlements: { active, all: active } };
}

describe('hasEntitlement', () => {
  let hasEntitlement: typeof import('../src/services/purchasesService').hasEntitlement;

  beforeEach(() => {
    jest.resetModules();
    hasEntitlement = require('../src/services/purchasesService').hasEntitlement;
  });

  it('is false for null customer info (store unreachable)', () => {
    expect(hasEntitlement(null)).toBe(false);
  });

  it('is false when no entitlements are active', () => {
    expect(hasEntitlement(customerInfo([]) as any)).toBe(false);
  });

  it('is true when the premium entitlement is active', () => {
    expect(hasEntitlement(customerInfo([ENTITLEMENT]) as any)).toBe(true);
  });

  it('is false when only some other entitlement is active', () => {
    // A different product must never unlock premium by accident.
    expect(hasEntitlement(customerInfo(['some_other_tier']) as any)).toBe(false);
  });
});

describe('premium entitlement resolution', () => {
  let premium: typeof import('../src/services/premiumService');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    premium = require('../src/services/premiumService');
  });

  it('fails closed when the store cannot be reached', async () => {
    mockPurchases.getCustomerInfo.mockRejectedValue(new Error('offline'));
    expect(await premium.isPremium()).toBe(false);
  });

  it('grants premium when the entitlement is active', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue(customerInfo([ENTITLEMENT]));
    expect(await premium.isPremium()).toBe(true);
  });

  it('denies premium when the entitlement is absent', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue(customerInfo([]));
    expect(await premium.isPremium()).toBe(false);
  });

  it('reads the purchase date from OUR entitlement, not whichever is first', async () => {
    // Regression guard: an unrelated entitlement listed first must not
    // supply the date we report for premium.
    const info = {
      entitlements: {
        active: {
          other_tier: { identifier: 'other_tier', latestPurchaseDateMillis: 111 },
          [ENTITLEMENT]: { identifier: ENTITLEMENT, latestPurchaseDateMillis: 999 },
        },
      },
    };
    mockPurchases.getCustomerInfo.mockResolvedValue(info);
    expect((await premium.getEntitlement()).since).toBe(999);
  });

  it('collapses concurrent first reads into a single store call', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue(customerInfo([ENTITLEMENT]));
    await Promise.all([premium.isPremium(), premium.isPremium(), premium.isPremium()]);
    expect(mockPurchases.getCustomerInfo).toHaveBeenCalledTimes(1);
  });

  it('reflects an expired subscription on refresh', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue(customerInfo([ENTITLEMENT]));
    expect(await premium.isPremium()).toBe(true);

    // Subscription lapses; a refresh must revoke access.
    mockPurchases.getCustomerInfo.mockResolvedValue(customerInfo([]));
    expect(await premium.refreshPremium()).toBe(false);
    expect(await premium.isPremium()).toBe(false);
  });
});

describe('purchase outcomes', () => {
  let purchases: typeof import('../src/services/purchasesService');
  const pkg = { identifier: 'annual', product: {} } as any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    purchases = require('../src/services/purchasesService');
  });

  it('reports success when the purchase grants the entitlement', async () => {
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: customerInfo([ENTITLEMENT]),
    });
    expect(await purchases.purchasePackage(pkg)).toEqual({ status: 'success', isPremium: true });
  });

  it('treats a user backing out as cancelled, not an error', async () => {
    mockPurchases.purchasePackage.mockRejectedValue({ userCancelled: true });
    expect(await purchases.purchasePackage(pkg)).toEqual({ status: 'cancelled' });
  });

  it('flags a purchase that unlocks nothing (dashboard misconfiguration)', async () => {
    // Charged, but the product was never attached to the entitlement.
    mockPurchases.purchasePackage.mockResolvedValue({ customerInfo: customerInfo([]) });
    expect(await purchases.purchasePackage(pkg)).toEqual({ status: 'no_entitlement' });
  });

  it('surfaces genuine purchase errors', async () => {
    mockPurchases.purchasePackage.mockRejectedValue({ userCancelled: false, message: 'Network down' });
    expect(await purchases.purchasePackage(pkg)).toEqual({ status: 'error', message: 'Network down' });
  });
});

describe('restore outcomes', () => {
  let purchases: typeof import('../src/services/purchasesService');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    purchases = require('../src/services/purchasesService');
  });

  it('restores when a prior purchase grants the entitlement', async () => {
    mockPurchases.restorePurchases.mockResolvedValue(customerInfo([ENTITLEMENT]));
    expect(await purchases.restorePurchases()).toEqual({ status: 'restored' });
  });

  it('reports nothing to restore rather than failing', async () => {
    mockPurchases.restorePurchases.mockResolvedValue(customerInfo([]));
    expect(await purchases.restorePurchases()).toEqual({ status: 'nothing_to_restore' });
  });

  it('surfaces restore errors', async () => {
    mockPurchases.restorePurchases.mockRejectedValue({ message: 'Play unavailable' });
    expect(await purchases.restorePurchases()).toEqual({ status: 'error', message: 'Play unavailable' });
  });
});

describe('offerings', () => {
  let purchases: typeof import('../src/services/purchasesService');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    purchases = require('../src/services/purchasesService');
  });

  it('returns an empty list when no offering is current (products not set up yet)', async () => {
    mockPurchases.getOfferings.mockResolvedValue({ current: null, all: {} });
    expect(await purchases.fetchOfferingPackages()).toEqual([]);
  });

  it('returns the current offering packages in dashboard order', async () => {
    const packages = [{ identifier: 'annual' }, { identifier: 'monthly' }];
    mockPurchases.getOfferings.mockResolvedValue({ current: { availablePackages: packages } });
    expect(await purchases.fetchOfferingPackages()).toEqual(packages);
  });

  it('returns an empty list rather than throwing when offerings fail to load', async () => {
    mockPurchases.getOfferings.mockRejectedValue(new Error('timeout'));
    expect(await purchases.fetchOfferingPackages()).toEqual([]);
  });
});
