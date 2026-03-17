/// Session Detail View component for the norbert-session plugin.
///
/// Wraps the existing EventDetailView as a plugin-registered view.
/// This module imports only from the public plugin types interface.
/// The actual React component delegates to the existing implementation
/// which will be fully migrated in step 05-03.

/// Placeholder component identifier for the session detail view.
/// The React component is registered as a view via the plugin API.
/// Rendering is handled by the layout engine based on view registration.
export const SESSION_DETAIL_VIEW_ID = "session-detail" as const;
export const SESSION_DETAIL_VIEW_LABEL = "Session Detail" as const;
export const SESSION_DETAIL_VIEW_ICON = "activity" as const;
