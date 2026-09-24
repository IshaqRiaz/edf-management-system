import { MaterialItem } from '../types/index.ts';

export interface ExtractedTextTableResult {
  materials: MaterialItem[];
  suggestedCategory: string;
  categoryReasoning: string;
  confidence: 'High' | 'Medium' | 'Low';
  suggestedTeam: string;
  suggestedDescription: string;
  detectedHeaders: {
    nameIndex: number;
    qtyIndex: number;
    unitIndex: number;
    descIndex: number;
  } | null;
}

export const COMMON_UNITS = [
  'Pieces',
  'Meters',
  'Units',
  'Sets',
  'Rolls',
  'Cylinders',
  'Liters',
  'Pairs',
  'Boxes',
  'Kg',
  'Feet',
];

/**
 * Normalizes user-typed or extracted unit strings into standard EDF units.
 */
export function normalizeUnit(rawUnit: string): string {
  if (!rawUnit) return 'Pieces';
  const u = rawUnit.trim().toLowerCase();

  if (u.startsWith('pc') || u === 'ea' || u === 'each') return 'Pieces';
  if (u.startsWith('meter') || u === 'm' || u === 'mtr' || u === 'mtrs') return 'Meters';
  if (u.startsWith('unit') || u === 'nos' || u === 'no') return 'Units';
  if (u.startsWith('set')) return 'Sets';
  if (u.startsWith('roll') || u === 'rl') return 'Rolls';
  if (u.startsWith('cyl') || u.includes('cylinder') || u.includes('bottle')) return 'Cylinders';
  if (u.startsWith('liter') || u.startsWith('litre') || u === 'l' || u === 'ltr' || u === 'ltrs') return 'Liters';
  if (u.startsWith('pair') || u === 'pr') return 'Pairs';
  if (u.startsWith('box') || u.startsWith('pack') || u === 'bx' || u === 'pkt') return 'Boxes';
  if (u.startsWith('kg') || u.startsWith('kilo')) return 'Kg';
  if (u.startsWith('foot') || u.startsWith('feet') || u === 'ft') return 'Feet';

  // Capitalize first letter if not in standard list
  const matched = COMMON_UNITS.find((unit) => unit.toLowerCase() === u);
  if (matched) return matched;

  return rawUnit.charAt(0).toUpperCase() + rawUnit.slice(1);
}

/**
 * Extracts numeric or fractional quantity from a string.
 */
export function extractQuantity(rawQty: string): string {
  if (!rawQty) return '1';
  const cleaned = rawQty.replace(/[^0-9.]/g, '');
  if (!cleaned || isNaN(parseFloat(cleaned))) return '1';
  return cleaned;
}

/**
 * Determines technical category based on text content and extracted material items.
 */
export function detectCategoryFromTextAndItems(
  text: string,
  items: MaterialItem[]
): { category: string; reasoning: string; confidence: 'High' | 'Medium' | 'Low'; team: string } {
  const combined = (
    text +
    ' ' +
    items.map((i) => `${i.materialName} ${i.description || ''}`).join(' ')
  ).toLowerCase();

  if (
    combined.includes('hvac') ||
    combined.includes('air condition') ||
    combined.includes('ac ') ||
    combined.includes('refrigerant') ||
    combined.includes('r410') ||
    combined.includes('r22') ||
    combined.includes('r134') ||
    combined.includes('copper pipe') ||
    combined.includes('compressor') ||
    combined.includes('chiller') ||
    combined.includes('filter drier') ||
    combined.includes('ahu') ||
    (combined.includes('filter') && (combined.includes('merv') || combined.includes('intake')))
  ) {
    return {
      category: 'HVAC / AC',
      reasoning: 'Extracted items reference cooling coils, air filters, refrigerant, compressor, or HVAC systems.',
      confidence: 'High',
      team: 'HVAC & Climate Control Unit',
    };
  }

  if (
    combined.includes('plumb') ||
    combined.includes('valve') ||
    combined.includes('pvc pipe') ||
    combined.includes('drain') ||
    combined.includes('wash basin') ||
    combined.includes('mixer tap') ||
    combined.includes('faucet') ||
    combined.includes('sewer') ||
    combined.includes('gasket') ||
    combined.includes('teflon') ||
    combined.includes('booster pump')
  ) {
    return {
      category: 'Plumbing',
      reasoning: 'Extracted items reference plumbing pipes, brass valves, wash basin fittings, or drainage materials.',
      confidence: 'High',
      team: 'Facility Plumbing Maintenance Crew',
    };
  }

  if (
    combined.includes('generator') ||
    combined.includes('genset') ||
    combined.includes('dg set') ||
    combined.includes('cummins') ||
    combined.includes('perkins') ||
    combined.includes('diesel fuel filter') ||
    combined.includes('oil filter') ||
    combined.includes('starter battery') ||
    combined.includes('alternator belt') ||
    combined.includes('engine oil 15w-40')
  ) {
    return {
      category: 'Generator',
      reasoning: 'Extracted items reference standby generator servicing, diesel engine oil/fuel filters, or alternator belts.',
      confidence: 'High',
      team: 'Power Generation & Generator Team',
    };
  }

  if (
    combined.includes('telephone') ||
    combined.includes('telecom') ||
    combined.includes('handset') ||
    combined.includes('rj11') ||
    combined.includes('rj-11') ||
    combined.includes('pbx') ||
    combined.includes('intercom') ||
    combined.includes('patch cord') ||
    combined.includes('cisco 7821') ||
    combined.includes('2-pair cable')
  ) {
    return {
      category: 'Telephone',
      reasoning: 'Extracted items reference telephone handsets, RJ11 connectors, PBX cabling, or telecommunications gear.',
      confidence: 'High',
      team: 'Telecommunications & PABX Team',
    };
  }

  if (
    combined.includes('electr') ||
    combined.includes('mcb') ||
    combined.includes('circuit breaker') ||
    combined.includes('contactor') ||
    combined.includes('distribution board') ||
    combined.includes('armored cable') ||
    combined.includes('industrial socket') ||
    combined.includes('relay') ||
    combined.includes('led driver') ||
    combined.includes('switchboard')
  ) {
    return {
      category: 'Electrical',
      reasoning: 'Extracted items reference electrical breakers, contactors, armored wiring, or power distribution.',
      confidence: 'High',
      team: 'Electrical Engineering & Maintenance Team',
    };
  }

  return {
    category: 'General / Other',
    reasoning: 'Extracted general requisition items without specific single-domain equipment keywords.',
    confidence: 'Medium',
    team: 'Facility Operations Maintenance Unit',
  };
}

/**
 * Intelligent parser that extracts Material Items (Description, Quantity, Unit, Notes)
 * from any text table (Markdown table, TSV, CSV, space-aligned, or bulleted list).
 */
export function parseTextTable(rawText: string): ExtractedTextTableResult {
  if (!rawText || !rawText.trim()) {
    return {
      materials: [],
      suggestedCategory: 'General / Other',
      categoryReasoning: 'No text provided.',
      confidence: 'Low',
      suggestedTeam: 'General Maintenance Team',
      suggestedDescription: 'Empty table requisition',
      detectedHeaders: null,
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const materials: MaterialItem[] = [];

  // 1. Detect if table uses pipe '|' delimiter (Markdown / Pipe Table)
  const pipeLines = lines.filter((l) => l.includes('|'));
  if (pipeLines.length >= 2) {
    parsePipeTable(lines, materials);
  }

  // 2. If not found or empty, detect Tab-separated values (TSV)
  if (materials.length === 0) {
    const tabLines = lines.filter((l) => l.includes('\t'));
    if (tabLines.length >= 2) {
      parseDelimitedTable(lines, '\t', materials);
    }
  }

  // 3. If not found or empty, detect Comma-separated values (CSV)
  if (materials.length === 0) {
    const commaLines = lines.filter((l) => l.includes(',') && !l.startsWith('#'));
    if (commaLines.length >= 2) {
      parseDelimitedTable(lines, ',', materials);
    }
  }

  // 4. If not found or empty, detect Semicolon-separated values
  if (materials.length === 0) {
    const semiLines = lines.filter((l) => l.includes(';'));
    if (semiLines.length >= 2) {
      parseDelimitedTable(lines, ';', materials);
    }
  }

  // 5. If still empty, parse natural lines or space-aligned rows
  if (materials.length === 0) {
    parseNaturalTextLines(lines, materials);
  }

  // Deduplicate and filter empty items
  const cleanMaterials = materials.filter(
    (m) => m.materialName && m.materialName.trim().length > 0
  );

  // If completely empty, provide at least one placeholder so the user has a starter row
  if (cleanMaterials.length === 0) {
    cleanMaterials.push({
      materialName: 'Extracted Material Line #1',
      quantity: '1',
      unit: 'Pieces',
      description: 'Extracted from text table',
    });
  }

  const categoryResult = detectCategoryFromTextAndItems(rawText, cleanMaterials);

  return {
    materials: cleanMaterials,
    suggestedCategory: categoryResult.category,
    categoryReasoning: categoryResult.reasoning,
    confidence: categoryResult.confidence,
    suggestedTeam: categoryResult.team,
    suggestedDescription: `Requisition extracted from text table with ${cleanMaterials.length} item line(s)`,
    detectedHeaders: null,
  };
}

/**
 * Parses markdown / pipe-delimited table lines.
 */
function parsePipeTable(lines: string[], results: MaterialItem[]) {
  let headerColIndices = { name: 0, qty: 1, unit: 2, desc: -1 };
  let headerFound = false;

  for (const line of lines) {
    // Skip markdown separator lines like |---|:---:|---| or +---+
    if (/^[|\-+: \t]+$/.test(line) && line.includes('-')) {
      continue;
    }

    // Split cells
    const cells = line
      .split('|')
      .map((c) => c.trim())
      // Strip leading and trailing empty cells if line starts/ends with |
      .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));

    if (cells.length < 2) continue;

    // Check if header row
    const lineLower = line.toLowerCase();
    if (
      !headerFound &&
      (lineLower.includes('item') ||
        lineLower.includes('material') ||
        lineLower.includes('description') ||
        lineLower.includes('qty') ||
        lineLower.includes('quantity'))
    ) {
      headerFound = true;
      cells.forEach((cell, idx) => {
        const cLower = cell.toLowerCase();
        if (cLower.includes('material') || cLower.includes('item') || cLower.includes('name')) {
          headerColIndices.name = idx;
        } else if (cLower.includes('qty') || cLower.includes('quantity')) {
          headerColIndices.qty = idx;
        } else if (cLower.includes('unit') || cLower.includes('uom') || cLower.includes('type')) {
          headerColIndices.unit = idx;
        } else if (cLower.includes('desc') || cLower.includes('spec') || cLower.includes('remark') || cLower.includes('note')) {
          headerColIndices.desc = idx;
        }
      });
      continue;
    }

    // Normal data row
    const name = cells[headerColIndices.name] || cells[0] || '';
    if (!name || name.toLowerCase().startsWith('total') || name.toLowerCase().startsWith('item #')) {
      continue;
    }

    const qtyRaw = cells[headerColIndices.qty] !== undefined ? cells[headerColIndices.qty] : '';
    const unitRaw = cells[headerColIndices.unit] !== undefined ? cells[headerColIndices.unit] : '';
    const descRaw = headerColIndices.desc !== -1 && cells[headerColIndices.desc] !== undefined ? cells[headerColIndices.desc] : '';

    results.push({
      materialName: cleanMaterialName(name),
      quantity: extractQuantity(qtyRaw) || '1',
      unit: normalizeUnit(unitRaw),
      description: descRaw.trim(),
    });
  }
}

/**
 * Parses TSV, CSV, or semicolon delimited tables.
 */
function parseDelimitedTable(lines: string[], delimiter: string, results: MaterialItem[]) {
  let headerColIndices = { name: 0, qty: 1, unit: 2, desc: -1 };
  let headerFound = false;

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('//')) continue;

    const cells = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cells.length < 2) continue;

    const lineLower = line.toLowerCase();
    if (
      !headerFound &&
      (lineLower.includes('item') ||
        lineLower.includes('material') ||
        lineLower.includes('description') ||
        lineLower.includes('qty') ||
        lineLower.includes('quantity'))
    ) {
      headerFound = true;
      cells.forEach((cell, idx) => {
        const cLower = cell.toLowerCase();
        if (cLower.includes('material') || cLower.includes('item') || cLower.includes('name')) {
          headerColIndices.name = idx;
        } else if (cLower.includes('qty') || cLower.includes('quantity')) {
          headerColIndices.qty = idx;
        } else if (cLower.includes('unit') || cLower.includes('uom') || cLower.includes('type')) {
          headerColIndices.unit = idx;
        } else if (cLower.includes('desc') || cLower.includes('spec') || cLower.includes('remark') || cLower.includes('note')) {
          headerColIndices.desc = idx;
        }
      });
      continue;
    }

    const name = cells[headerColIndices.name] || cells[0] || '';
    if (!name || name.toLowerCase().startsWith('total') || name.toLowerCase().startsWith('item #')) {
      continue;
    }

    const qtyRaw = cells[headerColIndices.qty] !== undefined ? cells[headerColIndices.qty] : '';
    const unitRaw = cells[headerColIndices.unit] !== undefined ? cells[headerColIndices.unit] : '';
    const descRaw = headerColIndices.desc !== -1 && cells[headerColIndices.desc] !== undefined ? cells[headerColIndices.desc] : '';

    results.push({
      materialName: cleanMaterialName(name),
      quantity: extractQuantity(qtyRaw) || '1',
      unit: normalizeUnit(unitRaw),
      description: descRaw.trim(),
    });
  }
}

/**
 * Fallback natural text lines parser:
 * e.g. "1. Air Filter 24x24 - 10 Pieces - Primary intake"
 * or "Compressor oil (5 Liters)"
 * or space-aligned rows
 */
function parseNaturalTextLines(lines: string[], results: MaterialItem[]) {
  for (const line of lines) {
    if (line.length < 3) continue;

    // Pattern 1: e.g. "Air Filter 24x24: 10 Pieces (Note)" or "Item - 5 Meters - Remark"
    const dashParts = line.split(/\s*[-–—|:]\s*/);
    if (dashParts.length >= 2) {
      const nameCandidate = dashParts[0].replace(/^[\d\s.)]+/, '').trim();
      let qty = '1';
      let unit = 'Pieces';
      let desc = '';

      // Check remaining parts for quantity & unit
      for (let i = 1; i < dashParts.length; i++) {
        const part = dashParts[i].trim();
        const qtyMatch = part.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
        if (qtyMatch) {
          qty = qtyMatch[1];
          if (qtyMatch[2]) unit = normalizeUnit(qtyMatch[2]);
        } else if (COMMON_UNITS.some((u) => part.toLowerCase().includes(u.toLowerCase()))) {
          unit = normalizeUnit(part);
        } else {
          desc = desc ? `${desc}, ${part}` : part;
        }
      }

      if (nameCandidate) {
        results.push({
          materialName: cleanMaterialName(nameCandidate),
          quantity: qty,
          unit,
          description: desc,
        });
        continue;
      }
    }

    // Pattern 2: e.g. "10 pcs Air Filter 24x24" or "5x Circuit Breakers 20A"
    const leadingQtyMatch = line.match(/^[\d.)\s]*(\d+)\s*(?:x\s*)?([a-zA-Z]+)?\s+([A-Za-z0-9].+)$/);
    if (leadingQtyMatch) {
      const qty = leadingQtyMatch[1];
      const possibleUnit = leadingQtyMatch[2] ? normalizeUnit(leadingQtyMatch[2]) : 'Pieces';
      const name = leadingQtyMatch[3].trim();
      results.push({
        materialName: cleanMaterialName(name),
        quantity: qty,
        unit: possibleUnit,
        description: '',
      });
      continue;
    }

    // Pattern 3: Space separated words if at least 2 tokens
    const tokens = line.split(/\s{2,}/);
    if (tokens.length >= 2) {
      results.push({
        materialName: cleanMaterialName(tokens[0]),
        quantity: extractQuantity(tokens[1]) || '1',
        unit: tokens[2] ? normalizeUnit(tokens[2]) : 'Pieces',
        description: tokens[3] || '',
      });
    }
  }
}

function cleanMaterialName(raw: string): string {
  // Strip leading numbers like "1. ", "01 - ", "#1 "
  return raw
    .replace(/^#?\d+[\s.)\-_]+/, '')
    .trim();
}

/**
 * Realistic sample text tables ready for 1-click loading.
 */
export const SAMPLE_TEXT_TABLES = {
  HVAC: {
    name: 'HVAC Air Conditioning Materials',
    text: `| Item Description | Unit Type | Quantity | Specification / Notes |
| AC Air Filter 24x24x2 MERV 8 | Pieces | 25 | AHU primary intake filters |
| Copper Pipe 7/8" Suction Line | Meters | 45 | Refrigerant hard tubing |
| Refrigerant R-410A Cylinders | Cylinders | 6 | 11.3 kg sealed cylinders |
| Dual Run Capacitor 50+5 uF 440V | Pieces | 8 | Heavy-duty condenser fan motor |
| Liquid Line Filter Drier 5/8" | Pieces | 5 | Hermetic solder connections |`,
  },
  Plumbing: {
    name: 'Plumbing & Sanitary Materials',
    text: `| Item Description | Unit Type | Quantity | Specification / Notes |
| Brass Gate Valve 2 Inch PN16 | Pieces | 10 | Full bore female threaded |
| PVC Drain Pipe 4 Inch Class B | Meters | 30 | Heavy wall drainage piping |
| Wash Basin Mixer Tap Single Lever | Sets | 12 | Chrome finish ceramic cartridge |
| PTFE Teflon Thread Seal Tape | Rolls | 40 | High-density 19mm x 15m |
| Stainless Steel Flexible Hose 1/2" | Pieces | 24 | Braided connector 450mm |`,
  },
  Electrical: {
    name: 'Electrical Distribution Materials',
    text: `| Item Description | Unit Type | Quantity | Specification / Notes |
| Schneider 32A 3-Pole MCB 10kA | Pieces | 15 | C-curve DIN rail breaker |
| Schneider 40A 3-Pole Contactor | Pieces | 8 | TeSys D magnetic contactor |
| 4-Core 16mm Armored Copper Cable | Meters | 80 | XLPE heavy duty power cable |
| Industrial Surface Socket 16A 3-Pin | Pieces | 20 | IP67 waterproof enclosure |
| Panel LED Pilot Lamps 220V | Sets | 25 | Red, Yellow, Blue indicators |`,
  },
  Generator: {
    name: 'Generator Maintenance Materials',
    text: `| Item Description | Unit Type | Quantity | Specification / Notes |
| Diesel Engine Oil Filter LF9009 | Pieces | 8 | Fleetguard spin-on lube filter |
| Primary Fuel Water Separator FS1000 | Pieces | 8 | Diesel fuel element filter |
| 12V 200Ah Heavy Duty Starter Battery | Units | 2 | Cranking battery for standby DG |
| Alternator Poly-V Cogged Belt | Sets | 6 | High temp heavy-duty belt set |
| Diesel Engine Lube Oil 15W-40 | Liters | 100 | API CI-4 20L containers |`,
  },
  Telephone: {
    name: 'Telephone & Telecom Materials',
    text: `| Item Description | Unit Type | Quantity | Specification / Notes |
| Telephone Handset Cisco 7821 IP | Units | 10 | PoE VoIP desktop telephone |
| RJ11 Modular Telephone Connectors | Pieces | 150 | 6P4C gold plated clear plugs |
| 2-Pair Telephone Drop Wire | Meters | 200 | CW1308 unshielded solid copper |
| 24-Port Voice Patch Panel 1U | Units | 2 | 19-inch rack mount RJ45/RJ11 |
| RJ11 to RJ11 Curly Handset Cord | Pieces | 30 | 2-meter stretched spring cable |`,
  },
};
