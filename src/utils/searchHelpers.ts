import { EDF, EDFItem } from '../types.ts';
import { deduplicateEdfsByNumber } from './exportHelpers.ts';

export interface GlobalSearchMatch {
  edf: EDF;
  matchedBy: {
    id: boolean;
    edfNumber: boolean;
    requester: boolean;
    material: boolean;
  };
  matchingItems: EDFItem[];
  score: number;
}

/**
 * Checks whether a single search token matches an EDF's numeric database ID
 * (supports both `42` and `#42`).
 */
export function matchesEdfIdToken(edfId: number | string | undefined | null, token: string): boolean {
  if (edfId === undefined || edfId === null) return false;
  const cleanToken = token.trim().replace(/^#/, '');
  if (!cleanToken || !/^\d+$/.test(cleanToken)) return false;
  return String(edfId).includes(cleanToken);
}

/**
 * Checks whether an individual material item matches a query token.
 */
function itemMatchesToken(item: EDFItem, token: string): boolean {
  const desc = (item.itemDescription || '').toLowerCase();
  const unit = (item.unit || '').toLowerCase();
  const remarks = (item.remarks || item.justification || '').toLowerCase();
  return desc.includes(token) || unit.includes(token) || remarks.includes(token);
}

/**
 * Searches unique EDF records by:
 *  - EDF ID (`42`, `#42`) or EDF Number (`EDF-2026-001`)
 *  - Requester name
 *  - Specific material item descriptions (within `items[]` or fallback `materialList`)
 *
 * Returns ranked matches along with the specific matching `EDFItem` entries.
 */
export function searchEdfsGlobally(
  edfs: EDF[],
  query: string,
  limit: number = 8
): { matches: GlobalSearchMatch[]; totalCount: number } {
  const trimmed = query.trim();
  if (!trimmed || !edfs || edfs.length === 0) {
    return { matches: [], totalCount: 0 };
  }

  const normalizedQuery = trimmed.toLowerCase();
  const normalizedIdQuery = normalizedQuery.replace(/^#/, '');
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { matches: [], totalCount: 0 };
  }

  const uniqueEdfs = deduplicateEdfsByNumber(edfs);
  const results: GlobalSearchMatch[] = [];

  for (const edf of uniqueEdfs) {
    const edfNumberLower = (edf.edfNumber || '').toLowerCase();
    const requesterLower = (edf.requesterName || '').toLowerCase();
    const materialListLower = (edf.materialList || '').toLowerCase();
    const idStr = String(edf.id ?? '');
    const items = edf.items || [];

    let matchedId = false;
    let matchedEdfNumber = false;
    let matchedRequester = false;
    let matchedMaterial = false;

    const allTokensMatch = tokens.every((token) => {
      const hitId = matchesEdfIdToken(edf.id, token);
      const hitNumber = edfNumberLower.includes(token);
      const hitRequester = requesterLower.includes(token);
      const hitMaterialSummary = materialListLower.includes(token);
      const hitItem = items.some((it) => itemMatchesToken(it, token));

      if (hitId) matchedId = true;
      if (hitNumber) matchedEdfNumber = true;
      if (hitRequester) matchedRequester = true;
      if (hitMaterialSummary || hitItem) matchedMaterial = true;

      return hitId || hitNumber || hitRequester || hitMaterialSummary || hitItem;
    });

    if (!allTokensMatch) {
      continue;
    }

    // Collect specific material items that matched (prioritizing items matching all tokens)
    const fullMatchItems = items.filter((it) => tokens.every((t) => itemMatchesToken(it, t)));
    const partialMatchItems =
      fullMatchItems.length > 0
        ? fullMatchItems
        : items.filter((it) => tokens.some((t) => itemMatchesToken(it, t)));

    // Compute relevance score
    let score = 0;
    if (normalizedIdQuery && /^\d+$/.test(normalizedIdQuery) && idStr === normalizedIdQuery) {
      score += 120;
    } else if (edfNumberLower === normalizedQuery) {
      score += 110;
    } else if (edfNumberLower.startsWith(normalizedQuery)) {
      score += 75;
    } else if (matchedId) {
      score += 65;
    } else if (matchedEdfNumber) {
      score += 50;
    }

    if (requesterLower === normalizedQuery) {
      score += 45;
    } else if (requesterLower.startsWith(normalizedQuery)) {
      score += 35;
    } else if (matchedRequester) {
      score += 25;
    }

    if (matchedMaterial) {
      score += fullMatchItems.length > 0 ? 20 : 12;
    }

    results.push({
      edf,
      matchedBy: {
        id: matchedId,
        edfNumber: matchedEdfNumber,
        requester: matchedRequester,
        material: matchedMaterial,
      },
      matchingItems: partialMatchItems,
      score,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.edf.id ?? 0) - (a.edf.id ?? 0);
  });

  return {
    matches: results.slice(0, limit),
    totalCount: results.length,
  };
}
