/**
 * KnowledgeContext: state for the AI Knowledge Base.
 *
 * Owns knowledge bases, their documents, and the ingestion queue. Chat state
 * lives in the chat screen itself (it's per-KB and scrolls independently), but
 * the queue lives here so ingestion survives navigating away mid-upload.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Q } from '@nozbe/watermelondb';
import {
  database,
  kbChunksCollection,
  kbDocumentsCollection,
  kbMessagesCollection,
  knowledgeBasesCollection,
} from '../db';
import type { KnowledgeBaseModel } from '../db/models/KnowledgeBaseModel';
import type { KbDocumentModel } from '../db/models/KbDocumentModel';
import type { KbChunkModel } from '../db/models/KbChunkModel';
import type { KbMessageModel } from '../db/models/KbMessageModel';
import type {
  KbDocument,
  KbIngestProgress,
  KbPreset,
  KbSourceType,
  KnowledgeBase,
} from '../types/knowledge';
import {
  createDocument,
  deleteDocument as deleteDocumentService,
  ingestDocument,
  ingestNote,
  onIngestProgress,
  retryEmbedding,
  retryEnrichment,
} from '../services/kbIngestService';
import { detectSourceType } from '../services/kbExtractionService';
import { countUnembeddedChunks } from '../services/kbSearchService';
import { categoryColors } from '../core/theme';
import { stripHtml } from '../utils/stripHtml';
import { useApp } from './AppContext';

// ─── Starter presets ──────────────────────────────────────────────────────────

export const KB_PRESETS: KbPreset[] = [
  { name: 'Work', icon: 'briefcase-outline', color: categoryColors.orange, description: 'Projects, meetings and reports' },
  { name: 'Personal', icon: 'person-outline', color: categoryColors.blue, description: 'Anything for your own life' },
  { name: 'University', icon: 'school-outline', color: categoryColors.purple, description: 'Lectures, papers and revision' },
  { name: 'Programming', icon: 'code-slash-outline', color: categoryColors.teal, description: 'Docs, guides and code notes' },
  { name: 'Business', icon: 'trending-up-outline', color: categoryColors.green, description: 'Strategy, finance and market research' },
  { name: 'Research', icon: 'flask-outline', color: categoryColors.indigo, description: 'Papers and findings to compare' },
  { name: 'Health', icon: 'heart-outline', color: categoryColors.red, description: 'Reports, plans and reference' },
  { name: 'Finance', icon: 'wallet-outline', color: categoryColors.pink, description: 'Statements, budgets and planning' },
];

// ─── Queue types ──────────────────────────────────────────────────────────────

export interface QueueItem {
  documentId: string;
  kbId: string;
  title: string;
  status: KbIngestProgress['status'];
  progress: number;
  label: string;
}

interface KnowledgeState {
  knowledgeBases: KnowledgeBase[];
  documents: KbDocument[];
  isHydrated: boolean;
  /** Documents currently moving through the pipeline, keyed by document id. */
  queue: Record<string, QueueItem>;
  /** True while any document is being ingested. */
  isIngesting: boolean;
}

interface KnowledgeContextValue extends KnowledgeState {
  // Knowledge bases
  createKnowledgeBase: (input: {
    name: string;
    icon?: string;
    color?: string;
    description?: string;
  }) => Promise<string>;
  updateKnowledgeBase: (
    id: string,
    changes: Partial<Pick<KnowledgeBase, 'name' | 'icon' | 'color' | 'description'>>,
  ) => Promise<void>;
  deleteKnowledgeBase: (id: string) => Promise<void>;
  getKnowledgeBase: (id: string) => KnowledgeBase | undefined;

  // Documents
  documentsFor: (kbId: string) => KbDocument[];
  getDocument: (id: string) => KbDocument | undefined;
  addFileDocument: (
    kbId: string,
    file: { uri: string; name: string; mimeType?: string },
  ) => Promise<{ documentId: string; error: string | null }>;
  addNoteDocument: (
    kbId: string,
    noteId: string,
  ) => Promise<{ documentId: string; error: string | null }>;
  removeDocument: (id: string) => Promise<void>;
  retryDocument: (id: string) => Promise<void>;
  regenerateSummary: (id: string) => Promise<boolean>;

  // Stats
  refresh: () => Promise<void>;
  unembeddedCount: (kbId: string) => Promise<number>;
  allTags: (kbId: string) => string[];
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const { settings, notes } = useApp();
  const userApiKey = settings.geminiApiKey ?? null;

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [documents, setDocuments] = useState<KbDocument[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [queue, setQueue] = useState<Record<string, QueueItem>>({});

  /** Keeps the latest API key available inside async pipeline runs. */
  const apiKeyRef = useRef(userApiKey);
  useEffect(() => { apiKeyRef.current = userApiKey; }, [userApiKey]);

  // ─── Loading ────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      const [kbRows, docRows] = await Promise.all([
        knowledgeBasesCollection.query(Q.sortBy('updated_at', Q.desc)).fetch() as Promise<KnowledgeBaseModel[]>,
        kbDocumentsCollection.query(Q.sortBy('created_at', Q.desc)).fetch() as Promise<KbDocumentModel[]>,
      ]);

      const docs = docRows.map((d) => d.toPlain());
      const countByKb = docs.reduce<Record<string, number>>((acc, d) => {
        acc[d.kbId] = (acc[d.kbId] ?? 0) + 1;
        return acc;
      }, {});

      setDocuments(docs);
      setKnowledgeBases(kbRows.map((k) => k.toPlain(countByKb[k.id] ?? 0)));
    } catch (err) {
      console.warn('[KB] Failed to load knowledge bases', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Any document row change (including pipeline writes) refreshes the list.
  useEffect(() => {
    const subscription = kbDocumentsCollection
      .query()
      .observeWithColumns(['status', 'progress', 'title', 'chunk_count', 'tags', 'quick_summary'])
      .subscribe({
        next: (rows) => {
          const docs = (rows as KbDocumentModel[]).map((d) => d.toPlain());
          docs.sort((a, b) => b.createdAt - a.createdAt);
          setDocuments(docs);

          const countByKb = docs.reduce<Record<string, number>>((acc, d) => {
            acc[d.kbId] = (acc[d.kbId] ?? 0) + 1;
            return acc;
          }, {});
          setKnowledgeBases((prev) =>
            prev.map((kb) => ({ ...kb, documentCount: countByKb[kb.id] ?? 0 })),
          );
        },
        error: (err) => console.warn('[KB] Document observation failed', err),
      });
    return () => subscription.unsubscribe();
  }, []);

  // Mirror ingestion progress into the queue.
  useEffect(() => {
    return onIngestProgress((progress) => {
      setQueue((prev) => {
        const existing = prev[progress.documentId];
        if (!existing) return prev;

        // Drop finished items so the queue only shows active work.
        if (
          progress.status === 'ready' ||
          progress.status === 'failed' ||
          progress.status === 'partial'
        ) {
          const next = { ...prev };
          delete next[progress.documentId];
          return next;
        }

        return {
          ...prev,
          [progress.documentId]: {
            ...existing,
            status: progress.status,
            progress: progress.progress,
            label: progress.label,
          },
        };
      });
    });
  }, []);

  // ─── Knowledge base CRUD ────────────────────────────────────────────────────

  const createKnowledgeBase = useCallback(
    async (input: { name: string; icon?: string; color?: string; description?: string }) => {
      const now = Date.now();
      let id = '';
      await database.write(async () => {
        const created = await knowledgeBasesCollection.create((k: KnowledgeBaseModel) => {
          k.name = input.name.trim() || 'Untitled';
          k.icon = input.icon ?? 'library-outline';
          k.color = input.color ?? categoryColors.blue;
          k.description = input.description ?? '';
          k.createdAt = now;
          k.updatedAt = now;
        });
        id = created.id;
      });
      await loadAll();
      return id;
    },
    [loadAll],
  );

  const updateKnowledgeBase = useCallback(
    async (
      id: string,
      changes: Partial<Pick<KnowledgeBase, 'name' | 'icon' | 'color' | 'description'>>,
    ) => {
      try {
        const kb = (await knowledgeBasesCollection.find(id)) as KnowledgeBaseModel;
        await database.write(async () => {
          await kb.update((k) => {
            if (changes.name !== undefined) k.name = changes.name.trim() || 'Untitled';
            if (changes.icon !== undefined) k.icon = changes.icon;
            if (changes.color !== undefined) k.color = changes.color;
            if (changes.description !== undefined) k.description = changes.description;
            k.updatedAt = Date.now();
          });
        });
        setKnowledgeBases((prev) =>
          prev.map((k) => (k.id === id ? { ...k, ...changes, updatedAt: Date.now() } : k)),
        );
      } catch (err) {
        console.warn('[KB] Failed to update knowledge base', err);
      }
    },
    [],
  );

  /** Deletes a KB and everything under it: documents, chunks and chat. */
  const deleteKnowledgeBase = useCallback(
    async (id: string) => {
      try {
        const [docs, chunks, messages] = await Promise.all([
          kbDocumentsCollection.query(Q.where('kb_id', id)).fetch() as Promise<KbDocumentModel[]>,
          kbChunksCollection.query(Q.where('kb_id', id)).fetch() as Promise<KbChunkModel[]>,
          kbMessagesCollection.query(Q.where('kb_id', id)).fetch() as Promise<KbMessageModel[]>,
        ]);
        const kb = (await knowledgeBasesCollection.find(id)) as KnowledgeBaseModel;

        await database.write(async () => {
          await Promise.all([
            ...chunks.map((c) => c.destroyPermanently()),
            ...messages.map((m) => m.destroyPermanently()),
          ]);
          await Promise.all(docs.map((d) => d.destroyPermanently()));
          await kb.destroyPermanently();
        });

        setKnowledgeBases((prev) => prev.filter((k) => k.id !== id));
        setDocuments((prev) => prev.filter((d) => d.kbId !== id));
      } catch (err) {
        console.warn('[KB] Failed to delete knowledge base', err);
      }
    },
    [],
  );

  const getKnowledgeBase = useCallback(
    (id: string) => knowledgeBases.find((k) => k.id === id),
    [knowledgeBases],
  );

  // ─── Documents ──────────────────────────────────────────────────────────────

  const documentsFor = useCallback(
    (kbId: string) => documents.filter((d) => d.kbId === kbId),
    [documents],
  );

  const getDocument = useCallback(
    (id: string) => documents.find((d) => d.id === id),
    [documents],
  );

  /** Registers a document in the queue and runs the pipeline. */
  const runIngestion = useCallback(
    async (
      documentId: string,
      kbId: string,
      title: string,
      preExtracted?: { text: string; pages: string[]; pageCount: number },
    ): Promise<string | null> => {
      setQueue((prev) => ({
        ...prev,
        [documentId]: {
          documentId,
          kbId,
          title,
          status: 'queued',
          progress: 0,
          label: 'Queued',
        },
      }));

      try {
        const result = await ingestDocument(documentId, {
          userApiKey: apiKeyRef.current,
          preExtracted,
        });
        // Only surface an error for a genuine failure. A 'partial' document was
        // added successfully and is keyword-searchable — its card already shows
        // the degraded state and a "Finish indexing" action, so raising an
        // alert here would wrongly tell the user the document wasn't added.
        return result.status === 'failed' ? result.error : null;
      } catch (err) {
        console.warn('[KB] Ingestion crashed', err);
        return 'Something went wrong while processing this document.';
      } finally {
        setQueue((prev) => {
          const next = { ...prev };
          delete next[documentId];
          return next;
        });
        await loadAll();
      }
    },
    [loadAll],
  );

  const addFileDocument = useCallback(
    async (kbId: string, file: { uri: string; name: string; mimeType?: string }) => {
      const sourceType: KbSourceType = detectSourceType(file.name, file.mimeType);
      // Strip the extension for a cleaner default title; enrichment may improve it.
      const title = file.name.replace(/\.[^.]+$/, '') || file.name;

      const documentId = await createDocument({
        kbId,
        title,
        fileName: file.name,
        fileUri: file.uri,
        noteId: null,
        sourceType,
      });

      await loadAll();
      const error = await runIngestion(documentId, kbId, title);
      return { documentId, error };
    },
    [loadAll, runIngestion],
  );

  /** Imports an existing Thinkora note as a document. */
  const addNoteDocument = useCallback(
    async (kbId: string, noteId: string) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) {
        return { documentId: '', error: 'That note no longer exists.' };
      }

      const plainText = (note.plainText || stripHtml(note.content || '')).trim();
      if (plainText.length < 20) {
        return { documentId: '', error: 'This note is too short to index.' };
      }

      const title = note.title?.trim() || 'Untitled note';
      const { documentId, result } = await ingestNote(
        kbId,
        { id: note.id, title, plainText },
        apiKeyRef.current,
      );
      await loadAll();
      // As in runIngestion: a 'partial' note was added and is searchable, so
      // only a real failure becomes a user-facing error.
      return { documentId, error: result.status === 'failed' ? result.error : null };
    },
    [notes, loadAll],
  );

  const removeDocument = useCallback(
    async (id: string) => {
      await deleteDocumentService(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      await loadAll();
    },
    [loadAll],
  );

  /**
   * Retries a document. A failed document re-runs the whole pipeline; a
   * partial one only needs its missing embeddings.
   */
  const retryDocument = useCallback(
    async (id: string) => {
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;

      if (doc.status === 'partial') {
        setQueue((prev) => ({
          ...prev,
          [id]: {
            documentId: id,
            kbId: doc.kbId,
            title: doc.title,
            status: 'embedding',
            progress: 30,
            label: 'Building search index',
          },
        }));
        try {
          await retryEmbedding(id, { userApiKey: apiKeyRef.current });
        } finally {
          setQueue((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          await loadAll();
        }
        return;
      }

      // Notes have no file to re-read, so re-extract from stored text.
      const preExtracted = doc.noteId && doc.extractedText
        ? { text: doc.extractedText, pages: [], pageCount: 0 }
        : undefined;
      await runIngestion(id, doc.kbId, doc.title, preExtracted);
    },
    [documents, loadAll, runIngestion],
  );

  const regenerateSummary = useCallback(
    async (id: string) => {
      const ok = await retryEnrichment(id, apiKeyRef.current);
      await loadAll();
      return ok;
    },
    [loadAll],
  );

  const unembeddedCount = useCallback(
    (kbId: string) => countUnembeddedChunks(kbId),
    [],
  );

  const allTags = useCallback(
    (kbId: string) => {
      const tags = new Set<string>();
      documents.forEach((d) => {
        if (d.kbId === kbId) d.tags.forEach((t) => tags.add(t));
      });
      return Array.from(tags).sort((a, b) => a.localeCompare(b));
    },
    [documents],
  );

  const isIngesting = Object.keys(queue).length > 0;

  const value = useMemo<KnowledgeContextValue>(
    () => ({
      knowledgeBases,
      documents,
      isHydrated,
      queue,
      isIngesting,
      createKnowledgeBase,
      updateKnowledgeBase,
      deleteKnowledgeBase,
      getKnowledgeBase,
      documentsFor,
      getDocument,
      addFileDocument,
      addNoteDocument,
      removeDocument,
      retryDocument,
      regenerateSummary,
      refresh: loadAll,
      unembeddedCount,
      allTags,
    }),
    [
      knowledgeBases, documents, isHydrated, queue, isIngesting,
      createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase, getKnowledgeBase,
      documentsFor, getDocument, addFileDocument, addNoteDocument, removeDocument,
      retryDocument, regenerateSummary, loadAll, unembeddedCount, allTags,
    ],
  );

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error('useKnowledge must be used within KnowledgeProvider');
  return ctx;
}
