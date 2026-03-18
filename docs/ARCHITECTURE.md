# NotioX Architecture

This document describes the codebase structure and conventions for maintainability and scale.

## Directory Structure

```
src/
├── core/                 # App-wide constants and design system
│   ├── constants.ts      # Magic numbers, storage keys, config
│   ├── theme.ts          # Colors, spacing, typography, shadows
│   └── index.ts
├── navigation/           # Navigation setup and types
│   ├── types.ts          # Typed param lists (RootStackParamList, etc.)
│   └── AppNavigator.tsx
├── context/              # React context (global state)
│   └── AppContext.tsx    # Notes, folders, tags, reminders, filter
├── services/             # Platform & I/O (storage, notifications, voice, attachments)
│   ├── storage.ts        # AsyncStorage persistence
│   ├── reminderService.ts
│   ├── voiceService.ts
│   ├── attachmentService.ts
│   └── audioRecordService.ts
├── components/           # Reusable UI components
│   ├── Icons.tsx
│   ├── RichNoteEditor.tsx
│   ├── AttachmentList.tsx
│   ├── SketchCanvas.tsx
│   ├── ErrorBoundary.tsx
│   ├── AppLoading.tsx
│   └── index.ts
├── screens/              # Full-screen views
│   ├── NoteListScreen.tsx
│   ├── NoteEditorScreen.tsx
│   ├── FoldersScreen.tsx
│   └── TagsScreen.tsx
├── types/                # TypeScript types and interfaces
│   └── index.ts
└── utils/                # Pure helpers
    ├── id.ts
    └── stripHtml.ts
```

## Conventions

### 1. **Core layer**
- **constants.ts**: All configurable values (intervals, keys, limits). No magic numbers in features.
- **theme.ts**: Single source for colors, spacing, typography. All screens/components use `theme` for styles.

### 2. **Navigation**
- Screen params are defined in `navigation/types.ts` (`RootStackParamList`, `NoteEditorParams`).
- Use typed `useNavigation<NavProp>()` and `useRoute<RouteProp>()` in screens.
- From tab screens, use `navigation.getParent()` to access the stack and navigate to stack screens.

### 3. **State**
- Global state lives in `AppContext` (notes, folders, tags, reminders, filter).
- Context exposes `isHydrated`; app shows `AppLoading` until storage is loaded.
- Persistence: each state slice is synced to AsyncStorage via `storage` service when it changes.

### 4. **Services**
- Platform-specific code (Android) is guarded with `Platform.OS === 'android'` and optional `require()`.
- Storage keys and notification channel IDs come from `core/constants`.

### 5. **Components**
- Use `theme` for all colors, spacing, and typography.
- Export public components from `components/index.ts` for cleaner imports.

### 6. **Error handling**
- `ErrorBoundary` wraps the app to catch render errors and show a fallback with retry.
- Service errors are handled locally (e.g. try/catch, null return).

### 7. **Types**
- Domain types in `types/index.ts` (Note, Folder, Tag, Reminder, etc.).
- No `any` for navigation or domain data; use proper types or generics.

## Data flow

1. **Load**: App starts → `AppProvider` reads from `storage` → sets state and `loaded = true` → `AppContent` renders `AppNavigator`.
2. **Notes**: User edits in `NoteEditorScreen` → local state → auto-save and on blur call `updateNote` / `addNote` from context → context updates state → `storage.setNotes` in useEffect.
3. **Reminders**: `addReminder` in context creates reminder and calls `reminderService.scheduleTimeReminder` (Notifee) on Android; reminder id and optional `notifeeId` stored in state and persisted.

## Scaling tips

- **New feature**: Add types in `types/`, service in `services/` if needed, screen in `screens/`, register in navigator and (if needed) in context.
- **New constant**: Add to `core/constants.ts`.
- **New UI token**: Add to `core/theme.ts`.
- **Extract screen logic**: Consider a custom hook (e.g. `useNoteEditor`) in a `hooks/` folder if a screen grows too large.
