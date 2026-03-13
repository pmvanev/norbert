/// CostTicker: stateless React component rendering CostTickerData.
///
/// Pure renderer -- receives pre-computed data, no business logic.
/// All zone classification and formatting happens in the domain layer
/// (costTicker.ts).

import type { CostTickerData, ColorZone } from "../domain/costTicker";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CostTickerProps {
  readonly data: CostTickerData;
}

// ---------------------------------------------------------------------------
// Zone-to-CSS class mapping
// ---------------------------------------------------------------------------

const ZONE_CLASS_MAP: Record<ColorZone, string> = {
  red: "cost-ticker-red",
  amber: "cost-ticker-amber",
  dim: "cost-ticker-dim",
  brand: "cost-ticker-brand",
};

const zoneClass = (zone: ColorZone): string => ZONE_CLASS_MAP[zone];

// ---------------------------------------------------------------------------
// Digit roll helper: split label into individual characters for animation
// ---------------------------------------------------------------------------

const renderDigits = (label: string): JSX.Element[] =>
  label.split("").map((char, index) => (
    <span key={`${index}-${char}`} className="cost-ticker-digit" data-char={char}>
      {char}
    </span>
  ));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CostTicker = ({ data }: CostTickerProps) => (
  <div
    className={`cost-ticker ${zoneClass(data.colorZone)}`}
    role="status"
    aria-label={`Session cost: ${data.label}`}
  >
    <span className="cost-ticker-value">{renderDigits(data.label)}</span>
  </div>
);
