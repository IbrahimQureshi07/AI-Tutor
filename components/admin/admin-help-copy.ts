/**
 * Admin panel metric explanations — where each number comes from.
 */

export const ADMIN_HELP = {
  total_users: {
    title: "Total users",
    description:
      "All accounts in auth — students and admins. Cohort metrics on the dashboard exclude admin accounts.",
  },
  cohort_students: {
    title: "Students (cohort)",
    description:
      "Student-role accounts only — admins are excluded from funnel, accuracy, and risk metrics on this dashboard.",
  },
  lifetime_accuracy: {
    title: "Lifetime question accuracy",
    description:
      "Correct ÷ all answered questions in the attempts table — any mode, smoke, partial, or finished. Not a finished exam score.",
  },
  avg_lifetime_accuracy: {
    title: "Average lifetime question accuracy",
    description:
      "Mean of each student's lifetime question accuracy (from individual attempts). Students with no attempts are excluded.",
  },
  best_mock_finished: {
    title: "Best mock (finished)",
    description:
      "Highest score_pct from sessions where mode = mock and status = finished. Partial or in-progress mocks are ignored.",
  },
  last_mock_finished: {
    title: "Last mock (finished)",
    description:
      "Most recent finished mock session score. Only counts completed mock exams.",
  },
  coverage_sections: {
    title: "Section coverage",
    description:
      "How many of the 12 syllabus sections have at least one answered question (v_user_section_mastery).",
  },
  open_mistakes: {
    title: "Open mistakes",
    description:
      "Unresolved rows in v_user_mistakes (resolved = false) — questions the student missed and has not cleared.",
  },
  mode_finished_badge: {
    title: "Mode finished count",
    description:
      "Number of sessions with status = finished for this mode. A green badge means at least one completed run.",
  },
  mode_partial_badge: {
    title: "Partial / in-progress runs",
    description:
      "Sessions started but not finished (in_progress or abandoned) — smoke tests, abandoned, or incomplete runs.",
  },
  completion_funnel: {
    title: "Completion funnel",
    description:
      "Students who finished each stage at least once (session status = finished). Not the same as lifetime question accuracy.",
  },
  mock_distribution: {
    title: "Best mock score distribution",
    description:
      "Each student's single best finished mock score, bucketed. Only students with at least one finished mock are counted.",
  },
  class_section_accuracy: {
    title: "Class section accuracy",
    description:
      "Combined correct ÷ total attempts across all students for that section — lifetime question accuracy, not finished-test scores.",
  },
  at_risk: {
    title: "At risk",
    description:
      "Students with attempts whose lifetime accuracy is below 70%, or whose best finished mock is below 70%.",
  },
  active_7d: {
    title: "Active (7 days)",
    description:
      "Users with a session started or finished in the last 7 days.",
  },
  finished_test_scores: {
    title: "Finished test scores",
    description:
      "Latest and best score_pct from sessions with status = finished only. Partial runs do not appear here.",
  },
  session_breakdown: {
    title: "Session breakdown by mode & type",
    description:
      "Counts of sessions grouped by mode and run type (smoke, full, etc.), split into finished vs partial.",
  },
  readiness_estimate: {
    title: "Readiness estimate",
    description:
      "Composite score from getUserStats — blends accuracy, coverage, streak, and mode progress. May reflect question attempts before any finished exam.",
  },
  questions_attempted: {
    title: "Questions attempted",
    description:
      "Total primary question attempts across all sessions and modes (attempts table). Includes smoke and partial runs.",
  },
  seven_day_accuracy: {
    title: "7-day question accuracy",
    description:
      "Correct ÷ attempts in the last 7 days only — still individual questions, not finished test scores.",
  },
  study_time_30d: {
    title: "Study time (30 days)",
    description:
      "Sum of duration_ms on finished sessions in the last 30 days.",
  },
  active_days_30d: {
    title: "Active days (30 days)",
    description:
      "Days in the last 30 with at least one question attempt (daily activity rollup).",
  },
} as const;

export type AdminHelpKey = keyof typeof ADMIN_HELP;
