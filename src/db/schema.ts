import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table (Coordinator, Admins, Technical Leads)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('Coordinator'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Categories table (HVAC / AC, Plumbing, Generator, Telephone, Electrical, General / Other, etc.)
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  categoryName: text('category_name').notNull().unique(),
  description: text('description'),
  color: text('color').default('blue'),
  icon: text('icon').default('folder'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// EDFs table (Employee Demand Forms / Material Requests)
export const edfs = pgTable('edfs', {
  id: serial('id').primaryKey(),
  edfNumber: text('edf_number').notNull().unique(),
  categoryId: integer('category_id').references(() => categories.id),
  categoryName: text('category_name').notNull(),
  requestDescription: text('request_description'),
  requestDate: text('request_date').notNull(), // ISO YYYY-MM-DD
  requiredDate: text('required_date').notNull(), // ISO YYYY-MM-DD or timestamp
  expectedDate: text('expected_date'), // ISO YYYY-MM-DD
  requestingTeam: text('requesting_team').notNull(),
  status: text('status').notNull().default('Pending'), // Draft, Submitted, Pending, Partially Received, Received, Completed, Overdue
  priority: text('priority').notNull().default('Normal'), // Low, Normal, High, Urgent
  remarks: text('remarks'),
  receivedDate: text('received_date'),
  completedDate: text('completed_date'),
  createdBy: text('created_by').default('Office Coordinator'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Materials table
export const materials = pgTable('materials', {
  id: serial('id').primaryKey(),
  edfId: integer('edf_id')
    .references(() => edfs.id, { onDelete: 'cascade' })
    .notNull(),
  materialName: text('material_name').notNull(),
  quantity: text('quantity').notNull(),
  unit: text('unit').notNull(),
  description: text('description'),
  status: text('status').default('Pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Attachments table
export const attachments = pgTable('attachments', {
  id: serial('id').primaryKey(),
  edfId: integer('edf_id')
    .references(() => edfs.id, { onDelete: 'cascade' })
    .notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size').default(0),
  fileUrl: text('file_url'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

// Recent Activities / Audit Trail table
export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(), // 'created', 'status_changed', 'updated', 'deleted', 'bulk_status_changed', 'bulk_deleted', 'imported'
  title: text('title').notNull(), // e.g. "EDF-2026-00101 created", "EDF-2026-00102 marked as Received"
  description: text('description'),
  edfId: integer('edf_id'),
  edfNumber: text('edf_number'),
  status: text('status'),
  user: text('user').default('Office Coordinator'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const edfsRelations = relations(edfs, ({ many, one }) => ({
  materials: many(materials),
  attachments: many(attachments),
  category: one(categories, {
    fields: [edfs.categoryId],
    references: [categories.id],
  }),
}));

export const materialsRelations = relations(materials, ({ one }) => ({
  edf: one(edfs, {
    fields: [materials.edfId],
    references: [edfs.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  edf: one(edfs, {
    fields: [attachments.edfId],
    references: [edfs.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  edfs: many(edfs),
}));
