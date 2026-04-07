/**
 * PMSidebar: category list with sparklines for the Performance Monitor v2.
 *
 * Renders 4 metric category rows from METRIC_CATEGORIES. Each row shows:
 *   - Category label (uppercase)
 *   - Current value formatted from latest aggregate sample
 *   - Sparkline canvas rendering last 60s line via prepareSparklinePoints
 *
 * The selected category has a left border in the category color.
 * Clicking a row emits onCategorySelect with the category ID.
 *
 * Pure data flows through METRIC_CATEGORIES and MultiSessionStore.
 * Canvas drawing is the only side effect (at the view boundary).
 */

import { useRef, useEffect, useCallback } from "react";
import type { MultiSessionStore } from "../adapters/multiSessionStore";
import type { MetricCategoryId } from "../domain/types";
import {
  METRIC_CATEGORIES,
  type MetricCategory,
} from "../domain/categoryConfig";
import { prepareSparklinePoints, type FilledAreaPoint } from "../domain/chartRenderer";
import type { CanvasDimensions } from "../domain/oscilloscope";
import { resolveThemeColor } from "./PMChart";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPARKLINE_WIDTH = 80;
const SPARKLINE_HEIGHT = 20;

const SPARKLINE_DIMENSIONS: CanvasDimensions = {
  width: SPARKLINE_WIDTH,
  height: SPARKLINE_HEIGHT,
  padding: 2,
};

// ---------------------------------------------------------------------------
// Pure sparkline canvas drawing
// ---------------------------------------------------------------------------

const clampY = (y: number): number => {
  const top = SPARKLINE_DIMENSIONS.padding;
  const bottom = SPARKLINE_HEIGHT - SPARKLINE_DIMENSIONS.padding;
  if (y < top) return top;
  if (y > bottom) return bottom;
  return y;
};

const drawSparkline = (
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<FilledAreaPoint>,
  color: string,
): void => {
  ctx.clearRect(0, 0, SPARKLINE_WIDTH, SPARKLINE_HEIGHT);

  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, clampY(points[0].y));

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, clampY(points[i].y));
  }

  ctx.stroke();
};

// ---------------------------------------------------------------------------
// extractLatestValue -- get current value from aggregate buffer
// ---------------------------------------------------------------------------

const extractLatestValue = (
  multiSessionStore: MultiSessionStore,
  categoryId: MetricCategoryId,
): number => {
  const buffer = multiSessionStore.getAggregateBuffer(categoryId);
  if (buffer.samples.length === 0) return 0;
  const latestSample = buffer.samples[buffer.samples.length - 1];
  return latestSample.tokenRate;
};

// ---------------------------------------------------------------------------
// SparklineCanvas -- individual sparkline for one category row
// ---------------------------------------------------------------------------

interface SparklineCanvasProps {
  readonly multiSessionStore: MultiSessionStore;
  readonly category: MetricCategory;
}

const SparklineCanvas = ({
  multiSessionStore,
  category,
}: SparklineCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderSparkline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(SPARKLINE_WIDTH * dpr);
    const targetH = Math.round(SPARKLINE_HEIGHT * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const buffer = multiSessionStore.getAggregateBuffer(category.id);
    const samples = buffer.samples.map((sample) => ({
      timestamp: sample.timestamp,
      value: sample.tokenRate,
    }));

    const points = prepareSparklinePoints(
      samples,
      SPARKLINE_DIMENSIONS,
      category.yMax,
      buffer.capacity,
    );

    drawSparkline(ctx, points, resolveThemeColor(category.cssVar, category.color));
  }, [multiSessionStore, category]);

  useEffect(() => {
    renderSparkline();
  }, [renderSparkline]);

  // Re-render sparkline when the theme class on <html> changes so the line
  // color picks up the new palette immediately (canvas pixels don't react to
  // CSS variable changes on their own).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => renderSparkline());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [renderSparkline]);

  return (
    <canvas
      ref={canvasRef}
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      style={{ width: `${SPARKLINE_WIDTH}px`, height: `${SPARKLINE_HEIGHT}px` }}
      className="pm-sidebar-sparkline"
      aria-hidden="true"
    />
  );
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMSidebarProps {
  readonly multiSessionStore: MultiSessionStore;
  readonly selectedCategory: MetricCategoryId;
  readonly onCategorySelect: (categoryId: MetricCategoryId) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMSidebar = ({
  multiSessionStore,
  selectedCategory,
  onCategorySelect,
}: PMSidebarProps) => (
  <div className="pm-sidebar" role="listbox" aria-label="Metric categories">
    {METRIC_CATEGORIES.map((category) => {
      const isSelected = category.id === selectedCategory;
      const currentValue = extractLatestValue(multiSessionStore, category.id);
      const formattedValue = category.formatValue(currentValue);

      return (
        <button
          key={category.id}
          className={`pm-sidebar-row${isSelected ? " pm-sidebar-row-selected" : ""}`}
          style={isSelected ? { borderLeftColor: resolveThemeColor(category.cssVar, category.color) } : undefined}
          onClick={() => onCategorySelect(category.id)}
          role="option"
          aria-selected={isSelected}
          data-category={category.id}
        >
          <div className="pm-sidebar-label">{category.label}</div>
          <div className="pm-sidebar-value" data-mono="true">
            {formattedValue}
          </div>
          <SparklineCanvas
            multiSessionStore={multiSessionStore}
            category={category}
          />
        </button>
      );
    })}
  </div>
);
