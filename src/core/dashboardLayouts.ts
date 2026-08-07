export type WidgetId =
  | 'greeting'
  | 'todaysTasks'
  | 'upcomingEvents'
  | 'habits'
  | 'water'
  | 'mood'
  | 'focusTime'
  | 'quickNotes'
  | 'calendar'
  | 'recentFiles';

export interface WidgetSpec {
  id: WidgetId;
  label: string;
  /** 'full' spans the row; 'half' pairs with the next half widget. */
  size: 'full' | 'half';
}

export interface DashboardLayout {
  id: string;
  label: string;
  description: string;
  premium: boolean;
  widgets: WidgetSpec[];
}

const GREETING: WidgetSpec = { id: 'greeting', label: 'Greeting', size: 'full' };

export const DASHBOARD_LAYOUTS: DashboardLayout[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Tasks and habits first, everything else below',
    premium: false,
    widgets: [
      GREETING,
      { id: 'todaysTasks', label: "Today's Tasks", size: 'full' },
      { id: 'habits', label: 'Habits', size: 'half' },
      { id: 'focusTime', label: 'Focus Time', size: 'half' },
      { id: 'water', label: 'Water Intake', size: 'half' },
      { id: 'mood', label: 'Mood', size: 'half' },
      { id: 'upcomingEvents', label: 'Upcoming', size: 'full' },
      { id: 'quickNotes', label: 'Quick Notes', size: 'full' },
      { id: 'calendar', label: 'Calendar', size: 'full' },
      { id: 'recentFiles', label: 'Recent Files', size: 'full' },
    ],
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'Just today — tasks, events and focus time',
    premium: true,
    widgets: [
      GREETING,
      { id: 'todaysTasks', label: "Today's Tasks", size: 'full' },
      { id: 'upcomingEvents', label: 'Upcoming', size: 'full' },
      { id: 'focusTime', label: 'Focus Time', size: 'full' },
      { id: 'quickNotes', label: 'Quick Notes', size: 'full' },
    ],
  },
  {
    id: 'wellness',
    label: 'Wellness',
    description: 'Habits, mood and water lead the day',
    premium: true,
    widgets: [
      GREETING,
      { id: 'habits', label: 'Habits', size: 'full' },
      { id: 'water', label: 'Water Intake', size: 'half' },
      { id: 'mood', label: 'Mood', size: 'half' },
      { id: 'focusTime', label: 'Focus Time', size: 'full' },
      { id: 'todaysTasks', label: "Today's Tasks", size: 'full' },
      { id: 'calendar', label: 'Calendar', size: 'full' },
    ],
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Two-up widgets, less scrolling',
    premium: true,
    widgets: [
      GREETING,
      { id: 'todaysTasks', label: "Today's Tasks", size: 'half' },
      { id: 'habits', label: 'Habits', size: 'half' },
      { id: 'water', label: 'Water Intake', size: 'half' },
      { id: 'mood', label: 'Mood', size: 'half' },
      { id: 'focusTime', label: 'Focus Time', size: 'half' },
      { id: 'upcomingEvents', label: 'Upcoming', size: 'half' },
      { id: 'quickNotes', label: 'Quick Notes', size: 'full' },
      { id: 'recentFiles', label: 'Recent Files', size: 'full' },
    ],
  },
];

export const DEFAULT_LAYOUT = DASHBOARD_LAYOUTS[0];

/** Falls back to the free layout when a premium one is selected without entitlement. */
export function resolveDashboardLayout(id: string, hasPremium: boolean): DashboardLayout {
  const layout = DASHBOARD_LAYOUTS.find(l => l.id === id) ?? DEFAULT_LAYOUT;
  return layout.premium && !hasPremium ? DEFAULT_LAYOUT : layout;
}
