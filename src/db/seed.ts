import bcrypt from 'bcryptjs';
import { db } from './index.ts';
import { users, categories, edfs, edfItems, activityLogs, requesters, systemSettings } from './schema.ts';
import { eq } from 'drizzle-orm';
import { restoreFromBackupIfNeeded, takeDatabaseBackup } from '../lib/backupManager.ts';

export const DEFAULT_REQUESTER_NAMES = [
  'Ashraf',
  'Azeem Karim',
  'Glacier Eng',
  'Gulsher',
  'Imran',
  'Kamran Alam',
  'Nazim',
  'Rasheed',
  'Sarfraz Aziz',
  'Shahzad',
  'Sharafat',
  'Taimur',
  'Tanveer Ijaz',
  'Younas',
];

export async function seedDatabase() {
  try {
    // 0. Attempt backup restoration if database was ever reset
    await restoreFromBackupIfNeeded();

    // 1. Check if admin user exists
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length === 0) {
      console.log('Seeding initial users...');
      const adminHash = await bcrypt.hash('admin123', 10);
      const visitorHash = await bcrypt.hash('visitor123', 10);

      await db.insert(users).values([
        {
          phone: '03001234567',
          name: 'Coordinator Admin',
          role: 'admin',
          passwordHash: adminHash,
        },
        {
          phone: '03009876543',
          name: 'Site Visitor',
          role: 'visitor',
          passwordHash: visitorHash,
        },
      ]);
      console.log('Default users seeded.');
    }

    // 2. Check and seed categories
    const existingCategories = await db.select().from(categories);
    const defaultCategories = [
      { name: 'HVAC', description: 'Heating, Ventilation, and Air Conditioning equipment & repairs', icon: 'Wind' },
      { name: 'Plumbing', description: 'Pipes, fittings, valves, water pumps and drainage', icon: 'Droplets' },
      { name: 'Generator', description: 'Diesel generator maintenance, fuel, and electrical backup', icon: 'Zap' },
      { name: 'Telephone', description: 'PBX lines, intercoms, telecom cables and handsets', icon: 'Phone' },
      { name: 'Electrical', description: 'Wiring, breakers, distribution boxes, lighting fixtures', icon: 'Sparkles' },
      { name: 'General', description: 'General office maintenance, furniture, and carpentry', icon: 'Layers' },
    ];

    if (existingCategories.length === 0) {
      console.log('Seeding categories...');
      for (const cat of defaultCategories) {
        await db.insert(categories).values(cat).onConflictDoNothing();
      }
    }

    // 3. Seed default Requesters list (alphabetical order)
    const existingRequesters = await db.select().from(requesters).limit(1);
    if (existingRequesters.length === 0) {
      console.log('Seeding requester names in alphabetical order...');
      for (const name of DEFAULT_REQUESTER_NAMES) {
        await db.insert(requesters).values({ name }).onConflictDoNothing();
      }
    }

    // 4. Check if seed has ever been executed before or if database already contains EDFs
    const seedSetting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'seed_completed'))
      .limit(1);

    const hasSeedCompleted = seedSetting.length > 0 && seedSetting[0].value === 'true';
    const existingEdfs = await db.select().from(edfs).limit(1);

    if (hasSeedCompleted || existingEdfs.length > 0) {
      console.log('[Persistence] User data detected or initial seed already finalized. Preserving existing records without modification.');
      await takeDatabaseBackup('auto');
      return;
    }

    // 5. Very first installation ONLY: seed baseline sample EDFs
    console.log('Seeding initial baseline EDFs for first installation...');
    const now = new Date();

    const futureDate1 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 5 * 3600 * 1000);
    const soonDate1 = new Date(now.getTime() + 18 * 3600 * 1000);
    const soonDate2 = new Date(now.getTime() + 6 * 3600 * 1000);
    const pastDate1 = new Date(now.getTime() - (2 * 24 + 8) * 3600 * 1000);
    const pastDate2 = new Date(now.getTime() - 4 * 24 * 3600 * 1000);
    const completedDate = new Date(now.getTime() - 2 * 24 * 3600 * 1000);

    const sampleEdfs = [
      {
        edfNumber: 'EDF-2026-001',
        requesterName: 'Imran',
        category: 'HVAC',
        issueDate: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
        requiredDate: pastDate1,
        materialList: 'Chiller Compressor Oil (R134a), 2x Filter Driers',
        quantity: 2,
        unit: 'sets',
        status: 'Overdue',
        remarks: 'Urgent: Chiller #2 high pressure alarm triggered. Supply pending vendor quote.',
        createdBy: '03001234567',
      },
      {
        edfNumber: 'EDF-2026-002',
        requesterName: 'Tanveer Ijaz',
        category: 'Generator',
        issueDate: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
        requiredDate: soonDate1,
        materialList: 'Fuel Filter Fleetguard FF5052, Primary Lube Filter LF9009',
        quantity: 4,
        unit: 'pcs',
        status: 'Pending',
        remarks: 'Scheduled 500-hour service on 250kVA Perkins DG set.',
        createdBy: '03001234567',
      },
      {
        edfNumber: 'EDF-2026-003',
        requesterName: 'Rasheed',
        category: 'Electrical',
        issueDate: new Date(now.getTime() - 6 * 3600 * 1000),
        requiredDate: futureDate1,
        materialList: 'Schneider 3-Phase 63A MCB Breaker, 4-core 16mm Copper Cable (50m)',
        quantity: 50,
        unit: 'meters',
        status: 'Pending',
        remarks: 'Server room power distribution panel upgrade.',
        createdBy: '03001234567',
      },
      {
        edfNumber: 'EDF-2026-004',
        requesterName: 'Sarfraz Aziz',
        category: 'Plumbing',
        issueDate: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
        requiredDate: soonDate2,
        materialList: 'Grundfos Booster Pump Mechanical Seal Kit, 2" Brass Check Valve',
        quantity: 2,
        unit: 'kits',
        status: 'Received',
        remarks: 'Delivered to basement pump room; technician installation in progress.',
        createdBy: '03001234567',
      },
      {
        edfNumber: 'EDF-2026-005',
        requesterName: 'Glacier Eng',
        category: 'Telephone',
        issueDate: new Date(now.getTime() - 6 * 24 * 3600 * 1000),
        requiredDate: completedDate,
        materialList: 'Panasonic KX-T7730 Display Phone, 100m 2-Pair Drop Wire',
        quantity: 3,
        unit: 'units',
        status: 'Completed',
        remarks: 'Accounts department extensions reconfigured and tested OK.',
        createdBy: '03001234567',
      },
      {
        edfNumber: 'EDF-2026-006',
        requesterName: 'Kamran Alam',
        category: 'General',
        issueDate: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
        requiredDate: pastDate2,
        materialList: 'Hydraulic Door Closers (Heavy Duty), Stainless Steel Hinges',
        quantity: 6,
        unit: 'sets',
        status: 'Overdue',
        remarks: 'Fire exit doors on 3rd & 4th floors require immediate repair.',
        createdBy: '03001234567',
      },
    ];

    for (const edfData of sampleEdfs) {
      const [inserted] = await db.insert(edfs).values(edfData).returning();
      await db.insert(edfItems).values([
        {
          edfId: inserted.id,
          itemDescription: edfData.materialList,
          quantity: edfData.quantity,
          unit: edfData.unit,
        },
      ]);
    }

    // Mark seed completed permanently
    await db
      .insert(systemSettings)
      .values({
        key: 'seed_completed',
        value: 'true',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: 'true', updatedAt: new Date() },
      });

    // Create immediate initial backup
    await takeDatabaseBackup('auto');
    console.log('Sample baseline EDFs seeded and initial permanent backup created.');
  } catch (error) {
    console.error('Database seeding error:', error);
  }
}
