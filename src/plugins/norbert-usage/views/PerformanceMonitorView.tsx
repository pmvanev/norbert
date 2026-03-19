/**
 * PerformanceMonitorView: real-time multi-session performance dashboard.
 *
 * Layout grouped by unit type:
 *   - Rate chart (tokens/s + cost/s): dual-trace canvas waveform at ~10Hz
 *   - Rate metrics: current, peak, average (all tok/s unit)
 *   - Count metrics: active agents total, tool calls, total tokens
 *   - Percentage: context window % bar gauge
 *   - Per-session breakdown: tokens/s, agents, context % per session
 *
 * Subscribes to both MetricsStore (for time series waveform) and
 * MultiSessionStore (for cross-session aggregation).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { MetricsStore } from "../adapters/metricsStore";
import type { MultiSessionStore } from "../adapters/multiSessionStore";
import type { TimeSeriesBuffer, TimeWindowId } from "../domain/types";
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
import { aggregateAcrossSessions } from "../domain/crossSessionAggregator";
import { PMTimeWindowSelector } from "./PMTimeWindowSelector";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 100;
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
  readonly multiSessionStore: MultiSessionStore;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEFAULT_TIME_WINDOW: TimeWindowId = "1m";

const truncateId = (id: string, max: number = 16): string =>
  id.length > max ? `${id.slice(0, max - 1)}\u2026` : id;

export const PerformanceMonitorView = ({ store, multiSessionStore }: PerformanceMonitorViewProps) => {
  const [selectedWindow, setSelectedWindow] = useState<TimeWindowId>(DEFAULT_TIME_WINDOW);

  const bufferRef = useRef<TimeSeriesBuffer>(store.getTimeSeries());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({
    width: 600, height: 150, padding: 10,
  });

  const [liveMetrics, setLiveMetrics] = useState({
    tokenRate: "0 tok/s",
    costPerMin: "$0.00/min",
    peakRate: "0 tok/s",
    avgRate: "0 tok/s",
    totalActiveAgents: 0,
    sessionCost: "$0.00",
    totalTokens: 0,
    toolCalls: 0,
  });

  // Per-session breakdown
  const [sessionRows, setSessionRows] = useState<ReadonlyArray<{
    id: string;
    tokenRate: string;
    agents: number;
    contextPct: number;
    contextUrgency: string;
  }>>([]);

  // Aggregate context (max across sessions)
  const [contextBar, setContextBar] = useState({ pct: 0, urgency: "normal" as "normal" | "amber" | "red" });

  // Subscribe to store for time series
  useEffect(() => {
    return store.subscribe((_m, ts) => { bufferRef.current = ts; });
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

  // Render frame (10Hz)
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Heartbeat
    const now = Date.now();
    const currentSamples = getSamples(bufferRef.current);
    const lastTime = currentSamples.length > 0
      ? currentSamples[currentSamples.length - 1].timestamp : 0;
    if (now - lastTime >= REFRESH_INTERVAL_MS) {
      bufferRef.current = appendSample(bufferRef.current, { timestamp: now, tokenRate: 0, costRate: 0 });
    }

    const buffer = bufferRef.current;
    const samples = getSamples(buffer);
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

    // Rate overlay
    const currentRate = samples.length > 0 ? samples[samples.length - 1].tokenRate : 0;
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = getThemeColor("--text-p", "#c8f0e8");
    ctx.fillText(formatRateOverlay(currentRate), canvasDimensions.padding + 4, canvasDimensions.padding + 14);

    // Aggregate from multi-session store
    const allSessions = multiSessionStore.getSessions();
    const aggregate = aggregateAcrossSessions(allSessions);

    const currentCostRate = samples.length > 0 ? samples[samples.length - 1].costRate : 0;
    const totalAgents = aggregate.sessionCount > 0 ? aggregate.totalActiveAgents : 0;
    const totalTokens = allSessions.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalToolCalls = allSessions.reduce((sum, s) => sum + s.toolCallCount, 0);
    const totalCost = allSessions.reduce((sum, s) => sum + s.sessionCost, 0);

    setLiveMetrics({
      tokenRate: formatRateOverlay(aggregate.sessionCount > 0 ? aggregate.totalTokenRate : currentRate),
      costPerMin: `$${computeCostRatePerMinute(currentCostRate).toFixed(4)}/min`,
      peakRate: formatRateOverlay(stats.peakRate),
      avgRate: formatRateOverlay(stats.avgRate),
      totalActiveAgents: totalAgents,
      sessionCost: `$${totalCost.toFixed(4)}`,
      totalTokens,
      toolCalls: totalToolCalls,
    });

    // Per-session breakdown
    const rows = allSessions.map((s) => ({
      id: s.sessionId,
      tokenRate: formatRateOverlay(s.burnRate),
      agents: s.activeAgentCount,
      contextPct: s.contextWindowPct,
      contextUrgency: classifyContextUrgency(s.contextWindowPct),
    }));
    setSessionRows(rows);

    // Context bar: show max context pressure across sessions
    const maxContextPct = allSessions.length > 0
      ? Math.max(...allSessions.map((s) => s.contextWindowPct))
      : 0;
    setContextBar({ pct: maxContextPct, urgency: classifyContextUrgency(maxContextPct) });
  }, [canvasDimensions, multiSessionStore]);

  // Animation loop
  useEffect(() => {
    renderFrame();
    intervalRef.current = setInterval(renderFrame, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [renderFrame]);

  const urgencyClass = contextBar.urgency === "red"
    ? "pm-urgency-red"
    : contextBar.urgency === "amber"
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

      {/* ── Rates (tok/s unit) ── */}
      <div className="pm-stat-row">
        <div className="pm-stat">
          <div className="pm-stat-l">Tokens/s Total</div>
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

      {/* ── Counts ── */}
      <div className="pm-stat-row">
        <div className="pm-stat">
          <div className="pm-stat-l">Active Agents</div>
          <div className="pm-stat-v" data-mono="">{liveMetrics.totalActiveAgents}</div>
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

      {/* ── Context window % (max across sessions) ── */}
      <div className="pm-context-bar">
        <div className="pm-stat-l">Context Window</div>
        <div className="pm-context-track">
          <div
            className={`pm-context-fill ${urgencyClass}`}
            style={{ width: `${Math.min(contextBar.pct, 100)}%` }}
          />
        </div>
        <div className="pm-stat-v" data-mono="">
          {contextBar.pct.toFixed(0)}%
        </div>
      </div>

      {/* ── Per-session breakdown ── */}
      {sessionRows.length > 0 && (
        <div className="pm-sessions">
          <div className="pm-sessions-hdr">
            <span>Session</span>
            <span>Tokens/s</span>
            <span>Agents</span>
            <span>Context %</span>
          </div>
          {sessionRows.map((row) => (
            <div key={row.id} className="pm-session-row">
              <span className="pm-session-id" data-mono="">{truncateId(row.id)}</span>
              <span data-mono="">{row.tokenRate}</span>
              <span data-mono="">{row.agents}</span>
              <span data-mono="" className={
                row.contextUrgency === "red" ? "pm-urgency-red" :
                row.contextUrgency === "amber" ? "pm-urgency-amber" : ""
              }>{row.contextPct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
