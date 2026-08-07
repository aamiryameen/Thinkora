import { notesCollection, tasksCollection } from '../db';
import { pruneOrphanBackgrounds } from './wallpaperService';

/**
 * Removes background images no note or task points at.
 *
 * Lives in its own module so `wallpaperService` stays free of database imports
 * and remains testable without the native SQLite adapter.
 */
export async function pruneBackgroundsNow(): Promise<number> {
  try {
    const [noteRows, taskRows] = await Promise.all([
      notesCollection.query().fetch(),
      tasksCollection.query().fetch(),
    ]);
    const referenced = [
      ...noteRows.map(r => r.toPlain().backgroundUri),
      ...taskRows.map(r => r.toPlain().backgroundUri),
    ];
    return await pruneOrphanBackgrounds(referenced);
  } catch {
    return 0;
  }
}
