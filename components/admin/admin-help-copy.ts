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
      "Correct answers divided by all questions the student has ever answered — any mode, including smoke tests and partial runs. This is not a finished exam score.",
  },
  avg_lifetime_accuracy: {
    title: "Average lifetime question accuracy",
    description:
      "Mean of each student's lifetime question accuracy (from individual attempts). Students with no attempts are excluded.",
  },
  best_mock_finished: {
    title: "Best mock (finished)",
    description:
      "The student's highest score on a completed mock exam. Partial or in-progress mocks are not counted.",
  },
  last_mock_finished: {
    title: "Last mock (finished)",
    description:
      "Most recent finished mock session score. Only counts completed mock exams.",
  },
  coverage_sections: {
    title: "Section coverage",
    description:
      "How many of the 12 syllabus sections the student has touched — each section counts once they have answered at least one question there.",
  },
  open_mistakes: {
    title: "Open mistakes",
    description:
      "Questions the student missed and has not yet cleared. A mistake closes after two correct answers in a row on that question.",
  },
  mode_finished_badge: {
    title: "Mode finished count",
    description:
      "Number of completed sessions in this mode. A green badge means the student finished at least one run.",
  },
  mode_partial_badge: {
    title: "Partial / in-progress runs",
    description:
      "Sessions started but not finished (in_progress or abandoned) — smoke tests, abandoned, or incomplete runs.",
  },
  completion_funnel: {
    title: "Completion funnel",
    description:
      "How many students completed each stage at least once. This tracks finished sessions, not overall question accuracy.",
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
      "Latest and best scores from completed exams only. Partial or abandoned runs do not appear here.",
  },
  session_breakdown: {
    title: "Session breakdown by mode & type",
    description:
      "Counts of sessions grouped by mode and run type (smoke, full, etc.), split into finished vs partial.",
  },
  readiness_estimate: {
    title: "Readiness estimate",
    description:
      "A composite readiness score blending accuracy, section coverage, streak, and progress across modes. Can reflect practice before any finished exam.",
  },
  questions_attempted: {
    title: "Questions attempted",
    description:
      "Total questions the student has answered across all sessions and modes, including smoke tests and partial runs.",
  },
  seven_day_accuracy: {
    title: "7-day question accuracy",
    description:
      "Correct ÷ attempts in the last 7 days only — still individual questions, not finished test scores.",
  },
  study_time_30d: {
    title: "Study time (30 days)",
    description:
      "Total time spent on completed sessions in the last 30 days.",
  },
  active_days_30d: {
    title: "Active days (30 days)",
    description:
      "Number of days in the last 30 with at least one question answered.",
  },
} as const;

export type AdminHelpKey = keyof typeof ADMIN_HELP;
