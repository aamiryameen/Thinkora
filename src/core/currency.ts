export interface Currency {
  /** ISO 4217 code, used as the stored preference. */
  code: string;
  name: string;
  symbol: string;
  /** Minor units — 0 for JPY/KRW, 2 for most, 3 for KWD/BHD. */
  decimals: number;
}

/**
 * Curated list rather than every ISO code: a 180-item picker is worse than a
 * short one covering the currencies this app's users actually hold.
 */
export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimals: 2 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimals: 2 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
];

export const DEFAULT_CURRENCY = CURRENCIES[0];

export function findCurrency(code: string | null | undefined): Currency {
  return CURRENCIES.find(c => c.code === code) ?? DEFAULT_CURRENCY;
}

/**
 * Best-guess currency from the device locale, used only as the initial
 * default — the user's explicit choice always wins.
 */
export function guessCurrency(): Currency {
  try {
    const region = new Intl.NumberFormat().resolvedOptions().locale?.split('-')[1];
    const byRegion: Record<string, string> = {
      PK: 'PKR', IN: 'INR', GB: 'GBP', AE: 'AED', SA: 'SAR', BD: 'BDT',
      ID: 'IDR', PH: 'PHP', MY: 'MYR', SG: 'SGD', JP: 'JPY', CN: 'CNY',
      KR: 'KRW', TR: 'TRY', NG: 'NGN', ZA: 'ZAR', EG: 'EGP', KE: 'KES',
      BR: 'BRL', MX: 'MXN', CA: 'CAD', AU: 'AUD', CH: 'CHF', SE: 'SEK',
      PL: 'PLN', RU: 'RUB', TH: 'THB', VN: 'VND',
      DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR',
    };
    return findCurrency(region ? byRegion[region] : undefined);
  } catch {
    return DEFAULT_CURRENCY;
  }
}

/**
 * Formats an amount in the given currency.
 *
 * Uses Intl so symbol placement, grouping and decimal separators follow the
 * currency's own conventions — "1.234,56 €" in the eurozone, "₹1,23,456" with
 * Indian lakh grouping. Falls back to a plain prefix if Intl lacks the data,
 * which can happen on older Android JSC builds.
 */
export function formatCurrency(
  amount: number,
  currency: Currency,
  opts: { compact?: boolean } = {},
): string {
  const decimals = amount % 1 === 0 ? 0 : currency.decimals;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: currency.decimals,
      ...(opts.compact ? { notation: 'compact' } : {}),
    }).format(amount);
  } catch {
    const body = Math.abs(amount).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: currency.decimals,
    });
    return `${amount < 0 ? '-' : ''}${currency.symbol}${body}`;
  }
}
