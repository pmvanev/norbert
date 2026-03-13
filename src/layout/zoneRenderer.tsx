/**
 * Zone Renderer — React component that mounts views into layout zones.
 *
 * Takes a LayoutState and a view registry (map of viewId -> React component),
 * renders Main zone (always) and optional Secondary zone with divider.
 *
 * Pure rendering: all state management is external (lifted to parent).
 */

import { type FC, useRef, useCallback } from "react";
import type { LayoutState, ZoneState } from "./types";
import { getZone } from "./zoneRegistry";
import { isSecondaryVisible } from "./zoneToggle";
import { clampDividerPosition, snapToCenter } from "./dividerManager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A view registry maps viewId strings to React components.
 * This is the "plugin registry" port — adapters provide the actual mapping.
 */
export type ViewRegistry = ReadonlyMap<string, FC>;

export type ZoneRendererProps = {
  readonly layout: LayoutState;
  readonly viewRegistry: ViewRegistry;
  readonly containerWidth: number;
  readonly minZoneWidth: number;
  readonly onDividerPositionChange: (ratio: number) => void;
  readonly guidanceMessage?: string;
};

// ---------------------------------------------------------------------------
// Empty Zone Content — shown when no view is assigned
// ---------------------------------------------------------------------------

const EmptyZoneContent: FC<{ message: string }> = ({ message }) => (
  <div className="zone-empty" data-testid="zone-empty">
    <p>{message}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Zone Content — resolves viewId to component
// ---------------------------------------------------------------------------

const ZoneContent: FC<{
  zone: ZoneState | undefined;
  viewRegistry: ViewRegistry;
  guidanceMessage: string;
}> = ({ zone, viewRegistry, guidanceMessage }) => {
  if (!zone || zone.viewId === null) {
    return <EmptyZoneContent message={guidanceMessage} />;
  }

  const ViewComponent = viewRegistry.get(zone.viewId);
  if (!ViewComponent) {
    return <EmptyZoneContent message={`View "${zone.viewId}" not found`} />;
  }

  return <ViewComponent />;
};

// ---------------------------------------------------------------------------
// Divider Handle — draggable separator between zones
// ---------------------------------------------------------------------------

const DividerHandle: FC<{
  onDrag: (ratio: number) => void;
  onDoubleClick: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}> = ({ onDrag, onDoubleClick, containerRef }) => {
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        const ratio = (moveEvent.clientX - rect.left) / rect.width;
        onDrag(ratio);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onDrag, containerRef]
  );

  return (
    <div
      className="zone-divider"
      data-testid="zone-divider"
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      role="separator"
      aria-orientation="vertical"
    />
  );
};

// ---------------------------------------------------------------------------
// ZoneRenderer — main layout component
// ---------------------------------------------------------------------------

export const ZoneRenderer: FC<ZoneRendererProps> = ({
  layout,
  viewRegistry,
  containerWidth,
  minZoneWidth,
  onDividerPositionChange,
  guidanceMessage = "Click a sidebar icon or use the view picker to get started",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const secondaryVisible = isSecondaryVisible(layout);

  const handleDividerDrag = useCallback(
    (rawRatio: number) => {
      const clamped = clampDividerPosition(rawRatio, containerWidth, minZoneWidth);
      onDividerPositionChange(clamped);
    },
    [containerWidth, minZoneWidth, onDividerPositionChange]
  );

  const handleDividerDoubleClick = useCallback(() => {
    onDividerPositionChange(snapToCenter());
  }, [onDividerPositionChange]);

  const mainZone = getZone(layout.zones, "main");

  if (!secondaryVisible) {
    // Single zone: Main fills full width
    return (
      <div className="zone-container" data-testid="zone-container" ref={containerRef}>
        <div className="zone zone-main" data-testid="zone-main" style={{ width: "100%" }}>
          <ZoneContent
            zone={mainZone}
            viewRegistry={viewRegistry}
            guidanceMessage={guidanceMessage}
          />
        </div>
      </div>
    );
  }

  // Two zones with divider
  const secondaryZone = getZone(layout.zones, "secondary");

  return (
    <div
      className="zone-container"
      data-testid="zone-container"
      ref={containerRef}
    >
      <div
        className="zone zone-main"
        data-testid="zone-main"
        style={{ flex: `0 0 ${layout.dividerPosition * 100}%` }}
      >
        <ZoneContent
          zone={mainZone}
          viewRegistry={viewRegistry}
          guidanceMessage={guidanceMessage}
        />
      </div>
      <DividerHandle
        onDrag={handleDividerDrag}
        onDoubleClick={handleDividerDoubleClick}
        containerRef={containerRef}
      />
      <div
        className="zone zone-secondary"
        data-testid="zone-secondary"
        style={{ flex: 1 }}
      >
        <ZoneContent
          zone={secondaryZone}
          viewRegistry={viewRegistry}
          guidanceMessage="Select a view for this zone"
        />
      </div>
    </div>
  );
};
