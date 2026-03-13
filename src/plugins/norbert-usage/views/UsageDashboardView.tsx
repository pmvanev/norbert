/// UsageDashboardView: stateless React component rendering DashboardData
/// with 6 metric cards and a 7-day burn chart.
///
/// Pure renderer -- receives pre-computed DashboardData and DailyCostEntry[],
/// no business logic. All computation happens in the domain layer (dashboard.ts).

import type { DashboardData, DailyCostEntry } from "../domain/dashboard";
import type { MetricCardData } from "../domain/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UsageDashboardViewProps {
  readonly dashboard: DashboardData;
  readonly dailyCosts: ReadonlyArray<DailyCostEntry>;
}

// ---------------------------------------------------------------------------
// Urgency-to-CSS class mapping
// ---------------------------------------------------------------------------

const URGENCY_CLASS_MAP: Record<string, string> = {
  red: "metric-card-urgency-red",
  amber: "metric-card-urgency-amber",
};

const urgencyClass = (urgency: string): string =>
  URGENCY_CLASS_MAP[urgency] ?? "metric-card-urgency-normal";

// ---------------------------------------------------------------------------
// Metric card renderer
// ---------------------------------------------------------------------------

const MetricCard = ({ card }: { readonly card: MetricCardData }) => (
  <div className={`metric-card ${urgencyClass(card.urgency)}`}>
    <span className="metric-card-label">{card.label}</span>
    <span className="metric-card-value">{card.value}</span>
    {card.subtitle !== "" && (
      <span className="metric-card-subtitle">{card.subtitle}</span>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Burn chart: proportional bar heights
// ---------------------------------------------------------------------------

const computeBarPercent = (cost: number, maxCost: number): number =>
  maxCost > 0 ? Math.round((cost / maxCost) * 100) : 0;

const BurnChart = ({
  dailyCosts,
}: {
  readonly dailyCosts: ReadonlyArray<DailyCostEntry>;
}) => {
  const maxCost = dailyCosts.length > 0
    ? Math.max(...dailyCosts.map((entry) => entry.totalCost))
    : 0;

  return (
    <div
      className="burn-chart"
      role="img"
      aria-label="7-day burn chart"
    >
      {dailyCosts.map((entry) => {
        const percent = computeBarPercent(entry.totalCost, maxCost);
        return (
          <div
            key={entry.date}
            className="burn-chart-bar"
            role="meter"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${entry.date}: $${entry.totalCost.toFixed(2)}`}
            style={{ height: `${percent}%` }}
          >
            <span className="burn-chart-bar-label">{entry.date.slice(-2)}</span>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Onboarding message
// ---------------------------------------------------------------------------

const OnboardingMessage = () => (
  <div className="usage-dashboard-onboarding" role="status">
    <p>Start a coding session with Claude Code to see your usage metrics here.</p>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const UsageDashboardView = ({
  dashboard,
  dailyCosts,
}: UsageDashboardViewProps) => (
  <div className="usage-dashboard" role="region" aria-label="Usage Dashboard">
    {dashboard.isOnboarding && dailyCosts.length === 0 && <OnboardingMessage />}

    <div className="usage-dashboard-cards">
      <MetricCard card={dashboard.runningCost} />
      <MetricCard card={dashboard.tokenCount} />
      <MetricCard card={dashboard.activeAgents} />
      <MetricCard card={dashboard.toolCalls} />
      <MetricCard card={dashboard.contextWindow} />
      <MetricCard card={dashboard.hookHealth} />
    </div>

    <BurnChart dailyCosts={dailyCosts} />
  </div>
);
