import React, { useCallback, useEffect, useState } from 'react';
import { STAFF_TIME_SLOTS, TECH_TIME_SLOTS } from './config';
import {
  defaultStaffFieldMap,
  defaultTechFieldMap,
  getActiveTableId,
  getFieldOptions,
  listTables,
  loadStaffApplicants,
  loadTechApplicants,
  TableMeta,
  writeStaffAssignments,
  writeTechAssignments,
} from './feishu';
import {
  canExecute,
  canManageGrants,
  PermissionState,
  resolvePermissionState,
} from './permission';
import { scheduleStaff, scheduleTechnicians } from './scheduler';
import { GrantPanel } from './components/GrantPanel';
import { PermissionBanner } from './components/PermissionBanner';
import { RenderableResult, ResultView } from './components/ResultView';
import { SlotEditor } from './components/SlotEditor';

type Mode = 'staff' | 'technician';

export function App() {
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const [permError, setPermError] = useState<string | null>(null);

  const [tables, setTables] = useState<TableMeta[]>([]);
  const [tableId, setTableId] = useState<string>('');
  const [mode, setMode] = useState<Mode>('staff');
  const [dryRun, setDryRun] = useState(false);
  const [slots, setSlots] = useState<string[]>(STAFF_TIME_SLOTS);
  const [slotSource, setSlotSource] = useState<string>('默认');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenderableResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const state = await resolvePermissionState();
        setPerm(state);
      } catch (e) {
        setPermError((e as Error).message);
      }
      try {
        const [ts, activeId] = await Promise.all([listTables(), getActiveTableId()]);
        setTables(ts);
        setTableId(activeId || ts[0]?.id || '');
      } catch (e) {
        setError('读取表格失败：' + (e as Error).message);
      }
    })();
  }, []);

  const resetSlots = useCallback(() => {
    const defaults = mode === 'staff' ? STAFF_TIME_SLOTS : TECH_TIME_SLOTS;
    setSlots([...defaults]);
    setSlotSource('默认');
  }, [mode]);

  useEffect(() => {
    resetSlots();
  }, [mode, resetSlots]);

  const loadSlotsFromTable = async () => {
    if (!tableId) {
      setError('请先选择数据表');
      return;
    }
    setError(null);
    try {
      const fieldName = mode === 'staff'
        ? defaultStaffFieldMap().appliedSlots
        : defaultTechFieldMap().appliedSlots;
      const options = await getFieldOptions(tableId, fieldName);
      const filtered = options.filter((o) => !/暂定|不参加|空/.test(o));
      if (filtered.length === 0) {
        setError(`字段「${fieldName}」没有可用选项`);
        return;
      }
      setSlots(filtered);
      setSlotSource(`表格字段「${fieldName}」`);
    } catch (e) {
      setError('读取字段选项失败：' + (e as Error).message);
    }
  };

  const run = async () => {
    if (!perm || !canExecute(perm)) {
      setError('当前账号无执行权限');
      return;
    }
    if (!tableId) {
      setError('请选择数据表');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      if (mode === 'staff') {
        const fmap = defaultStaffFieldMap();
        const applicants = await loadStaffApplicants(tableId, fmap);
        const schedule = scheduleStaff(applicants, slots);
        let written = 0;
        if (!dryRun) written = await writeStaffAssignments(tableId, fmap, schedule.assignments);
        setResult({ ...schedule, written, dryRun });
      } else {
        const fmap = defaultTechFieldMap();
        const applicants = await loadTechApplicants(tableId, fmap);
        const schedule = scheduleTechnicians(applicants, slots);
        let written = 0;
        if (!dryRun) written = await writeTechAssignments(tableId, fmap, schedule.assignments);
        setResult({ ...schedule, written, dryRun });
      }
    } catch (e) {
      setError('执行失败：' + (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const executable = !!perm && canExecute(perm);

  return (
    <div className="app">
      <div className="hero">
        <h1>大修活动自动化排班</h1>
        <p>按规则自动为干事 / 技术员分配时段与点位，结果直接写回本表格。</p>
      </div>

      {permError && <div className="error">读取权限失败：{permError}</div>}
      {perm && <PermissionBanner state={perm} />}

      <div className="card">
        <div className="card-title">
          <div className="card-step">1</div>
          选择数据表
        </div>
        <label className="field-label">数据表</label>
        <select value={tableId} onChange={(e) => setTableId(e.target.value)}>
          {tables.length === 0 && <option value="">（正在读取…）</option>}
          {tables.map((t) => (
            <option value={t.id} key={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="hint">当前插件已自动识别本多维表格，无需粘贴链接。</div>
      </div>

      <div className="card">
        <div className="card-title">
          <div className="card-step">2</div>
          配置排班
        </div>

        <label className="field-label">排班类型</label>
        <div className="mode-selector">
          <div
            className={`mode-option ${mode === 'staff' ? 'active' : ''}`}
            onClick={() => setMode('staff')}
          >
            干事排班<div className="hint" style={{ marginTop: 2 }}>分配时段 + 点位</div>
          </div>
          <div
            className={`mode-option ${mode === 'technician' ? 'active' : ''}`}
            onClick={() => setMode('technician')}
          >
            技术员排班<div className="hint" style={{ marginTop: 2 }}>仅分配时段</div>
          </div>
        </div>

        <div className="toggle-row" onClick={() => setDryRun(!dryRun)}>
          <div className={`toggle ${dryRun ? 'active' : ''}`} />
          <span className="toggle-label">仅预览，不写回表格</span>
        </div>

        <details>
          <summary>时间段配置</summary>
          <div style={{ marginTop: 10 }}>
            <SlotEditor
              slots={slots}
              source={slotSource}
              onChange={(s, src) => {
                setSlots(s);
                setSlotSource(src);
              }}
              onLoadFromTable={loadSlotsFromTable}
              onReset={resetSlots}
            />
          </div>
        </details>

        <div className="btn-group">
          <button
            className="btn btn-accent"
            onClick={run}
            disabled={running || !executable || !tableId}
            title={!executable ? '无执行权限' : ''}
          >
            {running ? <><span className="spinner" /> 排班中…</> : '执行排班'}
          </button>
          {result && (
            <button className="btn btn-ghost" onClick={() => setResult(null)}>
              清空结果
            </button>
          )}
        </div>

        {error && <div className="error">{error}</div>}
        {!executable && perm && (
          <div className="hint" style={{ marginTop: 10 }}>
            当前账号不可执行。请把下面这串 ID 发给管理员申请授权：<br />
            <code>{perm.userId}</code>
          </div>
        )}
      </div>

      {perm && canManageGrants(perm) && (
        <GrantPanel
          state={perm}
          onUpdated={(ids) => setPerm({ ...perm, grantedUserIds: ids })}
        />
      )}

      <ResultView result={result} />
    </div>
  );
}
