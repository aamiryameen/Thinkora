/**
 * Typed navigation params for type-safe screen navigation.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  /** Hosts the bottom-tab navigator; use `navigate('Home', { screen: 'Tasks' })`
   *  to target a specific tab from a screen outside the tab navigator. */
  Home: NavigatorScreenParams<HomeTabParamList>;
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
  Notebooks: undefined;
  Budget: undefined;
  BudgetCategories: undefined;
  BudgetLimits: undefined;
  BudgetRecurring: undefined;
  BudgetReports: undefined;
  Medicine: undefined;
  MedicineHistory: undefined;
  MedicineProfiles: undefined;
  DoctorVisits: undefined;
  MedicineInventory: undefined;
  MedicineAnalytics: undefined;
  Whiteboards: undefined;
  Whiteboard: { boardId: string };
  ArchiveTrash: undefined;
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
  Calendar: undefined;
  DailyPulse: undefined;
  TodayCard: undefined;
  MorningBrew: undefined;
  VoiceCapture: undefined;
  KnowledgeBases: undefined;
  KnowledgeBaseDetail: { kbId: string };
  KbChat: KbChatParams;
  KbDocument: KbDocumentParams;
  KbSearch: { kbId: string };
  WeatherDetail: undefined;
  // ── Daily Planner ──
  DailyPlanner: undefined;
  MorningPlanning: undefined;
  WeeklyPlanner: undefined;
  PlannerTemplates: undefined;
  PlannerAnalytics: undefined;
  PlannerSettings: undefined;
};

export type KbChatParams = {
  kbId: string;
  /** When set, the conversation is scoped to a single document. */
  documentId?: string;
};

export type KbDocumentParams = {
  kbId: string;
  documentId: string;
  /** Chunk to scroll to when arriving from a citation. */
  highlightChunkId?: string;
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
