import {
  ENDPOINT_SLOT_TARGET,
  MAINTENANCE_PREFERRED_POSITIONS,
  POSITION_CAPACITY,
  POSITION_ORDER,
  PREFERRED_DEPARTMENT,
  Position,
  STAFF_TIME_SLOTS,
  TECH_TIME_SLOTS,
} from './config';

export interface StaffApplicant {
  recordId: string;
  name: string;
  gender: string;
  departments: string[];
  appliedSlots: string[];
  alreadyAssignedSlot?: string;
  alreadyAssignedPosition?: string;
}

export interface TechApplicant {
  recordId: string;
  name: string;
  appliedSlots: string[];
  alreadyAssignedSlot?: string;
}

export interface StaffAssignment {
  recordId: string;
  name: string;
  slot: string;
  position: Position;
}

export interface TechAssignment {
  recordId: string;
  name: string;
  slot: string;
}

export interface StaffScheduleResult {
  assignments: StaffAssignment[];
  skipped: string[];
  unassigned: StaffApplicant[];
  summary: Record<string, unknown>;
}

export interface TechScheduleResult {
  assignments: TechAssignment[];
  skipped: string[];
  unassigned: TechApplicant[];
  summary: Record<string, unknown>;
}

const isMale = (gender: string): boolean =>
  ['男', 'Male', 'male', 'M', 'm'].includes(gender.trim());

const isMaintenance = (a: StaffApplicant): boolean =>
  a.departments.includes(PREFERRED_DEPARTMENT);

const staffAlreadyScheduled = (a: StaffApplicant): boolean =>
  !!a.alreadyAssignedSlot && !!a.alreadyAssignedPosition;

const techAlreadyScheduled = (a: TechApplicant): boolean => !!a.alreadyAssignedSlot;

export function normalizeSlot(s: string): string {
  if (!s) return '';
  let t = s.replace(/\s+/g, '');
  t = t
    .replace(/：/g, ':')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/～/g, '-')
    .replace(/~/g, '-');
  return t;
}

export function filterValidSlots(slots: string[], valid: string[]): string[] {
  const validMap = new Map<string, string>();
  valid.forEach((v) => validMap.set(normalizeSlot(v), v));
  const order = new Map<string, number>();
  valid.forEach((v, i) => order.set(v, i));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of slots) {
    const canonical = validMap.get(normalizeSlot(s));
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  out.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return out;
}

function activeTimeSlots(applicants: StaffApplicant[], validSlots: string[]): string[] {
  const validSet = new Set(validSlots);
  const used = new Set<string>();
  for (const a of applicants) {
    for (const s of a.appliedSlots) {
      if (validSet.has(s)) used.add(s);
    }
  }
  return validSlots.filter((s) => used.has(s));
}

function slotProcessOrder(activeSlots: string[], endpointSlots: Set<string>): string[] {
  const head = activeSlots.filter((s) => endpointSlots.has(s));
  const mid = activeSlots.filter((s) => !endpointSlots.has(s));
  return [...head, ...mid];
}

function posFull(occupants: StaffApplicant[], pos: Position): boolean {
  return occupants.length >= POSITION_CAPACITY[pos];
}

function slotTotal(posMap: Record<Position, StaffApplicant[]>): number {
  return POSITION_ORDER.reduce((acc, p) => acc + posMap[p].length, 0);
}

function pickCandidate(
  applicants: StaffApplicant[],
  assignedIds: Set<string>,
  slot: string,
  preferMaintenance: boolean,
  preferMale: boolean,
): StaffApplicant | null {
  let best: StaffApplicant | null = null;
  let bestKey: [number, number, number] | null = null;

  for (const a of applicants) {
    if (assignedIds.has(a.recordId)) continue;
    if (!a.appliedSlots.includes(slot)) continue;

    const key: [number, number, number] = [
      preferMaintenance && isMaintenance(a) ? 0 : 1,
      preferMale && isMale(a.gender) ? 0 : 1,
      a.appliedSlots.length,
    ];

    if (
      bestKey === null ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && key[1] < bestKey[1]) ||
      (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])
    ) {
      best = a;
      bestKey = key;
    }
  }
  return best;
}

export function scheduleStaff(
  rawApplicants: StaffApplicant[],
  timeSlots?: string[],
): StaffScheduleResult {
  const result: StaffScheduleResult = {
    assignments: [],
    skipped: [],
    unassigned: [],
    summary: {},
  };
  const validSlots: string[] = timeSlots ? [...timeSlots] : [...STAFF_TIME_SLOTS];

  const applicants: StaffApplicant[] = [];
  for (const raw of rawApplicants) {
    const a: StaffApplicant = { ...raw, appliedSlots: filterValidSlots(raw.appliedSlots, validSlots) };
    if (staffAlreadyScheduled(a)) {
      result.skipped.push(a.recordId);
      continue;
    }
    if (a.appliedSlots.length === 0) {
      result.unassigned.push(a);
      continue;
    }
    applicants.push(a);
  }

  const activeSlots = activeTimeSlots(applicants, validSlots);
  if (activeSlots.length === 0) {
    result.summary = { message: '无有效报名数据', slots: {} };
    return result;
  }

  const firstSlot = activeSlots[0];
  const lastSlot = activeSlots[activeSlots.length - 1];
  const endpointSlots = new Set<string>([firstSlot, lastSlot]);
  const endpointSlotList: string[] = firstSlot === lastSlot ? [firstSlot] : [firstSlot, lastSlot];

  const slotSlots: Record<string, Record<Position, StaffApplicant[]>> = {};
  for (const s of activeSlots) {
    const posMap = {} as Record<Position, StaffApplicant[]>;
    for (const p of POSITION_ORDER) posMap[p] = [];
    slotSlots[s] = posMap;
  }

  const assignedIds = new Set<string>();
  const processOrder = slotProcessOrder(activeSlots, endpointSlots);

  // Pass 1: 维修部填 1/4 号位
  for (const slot of processOrder) {
    for (const pos of ['1号位', '4号位'] as Position[]) {
      if (posFull(slotSlots[slot][pos], pos)) continue;
      const cand = pickCandidate(applicants, assignedIds, slot, true, endpointSlots.has(slot));
      if (cand) {
        slotSlots[slot][pos].push(cand);
        assignedIds.add(cand.recordId);
      }
    }
  }

  // Pass 2: 补齐 1/4/5/6 号位
  for (const slot of processOrder) {
    for (const pos of ['1号位', '4号位', '5号位', '6号位'] as Position[]) {
      while (!posFull(slotSlots[slot][pos], pos)) {
        const cand = pickCandidate(
          applicants,
          assignedIds,
          slot,
          MAINTENANCE_PREFERRED_POSITIONS.has(pos),
          endpointSlots.has(slot),
        );
        if (!cand) break;
        slotSlots[slot][pos].push(cand);
        assignedIds.add(cand.recordId);
      }
    }
  }

  // Pass 3: 机动位 (≤2)
  for (const slot of processOrder) {
    const pos: Position = '机动位';
    while (!posFull(slotSlots[slot][pos], pos)) {
      const cand = pickCandidate(applicants, assignedIds, slot, false, endpointSlots.has(slot));
      if (!cand) break;
      slotSlots[slot][pos].push(cand);
      assignedIds.add(cand.recordId);
    }
  }

  // Pass 4: 首末时段补齐到 ≥6（若首末是同一段，不重复处理）
  for (const slot of endpointSlotList) {
    while (slotTotal(slotSlots[slot]) < ENDPOINT_SLOT_TARGET) {
      const cand = pickCandidate(applicants, assignedIds, slot, false, true);
      if (!cand) break;
      slotSlots[slot]['学习位'].push(cand);
      assignedIds.add(cand.recordId);
    }
  }

  // Pass 5: 剩余进学习位
  const remaining = applicants.filter((a) => !assignedIds.has(a.recordId));
  for (const a of remaining) {
    if (a.appliedSlots.length === 0) {
      result.unassigned.push(a);
      continue;
    }
    const target = a.appliedSlots.reduce((acc, s) =>
      slotTotal(slotSlots[s]) < slotTotal(slotSlots[acc]) ? s : acc,
    );
    slotSlots[target]['学习位'].push(a);
    assignedIds.add(a.recordId);
  }

  for (const slot of activeSlots) {
    for (const pos of POSITION_ORDER) {
      for (const a of slotSlots[slot][pos]) {
        result.assignments.push({ recordId: a.recordId, name: a.name, slot, position: pos });
      }
    }
  }

  result.summary = buildStaffSummary(slotSlots, activeSlots, endpointSlots, endpointSlotList);
  return result;
}

function buildStaffSummary(
  slotSlots: Record<string, Record<Position, StaffApplicant[]>>,
  activeSlots: string[],
  endpointSlots: Set<string>,
  endpointSlotList: string[],
): Record<string, unknown> {
  const slotStats: Record<string, unknown> = {};
  let total = 0;
  for (const slot of activeSlots) {
    const perPos: Record<string, number> = {};
    for (const p of POSITION_ORDER) perPos[p] = slotSlots[slot][p].length;
    const st = Object.values(perPos).reduce((a, b) => a + b, 0);
    total += st;
    slotStats[slot] = {
      总人数: st,
      按点位: perPos,
      首末目标差额: endpointSlots.has(slot) ? Math.max(ENDPOINT_SLOT_TARGET - st, 0) : 0,
    };
  }
  return { 总分配人数: total, 各时段: slotStats, 首末时段: endpointSlotList };
}

export function scheduleTechnicians(
  rawApplicants: TechApplicant[],
  timeSlots?: string[],
): TechScheduleResult {
  const result: TechScheduleResult = {
    assignments: [],
    skipped: [],
    unassigned: [],
    summary: {},
  };
  const validSlots: string[] = timeSlots ? [...timeSlots] : [...TECH_TIME_SLOTS];

  const applicants: TechApplicant[] = [];
  for (const raw of rawApplicants) {
    const a: TechApplicant = { ...raw, appliedSlots: filterValidSlots(raw.appliedSlots, validSlots) };
    if (techAlreadyScheduled(a)) {
      result.skipped.push(a.recordId);
      continue;
    }
    if (a.appliedSlots.length === 0) {
      result.unassigned.push(a);
      continue;
    }
    applicants.push(a);
  }

  applicants.sort((x, y) => {
    if (x.appliedSlots.length !== y.appliedSlots.length) {
      return x.appliedSlots.length - y.appliedSlots.length;
    }
    return x.name.localeCompare(y.name);
  });

  const slotCounts: Record<string, number> = {};
  for (const s of validSlots) slotCounts[s] = 0;

  for (const a of applicants) {
    const target = a.appliedSlots.reduce((acc, s) =>
      slotCounts[s] < slotCounts[acc] ? s : acc,
    );
    slotCounts[target] += 1;
    result.assignments.push({ recordId: a.recordId, name: a.name, slot: target });
  }

  result.summary = {
    各时段人数: slotCounts,
    总分配人数: Object.values(slotCounts).reduce((a, b) => a + b, 0),
  };
  return result;
}
