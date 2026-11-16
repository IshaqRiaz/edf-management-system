import { EDF, EDFItem } from '../types.ts';

export type ExportFilterType =
  | 'Total'
  | 'Pending'
  | 'Partially Received'
  | 'Received'
  | 'Overdue'
  | 'Specific';

export interface EffectiveEdfState {
  isReceived: boolean;
  isPartiallyReceived: boolean;
  isPending: boolean;
  isOverdue: boolean;
  effectiveStatus: 'Received' | 'Partially Received' | 'Pending' | 'Overdue';
  totalItems: number;
  receivedItems: number;
}

export interface ExportMaterialRow {
  itemDescription: string;
  quantity: number;
  unit: string;
  status: 'Pending' | 'Received';
  remarks: string;
  justification: string;
}

export interface UniqueEdfCounts {
  total: number;
  pending: number;
  partiallyReceived: number;
  received: number;
  overdue: number;
}

export interface ExportFilterOptions {
  statusFilter?: ExportFilterType;
  categoryFilter?: string;
  specificEdfNumber?: string;
}

/**
 * Normalizes an EDF number for deduplication and comparison without altering display formatting.
 */
export function normalizeEdfNumber(edfNumber?: string | null): string {
  return String(edfNumber || '').trim().toLowerCase();
}

/**
 * Computes effective receiving & overdue state for an EDF without mutating it.
 */
export function getEffectiveEdfState(edf: EDF, nowMs: number = Date.now()): EffectiveEdfState {
  const rawItems = edf.items || [];
  const totalItems =
    edf.totalItemsCount !== undefined && edf.totalItemsCount !== null
      ? edf.totalItemsCount
      : rawItems.length > 0
      ? rawItems.length
      : 1;
  const receivedItems =
    edf.receivedItemsCount !== undefined && edf.receivedItemsCount !== null
      ? edf.receivedItemsCount
      : rawItems.filter((i) => i.status === 'Received').length;

  const isReceived =
    edf.status === 'Received' ||
    String(edf.status) === 'Completed' ||
    (totalItems > 0 && receivedItems >= totalItems);

  const isPartiallyReceived =
    !isReceived &&
    (edf.status === 'Partially Received' || (receivedItems > 0 && receivedItems < totalItems));

  const reqTime = edf.requiredDate ? new Date(edf.requiredDate).getTime() : NaN;
  const isPastDeadline = !Number.isNaN(reqTime) && reqTime < nowMs;
  const isOverdue =
    !isReceived &&
    (edf.status === 'Overdue' || Boolean(edf.isOverdue) || isPastDeadline);

  const isPending = !isReceived && !isPartiallyReceived;

  const effectiveStatus: EffectiveEdfState['effectiveStatus'] = isReceived
    ? 'Received'
    : isOverdue
    ? 'Overdue'
    : isPartiallyReceived
    ? 'Partially Received'
    : 'Pending';

  return {
    isReceived,
    isPartiallyReceived,
    isPending,
    isOverdue,
    effectiveStatus,
    totalItems,
    receivedItems,
  };
}

/**
 * Returns individual material rows for an EDF without merging distinct materials.
 * Always produces at least 1 row using fallback summary fields if `items` is empty.
 */
export function getEdfMaterialRows(edf: EDF): ExportMaterialRow[] {
  const rawItems = edf.items || [];
  if (rawItems.length > 0) {
    return rawItems.map((item) => ({
      itemDescription: (item.itemDescription || edf.materialList || 'Material Item').trim(),
      quantity:
        item.quantity !== undefined && item.quantity !== null && !Number.isNaN(Number(item.quantity))
          ? Number(item.quantity)
          : 1,
      unit: (item.unit || edf.unit || 'pcs').trim(),
      status: item.status === 'Received' || edf.status === 'Received' ? 'Received' : 'Pending',
      remarks: (item.remarks || '').trim(),
      justification: (item.justification || '').trim(),
    }));
  }

  return [
    {
      itemDescription: (edf.materialList || 'Material Item').trim(),
      quantity:
        edf.quantity !== undefined && edf.quantity !== null && !Number.isNaN(Number(edf.quantity))
          ? Number(edf.quantity)
          : 1,
      unit: (edf.unit || 'pcs').trim(),
      status: edf.status === 'Received' ? 'Received' : 'Pending',
      remarks: (edf.remarks || '').trim(),
      justification: '',
    },
  ];
}

/**
 * Deduplicates EDF records strictly by unique EDF Number without mutating source records.
 * If duplicate EDF objects share the same EDF Number, their distinct material items are merged
 * under one EDF record so each unique EDF Number appears only once.
 */
export function deduplicateEdfsByNumber(edfs: EDF[]): EDF[] {
  if (!edfs || edfs.length === 0) return [];

  const map = new Map<string, EDF>();

  for (const edf of edfs) {
    const norm = normalizeEdfNumber(edf.edfNumber);
    const key = norm || `__id_${edf.id}`;

    const clonedItems: EDFItem[] =
      edf.items && edf.items.length > 0
        ? edf.items.map((it) => ({ ...it }))
        : [];

    if (!map.has(key)) {
      map.set(key, {
        ...edf,
        edfNumber: String(edf.edfNumber || '').trim() || `EDF-${edf.id}`,
        items: clonedItems,
      });
    } else {
      const existing = map.get(key)!;
      const existingItems = existing.items ? [...existing.items] : [];

      const incomingRows: EDFItem[] =
        clonedItems.length > 0
          ? clonedItems
          : [
              {
                itemDescription: edf.materialList || 'Material Item',
                quantity: edf.quantity ?? 1,
                unit: edf.unit || 'pcs',
                status: edf.status === 'Received' ? 'Received' : 'Pending',
                remarks: edf.remarks || '',
              },
            ];

      const baseItems: EDFItem[] =
        existingItems.length > 0
          ? existingItems
          : [
              {
                itemDescription: existing.materialList || 'Material Item',
                quantity: existing.quantity ?? 1,
                unit: existing.unit || 'pcs',
                status: existing.status === 'Received' ? 'Received' : 'Pending',
                remarks: existing.remarks || '',
              },
            ];

      for (const inc of incomingRows) {
        const isDuplicateItem = baseItems.some((cur) => {
          if (cur.id !== undefined && inc.id !== undefined && cur.id === inc.id) {
            return true;
          }
          return (
            String(cur.itemDescription || '').trim().toLowerCase() ===
              String(inc.itemDescription || '').trim().toLowerCase() &&
            Number(cur.quantity ?? 1) === Number(inc.quantity ?? 1) &&
            String(cur.unit || '').trim().toLowerCase() ===
              String(inc.unit || '').trim().toLowerCase()
          );
        });

        if (!isDuplicateItem) {
          baseItems.push(inc);
        }
      }

      const recCount = baseItems.filter((i) => i.status === 'Received').length;
      const totCount = baseItems.length;

      existing.items = baseItems;
      existing.totalItemsCount = totCount;
      existing.receivedItemsCount = recCount;
      if (!existing.remarks && edf.remarks) {
        existing.remarks = edf.remarks;
      }
      if (recCount >= totCount && totCount > 0) {
        existing.status = 'Received';
      } else if (recCount > 0) {
        existing.status = 'Partially Received';
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Calculates the unique count of EDFs based on their unique EDF ID (ignoring individual material row count).
 */
export function countUniqueEdfsById(edfs: EDF[]): number {
  if (!edfs || edfs.length === 0) return 0;
  const uniqueIds = new Set<string>();
  for (const edf of edfs) {
    if (edf.id !== undefined && edf.id !== null) {
      uniqueIds.add(`id:${edf.id}`);
    } else {
      const norm = normalizeEdfNumber(edf.edfNumber);
      if (norm) uniqueIds.add(`num:${norm}`);
    }
  }
  return uniqueIds.size;
}

/**
 * Counts EDFs strictly by unique EDF Number (10 material items under EDF 3265 = 1 EDF).
 */
export function countUniqueEdfStats(edfs: EDF[]): UniqueEdfCounts {
  const uniqueEdfs = deduplicateEdfsByNumber(edfs);
  const nowMs = Date.now();

  let total = 0;
  let pending = 0;
  let partiallyReceived = 0;
  let received = 0;
  let overdue = 0;

  for (const edf of uniqueEdfs) {
    total++;
    const state = getEffectiveEdfState(edf, nowMs);
    if (state.isReceived) {
      received++;
    } else if (state.isPartiallyReceived) {
      partiallyReceived++;
    } else {
      pending++;
    }

    if (state.isOverdue) {
      overdue++;
    }
  }

  return {
    total,
    pending,
    partiallyReceived,
    received,
    overdue,
  };
}

/**
 * Filters unique EDFs according to statusFilter, categoryFilter, and specificEdfNumber.
 * Never mutates input EDF records.
 */
export function filterEdfsForExport(
  edfs: EDF[],
  options: ExportFilterOptions = {}
): {
  uniqueAllEdfs: EDF[];
  filteredEdfs: EDF[];
  counts: UniqueEdfCounts;
  totalMaterialItems: number;
} {
  const {
    statusFilter = 'Total',
    categoryFilter = 'All',
    specificEdfNumber = '',
  } = options;

  const uniqueAllEdfs = deduplicateEdfsByNumber(edfs);

  // Category filter applies before status counts if selected
  const categoryScoped =
    categoryFilter && categoryFilter !== 'All'
      ? uniqueAllEdfs.filter(
          (e) => String(e.category || '').trim().toLowerCase() === categoryFilter.trim().toLowerCase()
        )
      : uniqueAllEdfs;

  const counts = countUniqueEdfStats(categoryScoped);
  const nowMs = Date.now();
  const specificNorm = normalizeEdfNumber(specificEdfNumber);

  const hasExactSpecificMatch =
    Boolean(specificNorm) &&
    categoryScoped.some((e) => normalizeEdfNumber(e.edfNumber) === specificNorm);

  const matchesSpecificEdf = (edf: EDF): boolean => {
    if (!specificNorm) return true;
    const norm = normalizeEdfNumber(edf.edfNumber);
    return hasExactSpecificMatch ? norm === specificNorm : norm.includes(specificNorm);
  };

  const filteredEdfs = categoryScoped.filter((edf) => {
    const state = getEffectiveEdfState(edf, nowMs);

    // If Specific EDF Number filter is active or entered
    if (statusFilter === 'Specific') {
      return matchesSpecificEdf(edf);
    }

    // Even when another tab is active, if specificEdfNumber is explicitly entered, match it too
    if (specificNorm && !matchesSpecificEdf(edf)) {
      return false;
    }

    switch (statusFilter) {
      case 'Total':
        return true;
      case 'Pending':
        return state.isPending;
      case 'Partially Received':
        return state.isPartiallyReceived;
      case 'Received':
        return state.isReceived;
      case 'Overdue':
        return state.isOverdue;
      default:
        return true;
    }
  });

  const totalMaterialItems = filteredEdfs.reduce(
    (sum, edf) => sum + getEdfMaterialRows(edf).length,
    0
  );

  return {
    uniqueAllEdfs,
    filteredEdfs,
    counts,
    totalMaterialItems,
  };
}

/**
 * Returns a human-readable filter label for filenames & report headers.
 */
export function getExportFilterLabel(options: ExportFilterOptions = {}): string {
  const { statusFilter = 'Total', specificEdfNumber = '' } = options;
  if (statusFilter === 'Specific') {
    return specificEdfNumber.trim()
      ? `EDF_${specificEdfNumber.trim()}`
      : 'Specific_EDF';
  }
  switch (statusFilter) {
    case 'Total':
      return 'Total_EDF';
    case 'Pending':
      return 'Pending_EDF';
    case 'Partially Received':
      return 'Partially_Received_EDF';
    case 'Received':
      return 'Received_EDF';
    case 'Overdue':
      return 'Overdue_EDF';
    default:
      return 'Total_EDF';
  }
}
