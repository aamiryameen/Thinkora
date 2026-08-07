/**
 * Planner export (premium) — render a day or a week as a print-ready HTML
 * document saved to Downloads, then offer the system share sheet.
 *
 * The app has no native PDF renderer bundled, so we emit HTML with an
 * `@page` print stylesheet: opening it and choosing Print → Save as PDF
 * produces a clean, paginated PDF. This mirrors the existing
 * pdfExportService approach and keeps the export dependency-free.
 */

import { Alert, Platform, PermissionsAndroid, Share } from 'react-native';
import RNFS from 'react-native-fs';
import type { Habit, Task } from '../types';
import type { PlannerBlock, PlannerDay } from '../types/planner';
import { formatDuration, formatMinutes, fromDateKey } from '../core/plannerTime';

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function longDate(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function shortDate(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

const PRINT_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", sans-serif; color: #1F2937; margin: 0; padding: 24px; }
  h1 { font-size: 24px; margin: 0 0 4px; color: #111827; }
  h2 { font-size: 15px; margin: 26px 0 10px; color: #374151; text-transform: uppercase; letter-spacing: .08em; }
  .sub { color: #6B7280; font-size: 12px; margin: 0 0 18px; }
  .focus { background: #EEF2FF; border-left: 4px solid #6366F1; padding: 12px 16px; border-radius: 6px; margin-bottom: 18px; }
  .focus-label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #6366F1; font-weight: 700; }
  .focus-text { font-size: 15px; font-weight: 600; margin-top: 4px; }
  .stats { display: flex; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
  .stat { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 14px; min-width: 96px; }
  .stat-num { font-size: 20px; font-weight: 700; color: #111827; }
  .stat-label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #EEF0F4; font-size: 12px; vertical-align: top; }
  th { background: #F9FAFB; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #6B7280; }
  td.time { white-space: nowrap; color: #6B7280; font-variant-numeric: tabular-nums; width: 130px; }
  .swatch { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
  .kind { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: .05em; }
  .done { color: #9CA3AF; text-decoration: line-through; }
  ul.checks { list-style: none; padding: 0; margin: 0; }
  ul.checks li { padding: 7px 0; border-bottom: 1px solid #F3F4F6; font-size: 13px; }
  .box { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #9CA3AF; border-radius: 3px; margin-right: 9px; vertical-align: -1px; }
  .box.checked { background: #10B981; border-color: #10B981; }
  .notes { border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; font-size: 13px; white-space: pre-wrap; line-height: 1.55; min-height: 60px; }
  .empty { color: #9CA3AF; font-size: 12px; font-style: italic; }
  .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
  .wday { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; page-break-inside: avoid; }
  .wday h3 { font-size: 11px; margin: 0 0 8px; color: #374151; }
  .witem { font-size: 9.5px; padding: 4px 5px; border-radius: 4px; margin-bottom: 4px; background: #F3F4F6; line-height: 1.3; }
  .wtime { color: #6B7280; font-size: 8.5px; display: block; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF; }
  @media print { body { padding: 0; } .no-print { display: none; } }
`;

function checkList(items: { title: string; completed: boolean }[], emptyText: string): string {
  if (items.length === 0) return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  return `<ul class="checks">${items
    .map(i => `<li><span class="box${i.completed ? ' checked' : ''}"></span><span class="${i.completed ? 'done' : ''}">${escapeHtml(i.title)}</span></li>`)
    .join('')}</ul>`;
}

function blocksTable(blocks: PlannerBlock[]): string {
  if (blocks.length === 0) {
    return '<p class="empty">No time blocks scheduled.</p>';
  }
  const rows = [...blocks]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map(b => `<tr>
      <td class="time">${escapeHtml(formatMinutes(b.startMinutes))} – ${escapeHtml(formatMinutes(b.startMinutes + b.durationMinutes))}</td>
      <td>
        <span class="swatch" style="background:${escapeHtml(b.color)}"></span>
        <span class="${b.completed ? 'done' : ''}"><strong>${escapeHtml(b.title)}</strong></span>
        ${b.notes ? `<div style="color:#6B7280;margin-top:3px">${escapeHtml(b.notes)}</div>` : ''}
      </td>
      <td class="kind">${escapeHtml(b.kind)}</td>
      <td class="time">${escapeHtml(formatDuration(b.durationMinutes))}</td>
      <td>${b.completed ? '✓' : ''}</td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th>Time</th><th>Block</th><th>Type</th><th>Length</th><th>Done</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export interface DayExportInput {
  date: string;
  day: PlannerDay;
  blocks: PlannerBlock[];
  tasks: Task[];
  habits: Habit[];
}

export function buildDayHtml({ date, day, blocks, tasks, habits }: DayExportInput): string {
  const plannedMinutes = blocks.reduce((s, b) => s + b.durationMinutes, 0);
  const doneBlocks = blocks.filter(b => b.completed).length;
  const dayTasks = tasks.filter(t => !t.completed);
  const dueHabits = habits.filter(h => !h.archived);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily Plan — ${escapeHtml(longDate(date))}</title>
  <style>${PRINT_CSS}</style></head><body>
    <h1>Daily Plan</h1>
    <p class="sub">${escapeHtml(longDate(date))}</p>

    ${day.focus.trim()
      ? `<div class="focus"><div class="focus-label">Today's focus</div><div class="focus-text">${escapeHtml(day.focus)}</div></div>`
      : ''}

    <div class="stats">
      <div class="stat"><div class="stat-num">${blocks.length}</div><div class="stat-label">Blocks</div></div>
      <div class="stat"><div class="stat-num">${doneBlocks}</div><div class="stat-label">Completed</div></div>
      <div class="stat"><div class="stat-num">${escapeHtml(formatDuration(plannedMinutes))}</div><div class="stat-label">Planned</div></div>
      <div class="stat"><div class="stat-num">${day.dailyGoals.filter(g => g.completed).length}/${day.dailyGoals.length}</div><div class="stat-label">Goals</div></div>
    </div>

    <h2>Top Priorities</h2>
    ${checkList(day.topPriorities.map(p => ({ title: p.title, completed: p.completed })), 'No priorities set for this day.')}

    <h2>Schedule</h2>
    ${blocksTable(blocks)}

    <h2>Daily Goals</h2>
    ${checkList(day.dailyGoals.map(g => ({ title: g.title, completed: g.completed })), 'No daily goals set.')}

    ${dueHabits.length > 0 ? `<h2>Habits</h2>${checkList(
      dueHabits.map(h => ({ title: h.name, completed: (h.completedDates ?? []).includes(date) })), '')}` : ''}

    ${dayTasks.length > 0 ? `<h2>Open Tasks</h2>${checkList(
      dayTasks.slice(0, 25).map(t => ({ title: t.title, completed: false })), '')}` : ''}

    <h2>Notes</h2>
    <div class="notes">${day.notes.trim() ? escapeHtml(day.notes) : '&nbsp;'}</div>

    <p class="footer">Exported from Thinkora on ${escapeHtml(new Date().toLocaleString())}</p>
  </body></html>`;
}

export interface WeekExportInput {
  startKey: string;
  endKey: string;
  days: PlannerDay[];
  blocksByDate: Record<string, PlannerBlock[]>;
  dateKeys: string[];
}

export function buildWeekHtml({ startKey, endKey, days, blocksByDate, dateKeys }: WeekExportInput): string {
  const dayByKey = new Map(days.map(d => [d.date, d]));
  const allBlocks = dateKeys.flatMap(k => blocksByDate[k] ?? []);
  const plannedMinutes = allBlocks.reduce((s, b) => s + b.durationMinutes, 0);
  const doneCount = allBlocks.filter(b => b.completed).length;

  const columns = dateKeys.map(key => {
    const blocks = [...(blocksByDate[key] ?? [])].sort((a, b) => a.startMinutes - b.startMinutes);
    const day = dayByKey.get(key);
    const items = blocks.length === 0
      ? '<p class="empty" style="font-size:9px">Nothing planned</p>'
      : blocks.map(b => `<div class="witem" style="border-left:3px solid ${escapeHtml(b.color)}">
          <span class="wtime">${escapeHtml(formatMinutes(b.startMinutes))}</span>
          <span class="${b.completed ? 'done' : ''}">${escapeHtml(b.title)}</span>
        </div>`).join('');
    const focus = day?.focus.trim()
      ? `<div style="font-size:9px;color:#6366F1;font-weight:600;margin-bottom:6px">★ ${escapeHtml(day.focus)}</div>`
      : '';
    return `<div class="wday"><h3>${escapeHtml(shortDate(key))}</h3>${focus}${items}</div>`;
  }).join('');

  const goalRows = dateKeys.map(key => {
    const day = dayByKey.get(key);
    if (!day || (day.dailyGoals.length === 0 && day.topPriorities.length === 0)) return '';
    const entries = [
      ...day.topPriorities.map(p => ({ title: `★ ${p.title}`, completed: p.completed })),
      ...day.dailyGoals.map(g => ({ title: g.title, completed: g.completed })),
    ];
    return `<tr><td class="time">${escapeHtml(shortDate(key))}</td><td>${entries
      .map(e => `<div><span class="box${e.completed ? ' checked' : ''}"></span><span class="${e.completed ? 'done' : ''}">${escapeHtml(e.title)}</span></div>`)
      .join('')}</td></tr>`;
  }).filter(Boolean).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weekly Plan — ${escapeHtml(shortDate(startKey))} to ${escapeHtml(shortDate(endKey))}</title>
  <style>${PRINT_CSS} @page { size: A4 landscape; margin: 12mm; }</style></head><body>
    <h1>Weekly Plan</h1>
    <p class="sub">${escapeHtml(shortDate(startKey))} — ${escapeHtml(shortDate(endKey))}</p>

    <div class="stats">
      <div class="stat"><div class="stat-num">${allBlocks.length}</div><div class="stat-label">Blocks</div></div>
      <div class="stat"><div class="stat-num">${doneCount}</div><div class="stat-label">Completed</div></div>
      <div class="stat"><div class="stat-num">${escapeHtml(formatDuration(plannedMinutes))}</div><div class="stat-label">Planned</div></div>
      <div class="stat"><div class="stat-num">${dateKeys.filter(k => (blocksByDate[k] ?? []).length > 0).length}/7</div><div class="stat-label">Days planned</div></div>
    </div>

    <h2>Week at a glance</h2>
    <div class="week">${columns}</div>

    ${goalRows ? `<h2>Goals &amp; Priorities</h2><table><tbody>${goalRows}</tbody></table>` : ''}

    <p class="footer">Exported from Thinkora on ${escapeHtml(new Date().toLocaleString())}</p>
  </body></html>`;
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const sdkInt = Number(Platform.Version);
  if (Number.isFinite(sdkInt) && sdkInt >= 30) return true;   // scoped storage
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch { return false; }
}

/**
 * Write `html` to Downloads and offer to share it.
 * Returns the file path, or null when the export failed.
 */
async function writeAndShare(html: string, fileName: string, shareTitle: string): Promise<string | null> {
  if (!(await ensurePermission())) {
    Alert.alert('Permission needed', 'Storage permission is required to save the export.');
    return null;
  }
  try {
    const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
    const path = `${dir}/${fileName}`;
    await RNFS.writeFile(path, html, 'utf8');
    Alert.alert(
      'Export saved',
      `Saved as ${fileName}.\n\nOpen it and choose Print → Save as PDF to get a PDF copy.`,
      [
        { text: 'Done', style: 'cancel' },
        {
          text: 'Share',
          onPress: () => {
            // Android's share sheet reads `message`; iOS prefers `url` and
            // would append a duplicate line if both were set.
            const content = Platform.OS === 'android'
              ? { title: shareTitle, message: `${shareTitle}\n${path}` }
              : { title: shareTitle, url: `file://${path}` };
            Share.share(content).catch(() => { /* user dismissed */ });
          },
        },
      ]
    );
    return path;
  } catch (e: any) {
    Alert.alert('Export failed', e?.message ?? 'Could not write the file.');
    return null;
  }
}

export async function exportDayPlan(input: DayExportInput): Promise<string | null> {
  return writeAndShare(
    buildDayHtml(input),
    `Thinkora_Plan_${input.date}.html`,
    `Daily plan — ${longDate(input.date)}`
  );
}

export async function exportWeekPlan(input: WeekExportInput): Promise<string | null> {
  return writeAndShare(
    buildWeekHtml(input),
    `Thinkora_Week_${input.startKey}.html`,
    `Weekly plan — ${shortDate(input.startKey)} to ${shortDate(input.endKey)}`
  );
}
