import React, { useState } from 'react';
import { PermissionState, saveGrantedUserIds } from '../permission';

interface Props {
  state: PermissionState;
  onUpdated: (ids: string[]) => void;
}

export function GrantPanel({ state, onUpdated }: Props) {
  const [text, setText] = useState(state.grantedUserIds.join('\n'));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const copyMyId = () => {
    navigator.clipboard?.writeText(state.userId);
    setMsg('已复制当前用户 ID 到剪贴板');
    setTimeout(() => setMsg(null), 2000);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const ids = text
        .split(/[\s,，\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await saveGrantedUserIds(ids);
      onUpdated(ids);
      setMsg(`已保存 ${ids.length} 个授权 ID`);
    } catch (e) {
      setMsg('保存失败：' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">授权管理（仅管理员可见）</div>

      <label className="field-label">当前用户 ID（转发给管理员以申请授权）</label>
      <div className="user-id-box">
        <span>{state.userId}</span>
        <button className="btn btn-ghost btn-sm" onClick={copyMyId}>
          复制
        </button>
      </div>

      <label className="field-label">被授权用户 ID 列表（每行一个，或以空格 / 逗号分隔）</label>
      <textarea
        className="grant-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴被授权用户的 BaseUserId，每行一个"
      />
      <div className="hint" style={{ marginTop: 6 }}>
        非管理员用户打开此插件时会看到自己的 ID，复制发给你后粘贴到这里保存即可。
      </div>

      <div className="btn-group">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? '保存中…' : '保存授权名单'}
        </button>
      </div>

      {msg && <div className="success">{msg}</div>}
    </div>
  );
}
