import {
  DASHBOARD_LAYOUTS,
  DEFAULT_LAYOUT,
  resolveDashboardLayout,
  type WidgetSpec,
} from '../src/core/dashboardLayouts';

/**
 * Mirrors the row-pairing logic in DashboardScreen. Kept in sync by the
 * "every layout renders every widget" tests below, which fail if the screen
 * and this helper diverge in behaviour.
 */
function buildRows(widgets: WidgetSpec[]): WidgetSpec[][] {
  const out: WidgetSpec[][] = [];
  let pending: WidgetSpec | null = null;

  widgets.forEach(w => {
    if (w.size === 'full') {
      if (pending) { out.push([pending]); pending = null; }
      out.push([w]);
      return;
    }
    if (pending) { out.push([pending, w]); pending = null; }
    else pending = w;
  });

  if (pending) out.push([pending]);
  return out;
}

describe('dashboard layouts', () => {
  it('has exactly one free layout, used as the default', () => {
    const free = DASHBOARD_LAYOUTS.filter(l => !l.premium);
    expect(free).toHaveLength(1);
    expect(DEFAULT_LAYOUT.premium).toBe(false);
  });

  it('has unique ids', () => {
    const ids = DASHBOARD_LAYOUTS.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts every layout with the greeting', () => {
    DASHBOARD_LAYOUTS.forEach(l => {
      expect(l.widgets[0].id).toBe('greeting');
    });
  });

  it('never repeats a widget within a layout', () => {
    DASHBOARD_LAYOUTS.forEach(l => {
      const ids = l.widgets.map(w => w.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});

describe('resolveDashboardLayout', () => {
  it('returns the free layout for a free user who selected a premium one', () => {
    const premium = DASHBOARD_LAYOUTS.find(l => l.premium)!;
    expect(resolveDashboardLayout(premium.id, false).id).toBe(DEFAULT_LAYOUT.id);
  });

  it('returns the premium layout once entitled', () => {
    const premium = DASHBOARD_LAYOUTS.find(l => l.premium)!;
    expect(resolveDashboardLayout(premium.id, true).id).toBe(premium.id);
  });

  it('falls back to the default for an unknown id', () => {
    expect(resolveDashboardLayout('no-such-layout', true).id).toBe(DEFAULT_LAYOUT.id);
    expect(resolveDashboardLayout('', false).id).toBe(DEFAULT_LAYOUT.id);
  });

  it('gives a free user the free layout even if it is the selected one', () => {
    expect(resolveDashboardLayout(DEFAULT_LAYOUT.id, false).id).toBe(DEFAULT_LAYOUT.id);
  });
});

describe('row pairing', () => {
  it('renders every widget exactly once, for every layout', () => {
    DASHBOARD_LAYOUTS.forEach(layout => {
      const rendered = buildRows(layout.widgets).flat().map(w => w.id);
      expect(rendered).toEqual(layout.widgets.map(w => w.id));
    });
  });

  it('never puts more than two widgets in a row', () => {
    DASHBOARD_LAYOUTS.forEach(layout => {
      buildRows(layout.widgets).forEach(row => {
        expect(row.length).toBeGreaterThanOrEqual(1);
        expect(row.length).toBeLessThanOrEqual(2);
      });
    });
  });

  it('keeps full-width widgets alone on their row', () => {
    DASHBOARD_LAYOUTS.forEach(layout => {
      buildRows(layout.widgets).forEach(row => {
        if (row.some(w => w.size === 'full')) expect(row).toHaveLength(1);
      });
    });
  });

  it('pairs consecutive half widgets', () => {
    const rows = buildRows([
      { id: 'water', label: 'w', size: 'half' },
      { id: 'mood', label: 'm', size: 'half' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(2);
  });

  it('flushes a dangling half widget before a full one', () => {
    const rows = buildRows([
      { id: 'water', label: 'w', size: 'half' },
      { id: 'calendar', label: 'c', size: 'full' },
    ]);
    expect(rows).toEqual([
      [{ id: 'water', label: 'w', size: 'half' }],
      [{ id: 'calendar', label: 'c', size: 'full' }],
    ]);
  });

  it('flushes a trailing half widget at the end', () => {
    const rows = buildRows([{ id: 'mood', label: 'm', size: 'half' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(1);
  });

  it('handles an empty widget list without throwing', () => {
    expect(buildRows([])).toEqual([]);
  });

  it('handles three consecutive half widgets', () => {
    const rows = buildRows([
      { id: 'water', label: 'a', size: 'half' },
      { id: 'mood', label: 'b', size: 'half' },
      { id: 'habits', label: 'c', size: 'half' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(2);
    expect(rows[1]).toHaveLength(1);
  });
});
