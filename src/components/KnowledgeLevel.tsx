/** Keep even the first small gain visible without rounding it down to zero. */
export function formatKnowledgeLevel(level: number): string {
  if (level <= 0) return '0%';
  if (level < .001) return '0.1%未満';
  if (level >= 1) return '100%';
  return `${(Math.floor(level * 1000) / 10).toFixed(1)}%`;
}

export function KnowledgeLevel({ level, label }: { level: number; label: string }) {
  return <span className="knowledge-level">
    <span className="knowledge-level-value">{formatKnowledgeLevel(level)}</span>
    <span className="knowledge-level-track" role="progressbar" aria-label={`${label}の学習レベル`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={level * 100} aria-valuetext={formatKnowledgeLevel(level)}>
      <span style={{ width: `${level * 100}%`, minWidth: level > 0 ? 2 : 0 }} />
    </span>
  </span>;
}
