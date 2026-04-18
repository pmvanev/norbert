/**
 * EWMA — exponentially weighted moving-average step.
 *
 * Single-step smoothing with target attraction (prototype parity):
 *
 *   ewmaStep(current, target, alpha) = current*(1 - alpha) + target*alpha
 *
 * `alpha` is the attraction coefficient, conventionally in [0, 1]:
 *   - `alpha = 0`   => ignore target; result equals current (no motion).
 *   - `alpha = 1`   => jump to target; result equals target (no smoothing).
 *   - `alpha = 0.45` matches the prototype's per-frame attraction toward
 *                    the 5-second target envelope.
 *
 * Pure: no effects, no imports outside this module.
 */

/**
 * One EWMA attraction step. The function is total over all finite numeric
 * inputs. It does not clamp alpha; callers are responsible for passing a
 * value in [0, 1] if the bounded-interpolation invariant is required.
 */
export const ewmaStep = (current: number, target: number, alpha: number): number =>
  current * (1 - alpha) + target * alpha;
