/// GaugeClusterView: stateless React component rendering GaugeClusterData.
///
/// Pure renderer -- receives pre-computed data, no business logic.
/// All urgency classification and value computation happens in the
/// domain layer (gaugeCluster.ts).

import type { GaugeClusterData } from "../domain/gaugeCluster";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GaugeClusterViewProps {
  readonly data: GaugeClusterData;
}

// ---------------------------------------------------------------------------
// Urgency-to-CSS class mapping
// ---------------------------------------------------------------------------

const URGENCY_CLASS_MAP: Record<string, string> = {
  red: "gauge-urgency-red",
  amber: "gauge-urgency-amber",
};

const urgencyClass = (urgency: string): string =>
  URGENCY_CLASS_MAP[urgency] ?? "gauge-urgency-normal";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GaugeClusterView = ({ data }: GaugeClusterViewProps) => (
  <div className="gauge-cluster" role="region" aria-label="Gauge Cluster">
    <div className="sec-hdr">
      <span className="sec-t">// gauge cluster</span>
    </div>
    <div className="gauge-cluster-grid">
      <div className={`gauge-card tachometer ${urgencyClass(data.tachometer.urgency)}`}>
        <span className="gauge-label">Burn Rate</span>
        <span className="gauge-value" data-mono="">{data.tachometer.value}</span>
        <span className="gauge-unit">{data.tachometer.unit}</span>
      </div>

      <div className={`gauge-card fuel-gauge ${urgencyClass(data.fuelGauge.urgency)}`}>
        <span className="gauge-label">Context</span>
        <span className="gauge-value" data-mono="">{data.fuelGauge.value}</span>
        <span className="gauge-unit">{data.fuelGauge.unit}</span>
      </div>

      <div className="gauge-card odometer">
        <span className="gauge-label">Session Cost</span>
        <span className="gauge-value" data-mono="">{data.odometer.formatted}</span>
      </div>

      <div className="gauge-card rpm-counter">
        <span className="gauge-label">Active Agents</span>
        <span className="gauge-value" data-mono="">{data.rpmCounter.value}</span>
        <span className="gauge-unit">{data.rpmCounter.label}</span>
      </div>

      <div className={`gauge-card warning-cluster ${urgencyClass(data.warningCluster.hookHealth)}`}>
        <span className="gauge-label">Hook Health</span>
        <span className="gauge-value" data-mono="">{data.warningCluster.hookHealth}</span>
      </div>
    </div>
  </div>
);
