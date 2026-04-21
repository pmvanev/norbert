/**
 * @vitest-environment jsdom
 *
 * Acceptance tests: ConfigNavProvider + ReferenceToken + DisambiguationPopover
 * (config-cross-references) -- component-level scenarios.
 *
 * Validates the React adapter that wires the pure reducer to the DOM.
 * Tests render the provider with a fake AggregatedConfig and assert on
 * rendered DOM, ARIA live region, and focus management. No private fields,
 * no internal mock-call counts -- only observable user outcomes.
 *
 * Driving ports (component-level): <ConfigNavProvider>, <ConfigDetailPanel>,
 *                                   <ConfigListPanel>, <ReferenceToken>,
 *                                   <DisambiguationPopover>.
 *
 * Traces to:
 *   walking-skeleton.feature
 *     -- Markdown link to a known skill renders as a live cross-reference token
 *     -- Single-click on a live reference opens a vertical split with the target previewed
 *     -- Keyboard Enter on a focused live reference behaves as single-click
 *     -- Ctrl+click across sub-tabs switches sub-tab, list selection, and detail in one atomic update
 *     -- Alt+Left restores the previous navigation snapshot
 *     -- Alt+Left does not act when another top-level view is active
 *     -- Dead reference exposes its tooltip on keyboard focus
 *     -- Esc with focus inside the split collapses the split back to a single pane
 *   milestone-1-resolution-and-disambiguation.feature
 *     -- Single-click on an ambiguous reference opens the disambiguation popover
 *     -- Disambiguation popover is announced to assistive technology when opened
 *     -- Esc cancels the disambiguation popover with no side effects
 *   milestone-2-robustness.feature
 *     -- Reference target deleted between render and click surfaces a soft-fail toast
 *     -- Permission denied at click time opens the split with a permission-denied panel
 *     -- After Ctrl+click commit the focus moves to the new selected list row
 *     -- Each pane transition is announced via the ARIA live region
 *     -- Alt+Left is ignored while typing inside an input or textarea
 */

import { describe, it } from "vitest";

// @walking_skeleton @driving_port
describe("Markdown link to a known skill renders as a live cross-reference token", () => {
  it.skip("renders the link as a button-shaped reference token with data-ref-variant=live", () => {
    // render(<ConfigNavProvider aggregatedConfig={walkingSkeletonConfig} isActive>
    //          <ConfigurationView ... initial selection: command /release />
    //        </ConfigNavProvider>);
    // const token = screen.getByRole("button", { name: /nw-bdd-requirements/ });
    // expect(token).toHaveAttribute("data-ref-variant", "live");
  });
});

// @walking_skeleton @driving_port
describe("Single-click on a live reference opens a vertical split with the target previewed", () => {
  it.skip("clicking a live reference renders top and bottom regions with the expected items", () => {
    // const user = userEvent.setup();
    // render the provider with /release selected
    // const token = screen.getByRole("button", { name: /nw-bdd-requirements/ });
    // await user.click(token);
    // expect(screen.getByRole("region", { name: /detail top/i })).toHaveTextContent("/release");
    // expect(screen.getByRole("region", { name: /detail bottom/i })).toHaveTextContent("nw-bdd-requirements");
  });
});

// @walking_skeleton @driving_port
describe("Keyboard Enter on a focused live reference behaves as single-click", () => {
  it.skip("focusing a live reference and pressing Enter opens the split", () => {
    // const token = screen.getByRole("button", { name: /nw-bdd-requirements/ });
    // token.focus();
    // await user.keyboard("{Enter}");
    // expect(screen.getByRole("region", { name: /detail bottom/i })).toBeInTheDocument();
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click across sub-tabs switches sub-tab, list selection, and detail in one atomic update", () => {
  it.skip("Ctrl+click on a cross-sub-tab live reference produces the expected DOM in one render flush", () => {
    // await user.keyboard("{Control>}");
    // await user.click(token);
    // await user.keyboard("{/Control}");
    // expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Skills");
    // expect(within(listPane).getByRole("button", { current: "true" })).toHaveTextContent("nw-bdd-requirements");
    // expect(detailPane).toHaveTextContent("nw-bdd-requirements");
  });
});

// @walking_skeleton @driving_port
describe("Alt+Left restores the previous navigation snapshot", () => {
  it.skip("after a single-click then a Ctrl+click, Alt+Left restores the split state with /release on top", () => {
    // perform the chain via UI
    // await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    // expect(detailPaneTopRegion).toHaveTextContent("/release");
    // expect(detailPaneBottomRegion).toHaveTextContent("nw-bdd-requirements");
  });
});

// @walking_skeleton @driving_port
describe("Alt+Left does not act when another top-level view is active", () => {
  it.skip("when isActive=false the Alt+Left handler does not change Configuration view state", () => {
    // render with isActive=false but with non-empty history
    // await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    // history head is unchanged
  });
});

// @walking_skeleton @driving_port
describe("Dead reference exposes its tooltip on keyboard focus", () => {
  it.skip("focusing a dead reference exposes the tooltip text via aria-describedby", () => {
    // const deadToken = screen.getByRole("button", { name: /nw-retired-skill/ });
    // deadToken.focus();
    // const describedBy = deadToken.getAttribute("aria-describedby");
    // expect(describedBy).toBeTruthy();
    // expect(document.getElementById(describedBy!)).toHaveTextContent(/Not found in your config/);
  });
});

// @walking_skeleton @driving_port
describe("Esc with focus inside the split collapses the split back to a single pane", () => {
  it.skip("pressing Esc with focus in the bottom pane collapses the split", () => {
    // open split first, focus an element inside the bottom pane
    // await user.keyboard("{Escape}");
    // expect(screen.queryByRole("region", { name: /detail bottom/i })).not.toBeInTheDocument();
  });
});

// @milestone-1 @driving_port
describe("Single-click on an ambiguous reference opens the disambiguation popover", () => {
  it.skip("clicking an ambiguous reference renders a role=dialog popover listing all candidates", () => {
    // const token = screen.getByRole("button", { name: /release/ });
    // await user.click(token);
    // const dialog = screen.getByRole("dialog", { name: /disambiguation/i });
    // const options = within(dialog).getAllByRole("option");
    // expect(options).toHaveLength(2);
    // expect(options[0]).toHaveAttribute("aria-selected", "true");  // pre-highlight
    // expect(options[0]).toHaveTextContent(/project/);
  });
});

// @milestone-1 @driving_port
describe("Disambiguation popover is announced to assistive technology when opened", () => {
  it.skip("opening the popover writes 'Disambiguation required: 2 candidates for release' to the live region", () => {
    // await user.click(ambiguousToken);
    // const liveRegion = screen.getByRole("status");
    // expect(liveRegion).toHaveTextContent("Disambiguation required: 2 candidates for release");
  });
});

// @milestone-1 @driving_port
describe("Esc cancels the disambiguation popover with no side effects", () => {
  it.skip("pressing Esc closes the popover and leaves all observable state unchanged", () => {
    // await user.click(ambiguousToken);
    // await user.keyboard("{Escape}");
    // expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // // detail/list/sub-tab unchanged; no history entry
  });
});

// @milestone-2 @driving_port @infrastructure-failure
describe("Reference target deleted between render and click surfaces a soft-fail toast", () => {
  it.skip("when the registry has been mutated to drop the target, single-click shows the toast and does not split", () => {
    // render, mutate registry to remove pre-release.sh, click the reference
    // expect(screen.queryByRole("region", { name: /detail bottom/i })).not.toBeInTheDocument();
    // expect(screen.getByRole("status")).toHaveTextContent(/This item was removed/);
  });
});

// @milestone-2 @driving_port @infrastructure-failure
describe("Permission denied at click time opens the split with a permission-denied panel", () => {
  it.skip("a permission-denied resolution at click time renders the dedicated error panel in the bottom pane", () => {
    // arrange: target whose read returns permission-denied
    // expect(within(bottomPane).getByText(/Permission denied/)).toBeInTheDocument();
    // expect(within(bottomPane).getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

// @milestone-2 @driving_port
describe("After Ctrl+click commit the focus moves to the new selected list row", () => {
  it.skip("Ctrl+click to a cross-sub-tab target moves keyboard focus to the new list row", () => {
    // perform Ctrl+click
    // expect(document.activeElement).toBe(within(listPane).getByRole("button", { name: /nw-bdd-requirements/ }));
  });
});

// @milestone-2 @driving_port
describe("Each pane transition is announced via the ARIA live region", () => {
  it.skip("opening then closing the split writes the corresponding announcements to the live region", () => {
    // await user.click(refToken);
    // expect(liveRegion).toHaveTextContent("Preview open: skill nw-bdd-requirements, user scope");
    // await user.click(closeButton);
    // expect(liveRegion).toHaveTextContent("Preview closed");
  });
});

// @milestone-2 @driving_port
describe("Alt+Left is ignored while typing inside an input or textarea", () => {
  it.skip("when focus is on the filter bar input, Alt+Left does not change the Configuration view's history head", () => {
    // const filterInput = screen.getByRole("searchbox", { name: /filter/i });
    // filterInput.focus();
    // await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    // // history head unchanged via observable: detail pane unchanged
  });
});

// =====================================================================
// SA MEDIUM: end-of-history timer effect (ADR-003 implementation note)
// The reducer-level no-op is in history.test.ts; the visual cue + auto-clear
// timer effect lives in useEffect inside the Provider and must be tested at
// the React layer.
// =====================================================================

// @walking_skeleton @driving_port
describe("Alt+Left at the start of history shows then auto-clears the end-of-history cue", () => {
  it.skip("after Alt+Left at headIndex=0 the end-of-history cue element is present then absent after the auto-clear timer fires", () => {
    // vi.useFakeTimers();
    // render the provider with an empty history (or seed at headIndex=0).
    //
    // When -- await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    //
    // Then -- the cue element is present (e.g., a data-end-of-history="back"
    // attribute on the detail pane root or a dedicated visual cue node):
    //   expect(screen.getByTestId("detail-pane")).toHaveAttribute("data-end-of-history", "back");
    //
    // When -- vi.advanceTimersByTime(300);
    //
    // Then -- the cue element is absent (the setTimeout dispatched
    // clearEndOfHistory per ADR-003 implementation notes):
    //   expect(screen.getByTestId("detail-pane")).not.toHaveAttribute("data-end-of-history");
    //
    // vi.useRealTimers();   // teardown
  });
});

// =====================================================================
// PA HIGH: matched_snapshot via observable + the eventSink seam
// (Reinforces instrumentation.test.tsx; this provider-level scenario keeps
// the matched_snapshot field-presence check next to the DOM-level restoration
// assertion so the DELIVER crafter sees both halves of the contract together.)
// =====================================================================

// @kpi @driving_port
describe("Alt+Left restores the previous snapshot and the captured nav_history_restore event reports matched_snapshot=true", () => {
  it.skip("the restored DOM matches the snapshot AND the event payload field matches", () => {
    // Arrange: register an eventSink before render, perform single-click +
    // Ctrl+click, then Alt+Left.
    //
    // Then -- DOM matches the prior snapshot (already covered by the existing
    // walking-skeleton.feature scenario):
    //   expect(detailPaneTopRegion).toHaveTextContent("/release");
    //   expect(detailPaneBottomRegion).toHaveTextContent("nw-bdd-requirements");
    //
    // And -- the event sink captured matched_snapshot=true:
    //   const event = events.find((e) => e.type === "nav_history_restore");
    //   expect(event.matched_snapshot).toBe(true);
  });
});

// =====================================================================
// PO LOW: US-102 AC -- bottom pane shows all five preview fields
// =====================================================================

// @walking_skeleton @driving_port
describe("The bottom pane preview displays type, scope, name, source path, and content for a normal preview", () => {
  it.skip("after a single-click that opens the split, the bottom pane region renders all five metadata fields", () => {
    // After single-click on a live reference to the user-scope skill
    // 'nw-bdd-requirements':
    //   const bottom = screen.getByRole("region", { name: /detail bottom/i });
    //   expect(within(bottom).getByText(/skill/i)).toBeInTheDocument();              // type
    //   expect(within(bottom).getByText(/user/i)).toBeInTheDocument();               // scope
    //   expect(within(bottom).getByText("nw-bdd-requirements")).toBeInTheDocument(); // name
    //   expect(within(bottom).getByText(/~\/.claude\/skills\/nw-bdd-requirements\/SKILL\.md/)).toBeInTheDocument();  // source path
    //   expect(within(bottom).getByText(/Body for nw-bdd-requirements/)).toBeInTheDocument();  // content preview
  });
});

// =====================================================================
// PO LOW: US-103 AC -- browser/OS default for Ctrl+click is suppressed
// =====================================================================

// @walking_skeleton @driving_port
describe("Ctrl+click on a live reference suppresses the browser/OS default link behaviour", () => {
  it.skip("the click handler invokes event.preventDefault() so the surrounding view does not navigate away", () => {
    // const token = screen.getByRole("button", { name: /nw-bdd-requirements/ });
    // const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    // const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
    // token.dispatchEvent(clickEvent);
    // expect(preventDefaultSpy).toHaveBeenCalled();
    //
    // (Spy is on the public DOM Event API -- the boundary -- not on an
    // internal handler. Observable: the event's defaultPrevented flag is
    // also true, equivalent passing form:
    //   expect(clickEvent.defaultPrevented).toBe(true);
    // )
  });
});

// =====================================================================
// PO+PA MEDIUM: DisambiguationPopover Tab focus trap (WCAG 2.2 AA SC 2.1.2)
// =====================================================================

// @milestone-1 @driving_port
describe("Tab inside the open disambiguation popover keeps focus within the popover", () => {
  it.skip("Tab from the first candidate moves focus to the next candidate; focus does not escape role=dialog", () => {
    // await user.click(ambiguousToken);
    // const dialog = screen.getByRole("dialog", { name: /disambiguation/i });
    // const options = within(dialog).getAllByRole("option");
    // options[0].focus();
    // await user.keyboard("{Tab}");
    // expect(document.activeElement).toBe(options[1]);
    // // Verify focus did not leave the dialog:
    // expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

// @milestone-1 @driving_port
describe("Shift+Tab from the first candidate wraps focus to the last candidate within the popover", () => {
  it.skip("Shift+Tab from the first candidate either wraps to the last candidate or moves to the cancel button per design, but never escapes the popover", () => {
    // await user.click(ambiguousToken);
    // const dialog = screen.getByRole("dialog", { name: /disambiguation/i });
    // const options = within(dialog).getAllByRole("option");
    // options[0].focus();
    // await user.keyboard("{Shift>}{Tab}{/Shift}");
    // // Acceptable end states (DESIGN to choose one in DELIVER):
    // //   (a) document.activeElement === options[options.length - 1]
    // //   (b) document.activeElement === within(dialog).getByRole("button", { name: /cancel/i })
    // expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
