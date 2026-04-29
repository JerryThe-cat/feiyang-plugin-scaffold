import {
  bitable,
  FieldType,
  IFieldMeta,
  IOpenCellValue,
  IOpenSingleSelect,
  ISelectFieldMeta,
  IWidgetTable,
} from '@lark-opdev/block-bitable-api';
import {
  FIELD_STAFF_APPLIED_SLOTS,
  FIELD_STAFF_ASSIGNED_POSITION,
  FIELD_STAFF_ASSIGNED_SLOT,
  FIELD_STAFF_DEPARTMENT,
  FIELD_STAFF_GENDER,
  FIELD_STAFF_NAME,
  FIELD_TECH_APPLIED_SLOTS,
  FIELD_TECH_ASSIGNED_SLOT,
  FIELD_TECH_NAME,
} from './config';
import {
  StaffApplicant,
  StaffAssignment,
  TechApplicant,
  TechAssignment,
} from './scheduler';

export interface TableMeta {
  id: string;
  name: string;
}

export interface FieldBrief {
  id: string;
  name: string;
  type: FieldType;
  options?: string[];
}

export type StaffFieldMap = {
  name: string;
  gender: string;
  department: string;
  appliedSlots: string;
  assignedSlot: string;
  assignedPosition: string;
};

export type TechFieldMap = {
  name: string;
  appliedSlots: string;
  assignedSlot: string;
};

export const defaultStaffFieldMap = (): StaffFieldMap => ({
  name: FIELD_STAFF_NAME,
  gender: FIELD_STAFF_GENDER,
  department: FIELD_STAFF_DEPARTMENT,
  appliedSlots: FIELD_STAFF_APPLIED_SLOTS,
  assignedSlot: FIELD_STAFF_ASSIGNED_SLOT,
  assignedPosition: FIELD_STAFF_ASSIGNED_POSITION,
});

export const defaultTechFieldMap = (): TechFieldMap => ({
  name: FIELD_TECH_NAME,
  appliedSlots: FIELD_TECH_APPLIED_SLOTS,
  assignedSlot: FIELD_TECH_ASSIGNED_SLOT,
});

const READ_CONCURRENCY = 16;
const WRITE_CONCURRENCY = 8;

export async function listTables(): Promise<TableMeta[]> {
  const metas = await bitable.base.getTableMetaList();
  return metas.map((m) => ({ id: m.id, name: m.name }));
}

export async function getActiveTableId(): Promise<string> {
  try {
    const sel = await bitable.base.getSelection();
    return sel.tableId ?? '';
  } catch {
    return '';
  }
}

function isSelectMeta(m: IFieldMeta): m is ISelectFieldMeta {
  return m.type === FieldType.SingleSelect || m.type === FieldType.MultiSelect;
}

export async function listFields(tableId: string): Promise<FieldBrief[]> {
  const table = await bitable.base.getTableById(tableId);
  const metas = await table.getFieldMetaList();
  return metas.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    options: isSelectMeta(f) ? f.property.options.map((o) => o.name) : undefined,
  }));
}

export async function getFieldOptions(tableId: string, fieldName: string): Promise<string[]> {
  const fields = await listFields(tableId);
  const target = fields.find((f) => f.name === fieldName);
  return target?.options ?? [];
}

async function buildFieldNameMap(table: IWidgetTable): Promise<Map<string, IFieldMeta>> {
  const metas = await table.getFieldMetaList();
  const map = new Map<string, IFieldMeta>();
  for (const m of metas) map.set(m.name, m);
  return map;
}

function cellToStringList(val: IOpenCellValue): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    const out: string[] = [];
    for (const item of val) {
      if (typeof item === 'string') out.push(item.trim());
      else if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        for (const k of ['text', 'name', 'value']) {
          const v = rec[k];
          if (typeof v === 'string' && v.trim()) {
            out.push(v.trim());
            break;
          }
        }
      }
    }
    return out.filter((s) => !!s);
  }
  if (typeof val === 'string') return val.trim() ? [val.trim()] : [];
  if (typeof val === 'object') {
    const rec = val as Record<string, unknown>;
    for (const k of ['text', 'name', 'value']) {
      const v = rec[k];
      if (typeof v === 'string' && v.trim()) return [v.trim()];
    }
  }
  return [];
}

function cellToString(val: IOpenCellValue): string {
  return cellToStringList(val)[0] ?? '';
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners: Promise<void>[] = [];
  const slots = Math.max(1, Math.min(limit, items.length));
  for (let s = 0; s < slots; s++) {
    runners.push(
      (async () => {
        while (true) {
          const i = next++;
          if (i >= items.length) return;
          results[i] = await worker(items[i], i);
        }
      })(),
    );
  }
  await Promise.all(runners);
  return results;
}

async function loadRecordFields(
  table: IWidgetTable,
  recordId: string,
): Promise<Record<string, IOpenCellValue>> {
  try {
    const rec = await table.getRecordById(recordId);
    return (rec && rec.fields) || {};
  } catch {
    return {};
  }
}

export async function loadStaffApplicants(
  tableId: string,
  fieldMap: StaffFieldMap,
): Promise<StaffApplicant[]> {
  const table = await bitable.base.getTableById(tableId);
  const nameMap = await buildFieldNameMap(table);
  const recordIds = (await table.getRecordIdList()).filter((r): r is string => !!r);
  const fid = (key: keyof StaffFieldMap) => nameMap.get(fieldMap[key])?.id;
  const idName = fid('name');
  const idGender = fid('gender');
  const idDept = fid('department');
  const idApplied = fid('appliedSlots');
  const idAssignedSlot = fid('assignedSlot');
  const idAssignedPos = fid('assignedPosition');

  return mapWithLimit(recordIds, READ_CONCURRENCY, async (recordId) => {
    const fields = await loadRecordFields(table, recordId);
    const pick = (id: string | undefined): IOpenCellValue => (id ? fields[id] ?? null : null);
    return {
      recordId,
      name: cellToString(pick(idName)),
      gender: cellToString(pick(idGender)),
      departments: cellToStringList(pick(idDept)),
      appliedSlots: cellToStringList(pick(idApplied)),
      alreadyAssignedSlot: cellToString(pick(idAssignedSlot)) || undefined,
      alreadyAssignedPosition: cellToString(pick(idAssignedPos)) || undefined,
    };
  });
}

export async function loadTechApplicants(
  tableId: string,
  fieldMap: TechFieldMap,
): Promise<TechApplicant[]> {
  const table = await bitable.base.getTableById(tableId);
  const nameMap = await buildFieldNameMap(table);
  const recordIds = (await table.getRecordIdList()).filter((r): r is string => !!r);
  const fid = (key: keyof TechFieldMap) => nameMap.get(fieldMap[key])?.id;
  const idName = fid('name');
  const idApplied = fid('appliedSlots');
  const idAssignedSlot = fid('assignedSlot');

  return mapWithLimit(recordIds, READ_CONCURRENCY, async (recordId) => {
    const fields = await loadRecordFields(table, recordId);
    const pick = (id: string | undefined): IOpenCellValue => (id ? fields[id] ?? null : null);
    return {
      recordId,
      name: cellToString(pick(idName)),
      appliedSlots: cellToStringList(pick(idApplied)),
      alreadyAssignedSlot: cellToString(pick(idAssignedSlot)) || undefined,
    };
  });
}

function optionLookup(meta: ISelectFieldMeta): Map<string, string> {
  const m = new Map<string, string>();
  for (const o of meta.property.options) m.set(o.name, o.id);
  return m;
}

function buildSelectCellValue(
  meta: IFieldMeta,
  fieldLabel: string,
  optionIdByName: Map<string, string>,
  text: string,
): IOpenSingleSelect | IOpenSingleSelect[] {
  const id = optionIdByName.get(text);
  if (!id) {
    throw new Error(
      `字段「${fieldLabel}」没有名为「${text}」的选项，请先在表格里为该字段添加此选项`,
    );
  }
  const single: IOpenSingleSelect = { id, text };
  return meta.type === FieldType.MultiSelect ? [single] : single;
}

function requireSelectMeta(meta: IFieldMeta | undefined, label: string): ISelectFieldMeta {
  if (!meta) throw new Error(`找不到字段「${label}」，请检查表格字段名`);
  if (!isSelectMeta(meta)) throw new Error(`字段「${label}」不是单选/多选类型`);
  return meta;
}

export async function writeStaffAssignments(
  tableId: string,
  fieldMap: StaffFieldMap,
  assignments: StaffAssignment[],
): Promise<number> {
  if (assignments.length === 0) return 0;
  const table = await bitable.base.getTableById(tableId);
  const nameMap = await buildFieldNameMap(table);
  const slotMeta = requireSelectMeta(nameMap.get(fieldMap.assignedSlot), fieldMap.assignedSlot);
  const posMeta = requireSelectMeta(nameMap.get(fieldMap.assignedPosition), fieldMap.assignedPosition);
  const slotOpts = optionLookup(slotMeta);
  const posOpts = optionLookup(posMeta);

  await mapWithLimit(assignments, WRITE_CONCURRENCY, async (a) => {
    const slotVal = buildSelectCellValue(slotMeta, fieldMap.assignedSlot, slotOpts, a.slot);
    const posVal = buildSelectCellValue(posMeta, fieldMap.assignedPosition, posOpts, a.position);
    await table.setRecord(a.recordId, {
      fields: {
        [slotMeta.id]: slotVal,
        [posMeta.id]: posVal,
      },
    });
  });
  return assignments.length;
}

export async function writeTechAssignments(
  tableId: string,
  fieldMap: TechFieldMap,
  assignments: TechAssignment[],
): Promise<number> {
  if (assignments.length === 0) return 0;
  const table = await bitable.base.getTableById(tableId);
  const nameMap = await buildFieldNameMap(table);
  const slotMeta = requireSelectMeta(nameMap.get(fieldMap.assignedSlot), fieldMap.assignedSlot);
  const slotOpts = optionLookup(slotMeta);

  await mapWithLimit(assignments, WRITE_CONCURRENCY, async (a) => {
    const slotVal = buildSelectCellValue(slotMeta, fieldMap.assignedSlot, slotOpts, a.slot);
    await table.setRecord(a.recordId, {
      fields: { [slotMeta.id]: slotVal },
    });
  });
  return assignments.length;
}
