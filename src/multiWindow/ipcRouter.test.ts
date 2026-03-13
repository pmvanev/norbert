/// IPC router unit tests.
///
/// Tests the subscription, broadcast, and unsubscribe behavior of the
/// IPC event router. Property-based tests verify broadcast invariants.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createIpcRouter,
  type HookEvent,
} from "./ipcRouter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEvent = (hookName: string): HookEvent => ({
  hookName,
  payload: { data: hookName },
  timestamp: Date.now(),
});

// ---------------------------------------------------------------------------
// subscribeWindow / broadcastEvent
// ---------------------------------------------------------------------------

describe("createIpcRouter", () => {
  it("delivers events to all subscribed windows", () => {
    const router = createIpcRouter();
    const received1: HookEvent[] = [];
    const received2: HookEvent[] = [];

    router.subscribeWindow("w1", (e) => received1.push(e));
    router.subscribeWindow("w2", (e) => received2.push(e));

    const event = makeEvent("session_start");
    router.broadcastEvent(event);

    expect(received1).toEqual([event]);
    expect(received2).toEqual([event]);
  });

  it("does not deliver events after unsubscribe", () => {
    const router = createIpcRouter();
    const received: HookEvent[] = [];

    const unsubscribe = router.subscribeWindow("w1", (e) =>
      received.push(e)
    );
    router.broadcastEvent(makeEvent("before"));
    unsubscribe();
    router.broadcastEvent(makeEvent("after"));

    expect(received).toHaveLength(1);
    expect(received[0].hookName).toBe("before");
  });

  it("only unsubscribes the targeted window", () => {
    const router = createIpcRouter();
    const received1: HookEvent[] = [];
    const received2: HookEvent[] = [];

    const unsub1 = router.subscribeWindow("w1", (e) => received1.push(e));
    router.subscribeWindow("w2", (e) => received2.push(e));

    unsub1();
    router.broadcastEvent(makeEvent("after-unsub"));

    expect(received1).toHaveLength(0);
    expect(received2).toHaveLength(1);
  });

  it("returns the current subscriber count", () => {
    const router = createIpcRouter();
    expect(router.subscriberCount()).toBe(0);

    const unsub = router.subscribeWindow("w1", () => {});
    expect(router.subscriberCount()).toBe(1);

    router.subscribeWindow("w2", () => {});
    expect(router.subscriberCount()).toBe(2);

    unsub();
    expect(router.subscriberCount()).toBe(1);
  });

  it("handles double-unsubscribe gracefully", () => {
    const router = createIpcRouter();
    const unsub = router.subscribeWindow("w1", () => {});
    unsub();
    unsub(); // should not throw
    expect(router.subscriberCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Property: broadcast delivers to exactly all subscribers
// ---------------------------------------------------------------------------

describe("IPC router properties", () => {
  it("broadcast delivers event to every subscriber exactly once", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 1,
          maxLength: 8,
        }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (windowLabels, hookName) => {
          const uniqueLabels = [...new Set(windowLabels)];
          const router = createIpcRouter();
          const counts = new Map<string, number>();

          uniqueLabels.forEach((label) => {
            counts.set(label, 0);
            router.subscribeWindow(label, () => {
              counts.set(label, (counts.get(label) ?? 0) + 1);
            });
          });

          router.broadcastEvent(makeEvent(hookName));

          // Every subscriber received exactly one event
          for (const [, count] of counts) {
            if (count !== 1) return false;
          }
          return true;
        }
      )
    );
  });

  it("unsubscribed windows never receive subsequent events", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 4 }),
        (totalWindows, unsubIndex) => {
          const idx = Math.min(unsubIndex, totalWindows - 1);
          const router = createIpcRouter();
          const receivedAfterUnsub = new Map<string, number>();
          const unsubs: Array<() => void> = [];

          for (let i = 0; i < totalWindows; i++) {
            const label = `w-${i}`;
            receivedAfterUnsub.set(label, 0);
            unsubs.push(
              router.subscribeWindow(label, () => {
                receivedAfterUnsub.set(
                  label,
                  (receivedAfterUnsub.get(label) ?? 0) + 1
                );
              })
            );
          }

          // Unsubscribe one window
          unsubs[idx]();

          // Broadcast
          router.broadcastEvent(makeEvent("test"));

          // Unsubscribed window received 0 events
          return receivedAfterUnsub.get(`w-${idx}`) === 0;
        }
      )
    );
  });
});
