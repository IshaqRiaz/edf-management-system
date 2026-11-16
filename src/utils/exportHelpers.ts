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
  statusFilters?: ExportFilterType[];
  categoryFilter?: string;
  specificEdfNumber?: string;
  searchQuery?: string;
  dateFilter?: 'all' | 'today' | 'this-week' | 'this-month' | string;
  nowMs?: number;
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
        existing.isOverdue = false;
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
export function countUniqueEdfStats(edfs: EDF[], nowMs: number = Date.now()): UniqueEdfCounts {
  const uniqueEdfs = deduplicateEdfsByNumber(edfs);

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

function matchesSearchQuery(edf: EDF, searchQuery: string): boolean {
  const trimmed = searchQuery.trim();
  if (!trimmed) return true;
  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const checkStr = (val?: string | null) => (val ? val.toLowerCase() : '');

  return tokens.every((token) => {
    return (
      checkStr(edf.edfNumber).includes(token) ||
      checkStr(edf.requesterName).includes(token) ||
      checkStr(edf.category).includes(token) ||
      checkStr(edf.materialList).includes(token) ||
      checkStr(edf.unit).includes(token) ||
      checkStr(edf.remarks).includes(token) ||
      Boolean(
        edf.items?.some((it) => {
          const itDesc = checkStr(it.itemDescription);
          const itUnit = checkStr(it.unit);
          const itRemarks = checkStr(it.remarks || it.justification);
          return itDesc.includes(token) || itUnit.includes(token) || itRemarks.includes(token);
        })
      )
    );
  });
}

function matchesDateFilter(edf: EDF, dateFilter: string, nowMs: number): boolean {
  if (!dateFilter || dateFilter === 'all') return true;
  const itemDate = new Date(edf.issueDate);
  if (Number.isNaN(itemDate.getTime())) return false;
  const nowDate = new Date(nowMs);
  if (dateFilter === 'today') {
    return itemDate.toDateString() === nowDate.toDateString();
  }
  if (dateFilter === 'this-week') {
    const oneWeekAgo = nowMs - 7 * 24 * 3600 * 1000;
    return itemDate.getTime() >= oneWeekAgo;
  }
  if (dateFilter === 'this-month') {
    return (
      itemDate.getMonth() === nowDate.getMonth() &&
      itemDate.getFullYear() === nowDate.getFullYear()
    );
  }
  return true;
}

function matchesSingleStatusFilter(
  edf: EDF,
  filterType: ExportFilterType,
  nowMs: number,
  matchesSpecific: (e: EDF) => boolean
): boolean {
  const state = getEffectiveEdfState(edf, nowMs);
  switch (filterType) {
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
    case 'Specific':
      return matchesSpecific(edf);
    default:
      return true;
  }
}

/**
 * Filters unique EDFs according to statusFilter(s), categoryFilter, specificEdfNumber, searchQuery, and dateFilter.
 * Never mutates input EDF records and always deduplicates by unique EDF Number.
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
    statusFilters,
    categoryFilter = 'All',
    specificEdfNumber = '',
    searchQuery = '',
    dateFilter = 'all',
    nowMs = Date.now(),
  } = options;

  const uniqueAllEdfs = deduplicateEdfsByNumber(edfs);

  // Scope by category, search, and date before calculating status bucket counts
  const scoped = uniqueAllEdfs.filter((edf) => {
    if (
      categoryFilter &&
      categoryFilter !== 'All' &&
      String(edf.category || '').trim().toLowerCase() !== categoryFilter.trim().toLowerCase()
    ) {
      return false;
    }
    if (searchQuery && !matchesSearchQuery(edf, searchQuery)) {
      return false;
    }
    if (dateFilter && dateFilter !== 'all' && !matchesDateFilter(edf, dateFilter, nowMs)) {
      return false;
    }
    return true;
  });

  const counts = countUniqueEdfStats(scoped, nowMs);
  const specificNorm = normalizeEdfNumber(specificEdfNumber);

  const hasExactSpecificMatch =
    Boolean(specificNorm) &&
    scoped.some((e) => normalizeEdfNumber(e.edfNumber) === specificNorm);

  const matchesSpecificEdf = (edf: EDF): boolean => {
    if (!specificNorm) return true;
    const norm = normalizeEdfNumber(edf.edfNumber);
    return hasExactSpecificMatch ? norm === specificNorm : norm.includes(specificNorm);
  };

  const activeFilters =
    statusFilters && statusFilters.length > 0 ? statusFilters : [statusFilter];

  const filteredEdfs = scoped.filter((edf) => {
    // Specific EDF Number takes precedence or narrows any active status selection
    if (specificNorm && !matchesSpecificEdf(edf)) {
      return false;
    }

    if (activeFilters.includes('Total')) {
      return true;
    }

    return activeFilters.some((flt) =>
      matchesSingleStatusFilter(edf, flt, nowMs, matchesSpecificEdf)
    );
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
  const {
    statusFilter = 'Total',
    statusFilters,
    categoryFilter = 'All',
    specificEdfNumber = '',
  } = options;

  let baseLabel: string;
  if (statusFilters && statusFilters.length > 1) {
    baseLabel = statusFilters.map((s) => s.replace(/\s+/g, '_')).join('+');
  } else {
    const single = statusFilters && statusFilters.length === 1 ? statusFilters[0] : statusFilter;
    if (single === 'Specific') {
      baseLabel = specificEdfNumber.trim()
        ? `EDF_${specificEdfNumber.trim()}`
        : 'Specific_EDF';
    } else {
      switch (single) {
        case 'Total':
          baseLabel = 'Total_EDF';
          break;
        case 'Pending':
          baseLabel = 'Pending_EDF';
          break;
        case 'Partially Received':
          baseLabel = 'Partially_Received_EDF';
          break;
        case 'Received':
          baseLabel = 'Received_EDF';
          break;
        case 'Overdue':
          baseLabel = 'Overdue_EDF';
          break;
        default:
          baseLabel = 'Total_EDF';
      }
    }
  }

  if (categoryFilter && categoryFilter !== 'All') {
    return `${baseLabel}_${categoryFilter.trim().replace(/\s+/g, '_')}`;
  }
  return baseLabel;
}
