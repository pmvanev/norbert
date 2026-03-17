/// ErrorIndicator -- reusable inline error indicator for config views.
///
/// Displays a file path and error description with amber warning styling.
/// Used when a config file cannot be read or parsed.

import type { FC } from "react";
import { Icon } from "../../../components/Icon";

export interface ErrorIndicatorProps {
  readonly filePath: string;
  readonly error: string;
}

export const ErrorIndicator: FC<ErrorIndicatorProps> = ({ filePath, error }) => (
  <div className="config-error-indicator" role="alert">
    <span className="config-error-icon"><Icon name="alert-triangle" size={14} /></span>
    <div className="config-error-details">
      <span className="config-error-path" data-mono="">{filePath}</span>
      <span className="config-error-message">{error}</span>
    </div>
  </div>
);
