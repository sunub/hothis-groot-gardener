'use client';

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, type XAxisTickContentProps } from 'recharts';
import type { DayRecord, PlantState } from '@/lib/contract/types';
import { format, useDictionary } from '@/lib/i18n';
import { METRIC_MAX, METRIC_MIN } from '@/lib/game/rules';

type SeriesKey = 'plant_health' | 'root_moisture' | 'humidity';

/**
 * Series styles. Tokens only: health uses the game-value color; the two
 * chamber metrics use ink tones. Dash pattern and marker shape carry identity
 * too, because the ink tones are close in hue.
 */
const SERIES: readonly { key: SeriesKey; color: string; dash?: string; marker: Marker }[] = [
  { key: 'plant_health', color: 'var(--color-game)', marker: 'circle' },
  { key: 'root_moisture', color: 'var(--color-ink)', dash: '6 4', marker: 'square' },
  { key: 'humidity', color: 'var(--color-ink-muted)', dash: '2 4', marker: 'triangle' },
];

type Marker = 'circle' | 'square' | 'triangle';

/** Quarter steps of the 0-100 scale. */
const Y_TICKS = [0, 1, 2, 3, 4].map((i) => METRIC_MIN + ((METRIC_MAX - METRIC_MIN) * i) / 4);

interface Point {
  tick: string;
  sub: string;
  full: string;
  plant_health: number;
  root_moisture: number;
  humidity: number;
}

function MarkerShape({ shape, cx, cy, color }: { shape: Marker; cx: number; cy: number; color: string }) {
  const r = 4;
  const common = { fill: color, stroke: 'var(--color-surface)', strokeWidth: 2 };
  if (shape === 'square') return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...common} />;
  if (shape === 'triangle')
    return <polygon points={`${cx},${cy - r - 1} ${cx + r + 1},${cy + r} ${cx - r - 1},${cy + r}`} {...common} />;
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

function LegendSwatch({ shape, color, dash }: { shape: Marker; color: string; dash?: string }) {
  return (
    <svg width="28" height="12" aria-hidden className="shrink-0">
      <line x1="0" y1="6" x2="28" y2="6" stroke={color} strokeWidth="2" strokeDasharray={dash} />
      <MarkerShape shape={shape} cx={14} cy={6} color={color} />
    </svg>
  );
}

/** Two-line x tick: game day on top, cultivation day below, so 8 points fit a narrow column. */
function DayTick({ x, y, index, points }: { x: number | string; y: number | string; index: number; points: Point[] }) {
  const p = points[index];
  if (!p) return null;
  return (
    <g transform={`translate(${Number(x)},${Number(y) + 4})`}>
      <text textAnchor="middle" dy="0.71em" fontSize="11" fill="var(--color-ink)">
        {p.tick}
      </text>
      <text textAnchor="middle" dy="2.1em" fontSize="10" fill="var(--color-ink-muted)">
        {p.sub}
      </text>
    </g>
  );
}

/**
 * Plant health, root moisture and chamber humidity, one point per game day
 * read each morning, with an optional last point for the current state.
 */
export function StateHistoryChart({ days, current }: { days: readonly DayRecord[]; current?: PlantState }) {
  const t = useDictionary();
  const c = t.mission.chart;

  const points: Point[] = days.map((d) => ({
    tick: format(c.tick_day, { day: d.game_day }),
    sub: format(c.tick_cult, { day: d.cultivation_day }),
    full: format(c.day_full, { day: d.game_day, cultivation_day: d.cultivation_day }),
    plant_health: d.start.plant_health,
    root_moisture: d.start.root_moisture,
    humidity: d.start.humidity,
  }));
  if (current) {
    points.push({
      tick: c.latest,
      sub: '',
      full: c.latest_full,
      plant_health: current.plant_health,
      root_moisture: current.root_moisture,
      humidity: current.humidity,
    });
  }

  if (points.length === 0) return <p className="text-sm text-ink-muted">{c.empty}</p>;

  return (
    <figure aria-label={c.label} className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <LegendSwatch shape={s.marker} color={s.color} dash={s.dash} />
            {t.common.metric[s.key]}
          </li>
        ))}
      </ul>
      <div aria-hidden>
        <LineChart
          responsive
          data={points}
          margin={{ top: 8, right: 12, bottom: 4, left: -8 }}
          style={{ width: '100%', height: 220 }}
        >
          <CartesianGrid stroke="var(--color-line)" strokeOpacity={0.6} vertical={false} />
          <XAxis
            dataKey="tick"
            interval={0}
            height={36}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            tick={(props: XAxisTickContentProps) => (
              <DayTick x={props.x} y={props.y} index={props.index} points={points} />
            )}
          />
          <YAxis
            domain={[METRIC_MIN, METRIC_MAX]}
            ticks={Y_TICKS}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-ink-muted)', strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-line)',
              borderRadius: 8,
              color: 'var(--color-ink)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--color-ink)', fontWeight: 600 }}
            itemStyle={{ color: 'var(--color-ink)' }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as Point | undefined;
              return p?.full ?? '';
            }}
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={t.common.metric[s.key]}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash}
              isAnimationActive="auto"
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.cx === undefined || props.cy === undefined ? (
                  <g key={`${s.key}-${props.index}`} />
                ) : (
                  <MarkerShape key={`${s.key}-${props.index}`} shape={s.marker} cx={props.cx} cy={props.cy} color={s.color} />
                )
              }
              activeDot={{ r: 6, stroke: 'var(--color-surface)', strokeWidth: 2, fill: s.color }}
            />
          ))}
        </LineChart>
      </div>
      <figcaption className="text-xs text-ink-muted">{c.note}</figcaption>
      {/* The values as a table for screen readers. A table ignores a fixed width, so the wrapper is hidden instead. */}
      <div className="sr-only">
        <table>
          <caption>{c.table_caption}</caption>
          <thead>
            <tr>
              <th scope="col">{c.table_point}</th>
              {SERIES.map((s) => (
                <th key={s.key} scope="col">
                  {t.common.metric[s.key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <th scope="row">{p.full}</th>
                {SERIES.map((s) => (
                  <td key={s.key}>{p[s.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
