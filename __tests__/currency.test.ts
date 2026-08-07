import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  findCurrency,
  formatCurrency,
} from '../src/core/currency';

describe('currency list', () => {
  it('has unique ISO codes', () => {
    const codes = CURRENCIES.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('gives every entry a symbol and a name', () => {
    CURRENCIES.forEach(c => {
      expect(c.symbol.length).toBeGreaterThan(0);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.code).toMatch(/^[A-Z]{3}$/);
    });
  });

  it('marks zero-decimal currencies correctly', () => {
    // Getting these wrong shows "¥1,000.00" for a currency with no minor unit.
    ['JPY', 'KRW', 'IDR', 'VND'].forEach(code => {
      expect(findCurrency(code).decimals).toBe(0);
    });
  });

  it('uses two decimals for the common case', () => {
    ['USD', 'EUR', 'GBP', 'PKR', 'INR'].forEach(code => {
      expect(findCurrency(code).decimals).toBe(2);
    });
  });

  it('defaults to USD', () => {
    expect(DEFAULT_CURRENCY.code).toBe('USD');
  });
});

describe('findCurrency', () => {
  it('resolves a known code', () => {
    expect(findCurrency('PKR').name).toBe('Pakistani Rupee');
  });

  it('falls back to the default for unknown, null or undefined', () => {
    expect(findCurrency('XYZ').code).toBe('USD');
    expect(findCurrency(null).code).toBe('USD');
    expect(findCurrency(undefined).code).toBe('USD');
    expect(findCurrency('').code).toBe('USD');
  });
});

describe('formatCurrency', () => {
  const usd = findCurrency('USD');
  const jpy = findCurrency('JPY');

  it('includes the amount digits', () => {
    expect(formatCurrency(1234.5, usd)).toContain('1,234.5');
  });

  it('omits decimals for whole amounts', () => {
    expect(formatCurrency(12, usd)).not.toContain('.00');
  });

  it('never shows decimals for a zero-decimal currency', () => {
    const out = formatCurrency(1000.4, jpy);
    expect(out).not.toContain('.');
  });

  it('marks negatives', () => {
    expect(formatCurrency(-50, usd)).toMatch(/-|\(/);
  });

  it('handles zero', () => {
    expect(formatCurrency(0, usd)).toContain('0');
  });

  it('produces a different string per currency', () => {
    const a = formatCurrency(100, usd);
    const b = formatCurrency(100, findCurrency('EUR'));
    expect(a).not.toBe(b);
  });

  it('formats every listed currency without throwing', () => {
    CURRENCIES.forEach(c => {
      expect(() => formatCurrency(1234.56, c)).not.toThrow();
      expect(formatCurrency(1234.56, c).length).toBeGreaterThan(0);
    });
  });

  it('survives an Intl failure by falling back to a prefixed symbol', () => {
    const original = Intl.NumberFormat;
    // Older Android JSC builds ship without full ICU data.
    (Intl as any).NumberFormat = function () { throw new Error('no ICU'); };
    try {
      const out = formatCurrency(50, usd);
      expect(out).toContain('50');
      expect(out).toContain('$');
    } finally {
      (Intl as any).NumberFormat = original;
    }
  });
});
