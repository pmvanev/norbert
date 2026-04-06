/// Scheduling utilities for non-blocking background work.
///
/// The core primitive is yieldToMain() which gives the browser a chance to
/// process pending user input (pointer events, key events) between chunks
/// of our work. This prevents polling and data processing from blocking
/// UI interactions like window drag.

/// Yield control to the browser's event loop so it can process pending
/// user input before we continue. Uses MessageChannel for near-zero-delay
/// yielding to the macro task queue (setTimeout has a ~4ms minimum).
export const yieldToMain = (): Promise<void> =>
  new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(undefined);
  });

/// Creates a recurring poller that yields to the browser between ticks.
///
/// Flow: run tick → wait intervalMs → run next tick.
/// The fn should call yieldToMain() internally between heavy phases.
/// The first tick runs immediately so the UI populates without delay.
export function createIdlePoller(
  fn: () => Promise<void> | void,
  intervalMs: number,
): () => void {
  let stopped = false;

  const scheduleNext = () => {
    if (stopped) return;
    setTimeout(() => {
      if (stopped) return;
      runTick();
    }, intervalMs);
  };

  const runTick = () => {
    if (stopped) return;
    const result = fn();
    if (result && typeof result.then === "function") {
      result.then(scheduleNext, scheduleNext);
    } else {
      scheduleNext();
    }
  };

  // First tick runs immediately so the UI populates without delay.
  runTick();

  return () => { stopped = true; };
}
