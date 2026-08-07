/**
 * Widget data sync service.
 * Writes tasks and habits JSON to native SharedPreferences via WidgetBridge,
 * which then triggers the Android home screen widgets to refresh.
 *
 * Call syncWidgetData() whenever tasks or habits change.
 */

import { Platform, NativeModules } from 'react-native';
import type { Task, Habit } from '../types';

const { WidgetBridge } = NativeModules;

/**
 * Today's medicine doses, if any have been synced.
 *
 * Held in a module variable rather than passed as an argument so existing
 * `syncWidgetData(tasks, habits)` callers keep working unchanged.
 */
let medicinePayload: { name: string; time: string; taken: boolean }[] = [];

/** Called by MedicineContext whenever doses change. */
export function setWidgetMedicines(
  doses: { name: string; time: string; taken: boolean }[],
): void {
  medicinePayload = doses.slice(0, 10);
}

export function syncWidgetData(tasks: Task[], habits: Habit[]) {
  if (Platform.OS !== 'android' || !WidgetBridge?.updateWidgetData) return;

  try {
    // Only pass fields the widget needs to keep payload small
    const taskPayload = tasks
      .filter((t) => !t.completed)
      .slice(0, 20)
      .map((t) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        dueDate: t.dueDate,
        priority: t.priority,
      }));

    const habitPayload = habits
      .filter((h) => !h.archived)
      .slice(0, 10)
      .map((h) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        completedDates: (h.completedDates ?? []).slice(-30), // last 30 days only
        archived: h.archived ?? false,
      }));

    WidgetBridge.updateWidgetData({
      tasks: JSON.stringify(taskPayload),
      habits: JSON.stringify(habitPayload),
      // Extra key: the native side ignores what it doesn't read, so this is
      // safe to send before the widget layout consumes it.
      medicines: JSON.stringify(medicinePayload),
    });
  } catch (e) {
    // Widget sync is non-critical — fail silently
  }
}
