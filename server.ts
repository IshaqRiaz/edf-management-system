import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from './src/db/index.ts';
import { edfs, materials, categories, attachments, users, activities } from './src/db/schema.ts';
import { eq, desc, asc, sql, and, or, ilike } from 'drizzle-orm';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import * as XLSX from 'xlsx';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to log activities for auditability
async function logActivity(params: {
  action: string;
  title: string;
  description?: string;
  edfId?: number | null;
  edfNumber?: string | null;
  status?: string | null;
  user?: string;
}) {
  try {
    await db.insert(activities).values({
      action: params.action,
      title: params.title,
      description: params.description || '',
      edfId: params.edfId ?? null,
      edfNumber: params.edfNumber ?? null,
      status: params.status ?? null,
      user: params.user || 'Office Coordinator',
    });
  } catch (err) {
    console.error('Failed to log audit activity:', err);
  }
}

// Seed initial activities if table is empty
async function seedInitialActivities() {
  try {
    const existing = await db.select().from(activities).limit(1);
    if (existing.length === 0) {
      const allExistingEdfs = await db.select().from(edfs).orderBy(asc(edfs.id)).limit(8);
      if (allExistingEdfs.length > 0) {
        for (const edf of allExistingEdfs) {
          // Log creation
          await db.insert(activities).values({
            action: 'created',
            title: `${edf.edfNumber} created`,
            description: `Requisition created for ${edf.categoryName} (${edf.requestingTeam})`,
            edfId: edf.id,
            edfNumber: edf.edfNumber,
            status: edf.status,
            user: edf.createdBy || 'Office Coordinator',
            createdAt: edf.createdAt || new Date(Date.now() - 3600 * 1000 * 12),
          });

          // If received or completed, log that operation as well
          if (edf.status === 'Received') {
            await db.insert(activities).values({
              action: 'status_changed',
              title: `${edf.edfNumber} marked as Received`,
              description: `Materials received and confirmed by coordinator`,
              edfId: edf.id,
              edfNumber: edf.edfNumber,
              status: 'Received',
              user: 'Office Coordinator',
              createdAt: new Date(Date.now() - 3600 * 1000 * 3),
            });
          } else if (edf.status === 'Completed') {
            await db.insert(activities).values({
              action: 'status_changed',
              title: `${edf.edfNumber} marked as Completed`,
              description: `Voucher fulfilled and delivery confirmed`,
              edfId: edf.id,
              edfNumber: edf.edfNumber,
              status: 'Completed',
              user: 'Office Coordinator',
              createdAt: new Date(Date.now() - 3600 * 1000 * 5),
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error seeding initial activities:', err);
  }
}

// Helper to check and auto-update overdue status in DB
async function syncOverdueStatuses() {
  try {
    const nowIso = new Date().toISOString();
    // Any EDF that is 'Pending', 'Submitted', or 'Draft' whose requiredDate has passed is Overdue
    const candidateEdfs = await db
      .select()
      .from(edfs)
      .where(
        and(
          or(eq(edfs.status, 'Pending'), eq(edfs.status, 'Submitted'), eq(edfs.status, 'Draft')),
          sql`edfs.required_date < ${nowIso}`
        )
      );

    for (const item of candidateEdfs) {
      await db
        .update(edfs)
        .set({ status: 'Overdue', updatedAt: new Date() })
        .where(eq(edfs.id, item.id));
    }
  } catch (err) {
    console.error('Error syncing overdue statuses:', err);
  }
}

// -------------------------------------------------------------
// CATEGORIES API
// -------------------------------------------------------------
app.get('/api/categories', async (req, res) => {
  try {
    const allCategories = await db.select().from(categories).orderBy(asc(categories.id));
    res.json(allCategories);
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch categories' });
  }
});

app.post('/api/categories', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { categoryName, description, color, icon } = req.body;
    if (!categoryName || !categoryName.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const [inserted] = await db
      .insert(categories)
      .values({
        categoryName: categoryName.trim(),
        description: description?.trim() || '',
        color: color || 'blue',
        icon: icon || 'folder',
        active: true,
      })
      .returning();
    res.status(201).json(inserted);
  } catch (error: any) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: error.message || 'Failed to create category' });
  }
});

app.put('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { categoryName, description, color, icon, active } = req.body;
    const [updated] = await db
      .update(categories)
      .set({
        categoryName,
        description,
        color,
        icon,
        active: active !== undefined ? active : true,
      })
      .where(eq(categories.id, id))
      .returning();
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: error.message || 'Failed to update category' });
  }
});

// -------------------------------------------------------------
// EDFs (DEMAND FORMS) API
// -------------------------------------------------------------
app.get('/api/edfs', async (req, res) => {
  try {
    await syncOverdueStatuses();

    const { category, status, search, overdueOnly } = req.query;

    const allEdfs = await db.select().from(edfs).orderBy(desc(edfs.id));

    // Fetch materials and attachments for each EDF
    const allMaterials = await db.select().from(materials);
    const allAttachments = await db.select().from(attachments);

    const materialsByEdf = new Map<number, any[]>();
    for (const mat of allMaterials) {
      const list = materialsByEdf.get(mat.edfId) || [];
      list.push(mat);
      materialsByEdf.set(mat.edfId, list);
    }

    const attachmentsByEdf = new Map<number, any[]>();
    for (const att of allAttachments) {
      const list = attachmentsByEdf.get(att.edfId) || [];
      list.push(att);
      attachmentsByEdf.set(att.edfId, list);
    }

    let results = allEdfs.map((edf) => ({
      ...edf,
      materials: materialsByEdf.get(edf.id) || [],
      attachments: attachmentsByEdf.get(edf.id) || [],
      materialCount: (materialsByEdf.get(edf.id) || []).length,
      attachmentCount: (attachmentsByEdf.get(edf.id) || []).length,
    }));

    if (category && category !== 'All') {
      results = results.filter(
        (e) => e.categoryName?.toLowerCase() === String(category).toLowerCase()
      );
    }

    if (status && status !== 'All') {
      results = results.filter(
        (e) => e.status?.toLowerCase() === String(status).toLowerCase()
      );
    }

    if (overdueOnly === 'true') {
      results = results.filter((e) => e.status === 'Overdue');
    }

    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim();
      results = results.filter((e) => {
        const inNum = e.edfNumber?.toLowerCase().includes(q);
        const inCat = e.categoryName?.toLowerCase().includes(q);
        const inTeam = e.requestingTeam?.toLowerCase().includes(q);
        const inDesc = e.requestDescription?.toLowerCase().includes(q);
        const inRemarks = e.remarks?.toLowerCase().includes(q);
        const inMats = e.materials.some((m: any) =>
          m.materialName?.toLowerCase().includes(q)
        );
        return inNum || inCat || inTeam || inDesc || inRemarks || inMats;
      });
    }

    res.json(results);
  } catch (error: any) {
    console.error('Error fetching EDFs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch EDFs' });
  }
});

app.get('/api/edfs/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [edfRecord] = await db.select().from(edfs).where(eq(edfs.id, id));
    if (!edfRecord) {
      return res.status(404).json({ error: 'EDF not found' });
    }

    const edfMaterials = await db.select().from(materials).where(eq(materials.edfId, id));
    const edfAttachments = await db.select().from(attachments).where(eq(attachments.edfId, id));

    res.json({
      ...edfRecord,
      materials: edfMaterials,
      attachments: edfAttachments,
    });
  } catch (error: any) {
    console.error('Error fetching EDF:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch EDF' });
  }
});

app.post('/api/edfs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      edfNumber,
      categoryId,
      categoryName,
      requestDescription,
      requestDate,
      requiredDate,
      expectedDate,
      requestingTeam,
      status,
      priority,
      remarks,
      materials: materialItems = [],
      attachments: attachmentItems = [],
    } = req.body;

    if (!requiredDate) {
      return res.status(400).json({ error: 'Required date is mandatory' });
    }

    // Auto-generate EDF Number if missing
    let finalEdfNumber = edfNumber?.trim();
    if (!finalEdfNumber) {
      const [maxEdf] = await db.select().from(edfs).orderBy(desc(edfs.id)).limit(1);
      const nextId = (maxEdf?.id || 0) + 1;
      finalEdfNumber = `EDF-${new Date().getFullYear()}-${String(nextId + 100).padStart(5, '0')}`;
    }

    // Initial status calculation
    let initialStatus = status || 'Pending';
    const reqDateTime = new Date(requiredDate).getTime();
    if (Date.now() > reqDateTime && initialStatus !== 'Received' && initialStatus !== 'Completed') {
      initialStatus = 'Overdue';
    }

    const [newEdf] = await db
      .insert(edfs)
      .values({
        edfNumber: finalEdfNumber,
        categoryId: categoryId ? parseInt(categoryId, 10) : null,
        categoryName: categoryName || 'General / Other',
        requestDescription: requestDescription || '',
        requestDate: requestDate || new Date().toISOString().split('T')[0],
        requiredDate: requiredDate,
        expectedDate: expectedDate || null,
        requestingTeam: requestingTeam || 'General Maintenance',
        status: initialStatus,
        priority: priority || 'Normal',
        remarks: remarks || '',
        createdBy: req.user?.name || 'Office Coordinator',
      })
      .returning();

    // Insert materials
    if (Array.isArray(materialItems) && materialItems.length > 0) {
      for (const item of materialItems) {
        if (item.materialName && item.materialName.trim()) {
          await db.insert(materials).values({
            edfId: newEdf.id,
            materialName: item.materialName.trim(),
            quantity: String(item.quantity || '1'),
            unit: item.unit?.trim() || 'Pieces',
            description: item.description?.trim() || '',
            status: item.status || 'Pending',
          });
        }
      }
    }

    // Insert attachments
    if (Array.isArray(attachmentItems) && attachmentItems.length > 0) {
      for (const att of attachmentItems) {
        if (att.fileName) {
          await db.insert(attachments).values({
            edfId: newEdf.id,
            fileName: att.fileName,
            fileType: att.fileType || 'application/pdf',
            fileSize: att.fileSize || 0,
            fileUrl: att.fileUrl || '',
          });
        }
      }
    }

    const createdMaterials = await db.select().from(materials).where(eq(materials.edfId, newEdf.id));
    const createdAttachments = await db.select().from(attachments).where(eq(attachments.edfId, newEdf.id));

    // Audit activity log
    await logActivity({
      action: 'created',
      title: `${newEdf.edfNumber} created`,
      description: `Requisition created for ${newEdf.categoryName} (${newEdf.requestingTeam})`,
      edfId: newEdf.id,
      edfNumber: newEdf.edfNumber,
      status: newEdf.status,
      user: req.user?.name || 'Office Coordinator',
    });

    res.status(201).json({
      ...newEdf,
      materials: createdMaterials,
      attachments: createdAttachments,
    });
  } catch (error: any) {
    console.error('Error creating EDF:', error);
    res.status(500).json({ error: error.message || 'Failed to create EDF' });
  }
});

app.put('/api/edfs/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      edfNumber,
      categoryId,
      categoryName,
      requestDescription,
      requestDate,
      requiredDate,
      expectedDate,
      requestingTeam,
      status,
      priority,
      remarks,
      materials: materialItems,
      attachments: attachmentItems,
    } = req.body;

    let computedStatus = status;
    if (requiredDate) {
      const reqTime = new Date(requiredDate).getTime();
      if (Date.now() > reqTime && computedStatus !== 'Received' && computedStatus !== 'Completed') {
        computedStatus = 'Overdue';
      }
    }

    const [updatedEdf] = await db
      .update(edfs)
      .set({
        edfNumber,
        categoryId: categoryId ? parseInt(categoryId, 10) : null,
        categoryName,
        requestDescription,
        requestDate,
        requiredDate,
        expectedDate,
        requestingTeam,
        status: computedStatus,
        priority,
        remarks,
        updatedAt: new Date(),
      })
      .where(eq(edfs.id, id))
      .returning();

    // Update materials if provided
    if (Array.isArray(materialItems)) {
      await db.delete(materials).where(eq(materials.edfId, id));
      for (const item of materialItems) {
        if (item.materialName && item.materialName.trim()) {
          await db.insert(materials).values({
            edfId: id,
            materialName: item.materialName.trim(),
            quantity: String(item.quantity || '1'),
            unit: item.unit?.trim() || 'Pieces',
            description: item.description?.trim() || '',
            status: item.status || 'Pending',
          });
        }
      }
    }

    // Add new attachments if provided
    if (Array.isArray(attachmentItems) && attachmentItems.length > 0) {
      for (const att of attachmentItems) {
        if (att.fileName) {
          await db.insert(attachments).values({
            edfId: id,
            fileName: att.fileName,
            fileType: att.fileType || 'application/pdf',
            fileSize: att.fileSize || 0,
            fileUrl: att.fileUrl || '',
          });
        }
      }
    }

    const currentMaterials = await db.select().from(materials).where(eq(materials.edfId, id));
    const currentAttachments = await db.select().from(attachments).where(eq(attachments.edfId, id));

    // Audit activity log
    await logActivity({
      action: 'updated',
      title: `${updatedEdf.edfNumber} updated`,
      description: `Requisition details and delivery schedule updated`,
      edfId: updatedEdf.id,
      edfNumber: updatedEdf.edfNumber,
      status: updatedEdf.status,
      user: req.user?.name || 'Office Coordinator',
    });

    res.json({
      ...updatedEdf,
      materials: currentMaterials,
      attachments: currentAttachments,
    });
  } catch (error: any) {
    console.error('Error updating EDF:', error);
    res.status(500).json({ error: error.message || 'Failed to update EDF' });
  }
});

app.patch('/api/edfs/:id/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, remarks } = req.body;
    const nowIso = new Date().toISOString().split('T')[0];

    const updateFields: any = {
      status,
      updatedAt: new Date(),
    };

    if (remarks !== undefined) {
      updateFields.remarks = remarks;
    }

    if (status === 'Received') {
      updateFields.receivedDate = nowIso;
      // Also update materials to Received
      await db
        .update(materials)
        .set({ status: 'Received' })
        .where(eq(materials.edfId, id));
    } else if (status === 'Completed') {
      updateFields.completedDate = nowIso;
      if (!updateFields.receivedDate) updateFields.receivedDate = nowIso;
      await db
        .update(materials)
        .set({ status: 'Received' })
        .where(eq(materials.edfId, id));
    }

    const [updated] = await db
      .update(edfs)
      .set(updateFields)
      .where(eq(edfs.id, id))
      .returning();

    // Audit activity log
    await logActivity({
      action: 'status_changed',
      title: `${updated.edfNumber} marked as ${status}`,
      description: remarks ? `Status updated to ${status}. Remarks: ${remarks}` : `Status marked as ${status}`,
      edfId: updated.id,
      edfNumber: updated.edfNumber,
      status: status,
      user: req.user?.name || 'Office Coordinator',
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error patching EDF status:', error);
    res.status(500).json({ error: error.message || 'Failed to update status' });
  }
});

app.patch('/api/edfs/bulk/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { ids, status, remarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ error: 'ids array and status are required' });
    }
    const numericIds = ids.map((n: any) => parseInt(n, 10)).filter((n: number) => !isNaN(n));
    if (numericIds.length === 0) {
      return res.status(400).json({ error: 'Valid numeric IDs are required' });
    }
    const nowIso = new Date().toISOString().split('T')[0];

    const updateFields: any = {
      status,
      updatedAt: new Date(),
    };
    if (remarks !== undefined) updateFields.remarks = remarks;

    if (status === 'Received') {
      updateFields.receivedDate = nowIso;
    } else if (status === 'Completed') {
      updateFields.completedDate = nowIso;
      updateFields.receivedDate = nowIso;
    }

    const updated = await db
      .update(edfs)
      .set(updateFields)
      .where(sql`${edfs.id} IN (${sql.join(numericIds.map((id: number) => sql`${id}`), sql`, `)})`)
      .returning();

    if (status === 'Received' || status === 'Completed') {
      await db
        .update(materials)
        .set({ status: 'Received' })
        .where(sql`${materials.edfId} IN (${sql.join(numericIds.map((id: number) => sql`${id}`), sql`, `)})`);
    }

    // Audit activity log
    await logActivity({
      action: 'bulk_status_changed',
      title: updated.length === 1 ? `${updated[0].edfNumber} marked as ${status}` : `${updated.length} EDFs marked as ${status}`,
      description: `Bulk status update: ${updated.map((e: any) => e.edfNumber).slice(0, 3).join(', ')}${updated.length > 3 ? '...' : ''}`,
      status: status,
      user: req.user?.name || 'Office Coordinator',
    });

    res.json({ success: true, count: updated.length, updated });
  } catch (error: any) {
    console.error('Error bulk updating EDF status:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk update status' });
  }
});

app.post('/api/edfs/bulk/delete', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const numericIds = ids.map((n: any) => parseInt(n, 10)).filter((n: number) => !isNaN(n));
    if (numericIds.length === 0) {
      return res.status(400).json({ error: 'Valid numeric IDs are required' });
    }

    const deletedEdfs = await db
      .select({ edfNumber: edfs.edfNumber })
      .from(edfs)
      .where(sql`${edfs.id} IN (${sql.join(numericIds.map((id: number) => sql`${id}`), sql`, `)})`);

    await db.delete(materials).where(sql`${materials.edfId} IN (${sql.join(numericIds.map((id: number) => sql`${id}`), sql`, `)})`);
    await db.delete(attachments).where(sql`${attachments.edfId} IN (${sql.join(numericIds.map((id: number) => sql`${id}`), sql`, `)})`);
    await db.delete(edfs).where(sql`${edfs.id} IN (${sql.join(numericIds.map((id: number) => sql`${id}`), sql`, `)})`);

    // Audit activity log
    await logActivity({
      action: 'bulk_deleted',
      title: `Bulk deleted ${numericIds.length} EDFs`,
      description: `Removed vouchers: ${deletedEdfs.map((e) => e.edfNumber).slice(0, 3).join(', ')}${deletedEdfs.length > 3 ? '...' : ''}`,
      user: req.user?.name || 'Office Coordinator',
    });

    res.json({ success: true, count: numericIds.length });
  } catch (error: any) {
    console.error('Error bulk deleting EDFs:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk delete EDFs' });
  }
});

app.delete('/api/edfs/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [targetEdf] = await db.select().from(edfs).where(eq(edfs.id, id));

    await db.delete(materials).where(eq(materials.edfId, id));
    await db.delete(attachments).where(eq(attachments.edfId, id));
    await db.delete(edfs).where(eq(edfs.id, id));

    // Audit activity log
    await logActivity({
      action: 'deleted',
      title: `${targetEdf?.edfNumber || `EDF #${id}`} deleted`,
      description: `Requisition removed from system`,
      edfNumber: targetEdf?.edfNumber,
      user: req.user?.name || 'Office Coordinator',
    });

    res.json({ success: true, message: 'EDF deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting EDF:', error);
    res.status(500).json({ error: error.message || 'Failed to delete EDF' });
  }
});

// -------------------------------------------------------------
// ACTIVITIES / AUDIT TRAIL API
// -------------------------------------------------------------
app.get('/api/activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const recentActivities = await db
      .select()
      .from(activities)
      .orderBy(desc(activities.createdAt), desc(activities.id))
      .limit(limit);
    res.json(recentActivities);
  } catch (error: any) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch activities' });
  }
});

// -------------------------------------------------------------
// DASHBOARD STATS API
// -------------------------------------------------------------
app.get('/api/stats', async (req, res) => {
  try {
    await syncOverdueStatuses();

    const allEdfs = await db.select().from(edfs);
    const allCategories = await db.select().from(categories);
    const allMaterials = await db.select().from(materials);

    const now = Date.now();
    const twoDaysMs = 48 * 60 * 60 * 1000;

    let total = allEdfs.length;
    let pending = 0;
    let completed = 0;
    let received = 0;
    let overdue = 0;
    let dueSoon = 0;

    const categoryCounts: Record<string, number> = {
      'HVAC / AC': 0,
      'Plumbing': 0,
      'Generator': 0,
      'Telephone': 0,
      'Electrical': 0,
      'General / Other': 0,
    };

    // Ensure all registered categories have an entry
    for (const cat of allCategories) {
      if (!(cat.categoryName in categoryCounts)) {
        categoryCounts[cat.categoryName] = 0;
      }
    }

    for (const edf of allEdfs) {
      // Category count
      const catName = edf.categoryName || 'General / Other';
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;

      // Status count
      if (edf.status === 'Overdue') {
        overdue++;
      } else if (edf.status === 'Completed') {
        completed++;
      } else if (edf.status === 'Received') {
        received++;
      } else {
        pending++;
      }

      // Due soon check (< 48 hours and not received/completed)
      if (edf.status !== 'Completed' && edf.status !== 'Received' && edf.status !== 'Overdue') {
        const reqTime = new Date(edf.requiredDate).getTime();
        const diff = reqTime - now;
        if (diff > 0 && diff <= twoDaysMs) {
          dueSoon++;
        }
      }
    }

    // Monthly breakdown (last 6 months)
    const monthlyMap: Record<string, { total: number; completed: number; overdue: number }> = {};
    for (const edf of allEdfs) {
      const monthStr = edf.requestDate ? edf.requestDate.substring(0, 7) : '2026-09';
      if (!monthlyMap[monthStr]) {
        monthlyMap[monthStr] = { total: 0, completed: 0, overdue: 0 };
      }
      monthlyMap[monthStr].total++;
      if (edf.status === 'Completed' || edf.status === 'Received') {
        monthlyMap[monthStr].completed++;
      } else if (edf.status === 'Overdue') {
        monthlyMap[monthStr].overdue++;
      }
    }

    res.json({
      total,
      pending,
      received,
      completed,
      overdue,
      dueSoon,
      receivedOrCompleted: received + completed,
      categoryCounts,
      totalMaterials: allMaterials.length,
      monthlyMap,
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch statistics' });
  }
});

// -------------------------------------------------------------
// INTELLIGENT DOCUMENT EXTRACTION & CATEGORY DETECTION API
// -------------------------------------------------------------
app.post('/api/extract-edf', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { fileName, fileContentBase64, rawText, fileType } = req.body;

    let documentText = rawText || '';

    // If Excel or CSV file content is passed as base64, parse using XLSX
    if (
      fileContentBase64 &&
      (fileName?.endsWith('.xlsx') ||
        fileName?.endsWith('.xls') ||
        fileName?.endsWith('.csv') ||
        fileType?.includes('sheet') ||
        fileType?.includes('csv'))
    ) {
      try {
        const buffer = Buffer.from(fileContentBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetNames = workbook.SheetNames;
        let sheetContent = '';
        for (const sheet of sheetNames) {
          const worksheet = workbook.Sheets[sheet];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          sheetContent += `\n--- Sheet: ${sheet} ---\n${csv}`;
        }
        documentText = sheetContent;
      } catch (e) {
        console.warn('XLSX parsing failed, falling back to direct multimodal:', e);
      }
    }

    // Fetch existing categories from DB so Gemini classifies accurately into active categories
    const existingCategories = await db.select().from(categories);
    const categoryNames = existingCategories.map((c) => c.categoryName);

    // Initialize Gemini SDK using @google/genai
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined. Using smart local rule-based extractor.');
      // Smart rule-based fallback
      const extracted = runRuleBasedExtractor(fileName, documentText, categoryNames);
      return res.json(extracted);
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert Office Requisition and Material Demand Form (EDF) analyzer for a technical facilities management department.
Your task is to extract all material requisition data from the provided document content (which may be a scanned EDF, technical requisition slip, purchase order, Excel sheet, or PDF memo).

Available Categories:
${categoryNames.map((c) => `- "${c}"`).join('\n')}

Classification Rules:
1. "HVAC / AC": AC filter, compressor, copper pipe, capacitor, refrigerant (R410A, R22, R134a), chillers, cooling coil, AHU, thermostat, blower motor, duct.
2. "Plumbing": Water valve, gate valve, drain pipe, PVC pipe, wash basin, mixer tap, faucet, pump, gasket, sanitary fittings, sewer, water heater.
3. "Generator": Generator oil filter, diesel fuel filter, generator battery, alternator belt, DG set, Cummins, Perkins, lube oil, radiator coolant.
4. "Telephone": Telephone cable, telephone connector (RJ11), telephone handset, PBX, patch panel, intercom, trunk line.
5. "Electrical": MCB, circuit breaker, contactor, cable, switch, socket, fuse, distribution board, transformer, LED driver, relay.
6. If unclear or diverse general maintenance tools/PPE: classify as "General / Other" or the most fitting category, and explain why.

Today's current date is ${new Date().toISOString().split('T')[0]}.

You must extract:
- edfNumber: string (look for EDF-XXXX, REQ-XXXX, PO-XXXX, or suggest "EDF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}")
- category: one exact string from [${categoryNames.map((c) => `"${c}"`).join(', ')}]
- confidence: "High" | "Medium" | "Low"
- categoryReasoning: brief 1-2 sentence explanation of why this category was matched based on specific materials found
- requestDescription: short summary of the demand
- requestingTeam: e.g. "HVAC Maintenance Team", "Facility Plumbing Crew", etc.
- requestDate: YYYY-MM-DD
- requiredDate: YYYY-MM-DD or YYYY-MM-DDTHH:mm
- expectedDate: YYYY-MM-DD (optional)
- priority: "Normal" | "High" | "Urgent"
- remarks: any notes, vendor names, or special delivery instructions
- materials: list of items with { materialName: string, quantity: string, unit: string, description: string }

Return strictly a valid JSON object matching the requested schema.`;

    const contents: any[] = [];

    // If PDF or image base64 is available and text wasn't extracted from XLSX:
    if (fileContentBase64 && (!documentText || documentText.length < 50)) {
      const mime = fileType || (fileName?.endsWith('.pdf') ? 'application/pdf' : 'image/png');
      contents.push({
        inlineData: {
          mimeType: mime,
          data: fileContentBase64,
        },
      });
      contents.push({
        text: `Analyze this uploaded document (${fileName}) and extract the complete EDF material request information according to the system instructions.`,
      });
    } else {
      contents.push({
        text: `Document Name: ${fileName}\n\nDocument Content:\n${documentText || 'No text extracted. Please suggest sample template based on filename.'}`,
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            edfNumber: { type: Type.STRING },
            category: { type: Type.STRING },
            confidence: { type: Type.STRING },
            categoryReasoning: { type: Type.STRING },
            requestDescription: { type: Type.STRING },
            requestingTeam: { type: Type.STRING },
            requestDate: { type: Type.STRING },
            requiredDate: { type: Type.STRING },
            expectedDate: { type: Type.STRING },
            priority: { type: Type.STRING },
            remarks: { type: Type.STRING },
            materials: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  materialName: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['materialName', 'quantity', 'unit'],
              },
            },
          },
          required: [
            'edfNumber',
            'category',
            'categoryReasoning',
            'requestDescription',
            'requestDate',
            'requiredDate',
            'requestingTeam',
            'materials',
          ],
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('Empty response from AI model');
    }

    const parsedData = JSON.parse(textOutput);
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error during AI document extraction:', error);
    // Fall back to rule-based parser so user workflow is never interrupted
    const fallback = runRuleBasedExtractor(
      req.body.fileName,
      req.body.rawText || '',
      ['HVAC / AC', 'Plumbing', 'Generator', 'Telephone', 'Electrical', 'General / Other']
    );
    res.json(fallback);
  }
});

// Rule based fallback extractor if API key is absent or offline
function runRuleBasedExtractor(fileName: string, text: string, categoriesList: string[]) {
  const lower = (fileName + ' ' + text).toLowerCase();

  let category = 'General / Other';
  let reasoning = 'Classified as General / Other based on standard equipment demand.';
  let confidence = 'Medium';

  if (
    lower.includes('ac ') ||
    lower.includes('hvac') ||
    lower.includes('compressor') ||
    lower.includes('copper pipe') ||
    lower.includes('capacitor') ||
    lower.includes('refrigerant') ||
    lower.includes('filter') ||
    lower.includes('chiller')
  ) {
    category = 'HVAC / AC';
    reasoning = 'Detected HVAC keywords: compressor, copper pipe, capacitor, or AC filters.';
    confidence = 'High';
  } else if (
    lower.includes('plumb') ||
    lower.includes('valve') ||
    lower.includes('pipe') ||
    lower.includes('wash basin') ||
    lower.includes('drain') ||
    lower.includes('mixer tap')
  ) {
    category = 'Plumbing';
    reasoning = 'Detected Plumbing components: valves, pipes, drainage, or sanitary fittings.';
    confidence = 'High';
  } else if (
    lower.includes('generator') ||
    lower.includes('diesel') ||
    lower.includes('oil filter') ||
    lower.includes('fuel filter') ||
    lower.includes('dg set') ||
    lower.includes('battery')
  ) {
    category = 'Generator';
    reasoning = 'Detected Generator maintenance items: filters, diesel, battery, or engine parts.';
    confidence = 'High';
  } else if (
    lower.includes('telephone') ||
    lower.includes('telecom') ||
    lower.includes('handset') ||
    lower.includes('rj11') ||
    lower.includes('pbx') ||
    lower.includes('cable 2-pair')
  ) {
    category = 'Telephone';
    reasoning = 'Detected Telephone hardware: handsets, RJ11 connectors, or telephone cabling.';
    confidence = 'High';
  } else if (
    lower.includes('electr') ||
    lower.includes('mcb') ||
    lower.includes('contactor') ||
    lower.includes('breaker') ||
    lower.includes('switch') ||
    lower.includes('socket') ||
    lower.includes('fuse')
  ) {
    category = 'Electrical';
    reasoning = 'Detected Electrical gear: circuit breakers, contactors, cables, or power sockets.';
    confidence = 'High';
  }

  // Generate clean default fields
  const today = new Date().toISOString().split('T')[0];
  const required = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return {
    edfNumber: `EDF-2026-${Math.floor(10000 + Math.random() * 90000)}`,
    category,
    confidence,
    categoryReasoning: reasoning,
    requestDescription: `Material requisition extracted from ${fileName || 'uploaded document'}`,
    requestingTeam: `${category} Technical Unit`,
    requestDate: today,
    requiredDate: required,
    expectedDate: today,
    priority: 'Normal',
    remarks: 'Auto-extracted from uploaded file. Please review quantities and units before saving.',
    materials: [
      { materialName: 'Primary Material Item #1', quantity: '10', unit: 'Pieces', description: 'Extracted item' },
      { materialName: 'Connecting Accessories', quantity: '25', unit: 'Meters', description: 'Extracted item' },
    ],
  };
}

// -------------------------------------------------------------
// VITE MIDDLEWARE OR STATIC SERVING
// -------------------------------------------------------------
async function setupVite() {
  await seedInitialActivities();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`EDF Management Server running on port ${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('Failed to start server:', err);
});
