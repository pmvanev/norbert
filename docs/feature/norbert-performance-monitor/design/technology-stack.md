# Technology Stack: norbert-performance-monitor

## Stack Summary

No new external dependencies. All new capabilities use existing project technologies and browser built-in APIs.

## Technologies Used

| Component | Technology | Version | License | Rationale |
|---|---|---|---|---|
| Plugin runtime | TypeScript | 5.x | Apache-2.0 | Project standard. Existing. |
| View framework | React | 19 | MIT | Project standard. Existing. |
| Chart rendering | HTML Canvas API | N/A | Built-in | Proven at 10Hz in oscilloscope. Multi-chart PM grid uses same pipeline. |
| State management | Custom functional pub/sub | N/A | N/A | Existing pattern (MetricsStore). Extended for multi-session. No framework dependency. |
| Number/currency formatting | Intl.NumberFormat | N/A | Built-in | Existing. Cost rate formatting ($X.XX/min). |
| Responsive sizing | ResizeObserver | N/A | Built-in | Existing pattern in OscilloscopeView. Reused for PM chart cells. |
| Animation scheduling | requestAnimationFrame / setInterval | N/A | Built-in | Existing 10Hz render loop pattern. PM charts use same approach. |
| Data storage | SQLite (WAL mode) | N/A | Public domain | Existing. Historical queries for extended time windows use existing events table. |
| IPC | Tauri IPC | 2.x | MIT/Apache-2.0 | Existing. api.db.execute() for session discovery queries. |

## New Dependency Evaluation

### Evaluated and Rejected

| Library | Purpose | Why Rejected |
|---|---|---|
| Recharts / Victory / Chart.js | Chart rendering | SVG-based. Cannot match 10Hz Canvas performance for 4-5 simultaneous charts. Adds bundle weight. Oscilloscope pipeline already solves this. |
| Zustand / Jotai | State management | Adds dependency for a pattern already solved by the existing functional pub/sub store. Multi-session is an extension, not a paradigm change. |
| RxJS / Observable | Event stream processing | Over-engineered for the workload. Simple pub/sub + pure fold is sufficient. Hook events arrive at <100/sec per session. |
| D3 | Data visualization | Heavyweight. PM charts are uniform waveforms, not complex visualizations. Oscilloscope pipeline covers the need. |

## Technology Decisions

### Canvas over SVG for PM Charts (Rationale)
The PM grid renders 4-5 charts simultaneously at up to 10Hz (1m window). SVG DOM manipulation at this frequency across multiple charts would cause layout thrashing. Canvas rendering is stateless (clear + redraw) and avoids DOM overhead. The existing oscilloscope proves this approach at 10Hz with dual traces.

### Functional Pub/Sub over React Context for Multi-Session State (Rationale)
React Context re-renders all consumers on any change. With 4-5 charts + breakdown panel + stats bar, this creates unnecessary render cycles. The existing pub/sub pattern allows each subscriber to receive updates independently and decide whether to re-render. Multi-Session Store extends this pattern to multiple sessions.

### No Web Workers for Aggregation (Rationale)
Cross-session aggregation is O(N) where N = active sessions (2-5 typical). This completes in <1ms. Worker message serialization overhead exceeds computation cost. Same reasoning as ADR-015 for the oscilloscope ring buffer.
