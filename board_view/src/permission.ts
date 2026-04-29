import {
  bitable,
  OperationType,
  PermissionEntity,
} from '@lark-opdev/block-bitable-api';
import { GRANT_STORAGE_KEY } from './config';

export type Role = 'admin' | 'granted' | 'readonly';

export interface PermissionState {
  userId: string;
  role: Role;
  grantedUserIds: string[];
}

export async function getCurrentUserId(): Promise<string> {
  return bitable.bridge.getUserId();
}

export async function isBaseAdmin(): Promise<boolean> {
  try {
    return await bitable.base.getPermission({
      entity: PermissionEntity.Base,
      type: OperationType.Manageable,
    });
  } catch {
    return false;
  }
}

async function readStoredBlob(): Promise<Record<string, unknown>> {
  try {
    const raw = await bitable.bridge.getData();
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return {};
}

export async function loadGrantedUserIds(): Promise<string[]> {
  const blob = await readStoredBlob();
  const v = blob[GRANT_STORAGE_KEY];
  if (Array.isArray(v)) {
    return v.filter((s): s is string => typeof s === 'string' && s.length > 0);
  }
  return [];
}

export async function saveGrantedUserIds(ids: string[]): Promise<void> {
  const clean = Array.from(new Set(ids.map((s) => s.trim()).filter((s) => s.length > 0)));
  const blob = await readStoredBlob();
  blob[GRANT_STORAGE_KEY] = clean;
  await bitable.bridge.setData(blob);
}

export async function resolvePermissionState(): Promise<PermissionState> {
  const [userId, admin, granted] = await Promise.all([
    getCurrentUserId(),
    isBaseAdmin(),
    loadGrantedUserIds(),
  ]);
  let role: Role;
  if (admin) role = 'admin';
  else if (granted.includes(userId)) role = 'granted';
  else role = 'readonly';
  return { userId, role, grantedUserIds: granted };
}

export function canExecute(state: PermissionState): boolean {
  return state.role === 'admin' || state.role === 'granted';
}

export function canManageGrants(state: PermissionState): boolean {
  return state.role === 'admin';
}
