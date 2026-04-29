import React, { useState } from 'react';

interface Props {
  slots: string[];
  source: string;
  onChange: (slots: string[], source: string) => void;
  onLoadFromTable?: () => Promise<void>;
  onReset: () => void;
  disabled?: boolean;
}

export function SlotEditor({ slots, source, onChange, onLoadFromTable, onReset, disabled }: Props) {
  const [input, setInput] = useState('');

  const remove = (idx: number) => {
    const next = slots.filter((_, i) => i !== idx);
    onChange(next, '手动编辑');
  };
  const add = () => {
    const v = input.trim();
    if (!v || slots.includes(v)) {
      setInput('');
      return;
    }
    onChange([...slots, v], '手动编辑');
    setInput('');
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {onLoadFromTable && (
          <button className="btn btn-ghost btn-sm" onClick={onLoadFromTable} disabled={disabled}>
            从表格读取
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onReset} disabled={disabled}>
          恢复默认
        </button>
        <span className="hint" style={{ marginLeft: 'auto' }}>
          当前：{slots.length} 段 · 来源：{source}
        </span>
      </div>

      <div className="chip-list">
        {slots.length === 0 ? (
          <span className="hint">尚未配置任何时段</span>
        ) : (
          slots.map((s, idx) => (
            <span className="chip" key={`${s}-${idx}`}>
              {s}
              <span className="chip-x" onClick={() => !disabled && remove(idx)}>×</span>
            </span>
          ))
        )}
      </div>

      <div className="slot-add">
        <input
          type="text"
          placeholder="如 8:00 - 9:00（回车或点加号）"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          disabled={disabled}
        />
        <button className="btn btn-ghost btn-sm" onClick={add} disabled={disabled}>
          + 添加
        </button>
      </div>

      <div className="hint" style={{ marginTop: 8 }}>
        ⚠️ 自定义时段后，表格中"安排时间段"单选字段里也要有对应选项。顺序决定首末时段判定。
      </div>
    </div>
  );
}
