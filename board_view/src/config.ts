export const DEPARTMENTS = ['维修部', '研发部', '行政部', '流媒部', '设计部'] as const;

export const STAFF_TIME_SLOTS: string[] = [
  '8:00 - 10:00',
  '10:00 - 12:00',
  '12:00 - 14:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
];
export const STAFF_TENTATIVE_SLOT = '暂定';

export const TECH_TIME_SLOTS: string[] = [
  '9:00 - 11:00',
  '11:00 - 13:00',
  '13:00 - 15:00',
  '15:00 - 17:00',
];

export const POSITION_ORDER = [
  '1号位',
  '4号位',
  '5号位',
  '6号位',
  '机动位',
  '学习位',
] as const;

export type Position = (typeof POSITION_ORDER)[number];

export const POSITION_CAPACITY: Record<Position, number> = {
  '1号位': 1,
  '4号位': 1,
  '5号位': 1,
  '6号位': 1,
  '机动位': 2,
  '学习位': 1_000_000,
};

export const MAINTENANCE_PREFERRED_POSITIONS = new Set<Position>(['1号位', '4号位']);
export const PREFERRED_DEPARTMENT = '维修部';
export const ENDPOINT_SLOT_TARGET = 6;

export const FIELD_STAFF_NAME = '姓名';
export const FIELD_STAFF_GENDER = '性别';
export const FIELD_STAFF_DEPARTMENT = '部门';
export const FIELD_STAFF_APPLIED_SLOTS = '报名时间段';
export const FIELD_STAFF_ASSIGNED_SLOT = '安排时间段';
export const FIELD_STAFF_ASSIGNED_POSITION = '安排位置';

export const FIELD_TECH_NAME = '姓名';
export const FIELD_TECH_APPLIED_SLOTS = '报名时间段';
export const FIELD_TECH_ASSIGNED_SLOT = '安排时间段';

export const GRANT_STORAGE_KEY = 'feiyang_granted_user_ids';
