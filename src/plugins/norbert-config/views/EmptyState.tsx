/// EmptyState -- reusable empty state component for config tabs.
///
/// Displays a category name and guidance text when no items exist
/// for a given configuration category.

import type { FC } from "react";

export interface EmptyStateProps {
  readonly category: string;
  readonly guidance: string;
}

export const EmptyState: FC<EmptyStateProps> = ({ category, guidance }) => (
  <div className="config-empty-state" role="status">
    <span className="config-empty-icon">{"\u25CB"}</span>
    <span className="config-empty-category">No {category} configured</span>
    <span className="config-empty-guidance">{guidance}</span>
  </div>
);
