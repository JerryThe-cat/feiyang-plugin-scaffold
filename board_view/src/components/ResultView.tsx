import React from 'react';

export interface RenderableResult {
  assignments: unknown[];
  skipped: string[];
  unassigned: unknown[];
  summary: unknown;
  written?: number;
  dryRun: boolean;
}

export function ResultView({ result }: { result: RenderableResult | null }) {
  if (!result) return null;
  const stats = [
    { label: '已分配', value: result.assignments.length },
    { label: '已跳过', value: result.skipped.length },
    { label: '未分配', value: result.unassigned.length },
  ];
  if (!result.dryRun) stats.push({ label: '已写回', value: result.written ?? 0 });

  return (
    <div className="card">
      <div className="card-title">
        <div className="card-step">3</div>
        排班结果
      </div>
      <div className="result-stats">
        {stats.map((s) => (
          <div className="stat-box" key={s.label}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      {result.dryRun && <div className="success">预览模式：未写回，确认无误后取消预览再执行。</div>}
      {!result.dryRun && (result.written ?? 0) > 0 && (
        <div className="success">已成功写回 {result.written} 条到多维表格。</div>
      )}
      <pre className="result-json">{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}
