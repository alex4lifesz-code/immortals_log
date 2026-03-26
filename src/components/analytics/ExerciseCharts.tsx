"use client";

import { useMemo, useRef } from "react";

type NumPoint = { label: string; value: number };

type XYPoint = { x: number; y: number; label?: string };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalize(values: number[], fallback = 1): { min: number; max: number; range: number } {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, fallback);
  const range = max - min || 1;
  return { min, max, range };
}

function useDownloadSvg(title: string) {
  const ref = useRef<SVGSVGElement | null>(null);

  const downloadSvg = () => {
    if (!ref.current) return;
    const blob = new Blob([ref.current.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    if (!ref.current) return;
    const svgData = new XMLSerializer().serializeToString(ref.current);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = ref.current?.viewBox.baseVal.width || 640;
      canvas.height = ref.current?.viewBox.baseVal.height || 280;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const out = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = out;
      a.download = `${title}.png`;
      a.click();
    };
    img.src = url;
  };

  return { ref, downloadSvg, downloadPng };
}

function ChartFrame({
  title,
  subtitle,
  children,
  onSvg,
  onPng,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSvg?: () => void;
  onPng?: () => void;
}) {
  return (
    <div className="rounded border border-ink-light/20 bg-ink-dark/45 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-cloud-white">{title}</div>
          {subtitle && <div className="text-xs text-mist-dark">{subtitle}</div>}
        </div>
        {(onSvg || onPng) && (
          <div className="flex gap-1 text-[11px]">
            {onSvg && <button className="rounded border border-ink-light/25 px-2 py-1 text-mist-light hover:text-jade-light" onClick={onSvg}>SVG</button>}
            {onPng && <button className="rounded border border-ink-light/25 px-2 py-1 text-mist-light hover:text-jade-light" onClick={onPng}>PNG</button>}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function LineChartCard({ title, points }: { title: string; points: NumPoint[] }) {
  const { ref, downloadSvg, downloadPng } = useDownloadSvg(title.replace(/\s+/g, "-").toLowerCase());
  const values = points.map((p) => p.value);
  const { min, range } = normalize(values);

  const path = useMemo(() => {
    if (points.length < 2) return "";
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * 620 + 10;
        const y = 250 - ((p.value - min) / range) * 220;
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }, [points, min, range]);

  return (
    <ChartFrame title={title} onSvg={downloadSvg} onPng={downloadPng}>
      <svg ref={ref} viewBox="0 0 640 280" className="h-44 w-full">
        <rect x="0" y="0" width="640" height="280" style={{ fill: "var(--chart-bg)" }} rx="8" />
        <path d={path} style={{ stroke: "var(--chart-primary)" }} strokeWidth="3" fill="none" />
        {points.map((p, i) => {
          const x = points.length > 1 ? (i / (points.length - 1)) * 620 + 10 : 320;
          const y = 250 - ((p.value - min) / range) * 220;
            return <circle key={`${p.label}-${i}`} cx={x} cy={y} r="3" style={{ fill: "var(--chart-secondary)" }} />;
        })}
      </svg>
    </ChartFrame>
  );
}

export function BarChartCard({ title, points }: { title: string; points: NumPoint[] }) {
  const { ref, downloadSvg, downloadPng } = useDownloadSvg(title.replace(/\s+/g, "-").toLowerCase());
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <ChartFrame title={title} onSvg={downloadSvg} onPng={downloadPng}>
      <svg ref={ref} viewBox="0 0 640 280" className="h-44 w-full">
        <rect x="0" y="0" width="640" height="280" style={{ fill: "var(--chart-bg)" }} rx="8" />
        {points.map((p, i) => {
          const barWidth = 620 / Math.max(points.length, 1);
          const x = 10 + i * barWidth + 2;
          const h = (p.value / max) * 220;
          const y = 250 - h;
            return <rect key={`${p.label}-${i}`} x={x} y={y} width={Math.max(4, barWidth - 4)} height={h} style={{ fill: "var(--chart-bar)" }} rx="3" />;
        })}
      </svg>
    </ChartFrame>
  );
}

export function AreaChartCard({ title, points }: { title: string; points: NumPoint[] }) {
  const { ref, downloadSvg, downloadPng } = useDownloadSvg(title.replace(/\s+/g, "-").toLowerCase());
  const values = points.map((p) => p.value);
  const { min, range } = normalize(values);
  const path = points
    .map((p, i) => {
      const x = points.length > 1 ? (i / (points.length - 1)) * 620 + 10 : 320;
      const y = 250 - ((p.value - min) / range) * 220;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const areaPath = `${path} L 630,250 L 10,250 Z`;

  return (
    <ChartFrame title={title} onSvg={downloadSvg} onPng={downloadPng}>
      <svg ref={ref} viewBox="0 0 640 280" className="h-44 w-full">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity="0.65" />
            <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="640" height="280" style={{ fill: "var(--chart-bg)" }} rx="8" />
        <path d={areaPath} fill="url(#areaFill)" stroke="none" />
        <path d={path} style={{ stroke: "var(--chart-primary)" }} strokeWidth="2" fill="none" />
      </svg>
    </ChartFrame>
  );
}

export function ScatterChartCard({ title, points }: { title: string; points: XYPoint[] }) {
  const { ref, downloadSvg, downloadPng } = useDownloadSvg(title.replace(/\s+/g, "-").toLowerCase());
  const xn = normalize(points.map((p) => p.x), 1);
  const yn = normalize(points.map((p) => p.y), 1);

  return (
    <ChartFrame title={title} onSvg={downloadSvg} onPng={downloadPng}>
      <svg ref={ref} viewBox="0 0 640 280" className="h-44 w-full">
        <rect x="0" y="0" width="640" height="280" style={{ fill: "var(--chart-bg)" }} rx="8" />
        {points.map((p, i) => {
          const x = ((p.x - xn.min) / xn.range) * 600 + 20;
          const y = 250 - ((p.y - yn.min) / yn.range) * 220;
          return <circle key={p.label || i} cx={x} cy={y} r={5} style={{ fill: "var(--chart-secondary)" }} opacity="0.8" />;
        })}
      </svg>
    </ChartFrame>
  );
}

export function RadarChartCard({ title, values }: { title: string; values: NumPoint[] }) {
  const { ref, downloadSvg, downloadPng } = useDownloadSvg(title.replace(/\s+/g, "-").toLowerCase());
  const max = Math.max(...values.map((v) => v.value), 1);
  const center = { x: 320, y: 140 };
  const radius = 100;

  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
    const r = (v.value / max) * radius;
    return `${center.x + Math.cos(angle) * r},${center.y + Math.sin(angle) * r}`;
  }).join(" ");

  return (
    <ChartFrame title={title} onSvg={downloadSvg} onPng={downloadPng}>
      <svg ref={ref} viewBox="0 0 640 280" className="h-44 w-full">
        <rect x="0" y="0" width="640" height="280" style={{ fill: "var(--chart-bg)" }} rx="8" />
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <circle key={ratio} cx={center.x} cy={center.y} r={radius * ratio} fill="none" style={{ stroke: "var(--chart-grid)" }} />
        ))}
        <polygon points={points} style={{ fill: "rgb(var(--chart-primary-rgb) / 0.35)", stroke: "var(--chart-primary)" }} strokeWidth="2" />
      </svg>
    </ChartFrame>
  );
}

export function HeatMapCard({ title, points }: { title: string; points: NumPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <ChartFrame title={title}>
      <div className="grid grid-cols-10 gap-1">
        {points.slice(-120).map((p, i) => {
          const alpha = clamp(p.value / max, 0.12, 1);
          return <div key={`${p.label}-${i}`} className="h-4 rounded" style={{ background: `rgb(var(--chart-primary-rgb) / ${alpha})` }} title={`${p.label}: ${p.value}`} />;
        })}
      </div>
    </ChartFrame>
  );
}

export function GaugeCard({ title, value }: { title: string; value: number }) {
  const pct = clamp(value, 0, 100);
  const r = 56;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <ChartFrame title={title}>
      <div className="flex items-center justify-center py-2">
        <svg viewBox="0 0 180 180" className="h-40 w-40">
          <circle cx="90" cy="90" r={r} style={{ stroke: "var(--chart-grid)" }} strokeWidth="14" fill="none" />
          <circle
            cx="90"
            cy="90"
            r={r}
            style={{ stroke: "var(--chart-primary)" }}
            strokeWidth="14"
            fill="none"
            strokeDasharray={`${dash} ${c}`}
            transform="rotate(-90 90 90)"
          />
          <text x="90" y="97" textAnchor="middle" className="fill-cloud-white text-lg font-semibold">{Math.round(pct)}%</text>
        </svg>
      </div>
    </ChartFrame>
  );
}

export function BoxPlotCard({ title, stats }: { title: string; stats: { min: number; q1: number; median: number; q3: number; max: number } }) {
  const scale = normalize([stats.min, stats.q1, stats.median, stats.q3, stats.max]);
  const x = (v: number) => ((v - scale.min) / scale.range) * 560 + 40;

  return (
    <ChartFrame title={title}>
      <svg viewBox="0 0 640 160" className="h-24 w-full">
        <line x1={x(stats.min)} y1="80" x2={x(stats.max)} y2="80" style={{ stroke: "var(--chart-whisker)" }} strokeWidth="2" />
        <rect x={x(stats.q1)} y={58} width={x(stats.q3) - x(stats.q1)} height={44} style={{ fill: "rgb(var(--chart-primary-rgb) / 0.35)", stroke: "var(--chart-primary)" }} />
        <line x1={x(stats.median)} y1="56" x2={x(stats.median)} y2="104" style={{ stroke: "var(--chart-secondary)" }} strokeWidth="3" />
      </svg>
    </ChartFrame>
  );
}

export function SparklineCard({ title, points }: { title: string; points: number[] }) {
  const data = points.map((v, i) => ({ label: String(i + 1), value: v }));
  return <LineChartCard title={title} points={data} />;
}

export function StackedBarCard({ title, rows }: { title: string; rows: Array<{ label: string; a: number; b: number; c: number }> }) {
  const max = Math.max(...rows.map((r) => r.a + r.b + r.c), 1);
  return (
    <ChartFrame title={title}>
      <div className="space-y-2">
        {rows.map((r) => {
          const total = r.a + r.b + r.c;
          return (
            <div key={r.label}>
              <div className="mb-1 text-xs text-mist-light">{r.label}</div>
              <div className="flex h-3 w-full overflow-hidden rounded bg-ink-light/15">
                <div style={{ width: `${(r.a / max) * 100}%` }} className="bg-jade-light/80" />
                <div style={{ width: `${(r.b / max) * 100}%` }} className="bg-gold/80" />
                <div style={{ width: `${(r.c / max) * 100}%` }} className="bg-blue-300/80" />
              </div>
              <div className="text-[11px] text-mist-dark">{total} sessions</div>
            </div>
          );
        })}
      </div>
    </ChartFrame>
  );
}

export function PieChartCard({ title, points }: { title: string; points: NumPoint[] }) {
  const total = Math.max(1, points.reduce((sum, p) => sum + p.value, 0));
  const palette = ["var(--chart-primary)", "var(--chart-secondary)", "var(--chart-bar)", "var(--difficulty-violet)", "var(--chart-down)", "var(--difficulty-green)"];

  const arcs = points.reduce<Array<{ d: string; color: string; label: string; value: number }>>((acc, p, i) => {
    const start = acc.length === 0
      ? 0
      : points
          .slice(0, i)
          .reduce((sum, item) => sum + (item.value / total) * Math.PI * 2, 0);
    const angle = (p.value / total) * Math.PI * 2;
    const end = start + angle;
    const large = angle > Math.PI ? 1 : 0;
    const x1 = 120 + Math.cos(start) * 80;
    const y1 = 120 + Math.sin(start) * 80;
    const x2 = 120 + Math.cos(end) * 80;
    const y2 = 120 + Math.sin(end) * 80;
    const d = `M 120 120 L ${x1} ${y1} A 80 80 0 ${large} 1 ${x2} ${y2} Z`;
    acc.push({ d, color: palette[i % palette.length], label: p.label, value: p.value });
    return acc;
  }, []);

  return (
    <ChartFrame title={title}>
      <div className="flex flex-wrap items-center gap-4">
        <svg viewBox="0 0 240 240" className="h-36 w-36">
          {arcs.map((a) => <path key={a.label} d={a.d} fill={a.color} />)}
        </svg>
        <div className="space-y-1 text-xs text-mist-light">
          {arcs.map((a) => (
            <div key={`${a.label}-legend`} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
              <span>{a.label}: {a.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}

export function CandlestickCard({ title, candles }: { title: string; candles: Array<{ open: number; close: number; high: number; low: number }> }) {
  const all = candles.flatMap((c) => [c.open, c.close, c.high, c.low]);
  const scale = normalize(all, 1);
  const y = (v: number) => 250 - ((v - scale.min) / scale.range) * 220;
  const w = 620 / Math.max(candles.length, 1);

  return (
    <ChartFrame title={title}>
      <svg viewBox="0 0 640 280" className="h-44 w-full">
        <rect x="0" y="0" width="640" height="280" style={{ fill: "var(--chart-bg)" }} rx="8" />
        {candles.map((c, i) => {
          const x = 10 + i * w + w / 2;
          const bodyTop = y(Math.max(c.open, c.close));
          const bodyBottom = y(Math.min(c.open, c.close));
          const color = c.close >= c.open ? "var(--chart-primary)" : "var(--chart-down)";
          return (
            <g key={i}>
              <line x1={x} y1={y(c.high)} x2={x} y2={y(c.low)} stroke={color} strokeWidth="1.5" />
              <rect x={x - Math.max(2, w * 0.2)} y={bodyTop} width={Math.max(4, w * 0.4)} height={Math.max(2, bodyBottom - bodyTop)} fill={color} />
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

export function FunnelCard({ title, points }: { title: string; points: NumPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <ChartFrame title={title}>
      <div className="space-y-2">
        {points.map((p, i) => (
          <div key={p.label} className="rounded border border-ink-light/20 bg-ink-dark/40 p-2">
            <div className="mb-1 flex items-center justify-between text-xs text-mist-light">
              <span>{p.label}</span>
              <span>{p.value}</span>
            </div>
            <div className="h-2 rounded bg-ink-light/15">
              <div className="h-2 rounded bg-jade-light/80" style={{ width: `${(p.value / max) * 100}%` }} />
            </div>
            <div className="text-[10px] text-mist-dark">Stage {i + 1}</div>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}
