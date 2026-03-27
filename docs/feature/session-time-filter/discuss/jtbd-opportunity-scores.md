# Opportunity Scores: Session Time Filter

Scored on 1-10 scale. Opportunity = Importance + (Importance - Satisfaction).

| Job | Importance | Current Satisfaction | Opportunity Score |
|-----|-----------|---------------------|-------------------|
| J1: Focus on what's happening now | 9 | 4 | 14 |
| J2: Review recent activity | 7 | 2 | 12 |
| J3: Understand session volume | 4 | 3 | 5 |

## Prioritization

**J1** and **J2** are the primary opportunities — high importance, low current satisfaction. J1 is the strongest because "active now" is the most common filter intent and currently requires visual scanning.

**J3** is a low-effort add-on: updating the header count to reflect the filter costs almost nothing and satisfies this job as a side effect.

## Scope recommendation

All three jobs are addressable with a single UI control (filter selector) and a count update in the header. J3 does not require separate implementation — it falls out naturally from J1+J2.
