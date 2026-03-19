/**
 * PerformanceMonitorView: real-time performance monitoring dashboard.
 *
 * Layout grouped by unit type:
 *   - Rate chart (tokens/s + cost/s): dual-trace canvas waveform at ~10Hz
 *   - Count metrics (agents, sessions): numeric cards
 *   - Percentage metrics (context window %): bar gauge
 *   - Session breakdown: per-session table
 *
 * Subscribes to MetricsStore and uses a ref-based animation loop
 * (same pattern as OscilloscopeView) for continuous rendering.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { MetricsStore } from "../adapters/metricsStore";
import type { TimeSeriesBuffer, SessionMetrics, TimeWindowId } from "../domain/types";
import {
  prepareWaveformPoints,
  computeGridLines,
  computeCanvasDimensions,
  formatRateOverlay,
  type CanvasDimensions,
  type WaveformPoint,
  type GridLine,
} from "../domain/oscilloscope";
import { getSamples, appendSample, computeStats } from "../domain/timeSeriesSampler";
import { computeCostRatePerMinute } from "../domain/performanceMonitor";
import { classifyContextUrgency } from "../domain/urgencyThresholds";
import { PMTimeWindowSelector } from "./PMTimeWindowSelector";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 100; // ~10Hz
const WINDOW_DURATION_MS = 60_000;
const GRID_INTERVAL_MS = 10_000;
const ASPECT_RATIO = 4;

const getThemeColor = (prop: string, fallback: string): string => {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  return value || fallback;
};

// ---------------------------------------------------------------------------
// Canvas drawing
// ---------------------------------------------------------------------------

const clearCanvas = (ctx: CanvasRenderingContext2D, d: CanvasDimensions): void => {
  ctx.clearRect(0, 0, d.width, d.height);
  ctx.fillStyle = "rgba(0, 8, 6, 0.6)";
  ctx.fillRect(0, 0, d.width, d.height);
};

const drawGridLines = (ctx: CanvasRenderingContext2D, lines: ReadonlyArray<GridLine>, d: CanvasDimensions): void => {
  ctx.strokeStyle = "rgba(0, 229, 204, 0.08)";
  ctx.lineWidth = 1;
  ctx.font = "8px monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  for (const line of lines) {
    ctx.beginPath();
    ctx.moveTo(line.x, d.padding);
    ctx.lineTo(line.x, d.height - d.padding);
    ctx.stroke();
    ctx.fillText(line.label, line.x + 2, line.labelY);
  }
};

const drawTrace = (ctx: CanvasRenderingContext2D, points: ReadonlyArray<WaveformPoint>, color: string): void => {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PerformanceMonitorViewProps {
  readonly store: MetricsStore;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEFAULT_TIME_WINDOW: TimeWindowId = "1m";

export const PerformanceMonitorView = ({ store }: PerformanceMonitorViewProps) => {
  const [selectedWindow, setSelectedWindow] = useState<TimeWindowId>(DEFAULT_TIME_WINDOW);

  // Ref-based store access (same pattern as OscilloscopeView)
  const bufferRef = useRef<TimeSeriesBuffer>(store.getTimeSeries());
  const metricsRef = useRef<SessionMetrics>(store.getMetrics());

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({
    width: 600, height: 150, padding: 10,
  });

  // Live metric state (updated each render frame)
  const [liveMetrics, setLiveMetrics] = useState({
    tokenRate: "0 tok/s",
    costPerMin: "$0.00/min",
    peakRate: "0 tok/s",
    avgRate: "0 tok/s",
    activeAgents: 0,
    contextPct: 0,
    contextUrgency: "normal" as "normal" | "amber" | "red",
    sessionCost: "$0.00",
    totalTokens: 0,
    toolCalls: 0,
  });

  // Subscribe to store
  useEffect(() => {
    return store.subscribe((m, ts) => {
      metricsRef.current = m;
      bufferRef.current = ts;
    });
  }, [store]);

  // Responsive resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasDimensions(computeCanvasDimensions(width, height, ASPECT_RATIO));
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render frame (10Hz animation loop)
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Heartbeat: inject zero-rate sample during idle
    const now = Date.now();
    const currentSamples = getSamples(bufferRef.current);
    const lastTime = currentSamples.length > 0
      ? currentSamples[currentSamples.length - 1].timestamp
      : 0;
    if (now - lastTime >= REFRESH_INTERVAL_MS) {
      bufferRef.current = appendSample(bufferRef.current, { timestamp: now, tokenRate: 0, costRate: 0 });
    }

    const buffer = bufferRef.current;
    const samples = getSamples(buffer);
    const metrics = metricsRef.current;
    const stats = computeStats(buffer);

    // Draw rate chart
    const gridLines = computeGridLines(canvasDimensions, WINDOW_DURATION_MS, GRID_INTERVAL_MS);
    const tokenPoints = prepareWaveformPoints(samples, canvasDimensions, "tokenRate");
    const costPoints = prepareWaveformPoints(samples, canvasDimensions, "costRate");
    const tokenColor = getThemeColor("--brand", "#00e5cc");
    const costColor = getThemeColor("--amber", "#f0920a");

    clearCanvas(ctx, canvasDimensions);
    drawGridLines(ctx, gridLines, canvasDimensions);
    drawTrace(ctx, tokenPoints, tokenColor);
    drawTrace(ctx, costPoints, costColor);

    // Current rate overlay
    const currentRate = samples.length > 0 ? samples[samples.length - 1].tokenRate : 0;
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = getThemeColor("--text-p", "#c8f0e8");
    ctx.fillText(formatRateOverlay(currentRate), canvasDimensions.padding + 4, canvasDimensions.padding + 14);

    // Update live metric cards
    const currentCostRate = samples.length > 0 ? samples[samples.length - 1].costRate : 0;
    setLiveMetrics({
      tokenRate: formatRateOverlay(currentRate),
      costPerMin: `$${computeCostRatePerMinute(currentCostRate).toFixed(4)}/min`,
      peakRate: formatRateOverlay(stats.peakRate),
      avgRate: formatRateOverlay(stats.avgRate),
      activeAgents: metrics.activeAgentCount,
      contextPct: metrics.contextWindowPct,
      contextUrgency: classifyContextUrgency(metrics.contextWindowPct),
      sessionCost: `$${metrics.sessionCost.toFixed(4)}`,
      totalTokens: metrics.totalTokens,
      toolCalls: metrics.toolCallCount,
    });
  }, [canvasDimensions]);

  // Start/stop animation loop
  useEffect(() => {
    renderFrame();
    intervalRef.current = setInterval(renderFrame, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [renderFrame]);

  const urgencyClass = liveMetrics.contextUrgency === "red"
    ? "pm-urgency-red"
    : liveMetrics.contextUrgency === "amber"
      ? "pm-urgency-amber"
      : "";

  return (
    <div className="performance-monitor" role="region" aria-label="Performance Monitor">
      <div className="sec-hdr">
        <span className="sec-t">Performance Monitor</span>
        <PMTimeWindowSelector
          selectedWindow={selectedWindow}
          onChange={setSelectedWindow}
        />
      </div>

      {/* ── Rate chart (tokens/s + cost/s) ── */}
      <div ref={containerRef} className="pm-rate-chart">
        <canvas
          ref={canvasRef}
          width={canvasDimensions.width}
          height={canvasDimensions.height}
          className="pm-canvas"
        />
        <div className="pm-legend">
          <div className="pm-legend-item">
            <span className="pm-legend-dot" style={{ background: "var(--brand)" }} />
            tokens/s
          </div>
          <div className="pm-legend-item">
            <span className="pm-legend-dot" style={{ background: "var(--amber)" }} />
            cost/s
          </div>
        </div>
      </div>

      {/* ── Rate stats (same unit: rate) ── */}
      <div className="pm-stat-row">
        <div className="pm-stat">
          <div className="pm-stat-l">Current</div>
          <div className="pm-stat-v" data-mono="" style={{ color: "var(--brand)" }}>{liveMetrics.tokenRate}</div>
        </div>
        <div className="pm-stat">
          <div className="pm-stat-l">Peak</div>
          <div className="pm-stat-v" data-mono="" style={{ color: "var(--brand)" }}>{liveMetrics.peakRate}</div>
        </div>
        <div className="pm-stat">
          <div className="pm-stat-l">Average</div>
          <div className="pm-stat-v" data-mono="">{liveMetrics.avgRate}</div>
        </div>
        <div className="pm-stat">
          <div className="pm-stat-l">Cost Rate</div>
          <div className="pm-stat-v" data-mono="" style={{ color: "var(--amber)" }}>{liveMetrics.costPerMin}</div>
        </div>
      </div>

      {/* ── Counts + percentage metrics ── */}
      <div className="pm-stat-row">
        <div className="pm-stat">
          <div className="pm-stat-l">Agents</div>
          <div className="pm-stat-v" data-mono="">{liveMetrics.activeAgents}</div>
        </div>
        <div className="pm-stat">
          <div className="pm-stat-l">Tool Calls</div>
          <div className="pm-stat-v" data-mono="">{liveMetrics.toolCalls.toLocaleString()}</div>
        </div>
        <div className="pm-stat">
          <div className="pm-stat-l">Total Tokens</div>
          <div className="pm-stat-v" data-mono="">{liveMetrics.totalTokens.toLocaleString()}</div>
        </div>
        <div className="pm-stat">
          <div className="pm-stat-l">Session Cost</div>
          <div className="pm-stat-v" data-mono="" style={{ color: "var(--amber)" }}>{liveMetrics.sessionCost}</div>
        </div>
      </div>

      {/* ── Context window (percentage unit) ── */}
      <div className="pm-context-bar">
        <div className="pm-stat-l">Context Window</div>
        <div className="pm-context-track">
          <div
            className={`pm-context-fill ${urgencyClass}`}
            style={{ width: `${Math.min(liveMetrics.contextPct, 100)}%` }}
          />
        </div>
        <div className="pm-stat-v" data-mono="">
          {liveMetrics.contextPct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
};
