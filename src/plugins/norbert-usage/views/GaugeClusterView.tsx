/// GaugeClusterView: stateless React component rendering GaugeClusterData.
///
/// Pure renderer -- receives pre-computed data, no business logic.
/// All urgency classification and value computation happens in the
/// domain layer (gaugeCluster.ts).
///
/// Displays SVG arc gauges for tachometer and fuel gauge,
/// styled counters for odometer and RPM, and a status indicator for hook health.

import type { GaugeClusterData, TachometerData, FuelGaugeData } from "../domain/gaugeCluster";
import type { Urgency } from "../domain/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GaugeClusterViewProps {
  readonly data: GaugeClusterData;
}

// ---------------------------------------------------------------------------
// Urgency-to-CSS class mapping
// ---------------------------------------------------------------------------

const URGENCY_CLASS_MAP: Partial<Record<Urgency, string>> = {
  red: "gauge-urgency-red",
  amber: "gauge-urgency-amber",
};

const urgencyClass = (urgency: Urgency): string =>
  URGENCY_CLASS_MAP[urgency] ?? "gauge-urgency-normal";

// ---------------------------------------------------------------------------
// Urgency → stroke color for arc gauges
// ---------------------------------------------------------------------------

const urgencyColor = (urgency: Urgency): string => {
  if (urgency === "red") return "var(--error)";
  if (urgency === "amber") return "var(--amber)";
  return "var(--brand)";
};

// ---------------------------------------------------------------------------
// SVG Arc Gauge — 270° sweep, speedometer-style
// ---------------------------------------------------------------------------

const ARC_SIZE = 76;
const ARC_STROKE = 5;
const ARC_RADIUS = (ARC_SIZE - ARC_STROKE) / 2;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;
const ARC_FRACTION = 0.75; // 270° of 360°
const ARC_LENGTH = ARC_CIRCUMFERENCE * ARC_FRACTION;
const ARC_GAP = ARC_CIRCUMFERENCE - ARC_LENGTH;

interface GaugeArcProps {
  readonly pct: number; // 0..1
  readonly color: string;
}

const GaugeArc = ({ pct, color }: GaugeArcProps) => {
  const filled = ARC_LENGTH * Math.min(1, Math.max(0, pct));

  return (
    <svg
      className="gauge-arc-svg"
      width={ARC_SIZE}
      height={ARC_SIZE}
      viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}
    >
      {/* Background track */}
      <circle
        cx={ARC_SIZE / 2}
        cy={ARC_SIZE / 2}
        r={ARC_RADIUS}
        fill="none"
        stroke="var(--border-card)"
        strokeWidth={ARC_STROKE}
        strokeDasharray={`${ARC_LENGTH} ${ARC_GAP}`}
        strokeLinecap="round"
      />
      {/* Active fill */}
      <circle
        cx={ARC_SIZE / 2}
        cy={ARC_SIZE / 2}
        r={ARC_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={ARC_STROKE}
        strokeDasharray={`${filled} ${ARC_CIRCUMFERENCE - filled}`}
        strokeLinecap="round"
        className="gauge-arc-fill"
      />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Tachometer gauge (burn rate, 0..600 tok/s)
// ---------------------------------------------------------------------------

const TACHO_MAX = 600;

const TachometerGauge = ({ data }: { readonly data: TachometerData }) => {
  const pct = data.value / TACHO_MAX;
  const color = urgencyColor(data.urgency);

  return (
    <div className={`gauge-card gauge-card-arc tachometer ${urgencyClass(data.urgency)}`}>
      <div className="gauge-arc-wrap">
        <GaugeArc pct={pct} color={color} />
        <div className="gauge-arc-inner">
          <span className="gauge-value" data-mono="">{Math.round(data.value)}</span>
          <span className="gauge-unit">{data.unit}</span>
        </div>
      </div>
      <span className="gauge-label">Burn Rate</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Fuel gauge (context window, 0..100%)
// ---------------------------------------------------------------------------

const FuelGaugeComponent = ({ data }: { readonly data: FuelGaugeData }) => {
  const pct = data.value / 100;
  const color = urgencyColor(data.urgency);

  return (
    <div className={`gauge-card gauge-card-arc fuel-gauge ${urgencyClass(data.urgency)}`}>
      <div className="gauge-arc-wrap">
        <GaugeArc pct={pct} color={color} />
        <div className="gauge-arc-inner">
          <span className="gauge-value" data-mono="">{Math.round(data.value)}</span>
          <span className="gauge-unit">{data.unit}</span>
        </div>
      </div>
      <span className="gauge-label">Context</span>
      {data.tokenLabel !== "" && (
        <span className="gauge-sublabel">{data.tokenLabel}</span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GaugeClusterView = ({ data }: GaugeClusterViewProps) => (
  <div className="gauge-cluster" role="region" aria-label="Gauge Cluster">
    <div className="sec-hdr">
      <span className="sec-t">Gauge Cluster</span>
    </div>
    <div className="gauge-cluster-grid">
      <TachometerGauge data={data.tachometer} />
      <FuelGaugeComponent data={data.fuelGauge} />

      <div className="gauge-card odometer">
        <span className="gauge-value gauge-value-lg" data-mono="">{data.odometer.formatted}</span>
        <span className="gauge-label">Session Cost</span>
      </div>

      <div className="gauge-card rpm-counter">
        <div className="gauge-rpm-dots">
          {Array.from({ length: Math.min(data.rpmCounter.value, 5) }, (_, i) => (
            <span key={i} className="gauge-rpm-dot live" />
          ))}
          {data.rpmCounter.value === 0 && <span className="gauge-rpm-dot done" />}
        </div>
        <span className="gauge-value" data-mono="">{data.rpmCounter.value}</span>
        <span className="gauge-label">Active Agents</span>
      </div>

      <div className={`gauge-card warning-cluster ${data.warningCluster.dataHealth === "healthy" ? "gauge-urgency-normal" : data.warningCluster.dataHealth === "degraded" ? "gauge-urgency-amber" : "gauge-urgency-normal"}`}>
        <span className={`gauge-health-dot ${data.warningCluster.dataHealth === "healthy" ? "live" : data.warningCluster.dataHealth === "degraded" ? "warn" : "idle"}`} />
        <span className="gauge-value gauge-value-sm" data-mono="">{data.warningCluster.dataHealth}</span>
        <span className="gauge-label">Data Health</span>
      </div>
    </div>
  </div>
);
