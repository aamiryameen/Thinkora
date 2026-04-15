/**
 * Navigation service — allows navigation from outside React components.
 *
 * Used by notification handlers to deep-link into specific screens
 * when a user taps a notification.
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate to a screen. Safe to call even if navigation isn't ready yet —
 * retries for up to 3 seconds.
 */
export function navigateTo(screen: keyof RootStackParamList, params?: object): void {
  const doNavigate = () => (navigationRef as any).navigate(screen, params);

  if (navigationRef.isReady()) {
    doNavigate();
  } else {
    // Navigation not ready yet (app still loading) — retry
    let retries = 0;
    const interval = setInterval(() => {
      retries++;
      if (navigationRef.isReady()) {
        clearInterval(interval);
        doNavigate();
      } else if (retries > 30) {
        clearInterval(interval);
        console.warn('[Navigation] Could not navigate — ref not ready after 3s');
      }
    }, 100);
  }
}

/**
 * Handle deep link from notification data.
 * Routes to the correct screen based on notification payload.
 */
export function handleNotificationDeepLink(data: Record<string, string> | undefined): void {
  if (!data) return;

  const { type, taskId, noteId } = data;

  // Task reminder — open the task editor
  if (taskId) {
    navigateTo('TaskEditor', { taskId });
    return;
  }

  // Note reminder — open the note editor
  if (noteId) {
    navigateTo('NoteEditor', { noteId });
    return;
  }

  // Overdue alert — go to tasks list (Home > Tasks tab)
  if (type === 'overdue-alert') {
    navigateTo('Home');
    return;
  }

  // Daily digest — go to home
  if (type === 'daily-digest') {
    navigateTo('Home');
    return;
  }
}
