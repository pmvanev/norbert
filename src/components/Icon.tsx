/// Icon -- renders a lucide-react icon by name string.
///
/// Maps plugin-registered icon name strings to lucide-react components.
/// Falls back to rendering the raw string for unrecognized names.
/// This lets the plugin API stay string-based while rendering real icons.

import { type FC } from "react";
import {
  Bell,
  BellOff,
  Settings,
  Activity,
  Gauge,
  BarChart3,
  Zap,
  CircleDollarSign,
  ListTree,
  Bot,
  Anchor,
  Server,
  Sparkles,
  List,
  Package,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Circle,
  Mail,
  Webhook,
  Monitor,
  Layout,
  Hexagon,
  ArrowLeft,
  SquareActivity,
  type LucideProps,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Icon registry -- maps string names to lucide components
// ---------------------------------------------------------------------------

const ICON_REGISTRY: Readonly<Record<string, FC<LucideProps>>> = {
  // Sidebar / plugin icons
  "bell": Bell,
  "bell-off": BellOff,
  "settings": Settings,
  "activity": Activity,
  "gauge": Gauge,
  "bar-chart": BarChart3,
  "zap": Zap,
  "dollar": CircleDollarSign,
  "list-tree": ListTree,
  "hexagon": Hexagon,
  "square-activity": SquareActivity,

  // Config viewer sub-tab icons
  "bot": Bot,
  "anchor": Anchor,
  "server": Server,
  "sparkles": Sparkles,
  "list": List,
  "package": Package,
  "file-text": FileText,

  // Action icons
  "refresh": RefreshCw,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "arrow-left": ArrowLeft,

  // Notification channel icons
  "monitor": Monitor,
  "layout": Layout,
  "circle": Circle,
  "mail": Mail,
  "webhook": Webhook,

  // Alert icons
  "alert-triangle": AlertTriangle,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IconProps {
  readonly name: string;
  readonly size?: number;
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/// Renders a lucide-react icon by name. Falls back to raw string if unrecognized.
export const Icon: FC<IconProps> = ({ name, size = 14, className }) => {
  const LucideIcon = ICON_REGISTRY[name];

  if (LucideIcon) {
    return <LucideIcon size={size} className={className} strokeWidth={1.5} />;
  }

  // Fallback: render the raw string (for any remaining Unicode chars)
  return <span className={className}>{name}</span>;
};
