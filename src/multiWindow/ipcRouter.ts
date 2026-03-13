/// IPC Router — manages event subscription and broadcast across windows.
///
/// This module is the effects boundary for multi-window event delivery.
/// Each router instance holds mutable subscriber state; the broadcast
/// function delivers events to all currently subscribed windows.
///
/// Ports:
///   subscribeWindow: (label, handler) -> unsubscribe function
///   broadcastEvent: (event) -> void
///   subscriberCount: () -> number

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A hook event delivered to subscribed windows.
export type HookEvent = {
  readonly hookName: string;
  readonly payload: unknown;
  readonly timestamp: number;
};

/// Handler function called when a window receives a hook event.
export type WindowEventHandler = (event: HookEvent) => void;

/// The IPC router contract.
export type IpcRouter = {
  readonly subscribeWindow: (
    windowLabel: string,
    handler: WindowEventHandler
  ) => () => void;
  readonly broadcastEvent: (event: HookEvent) => void;
  readonly subscriberCount: () => number;
};

// ---------------------------------------------------------------------------
// Subscriber entry (internal)
// ---------------------------------------------------------------------------

type Subscriber = {
  readonly windowLabel: string;
  readonly handler: WindowEventHandler;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/// Creates a new IPC router instance.
///
/// Each router maintains its own subscriber list. Multiple windows subscribe
/// via subscribeWindow and receive events via broadcastEvent.
/// Unsubscribe is returned from subscribeWindow as a cleanup function.
export const createIpcRouter = (): IpcRouter => {
  let subscribers: Subscriber[] = [];

  const subscribeWindow = (
    windowLabel: string,
    handler: WindowEventHandler
  ): (() => void) => {
    const subscriber: Subscriber = { windowLabel, handler };
    subscribers = [...subscribers, subscriber];

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      subscribers = subscribers.filter((s) => s !== subscriber);
    };
  };

  const broadcastEvent = (event: HookEvent): void => {
    subscribers.forEach((s) => s.handler(event));
  };

  const subscriberCount = (): number => subscribers.length;

  return { subscribeWindow, broadcastEvent, subscriberCount };
};
