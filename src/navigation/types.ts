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
  PrivacyPolicy: undefined;
  Search: undefined;
  Gantt: undefined;
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
  Quotes: undefined;
  Notes: undefined;
  Dashboard: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
