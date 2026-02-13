# Program Command Chat-Edit Data Requirements

## Goal
Before enabling chat to apply schedule edits, we need deterministic, complete data so every AI action can be validated, explained, and safely undone.

## Current Baseline (Already in repo)
- `data/course-catalog.json`: course metadata (credits, quarter offerings, some prerequisites)
- `data/prerequisite-graph.json`: flow relationships and critical gatekeepers
- `data/room-constraints.json`: room inventory + core room rules
- `data/scheduling-rules.json`: global policy constraints (travel buffer, evening safety, case-by-case rules)
- `workload-data.json`: historical faculty workload/courses by year
- `enrollment-dashboard-data.json`: historical enrollment trends + forecast bands

## Critical Gaps (Must Have for Chat-Driven Changes)

### 1) Canonical Section Dataset for Target Year
Why it matters: chat actions need stable IDs and exact records to update.

Required fields per section:
- `assignment_id` (stable unique key)
- `academic_year`, `quarter`
- `course_code`, `section`
- `days`, `start_time`, `end_time`
- `room_id`, `modality` (`in-person`, `online`, `hybrid`, `arranged`)
- `assigned_faculty`
- `credits`, `enrollment_cap`
- `locked` (bool), `lock_reason`
- `source_of_truth_updated_at`

Current gap:
- Main grid data in `index.html` is demo-seeded and does not provide a durable, normalized section table for chat writes.

Suggested docs file:
- `docs/section-roster-AY2026-27.csv`

### 2) Faculty Capacity and Availability by Quarter
Why it matters: chat must reject impossible assignments before applying.

Required fields per faculty:
- `faculty_name`
- `included_in_scenario` (bool)
- `annual_target_credits`
- `annual_inload_credits`
- `desn499_reserved_per_quarter`
- `quarter_max_credits` (or derivable policy)
- `campus_eligibility` (Cheney/Catalyst/Both)
- `unavailable_slots` (day/time blocks)
- `max_preps_per_quarter`
- `can_teach_online` (bool)

Current gap:
- Capacity target data exists in UI/localStorage logic, but not as a durable input file contract for chat ops.

Suggested docs file:
- `docs/faculty-capacity-availability-AY2026-27.csv`

### 3) Course Offering Requirements (Not just preferences)
Why it matters: chat needs hard minima/maxima per quarter to avoid under-serving curriculum.

Required fields per course-quarter:
- `course_code`
- `quarter`
- `min_sections_required`
- `max_sections_allowed`
- `must_offer` (bool)
- `preferred_modality`
- `priority_weight` (for optimization)

Current gap:
- Catalog contains offered quarters, but no enforceable min/max section requirements for the target schedule year.

Suggested docs file:
- `docs/course-offering-requirements-AY2026-27.csv`

### 4) Room Availability Calendar (Blackouts and Shared-use windows)
Why it matters: static room lists are not enough for real placement.

Required fields:
- `room_id`
- `date_range` or `quarter`
- `days`
- `blocked_start_time`, `blocked_end_time`
- `reason` (maintenance, external booking, etc.)

Current gap:
- `data/room-constraints.json` defines capabilities and allowed courses, but not time-window blackouts.

Suggested docs file:
- `docs/room-availability-blackouts-AY2026-27.csv`

### 5) Hard Locks / Protected Assignments
Why it matters: chat must know what is non-negotiable.

Required fields:
- `assignment_id`
- `lock_type` (`hard`, `soft`)
- `reason`
- `owner`
- `expires_at` (optional)

Current gap:
- No explicit lock dataset for protected sections/instructors/slots.

Suggested docs file:
- `docs/schedule-locks-AY2026-27.csv`

### 6) Constraint Registry with Severity + Enforcement Mode
Why it matters: chat needs machine-readable hard/soft policies and conflict priority.

Required fields:
- `constraint_id`
- `constraint_type`
- `enabled`
- `severity`
- `enforcement` (`hard-block`, `warn-only`)
- `rule_details` (JSON)

Current gap:
- Constraints exist (JSON and/or Supabase), but no unified export guaranteed for offline deterministic validation in chat edit mode.

Suggested docs file:
- `docs/constraint-registry-AY2026-27.json`

## Recommended (Strongly Improves Quality)

### 7) Demand Targets by Course-Quarter for Planning Year
Required fields:
- `course_code`, `quarter`
- `predicted_headcount`
- `lower_bound`, `upper_bound`
- `confidence`

Note:
- Historical demand is present, but an explicit target-year planning extract is better for deterministic operations.

Suggested docs file:
- `docs/demand-targets-AY2026-27.csv`

### 8) Chat Action Policy and Objective Weights
Required fields:
- `objective_weights` (workload balance, conflict reduction, room fit, demand coverage)
- `tie_breaker_order`
- `max_changes_per_command`
- `require_confirmation_for` (e.g., faculty reassignment, evening moves)

Suggested docs file:
- `docs/chat-policy-config.json`

## Minimum Viable Data Pack (P0)
If you only collect one pass now, collect these first:
- `section-roster-AY2026-27.csv`
- `faculty-capacity-availability-AY2026-27.csv`
- `course-offering-requirements-AY2026-27.csv`
- `room-availability-blackouts-AY2026-27.csv`
- `schedule-locks-AY2026-27.csv`
- `constraint-registry-AY2026-27.json`

## Acceptance Checks Before Building Chat Edits
- Every visible section has a stable `assignment_id`.
- Every faculty member in schedule has a capacity record for the same year.
- Every scheduled section passes hard constraints with no ambiguity.
- Every chat-generated action can be mapped to a single section ID.
- A full edit command can be represented as reversible operations (move/add/remove/update).

## Next Step
After these docs are added, we can build a validator that reads them and reports readiness gaps before turning on chat-based schedule mutations.
