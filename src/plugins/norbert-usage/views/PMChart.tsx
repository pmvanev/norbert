/**
 * PMChart: uPlot-based time-series chart for the Performance Monitor.
 *
 * Supports two rendering modes:
 * - aggregate: Y-axis labels, grid lines, current value overlay, filled area
 * - mini: no axes, session label overlay, filled area
 *
 * Hover: emits sample index, value, and time offset via onHover callback.
 * uPlot provides built-in cursor crosshair and tooltip hooks.
 */

import { useRef, useEffect, useMemo } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { RateSample, ChartMode } from "../domain/types";
import type { RateField } from "../domain/oscilloscope";

// ---------------------------------------------------------------------------
// Hover data emitted to parent
// ---------------------------------------------------------------------------

export interface HoverData {
  readonly sampleIndex: number;
  readonly value: number;
  readonly timeOffsetMs: number;
  readonly tooltipX: number;
  readonly tooltipY: number;
}

// ---------------------------------------------------------------------------
// Color utility
// ---------------------------------------------------------------------------

const hexToRgba = (color: string, alpha: number): string => {
  const match = color.match(/#([0-9a-f]{6})/i);
  if (match) {
    const r = parseInt(match[1].slice(0, 2), 16);
    const g = parseInt(match[1].slice(2, 4), 16);
    const b = parseInt(match[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(255, 255, 255, ${alpha})`;
};

/** Read a CSS custom property from :root, with fallback. */
const getCssVar = (name: string, fallback: string): string => {
  if (typeof document === "undefined") return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
};

/** Resolve a category color through its CSS var, falling back to the hardcoded hex. */
export const resolveThemeColor = (cssVar: string, fallback: string): string =>
  getCssVar(cssVar, fallback);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMChartProps {
  readonly title: string;
  readonly samples: ReadonlyArray<RateSample>;
  readonly field: RateField;
  readonly color: string;
  readonly valueLabel?: string;
  readonly mode?: ChartMode;
  readonly yMax?: number;
  readonly yLabels?: ReadonlyArray<string>;
  readonly label?: string;
  readonly formatValue?: (value: number) => string;
  readonly hoverIndex?: number;
  readonly onHover?: (data: HoverData) => void;
  readonly onHoverEnd?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMChart = ({
  title,
  samples,
  field,
  color,
  mode = "aggregate",
  yMax,
  yLabels: _yLabels = [],
  label,
  formatValue,
  onHover,
  onHoverEnd,
}: PMChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);

  // Store callbacks in refs so uPlot hooks always call the latest version
  // without triggering uPlot recreation.
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const onHoverEndRef = useRef(onHoverEnd);
  onHoverEndRef.current = onHoverEnd;
  const formatValueRef = useRef(formatValue);
  formatValueRef.current = formatValue;

  const isAggregate = mode === "aggregate";

  // Build uPlot data from samples: [timestamps[], values[]]
  const data = useMemo((): uPlot.AlignedData => {
    if (samples.length === 0) {
      return [new Float64Array(0), new Float64Array(0)];
    }
    const timestamps = new Float64Array(samples.length);
    const values = new Float64Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      timestamps[i] = samples[i].timestamp / 1000;
      values[i] = samples[i][field];
    }
    return [timestamps, values];
  }, [samples, field]);

  // Autoscale Y-axis from data with 10% headroom.
  // Ignores the static yMax prop — the graph always fits the actual data.
  const effectiveYMax = useMemo(() => {
    if (samples.length === 0) return yMax ?? 1;
    const peak = samples.reduce((max, s) => Math.max(max, s[field]), 0);
    return peak > 0 ? peak * 1.1 : (yMax ?? 1);
  }, [yMax, samples, field]);

  // Create uPlot once on mount, destroy on unmount.
  // Uses refs for callbacks so this effect only runs once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 120;

    const opts: uPlot.Options = {
      width,
      height,
      cursor: {
        show: true,
        x: true,
        y: false,
        points: { show: false },
      },
      legend: { show: false },
      axes: [
        {
          show: false,
          stroke: "transparent",
          grid: {
            show: true,
            stroke: getCssVar("--osc-grid", "rgba(0, 229, 204, 0.06)"),
            width: 1,
            dash: [2, 4],
          },
        },
        {
          show: false,
          stroke: "transparent",
          grid: {
            show: true,
            stroke: getCssVar("--osc-grid", "rgba(0, 229, 204, 0.06)"),
            width: 1,
            dash: [2, 4],
          },
          ticks: { show: false },
          size: 0,
        },
      ],
      scales: {
        x: { time: false },
        y: { range: [0, effectiveYMax] },
      },
      series: [
        {},
        {
          stroke: color,
          width: 1.5,
          fill: (u: uPlot) => {
            const ctx = u.ctx;
            const plotTop = u.bbox.top / devicePixelRatio;
            const plotBot = (u.bbox.top + u.bbox.height) / devicePixelRatio;
            const gradient = ctx.createLinearGradient(0, plotTop, 0, plotBot);
            gradient.addColorStop(0, hexToRgba(color, 0.18));
            gradient.addColorStop(1, hexToRgba(color, 0.03));
            return gradient;
          },
          points: { show: false },
        },
      ],
      hooks: {
        setCursor: [
          (u: uPlot) => {
            const idx = u.cursor.idx;
            if (idx == null || idx < 0) {
              onHoverEndRef.current?.();
              return;
            }
            const hover = onHoverRef.current;
            if (!hover) return;
            const val = (u.data[1] as Float64Array | number[])[idx] ?? 0;
            const totalSamples = (u.data[0] as Float64Array | number[]).length;
            const timeOffsetMs = (totalSamples - 1 - idx) * 1000;
            const left = u.cursor.left ?? 0;
            const top = u.cursor.top ?? 0;
            const rect = u.over.getBoundingClientRect();
            hover({
              sampleIndex: idx,
              value: val as number,
              timeOffsetMs,
              tooltipX: rect.left + left,
              tooltipY: rect.top + top,
            });
          },
        ],
      },
    };

    const plot = new uPlot(opts, data, container);
    uplotRef.current = plot;

    return () => {
      plot.destroy();
      uplotRef.current = null;
    };
    // Only recreate on color/mode change. Y-axis autoscales via setScale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, isAggregate]);

  // Update data and autoscale Y axis without recreating the chart
  useEffect(() => {
    const plot = uplotRef.current;
    if (!plot) return;
    plot.setData(data, false);
    // Update Y scale range to fit the current data
    plot.setScale("y", { min: 0, max: effectiveYMax });
    plot.redraw();

  }, [data, effectiveYMax]);

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const plot = uplotRef.current;
      if (!plot) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0 && (w !== plot.width || h !== plot.height)) {
        plot.setSize({ width: w, height: h });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pm-chart-wrap" role="img" aria-label={title}>
      {!isAggregate && label && (
        <div className="pm-chart-ext-label" style={{ color }}>
          {label}
        </div>
      )}
      <div ref={containerRef} className="pm-chart-cell" />
    </div>
  );
};
