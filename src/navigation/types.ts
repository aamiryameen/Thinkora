/**
 * Typed navigation params for type-safe screen navigation.
 */

export type RootStackParamList = {
  Home: undefined;
  NoteEditor: NoteEditorParams;
  TaskEditor: TaskEditorParams;
  HabitTracker: undefined;
  MyDay: undefined;
  Pomodoro: undefined;
  MoodJournal: undefined;
  AIMoodInsights: undefined;
  Eisenhower: undefined;
  SharedLists: undefined;
  Templates: undefined;
  Badges: undefined;
  CategoryManager: undefined;
  Reports: undefined;
  Settings: undefined;
  AISettings: undefined;
  Scan: undefined;
  Quotes: undefined;
  CloudSync: undefined;
  TimeBlocking: undefined;
  ShareNoteCard: { noteId: string };
  ProductivityStats: undefined;
  Goals: undefined;
  HabitStacks: undefined;
  VoiceCommand: undefined;
  NoteCustomization: { noteId: string };
  StreakRewards: undefined;
  BirthdayRecap: undefined;
  PrivacyPolicy: undefined;
  Search: undefined;
  Gantt: undefined;
  ShareProgress: undefined;
  Sketch: undefined;
};

export type NoteEditorParams = {
  noteId?: string;
  folderId?: string;
};

export type TaskEditorParams = {
  taskId?: string;
  date?: number; // pre-fill due date when creating from calendar
};

export type HomeTabParamList = {
  MyDay: undefined;
  Tasks: undefined;
  /** Centered placeholder route. Tapping the tab actually navigates to the
   *  full-screen Scan flow in the root stack. */
  ScanTab: undefined;
  Notes: undefined;
  Dashboard: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
