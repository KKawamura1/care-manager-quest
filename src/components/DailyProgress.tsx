import { useEffect, useId, useMemo, useState } from 'react';
import type { LearningEvent } from '../domain/models';
import { dailyProgress, type ProgressPeriod } from '../domain/dailyProgress';

const number = (value: number) => value.toLocaleString('ja-JP');
const dateLabel = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`;

function useDailyProgress(events: readonly LearningEvent[], period: ProgressPeriod) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return useMemo(() => dailyProgress(events, period, now), [events, period, now]);
}

export function DailyProgressPreview({ events, onOpen }: { events: readonly LearningEvent[]; onOpen: () => void }) {
  const stats = useDailyProgress(events, 30);
  const id = useId().replace(/:/g, '');
  const today = stats.days.at(-1)!;
  const ceiling = Math.max(100, Math.ceil(stats.totalXp / 100) * 100);
  const points = stats.days.map((day, i) => `${6 + i / 29 * 108},${64 - day.cumulativeXp / ceiling * 54}`).join(' ');
  return <button className="progress-preview" aria-label="学習の積み上げを詳しく見る" onClick={onOpen}>
    <span className="progress-preview-stats"><span className="progress-preview-total"><strong>{number(stats.totalXp)}</strong><small>累積XP</small></span><span className="progress-preview-today">今日 <b>+{number(today.xp)} XP</b><span> · {stats.streak}日連続</span></span></span>
    <span className="progress-preview-visual">
      <svg viewBox="0 0 120 74" role="img" aria-label="直近30日間の累積XP">
        <defs><linearGradient id={`${id}-preview`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a5e5c3" stopOpacity=".25"/><stop offset="100%" stopColor="#a5e5c3" stopOpacity="0"/></linearGradient></defs>
        <polygon points={`6,68 ${points} 114,68`} fill={`url(#${id}-preview)`}/>
        <polyline points={points} className="progress-glow"/>
        <polyline points={points} className="progress-line" pathLength="1"/>
        <circle cx="114" cy={64 - stats.totalXp / ceiling * 54} r="3" fill="#a5e5c3"/>
      </svg>
      <span className="progress-preview-caption">30日間<span aria-hidden="true">↗</span></span>
    </span>
  </button>;
}

export function DailyProgress({ events }: { events: readonly LearningEvent[] }) {
  const [period, setPeriod] = useState<ProgressPeriod>(30);
  const [selected, setSelected] = useState(period - 1);
  const stats = useDailyProgress(events, period);
  const id = useId().replace(/:/g, '');
  const { days } = stats;
  const current = days[selected];
  const left = 12, right = 348, top = 24, bottom = 180, barBottom = 282;
  const x = (index: number) => left + index / (period - 1) * (right - left);
  const ceiling = Math.max(100, Math.ceil(stats.totalXp / 100) * 100);
  const y = (xp: number) => bottom - xp / ceiling * (bottom - top);
  const points = days.map((day, index) => `${x(index)},${y(day.cumulativeXp)}`).join(' ');
  const dailyMax = Math.max(10, ...days.map(day => day.xp));
  const barWidth = Math.min(16, (right - left) / period * .66);
  const barHeight = (xp: number) => xp / dailyMax * 54;
  const ticks = [0, Math.floor((period - 1) / 2), period - 1];
  return <section className="daily-progress" aria-label="日々の積み上げ">
    <div className="progress-heading"><h2>日々の積み上げ</h2><span className="progress-streak">{stats.streak}<small>日連続</small></span></div>
    <div className="progress-total"><strong>{number(stats.totalXp)}</strong><span>累積XP</span></div>
    <div className="progress-meta"><span className="mint">+{number(stats.periodXp)} XP<small> / {period}日間</small></span><span>学習 {stats.activeDays}日</span></div>
    <div className="progress-period" role="group" aria-label="グラフの期間">{([7, 30, 90] as const).map(value => <button key={value} aria-pressed={period === value} onClick={() => { setPeriod(value); setSelected(value - 1); }}>{value}日</button>)}</div>
    <svg className="progress-chart" viewBox="0 0 360 310" role="img" aria-label={`${period}日間の累積XPと日ごとの獲得XP。累積${number(stats.totalXp)} XP、期間内${number(stats.periodXp)} XP。日付を選ぶと詳細を確認できます。`}
      onPointerDown={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const localX = (event.clientX - rect.left) / rect.width * 360;
        setSelected(Math.max(0, Math.min(period - 1, Math.round((localX - left) / (right - left) * (period - 1)))));
      }}>
      <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a5e5c3" stopOpacity=".3"/><stop offset="100%" stopColor="#a5e5c3" stopOpacity=".01"/></linearGradient></defs>
      {[0, .5, 1].map(value => <g key={value}><line x1={left} x2={right} y1={y(value * ceiling)} y2={y(value * ceiling)} className="progress-grid"/><text x={left} y={y(value * ceiling) - 6} className="progress-axis">{number(value * ceiling)}</text></g>)}
      <polygon points={`${left},${bottom} ${points} ${right},${bottom}`} fill={`url(#${id}-area)`}/>
      <polyline points={points} className="progress-glow"/>
      <polyline points={points} className="progress-line" pathLength="1"/>
      <text x={left} y="215" className="progress-axis">日ごとのXP</text><text x={right} y="215" textAnchor="end" className="progress-axis">最大 {number(dailyMax)}</text>
      {days.map((day, i) => <g key={day.day} opacity={i === selected ? 1 : .65}>
        <rect x={x(i) - barWidth / 2} y={barBottom - barHeight(day.swipeXp)} width={barWidth} height={barHeight(day.swipeXp)} fill="#a5e5c3" rx="1"/>
        <rect x={x(i) - barWidth / 2} y={barBottom - barHeight(day.xp)} width={barWidth} height={barHeight(day.questXp)} fill="#e6c88c" rx="1"/>
      </g>)}
      <line x1={x(selected)} x2={x(selected)} y1={top} y2={barBottom} className="progress-cursor"/>
      <circle cx={x(selected)} cy={y(current.cumulativeXp)} r="8" fill="#a5e5c3" opacity=".15" className="progress-beacon"/>
      <circle cx={x(selected)} cy={y(current.cumulativeXp)} r="4" fill="#a5e5c3" stroke="#111820" strokeWidth="2"/>
      {ticks.map(i => <text key={i} x={x(i)} y="305" textAnchor={i === 0 ? 'start' : i === period - 1 ? 'end' : 'middle'} className="progress-axis">{dateLabel(days[i].day)}</text>)}
    </svg>
    <input className="progress-date-slider" type="range" aria-label="日付を選ぶ" aria-valuetext={`${dateLabel(current.day)}、${number(current.xp)} XP、${current.answers}回答`} min="0" max={period - 1} value={selected} onChange={event => setSelected(Number(event.target.value))}/>
    <div className="progress-day-detail" aria-live="polite"><span>{dateLabel(current.day)}{selected === period - 1 ? ' 今日' : ''}</span><b>+{number(current.xp)} <small>XP</small></b><span>{current.answers}回答</span></div>
    <div className="progress-legend"><span><i/>○×</span><span><i/>5択</span></div>
    {!events.length && <p className="progress-empty">最初の1問から、ここに積み上がる。</p>}
    <details className="help-details"><summary>グラフの見方</summary><p>ラインは全履歴の累積XP、棒はその日に獲得したXPです。5択の完全正解ボーナスも含みます。獲得XPは知識の定着度ではなく、学習の積み重ねを表します。</p><p>日付は日本時間。回答数は同じカード・版の1日最初の回答を数えます。同じ日の再練習はXPを増やしません。連続日数は今日、または昨日までの学習で数えます。日付をタップするか、スライダーで1日ずつ振り返れます。</p></details>
  </section>;
}
