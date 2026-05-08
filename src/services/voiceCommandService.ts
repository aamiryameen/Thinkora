/**
 * Voice Command Service — parses spoken commands into structured actions.
 *
 * Examples:
 *   "Add task buy groceries tomorrow at 5pm"
 *   "New note shopping list"
 *   "Start a 25 minute focus session"
 *   "Show my goals"
 *
 * Pure-JS heuristic parser — no AI call required (works offline).
 * For ambiguous input we fall back to "create note with the entire text".
 */

export type VoiceIntent =
  | { type: 'add_task'; title: string; dueDate?: number; priority?: 'low' | 'medium' | 'high' }
  | { type: 'add_note'; title: string; body?: string }
  | { type: 'start_pomodoro'; minutes?: number }
  | { type: 'navigate'; route: 'Goals' | 'TimeBlocking' | 'HabitTracker' | 'Pomodoro' | 'ProductivityStats' | 'MoodJournal' | 'Notes' | 'Tasks' | 'MyDay' }
  | { type: 'unknown'; raw: string };

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
};

function parseNumber(token: string): number | null {
  const n = parseInt(token, 10);
  if (!isNaN(n)) return n;
  return NUMBER_WORDS[token.toLowerCase()] ?? null;
}

/** Parse natural-language time references → unix timestamp. */
function parseDateTime(text: string): number | undefined {
  const lower = text.toLowerCase();
  const now = new Date();
  const out = new Date(now);

  // Day-of-week shifts
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let dayMatched = false;
  if (/\btomorrow\b/.test(lower)) {
    out.setDate(out.getDate() + 1);
    dayMatched = true;
  } else if (/\btoday\b/.test(lower) || /\btonight\b/.test(lower)) {
    dayMatched = true;
  } else {
    for (let i = 0; i < days.length; i++) {
      if (lower.includes(days[i])) {
        const cur = now.getDay();
        let diff = (i - cur + 7) % 7;
        if (diff === 0) diff = 7; // "next monday" rather than today
        out.setDate(out.getDate() + diff);
        dayMatched = true;
        break;
      }
    }
  }

  // Time of day — "5pm", "5 pm", "17:00", "at 5"
  const timeMatch =
    lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ||
    lower.match(/\b(\d{1,2}):(\d{2})\b/);
  let hourSet = false;
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3];
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    out.setHours(hours, minutes, 0, 0);
    hourSet = true;
  } else if (/\bnoon\b/.test(lower)) {
    out.setHours(12, 0, 0, 0); hourSet = true;
  } else if (/\bmidnight\b/.test(lower)) {
    out.setHours(0, 0, 0, 0); hourSet = true;
  } else if (/\btonight\b/.test(lower)) {
    out.setHours(20, 0, 0, 0); hourSet = true;
  }

  if (!dayMatched && !hourSet) return undefined;
  if (!hourSet) out.setHours(9, 0, 0, 0); // default morning
  return out.getTime();
}

function parsePriority(text: string): 'low' | 'medium' | 'high' | undefined {
  if (/\b(high|urgent|important|asap)\b/i.test(text)) return 'high';
  if (/\b(low|whenever|someday)\b/i.test(text)) return 'low';
  if (/\b(medium|normal)\b/i.test(text)) return 'medium';
  return undefined;
}

/** Strip common helper words from the title once date/priority extracted. */
function cleanTitle(s: string): string {
  return s
    .replace(/\b(tomorrow|today|tonight|noon|midnight|at|on)\b/gi, '')
    .replace(/\b(?:mon|tues?|wed(?:nes)?|thurs?|fri|sat|sun)(?:day)?\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
    .replace(/\b(high|low|medium|urgent|normal|important|asap|whenever|someday) priority\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseVoiceCommand(transcript: string): VoiceIntent {
  if (!transcript || !transcript.trim()) return { type: 'unknown', raw: transcript };
  const text = transcript.trim();
  const lower = text.toLowerCase();

  // Pomodoro / focus session
  const pomMatch = lower.match(/(?:start|begin)\s+(?:a\s+)?(?:(\d+|\w+)\s*(?:minute|min)\s+)?(?:focus|pomodoro|deep work)/);
  if (pomMatch) {
    const minutes = pomMatch[1] ? parseNumber(pomMatch[1]) ?? 25 : 25;
    return { type: 'start_pomodoro', minutes };
  }
  if (/\b(start|begin)\s+(?:a\s+)?(?:focus|pomodoro|timer)\b/.test(lower)) {
    return { type: 'start_pomodoro', minutes: 25 };
  }

  // Navigation intents
  const navMap: Record<string, VoiceIntent['type'] extends 'navigate' ? string : never> = {} as any;
  const goPatterns: { rx: RegExp; route: string }[] = [
    { rx: /\b(open|show|go to)\s+(my\s+)?(?:goals?|targets?)\b/, route: 'Goals' },
    { rx: /\b(open|show|go to)\s+(?:time\s*block(?:ing)?|schedule)\b/, route: 'TimeBlocking' },
    { rx: /\b(open|show|go to)\s+(?:habits?|habit\s*tracker)\b/, route: 'HabitTracker' },
    { rx: /\b(open|show|go to)\s+(?:pomodoro|focus)\b/, route: 'Pomodoro' },
    { rx: /\b(open|show|go to)\s+(?:stats|reports?|productivity)\b/, route: 'ProductivityStats' },
    { rx: /\b(open|show|go to)\s+(?:journal|mood)\b/, route: 'MoodJournal' },
    { rx: /\b(open|show|go to)\s+notes?\b/, route: 'Notes' },
    { rx: /\b(open|show|go to)\s+tasks?\b/, route: 'Tasks' },
    { rx: /\b(open|show|go to)\s+(?:home|my\s*day|today)\b/, route: 'MyDay' },
  ];
  for (const { rx, route } of goPatterns) {
    if (rx.test(lower)) return { type: 'navigate', route: route as any };
  }

  // Add task: "add task ___", "new task ___", "remind me to ___"
  const taskMatch = lower.match(/^(?:add\s+(?:a\s+)?task|new\s+task|create\s+task|remind\s+me\s+to)\s+(.+)/);
  if (taskMatch) {
    const rest = taskMatch[1];
    const dueDate = parseDateTime(rest);
    const priority = parsePriority(rest);
    const title = cleanTitle(rest);
    return { type: 'add_task', title: title || rest, dueDate, priority };
  }

  // Add note: "add note ___", "new note ___", "take a note ___"
  const noteMatch = lower.match(/^(?:add\s+(?:a\s+)?note|new\s+note|take\s+(?:a\s+)?note|note\s+to\s+self)\s+(.+)/);
  if (noteMatch) {
    const rest = noteMatch[1].trim();
    // First sentence or up to 60 chars becomes the title; rest is body
    let title = rest;
    let body: string | undefined;
    const firstSep = rest.search(/[.!?]/);
    if (firstSep > 5 && firstSep < rest.length - 4) {
      title = rest.slice(0, firstSep).trim();
      body = rest.slice(firstSep + 1).trim();
    } else if (rest.length > 60) {
      title = rest.slice(0, 60).trim();
      body = rest.slice(60).trim();
    }
    return { type: 'add_note', title, body };
  }

  // Implicit "add task" if it starts with a verb and contains a time
  if (parseDateTime(lower)) {
    const dueDate = parseDateTime(lower);
    const priority = parsePriority(lower);
    return { type: 'add_task', title: cleanTitle(text) || text, dueDate, priority };
  }

  return { type: 'unknown', raw: text };
}

/** Human-friendly label for an intent (used in the result toast). */
export function describeIntent(intent: VoiceIntent): string {
  switch (intent.type) {
    case 'add_task':
      return `Created task: ${intent.title}${intent.dueDate ? ` · ${new Date(intent.dueDate).toLocaleString()}` : ''}`;
    case 'add_note':
      return `Created note: ${intent.title}`;
    case 'start_pomodoro':
      return `Starting ${intent.minutes ?? 25}-minute focus session`;
    case 'navigate':
      return `Opening ${intent.route}`;
    case 'unknown':
      return `Couldn't understand: "${intent.raw}"`;
  }
}
