/**
 * PMTimeWindowSelector: controlled button group for time window selection.
 *
 * Renders buttons for 1m, 5m, 15m, and Session time windows.
 * Controlled component -- selectedWindow and onChange come from parent.
 * No internal state, no IO imports, pure presentation.
 */

import type { TimeWindowId } from "../domain/types";

// ---------------------------------------------------------------------------
// Window option descriptors
// ---------------------------------------------------------------------------

interface WindowOption {
  readonly id: TimeWindowId;
  readonly label: string;
}

const WINDOW_OPTIONS: ReadonlyArray<WindowOption> = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "session", label: "Session" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMTimeWindowSelectorProps {
  readonly selectedWindow: TimeWindowId;
  readonly onChange: (windowId: TimeWindowId) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMTimeWindowSelector = ({
  selectedWindow,
  onChange,
}: PMTimeWindowSelectorProps) => (
  <div
    className="pm-time-window-selector"
    role="group"
    aria-label="Time window selector"
  >
    {WINDOW_OPTIONS.map((option) => (
      <button
        key={option.id}
        className={`pm-tw-btn${selectedWindow === option.id ? " pm-tw-btn--active" : ""}`}
        aria-pressed={selectedWindow === option.id}
        onClick={() => onChange(option.id)}
      >
        {option.label}
      </button>
    ))}
  </div>
);
