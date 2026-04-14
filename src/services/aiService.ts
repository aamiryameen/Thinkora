/**
 * AI Service — on-device heuristic AI features:
 * - Smart task suggestions based on note content
 * - Mood insights from journal history
 * - Auto-categorize notes
 *
 * No external API needed — all runs locally using keyword matching + pattern analysis.
 */

import type { Note, Task, JournalEntry, SmartCategory, MoodLevel } from '../types';

// ─── Smart Task Suggestions ───────────────────────────────────────────────────

const ACTION_PATTERNS = [
  /\b(todo|to-do|to do):?\s+(.+)/gi,
  /\b(need to|needs to|must|should|have to|want to|plan to)\s+(.+)/gi,
  /\b(remember to|don't forget to|make sure to)\s+(.+)/gi,
  /\b(buy|get|order|purchase)\s+(.+)/gi,
  /\b(call|email|message|contact|reach out to)\s+(.+)/gi,
  /\b(fix|update|review|check|finish|complete|submit|send)\s+(.+)/gi,
  /\b(schedule|book|arrange|plan)\s+(.+)/gi,
];

function cleanSuggestion(text: string): string {
  return text
    .replace(/[.,;:!?]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function suggestTasksFromNote(note: Note, existingTasks: Task[]): string[] {
  const text = note.plainText || '';
  if (!text.trim()) return [];

  const suggestions = new Set<string>();
  const existingTitles = new Set(existingTasks.map((t) => t.title.toLowerCase()));

  for (const pattern of ACTION_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[2] || match[1] || '';
      const cleaned = cleanSuggestion(raw);
      if (
        cleaned.length > 3 &&
        cleaned.length < 80 &&
        !existingTitles.has(cleaned.toLowerCase())
      ) {
        // Capitalize first letter
        suggestions.add(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    }
  }

  // Also look for bullet/numbered list items
  const lines = text.split('\n');
  for (const line of lines) {
    const bulletMatch = line.match(/^[\s]*[-•*✓□☐]\s+(.+)/);
    const numberedMatch = line.match(/^[\s]*\d+[.)]\s+(.+)/);
    const raw = (bulletMatch || numberedMatch)?.[1] ?? '';
    if (raw) {
      const cleaned = cleanSuggestion(raw);
      if (
        cleaned.length > 3 &&
        cleaned.length < 80 &&
        !existingTitles.has(cleaned.toLowerCase())
      ) {
        suggestions.add(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    }
  }

  return [...suggestions].slice(0, 5);
}

// ─── Mood Insights ────────────────────────────────────────────────────────────

export interface MoodInsight {
  title: string;
  description: string;
  emoji: string;
  type: 'positive' | 'negative' | 'neutral' | 'tip';
}

export function analyzeMoodInsights(entries: JournalEntry[]): MoodInsight[] {
  if (entries.length < 3) {
    return [{
      title: 'Keep journaling',
      description: 'Log at least 3 mood entries to unlock personalized insights.',
      emoji: '📝',
      type: 'neutral',
    }];
  }

  const insights: MoodInsight[] = [];
  const recent = entries.slice(0, 30);
  const moods = recent.map((e) => e.mood);
  const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
  const last7 = entries.slice(0, 7).map((e) => e.mood);
  const avg7 = last7.length > 0 ? last7.reduce((a, b) => a + b, 0) / last7.length : avg;

  // Overall mood level
  if (avg >= 4) {
    insights.push({ title: 'Great overall mood!', description: `Your average mood is ${avg.toFixed(1)}/5 — you're doing really well.`, emoji: '😊', type: 'positive' });
  } else if (avg >= 3) {
    insights.push({ title: 'Steady mood', description: `Your average mood is ${avg.toFixed(1)}/5. Small consistent habits can push this higher.`, emoji: '😐', type: 'neutral' });
  } else {
    insights.push({ title: 'Mood needs attention', description: `Your average mood is ${avg.toFixed(1)}/5. Consider what activities make you feel better.`, emoji: '💙', type: 'negative' });
  }

  // Trend: recent 7 vs older
  if (entries.length >= 14) {
    const older = entries.slice(7, 14).map((e) => e.mood);
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
    const diff = avg7 - avgOlder;
    if (diff > 0.5) {
      insights.push({ title: 'Mood is improving!', description: `Your mood this week is ${diff.toFixed(1)} points higher than last week.`, emoji: '📈', type: 'positive' });
    } else if (diff < -0.5) {
      insights.push({ title: 'Mood dipped this week', description: `Your mood is ${Math.abs(diff).toFixed(1)} points lower than last week. Take care of yourself.`, emoji: '📉', type: 'negative' });
    }
  }

  // Best day of week
  const byDay: Record<number, number[]> = {};
  for (const entry of recent) {
    const day = new Date(entry.createdAt).getDay();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(entry.mood);
  }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let bestDay = -1, bestDayAvg = 0;
  let worstDay = -1, worstDayAvg = 6;
  for (const [day, dayMoods] of Object.entries(byDay)) {
    const dayAvg = dayMoods.reduce((a, b) => a + b, 0) / dayMoods.length;
    if (dayAvg > bestDayAvg) { bestDayAvg = dayAvg; bestDay = Number(day); }
    if (dayAvg < worstDayAvg) { worstDayAvg = dayAvg; worstDay = Number(day); }
  }
  if (bestDay >= 0 && bestDayAvg >= 4) {
    insights.push({ title: `${dayNames[bestDay]}s are your best days`, description: `You tend to feel happiest on ${dayNames[bestDay]}s (avg ${bestDayAvg.toFixed(1)}/5).`, emoji: '⭐', type: 'positive' });
  }
  if (worstDay >= 0 && worstDay !== bestDay && worstDayAvg <= 2.5) {
    insights.push({ title: `${dayNames[worstDay]}s feel harder`, description: `${dayNames[worstDay]}s tend to be tougher for you. Plan something enjoyable on those days.`, emoji: '💡', type: 'tip' });
  }

  // Streak of positive moods
  let positiveStreak = 0;
  for (const entry of entries) {
    if (entry.mood >= 4) positiveStreak++;
    else break;
  }
  if (positiveStreak >= 3) {
    insights.push({ title: `${positiveStreak}-day positivity streak!`, description: `You've logged ${positiveStreak} consecutive good mood days. Keep it up!`, emoji: '🔥', type: 'positive' });
  }

  // Tips based on mood
  if (avg < 3.5) {
    const tips = [
      { title: 'Try the Pomodoro technique', description: 'Short focused work sessions can reduce stress and boost your mood.', emoji: '⏱' },
      { title: 'Track your habits', description: 'Building consistent habits like exercise and sleep improves mood over time.', emoji: '🎯' },
      { title: 'Morning journaling', description: 'Writing what you\'re grateful for each morning can shift your mindset positively.', emoji: '🌅' },
    ];
    const tip = tips[entries.length % tips.length];
    insights.push({ ...tip, type: 'tip' });
  }

  return insights.slice(0, 5);
}

// ─── Auto-categorize Notes ────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<SmartCategory, string[]> = {
  work: ['meeting', 'project', 'deadline', 'client', 'report', 'office', 'work', 'job', 'task', 'budget', 'team', 'manager', 'email', 'presentation', 'sprint', 'standup', 'review', 'roadmap', 'kpi', 'target'],
  personal: ['family', 'friend', 'home', 'dinner', 'vacation', 'travel', 'birthday', 'personal', 'health', 'doctor', 'appointment', 'gym', 'exercise', 'hobby', 'weekend', 'party', 'wedding'],
  ideas: ['idea', 'concept', 'inspiration', 'brainstorm', 'what if', 'could', 'imagine', 'feature', 'design', 'innovation', 'creative', 'startup', 'invent', 'explore', 'maybe', 'thought'],
  todos: ['todo', 'to-do', 'to do', 'checklist', 'list', 'buy', 'need to', 'must', 'should', 'remember', 'don\'t forget', 'task', 'action item', '- [ ]', '☐', '□'],
  all: [],
  none: [],
};

export function autoCategorizeNote(note: Note): SmartCategory {
  const text = (note.title + ' ' + note.plainText).toLowerCase();
  if (!text.trim()) return 'none';

  const scores: Record<string, number> = { work: 0, personal: 0, ideas: 0, todos: 0 };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'all' || category === 'none') continue;
    for (const kw of keywords) {
      const count = (text.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
      scores[category] += count;
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] === 0) return 'none';
  return best[0] as SmartCategory;
}
