import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import { NoteModel } from './models/NoteModel';
import { FolderModel } from './models/FolderModel';
import { TagModel } from './models/TagModel';
import { ReminderModel } from './models/ReminderModel';
import { TaskModel } from './models/TaskModel';
import { TaskCategoryModel } from './models/TaskCategoryModel';
import { HabitModel } from './models/HabitModel';
import { JournalEntryModel } from './models/JournalEntryModel';
import { PomodoroSessionModel } from './models/PomodoroSessionModel';
import { SharedListModel } from './models/SharedListModel';
import { TaskTemplateModel } from './models/TaskTemplateModel';
import { BadgeModel } from './models/BadgeModel';
import { SettingModel } from './models/SettingModel';
import { KnowledgeBaseModel } from './models/KnowledgeBaseModel';
import { KbDocumentModel } from './models/KbDocumentModel';
import { KbChunkModel } from './models/KbChunkModel';
import { KbMessageModel } from './models/KbMessageModel';
import { PlannerBlockModel } from './models/PlannerBlockModel';
import { PlannerDayModel } from './models/PlannerDayModel';
import {
  BudgetCategoryModel,
  TransactionModel,
  BudgetModel,
  RecurringExpenseModel,
} from './models/BudgetModels';
import {
  FamilyProfileModel,
  MedicineModel,
  DoseLogModel,
  DoctorVisitModel,
} from './models/MedicineModels';
import { BoardModel, BoardItemModel, BoardVersionModel } from './models/WhiteboardModels';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'thinkora',
  jsi: true,
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    NoteModel,
    FolderModel,
    TagModel,
    ReminderModel,
    TaskModel,
    TaskCategoryModel,
    HabitModel,
    JournalEntryModel,
    PomodoroSessionModel,
    SharedListModel,
    TaskTemplateModel,
    BadgeModel,
    SettingModel,
    KnowledgeBaseModel,
    KbDocumentModel,
    KbChunkModel,
    KbMessageModel,
    PlannerBlockModel,
    PlannerDayModel,
    BudgetCategoryModel,
    TransactionModel,
    BudgetModel,
    RecurringExpenseModel,
    FamilyProfileModel,
    MedicineModel,
    DoseLogModel,
    DoctorVisitModel,
    BoardModel,
    BoardItemModel,
    BoardVersionModel,
  ],
});

// Typed collection accessors
export const notesCollection = database.get<NoteModel>('notes');
export const foldersCollection = database.get<FolderModel>('folders');
export const tagsCollection = database.get<TagModel>('tags');
export const remindersCollection = database.get<ReminderModel>('reminders');
export const tasksCollection = database.get<TaskModel>('tasks');
export const taskCategoriesCollection = database.get<TaskCategoryModel>('task_categories');
export const habitsCollection = database.get<HabitModel>('habits');
export const journalCollection = database.get<JournalEntryModel>('journal_entries');
export const pomodoroCollection = database.get<PomodoroSessionModel>('pomodoro_sessions');
export const sharedListsCollection = database.get<SharedListModel>('shared_lists');
export const taskTemplatesCollection = database.get<TaskTemplateModel>('task_templates');
export const badgesCollection = database.get<BadgeModel>('badges');
export const settingsCollection = database.get<SettingModel>('settings');
export const knowledgeBasesCollection = database.get<KnowledgeBaseModel>('knowledge_bases');
export const kbDocumentsCollection = database.get<KbDocumentModel>('kb_documents');
export const kbChunksCollection = database.get<KbChunkModel>('kb_chunks');
export const kbMessagesCollection = database.get<KbMessageModel>('kb_messages');
export const plannerBlocksCollection = database.get<PlannerBlockModel>('planner_blocks');
export const plannerDaysCollection = database.get<PlannerDayModel>('planner_days');
export const budgetCategoriesCollection = database.get<BudgetCategoryModel>('budget_categories');
export const transactionsCollection = database.get<TransactionModel>('transactions');
export const budgetsCollection = database.get<BudgetModel>('budgets');
export const recurringExpensesCollection = database.get<RecurringExpenseModel>('recurring_expenses');
export const familyProfilesCollection = database.get<FamilyProfileModel>('family_profiles');
export const medicinesCollection = database.get<MedicineModel>('medicines');
export const doseLogsCollection = database.get<DoseLogModel>('dose_logs');
export const doctorVisitsCollection = database.get<DoctorVisitModel>('doctor_visits');
export const boardsCollection = database.get<BoardModel>('boards');
export const boardItemsCollection = database.get<BoardItemModel>('board_items');
export const boardVersionsCollection = database.get<BoardVersionModel>('board_versions');
