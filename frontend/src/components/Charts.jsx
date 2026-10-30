import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Validated two-slot palette (CVD-safe on the #FFFDF9 card surface).
export const SERIES = ['#A0581C', '#0B7FA0'];
const AXIS = { fontSize: 11, fill: '#76685C' };
const GRID = '#EDE3D6';

function Tip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <strong>{label}</strong>
      {payload.map((p) => (
        <div key={p.dataKey} className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span className="muted">{p.name}:</span> <span className="num">{p.value}{unit || ''}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  if (items.length < 2) return null;
  return (
    <div className="legend">
      {items.map((it, i) => <span key={it}><i style={{ background: SERIES[i] }} />{it}</span>)}
    </div>
  );
}

/** Vertical bars; one or two series. series: [{ key, name }] */
export function Bars({ data, xKey, series, unit, height = 260, angled }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: angled ? 30 : 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: '#D9C7B5' }} interval={0}
            angle={angled ? -20 : 0} textAnchor={angled ? 'end' : 'middle'} height={angled ? 50 : 30}
            tickFormatter={(v) => (String(v).length > 18 ? `${String(v).slice(0, 17)}…` : v)} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<Tip unit={unit} />} cursor={{ fill: 'rgba(164,117,81,0.08)' }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={38} stroke="#FFFDF9" strokeWidth={1} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for long category labels; single series. */
export function HBars({ data, yKey, valueKey, name, height }) {
  const h = height || Math.max(160, data.length * 38 + 30);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey={yKey} tick={AXIS} tickLine={false} axisLine={false} width={170}
            tickFormatter={(v) => (String(v).length > 26 ? `${String(v).slice(0, 25)}…` : v)} />
          <Tooltip content={<Tip />} cursor={{ fill: 'rgba(164,117,81,0.08)' }} />
          <Bar dataKey={valueKey} name={name} fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Lines({ data, xKey, series, height = 260 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: '#D9C7B5' }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<Tip />} cursor={{ stroke: '#A47551', strokeDasharray: '3 3' }} />
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={SERIES[i]} strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: '#FFFDF9', fill: SERIES[i] }} activeDot={{ r: 5, stroke: '#FFFDF9', strokeWidth: 2 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
