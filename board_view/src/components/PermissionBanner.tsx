import React from 'react';
import { PermissionState } from '../permission';

export function PermissionBanner({ state }: { state: PermissionState }) {
  if (state.role === 'admin') {
    return (
      <div className="banner banner-admin">
        <span>👑</span>
        <span>你是本表格的管理员，可执行排班并授权他人。</span>
      </div>
    );
  }
  if (state.role === 'granted') {
    return (
      <div className="banner banner-granted">
        <span>✅</span>
        <span>你已被授权执行排班。</span>
      </div>
    );
  }
  return (
    <div className="banner banner-readonly">
      <span>🔒</span>
      <span>你当前为只读模式。若需执行排班，请联系表格管理员授权。</span>
    </div>
  );
}
