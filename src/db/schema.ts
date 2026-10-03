import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  phone: text('phone').notNull().unique(), // Username = Phone Number
  name: text('name').notNull(),
  role: text('role').notNull().default('visitor'), // 'admin' | 'visitor'
  passwordHash: text('password_hash').notNull(),
  displayPassword: text('display_password'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  icon: text('icon'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const edfs = pgTable('edfs', {
  id: serial('id').primaryKey(),
  edfNumber: text('edf_number').notNull().unique(),
  requesterName: text('requester_name').notNull(),
  category: text('category').notNull(),
  issueDate: timestamp('issue_date').notNull(),
  requiredDate: timestamp('required_date').notNull(),
  materialList: text('material_list').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unit: text('unit').notNull().default('pcs'),
  status: text('status').notNull().default('Pending'), // 'Pending' | 'Received' | 'Completed' | 'Overdue'
  priority: text('priority').notNull().default('Medium'), // 'Low' | 'Medium' | 'High'
  remarks: text('remarks'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const edfItems = pgTable('edf_items', {
  id: serial('id').primaryKey(),
  edfId: integer('edf_id').references(() => edfs.id, { onDelete: 'cascade' }).notNull(),
  itemDescription: text('item_description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unit: text('unit').notNull().default('pcs'),
  status: text('status').notNull().default('Pending'), // 'Pending' | 'Received'
  receivedAt: timestamp('received_at'),
  receivedBy: text('received_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  edfNumber: text('edf_number'),
  action: text('action').notNull(), // e.g., 'EDF-001 Created', 'EDF-005 Updated', 'EDF-008 Marked as Received'
  userPhone: text('user_phone'),
  userName: text('user_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const edfStatusHistory = pgTable('edf_status_history', {
  id: serial('id').primaryKey(),
  edfId: integer('edf_id').references(() => edfs.id, { onDelete: 'cascade' }).notNull(),
  edfNumber: text('edf_number').notNull(),
  fromStatus: text('from_status'), // previous status or null for initial creation
  toStatus: text('to_status').notNull(), // 'Pending' | 'Received' | 'Completed' | 'Overdue'
  changedBy: text('changed_by'), // user name or phone or 'System'
  notes: text('notes'), // optional description or note
  createdAt: timestamp('created_at').defaultNow(),
});

export const edfsRelations = relations(edfs, ({ many }) => ({
  items: many(edfItems),
  statusHistory: many(edfStatusHistory),
}));

export const edfItemsRelations = relations(edfItems, ({ one }) => ({
  edf: one(edfs, {
    fields: [edfItems.edfId],
    references: [edfs.id],
  }),
}));

export const edfStatusHistoryRelations = relations(edfStatusHistory, ({ one }) => ({
  edf: one(edfs, {
    fields: [edfStatusHistory.edfId],
    references: [edfs.id],
  }),
}));

export const requesters = pgTable('requesters', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const edfBackups = pgTable('edf_backups', {
  id: serial('id').primaryKey(),
  backupType: text('backup_type').notNull().default('auto'), // 'auto' | 'pre_update' | 'manual'
  snapshotData: text('snapshot_data').notNull(), // Complete JSON snapshot
  recordsCount: integer('records_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});
