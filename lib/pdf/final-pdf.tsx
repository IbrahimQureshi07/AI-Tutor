import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type { FinalReport, VerdictTier } from "@/lib/final/report";
import type { Journey } from "@/lib/journey/load";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

/* ─── Brand colours ─── */
const C = {
  primary: "#C15F3C",
  primaryLight: "#E7CFBF",
  bg: "#F7F4EE",
  surface: "#FFFFFF",
  ink: "#1F1B17",
  inkMuted: "#5C564E",
  border: "#D8CFBF",
  success: "#3A7A50",
  successLight: "#D6EDDF",
  warn: "#C48230",
  warnLight: "#F7EDD0",
  danger: "#AE3C22",
  dangerLight: "#F5D7CF",
  gray: "#E8E0D4",
  white: "#FFFFFF",
  lightBg: "#FAF7F2",
  national: "#5C8DC4",
  nationalLight: "#DDE8F5",
  state: "#7A5C9A",
  stateLight: "#EDE5F5",
  assessment: "#C15F3C",
  practice: "#5C8DC4",
  mistakes: "#C48230",
  mock: "#7A5C9A",
};

const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingBottom: 60,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
  },

  /* ── Header ── */
  header: {
    paddingHorizontal: 32,
    paddingTop: 22,
    paddingBottom: 18,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  appName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 8,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  reportBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 5,
    alignSelf: "flex-start",
  },
  reportBadgeText: {
    fontSize: 7.5,
    color: C.white,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerDate: { fontSize: 8, color: "rgba(255,255,255,0.75)", textAlign: "right" },
  headerTagline: {
    marginTop: 10,
    fontSize: 7.5,
    color: "rgba(255,255,255,0.6)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 8,
  },

  body: { paddingHorizontal: 28, paddingTop: 18 },

  sectionTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.primaryLight,
    paddingBottom: 3,
  },

  /* ── Score hero ── */
  heroBox: {
    backgroundColor: C.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    gap: 16,
  },
  heroLeft: {
    width: 90,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingRight: 14,
  },
  heroResult: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
  },
  heroSubtitle: { fontSize: 7, color: C.inkMuted, textAlign: "center", marginTop: 2 },
  heroRight: { flex: 1, gap: 7 },

  portionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  portionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", width: 120 },
  portionScore: { fontSize: 18, fontFamily: "Helvetica-Bold", width: 44, textAlign: "right" },
  portionSub: { fontSize: 7, color: C.inkMuted, width: 80 },
  portionPassBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: "auto",
  },
  portionBar: { marginTop: 4, height: 5, backgroundColor: C.gray, borderRadius: 3, overflow: "hidden" },
  portionFill: { height: 5, borderRadius: 3 },

  /* ── Combined stat row ── */
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 9,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  statValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.ink },
  statLabel: { fontSize: 7, color: C.inkMuted, marginTop: 2, textAlign: "center" },

  /* ── Portion detail cards ── */
  portionCards: { flexDirection: "row", gap: 10, marginBottom: 16 },
  portionCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  portionCardHeader: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  portionCardTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.white },
  portionCardBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  portionCardBody: { paddingHorizontal: 10, paddingBottom: 10, paddingTop: 6 },
  portionBigScore: { fontSize: 28, fontFamily: "Helvetica-Bold" },
  portionDetailText: { fontSize: 7.5, color: C.inkMuted, marginTop: 2 },
  portionWeakTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.inkMuted, marginTop: 7, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  portionWeakItem: { flexDirection: "row", gap: 4, alignItems: "flex-start", marginBottom: 2 },
  portionWeakBullet: { fontSize: 7, color: C.primary },
  portionWeakText: { fontSize: 7.5, color: C.inkMuted, flex: 1 },
  portionBarFull: { marginTop: 8, height: 6, backgroundColor: C.gray, borderRadius: 3, overflow: "hidden" },
  portionBarFill2: { height: 6, borderRadius: 3 },

  /* ── Section table ── */
  sectionTable: {
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F0E8DE",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  thCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.inkMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F2EBE0",
  },
  tableRowAlt: { backgroundColor: C.lightBg },
  tableRowLast: { borderBottomWidth: 0 },

  colGroup: { width: 28 },
  colCode: { width: 26 },
  colName: { flex: 1 },
  colBar: { width: 68, marginHorizontal: 5 },
  colPct: { width: 34, textAlign: "right" },
  colQs: { width: 24, textAlign: "right" },

  cellCode: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    borderRadius: 3,
    textAlign: "center",
  },
  cellGroup: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 3,
    textAlign: "center",
  },
  cellName: { fontSize: 8, color: C.ink },
  cellPct: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  cellSub: { fontSize: 7, color: C.inkMuted },

  progressTrack: { height: 5, backgroundColor: C.gray, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 3 },

  /* ── Verdict ── */
  verdictBox: {
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  verdictHeading: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  verdictBody: { fontSize: 8, color: C.inkMuted, lineHeight: 1.5 },

  /* ── Pass probability ── */
  probBox: {
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  probPct: { fontSize: 28, fontFamily: "Helvetica-Bold", width: 70, textAlign: "center" },
  probRight: { flex: 1 },
  probTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 3 },
  probText: { fontSize: 7.5, color: C.inkMuted, lineHeight: 1.5 },

  /* ─────────────── PAGE 2: JOURNEY ─────────────── */

  /* Stage cards grid */
  stageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  stageCard: {
    width: "47%",
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  stageCardHeader: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stageCardTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.white },
  stageCardCount: { fontSize: 7, color: "rgba(255,255,255,0.8)" },
  stageCardBody: { paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  stageStatRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stageStatLabel: { fontSize: 7.5, color: C.inkMuted },
  stageStatValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },
  stageNoData: { fontSize: 8, color: C.inkMuted, fontStyle: "italic", textAlign: "center", paddingVertical: 8 },

  /* Timeline */
  timelineBox: {
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F2EBE0",
    gap: 6,
  },
  timelineRowLast: { borderBottomWidth: 0 },
  timelineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  timelineMode: { fontSize: 7.5, fontFamily: "Helvetica-Bold", width: 65 },
  timelineDate: { fontSize: 7, color: C.inkMuted, flex: 1 },
  timelineScore: { fontSize: 8, fontFamily: "Helvetica-Bold", width: 32, textAlign: "right" },
  timelineBar: { width: 60, height: 5, backgroundColor: C.gray, borderRadius: 3, overflow: "hidden" },
  timelineBarFill: { height: 5, borderRadius: 3 },

  /* Footer */
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 5,
  },
  footerText: { fontSize: 6.5, color: C.inkMuted },
});

/* ─── Helpers ─── */
function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function scoreColor(pct: number, passPct: number): string {
  if (pct >= passPct) return C.success;
  if (pct >= passPct - 8) return C.warn;
  return C.danger;
}

function accuracyColor(pct: number, passPct: number): string {
  if (pct >= passPct) return C.success;
  if (pct >= passPct - 8) return C.warn;
  return C.danger;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function modeColor(mode: string): string {
  switch (mode) {
    case "assessment": return C.assessment;
    case "practice": return C.practice;
    case "mistakes": return C.mistakes;
    case "mock": return C.mock;
    default: return C.primary;
  }
}

function modeLabel(mode: string): string {
  switch (mode) {
    case "assessment": return "Assessment";
    case "practice": return "Practice";
    case "mistakes": return "Mistakes";
    case "mock": return "Mock Exam";
    default: return mode;
  }
}

function verdictDetails(verdict: VerdictTier, passPct: number): { title: string; body: string; color: string; bgColor: string; borderColor: string } {
  switch (verdict.kind) {
    case "schedule_real":
      return {
        title: `Ready to schedule the real PSI exam! (${verdict.portionsAtOrAbove === 2 ? "Both portions" : "Portion"} ≥ 85%)`,
        body: "Excellent performance on both portions. You have demonstrated consistent readiness above the high-confidence threshold. Consider booking your real exam soon while the material is fresh.",
        color: C.success,
        bgColor: "#F2FAF5",
        borderColor: "#B0D8BE",
      };
    case "ready_margin":
      return {
        title: "Passed both portions with comfortable margin (75–84%)",
        body: "Both the National and State portions cleared with a healthy buffer above the pass line. Review any weak sections before the real exam to solidify your standing.",
        color: C.success,
        bgColor: "#F2FAF5",
        borderColor: "#B0D8BE",
      };
    case "ready_narrow":
      return {
        title: `Passed both portions — close to the ${passPct}% pass line`,
        body: "Both portions passed, but the margin is narrow. Target your weakest sections to build more confidence before attempting the real exam.",
        color: C.warn,
        bgColor: "#FDF7EC",
        borderColor: "#E8D0A0",
      };
    case "partial_pass_close":
      return {
        title: `${verdict.passed === "national" ? "National" : "SC State"} portion passed — ${verdict.passed === "national" ? "State" : "National"} just below (${verdict.otherPct}%)`,
        body: `You cleared one portion. The other is only ${passPct - verdict.otherPct}% away from the pass line. A focused review of the weaker portion topics should get you over the line.`,
        color: C.warn,
        bgColor: "#FDF7EC",
        borderColor: "#E8D0A0",
      };
    case "partial_pass_far":
      return {
        title: `${verdict.passed === "national" ? "National" : "SC State"} portion passed — ${verdict.passed === "national" ? "State" : "National"} needs work (${verdict.otherPct}%)`,
        body: `One portion passed, the other requires more preparation (${verdict.otherPct}% vs ${passPct}% pass line). Revisit the weaker portion thoroughly before your next attempt.`,
        color: C.danger,
        bgColor: "#FDF3F0",
        borderColor: "#EAB8A8",
      };
    case "fail_close":
      return {
        title: `Both portions below pass line — close (Nat: ${verdict.nationalPct}%, SC: ${verdict.statePct}%)`,
        body: `You're within reach on both portions. Identify your weakest sections in each and do targeted drills before your next attempt.`,
        color: C.warn,
        bgColor: "#FDF7EC",
        borderColor: "#E8D0A0",
      };
    case "fail_far":
      return {
        title: `Both portions need significant improvement (Nat: ${verdict.nationalPct}%, SC: ${verdict.statePct}%)`,
        body: "More study time is needed across both portions. Focus on fundamentals before attempting the Final Test again.",
        color: C.danger,
        bgColor: "#FDF3F0",
        borderColor: "#EAB8A8",
      };
    default:
      return {
        title: "Incomplete session",
        body: "Not enough data to produce a full verdict.",
        color: C.inkMuted,
        bgColor: C.lightBg,
        borderColor: C.border,
      };
  }
}

/* ─── Props ─── */
export interface FinalPdfProps {
  sessionId: string;
  durationMs: number;
  passPct: number;
  report: FinalReport;
  predictedPassProbability: number | null;
  journey: Journey;
  generatedAt?: string;
}

/* ─── Document ─── */
export function FinalPdf({
  durationMs,
  passPct,
  report,
  predictedPassProbability,
  journey,
  generatedAt,
}: FinalPdfProps) {
  const passed = report.passed;
  const dateStr =
    generatedAt ??
    new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const headerBg = passed ? "#2D6B47" : C.primary;
  const nationalColor = scoreColor(report.nationalPct, passPct);
  const stateColor = scoreColor(report.statePct, passPct);
  const combinedColor = scoreColor(report.combinedPct, passPct);

  const verdict = verdictDetails(report.verdict, passPct);

  const nationalSections = report.sections.filter((s) => s.group === "National" && s.total > 0);
  const stateSections = report.sections.filter((s) => s.group === "State" && s.total > 0);

  /* Journey timeline — most recent 16, chronological */
  const timeline = [...journey.combined].reverse().slice(0, 16);

  const probPct =
    predictedPassProbability != null
      ? Math.round(predictedPassProbability * 100)
      : null;

  return (
    <Document
      title="Final Test Report"
      author="SC Real Estate Prep"
      subject="SC Real Estate Final Test Results"
    >
      {/* ══════════════ PAGE 1: FINAL EXAM RESULTS ══════════════ */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={[s.header, { backgroundColor: headerBg }]}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.appName}>SC Real Estate Prep</Text>
              <Text style={s.headerSubtitle}>Final Test · Official Format Simulation</Text>
              <View style={s.reportBadge}>
                <Text style={s.reportBadgeText}>
                  {passed ? "PASSED — Both Portions Cleared" : "NOT YET — Review Report Below"}
                </Text>
              </View>
            </View>
            <Text style={s.headerDate}>Generated {dateStr}</Text>
          </View>
          <Text style={s.headerTagline}>
            {`${report.nationalTotal}Q National  +  ${report.stateTotal}Q South Carolina  ·  Pass per portion: ${passPct}%  ·  Duration: ${fmtMs(durationMs)}`}
          </Text>
        </View>

        <View style={s.body}>
          {/* ── SCORE HERO ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Exam Score Summary</Text>
          <View style={s.heroBox}>
            {/* Left: overall verdict */}
            <View style={s.heroLeft}>
              <Text style={[s.heroResult, { color: passed ? C.success : C.danger, fontSize: 13 }]}>
                {passed ? "PASSED" : "NOT YET"}
              </Text>
              <Text style={s.heroSubtitle}>Both portions{"\n"}must clear {passPct}%</Text>
            </View>

            {/* Right: National + State rows */}
            <View style={s.heroRight}>
              {/* National */}
              <View style={[s.portionRow, { backgroundColor: "#F5F8FD" }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <Text style={[s.portionLabel, { color: C.national }]}>National Portion</Text>
                    <View style={[s.portionPassBadge, {
                      backgroundColor: report.nationalPassed ? C.successLight : C.dangerLight,
                      color: report.nationalPassed ? C.success : C.danger,
                    }]}>
                      <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: report.nationalPassed ? C.success : C.danger }}>
                        {report.nationalPassed ? "CLEARED" : "NOT CLEARED"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                    <Text style={[s.portionScore, { color: nationalColor }]}>{report.nationalPct}%</Text>
                    <Text style={s.portionSub}>{report.nationalCorrect}/{report.nationalTotal} correct</Text>
                  </View>
                  <View style={s.portionBar}>
                    <View style={[s.portionFill, { width: `${report.nationalPct}%`, backgroundColor: nationalColor }]} />
                  </View>
                </View>
              </View>

              {/* State */}
              <View style={[s.portionRow, { backgroundColor: "#F8F5FD" }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <Text style={[s.portionLabel, { color: C.state }]}>SC State Portion</Text>
                    <View style={[s.portionPassBadge, {
                      backgroundColor: report.statePassed ? C.successLight : C.dangerLight,
                      color: report.statePassed ? C.success : C.danger,
                    }]}>
                      <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: report.statePassed ? C.success : C.danger }}>
                        {report.statePassed ? "CLEARED" : "NOT CLEARED"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                    <Text style={[s.portionScore, { color: stateColor }]}>{report.statePct}%</Text>
                    <Text style={s.portionSub}>{report.stateCorrect}/{report.stateTotal} correct</Text>
                  </View>
                  <View style={s.portionBar}>
                    <View style={[s.portionFill, { width: `${report.statePct}%`, backgroundColor: stateColor }]} />
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── COMBINED STATS ROW ── */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: combinedColor }]}>{report.combinedPct}%</Text>
              <Text style={s.statLabel}>Combined{"\n"}(reference only)</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: C.ink }]}>{report.combinedCorrect}/{report.combinedTotal}</Text>
              <Text style={s.statLabel}>Total{"\n"}Correct</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: C.ink }]}>{fmtMs(durationMs)}</Text>
              <Text style={s.statLabel}>Time{"\n"}Taken</Text>
            </View>
            {probPct != null && (
              <View style={s.statCard}>
                <Text style={[s.statValue, {
                  color: probPct >= 70 ? C.success : probPct >= 50 ? C.warn : C.danger,
                }]}>{probPct}%</Text>
                <Text style={s.statLabel}>Predicted{"\n"}Pass Prob.</Text>
              </View>
            )}
          </View>
          </View>

          {/* ── VERDICT ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Verdict & Recommendation</Text>
          <View style={[s.verdictBox, {
            backgroundColor: verdict.bgColor,
            borderColor: verdict.borderColor,
          }]}>
            <Text style={[s.verdictHeading, { color: verdict.color }]}>{verdict.title}</Text>
            <Text style={s.verdictBody}>{verdict.body}</Text>
            {(report.nationalWeakest.length > 0 || report.stateWeakest.length > 0) && (
              <View style={{ marginTop: 7, flexDirection: "row", gap: 14 }}>
                {report.nationalWeakest.length > 0 && (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: C.national, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      National Weak Spots
                    </Text>
                    {report.nationalWeakest.map((w, i) => (
                      <View key={i} style={{ flexDirection: "row", gap: 4, marginBottom: 2 }}>
                        <Text style={{ fontSize: 7, color: C.primary }}>›</Text>
                        <Text style={{ fontSize: 7.5, color: C.inkMuted, flex: 1 }}>{w}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {report.stateWeakest.length > 0 && (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: C.state, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      State Weak Spots
                    </Text>
                    {report.stateWeakest.map((w, i) => (
                      <View key={i} style={{ flexDirection: "row", gap: 4, marginBottom: 2 }}>
                        <Text style={{ fontSize: 7, color: C.primary }}>›</Text>
                        <Text style={{ fontSize: 7.5, color: C.inkMuted, flex: 1 }}>{w}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
          </View>

          {/* ── SECTION TABLE ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Section-by-Section Breakdown</Text>

          {nationalSections.length > 0 && (
            <View style={[s.sectionTable, { marginBottom: 8 }]}>
              <View style={s.tableHeader}>
                <View style={s.colGroup}><Text style={[s.thCell, { color: C.national }]}>Nat</Text></View>
                <View style={s.colName}><Text style={s.thCell}>Section</Text></View>
                <View style={s.colBar}><Text style={s.thCell}>Accuracy</Text></View>
                <View style={s.colPct}><Text style={s.thCell}>Score</Text></View>
                <View style={s.colQs}><Text style={s.thCell}>Qs</Text></View>
              </View>
              {nationalSections.map((sec, i) => {
                const isLast = i === nationalSections.length - 1;
                const color = accuracyColor(sec.accuracyPct, passPct);
                return (
                  <View key={sec.code} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                    <View style={s.colGroup}>
                      <Text style={[s.cellGroup, { backgroundColor: C.nationalLight, color: C.national }]}>Nat</Text>
                    </View>
                    <View style={s.colName}><Text style={s.cellName}>{formatSectionDisplayLabel(sec.code)}</Text></View>
                    <View style={s.colBar}>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${Math.max(2, sec.accuracyPct)}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                    <View style={s.colPct}><Text style={[s.cellPct, { color }]}>{sec.accuracyPct}%</Text></View>
                    <View style={s.colQs}><Text style={s.cellSub}>{sec.total}</Text></View>
                  </View>
                );
              })}
            </View>
          )}

          {stateSections.length > 0 && (
            <View style={[s.sectionTable, { marginBottom: 0 }]}>
              <View style={s.tableHeader}>
                <View style={s.colGroup}><Text style={[s.thCell, { color: C.state }]}>SC</Text></View>
                <View style={s.colName}><Text style={s.thCell}>Section</Text></View>
                <View style={s.colBar}><Text style={s.thCell}>Accuracy</Text></View>
                <View style={s.colPct}><Text style={s.thCell}>Score</Text></View>
                <View style={s.colQs}><Text style={s.thCell}>Qs</Text></View>
              </View>
              {stateSections.map((sec, i) => {
                const isLast = i === stateSections.length - 1;
                const color = accuracyColor(sec.accuracyPct, passPct);
                return (
                  <View key={sec.code} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                    <View style={s.colGroup}>
                      <Text style={[s.cellGroup, { backgroundColor: C.stateLight, color: C.state }]}>SC</Text>
                    </View>
                    <View style={s.colName}><Text style={s.cellName}>{formatSectionDisplayLabel(sec.code)}</Text></View>
                    <View style={s.colBar}>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${Math.max(2, sec.accuracyPct)}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                    <View style={s.colPct}><Text style={[s.cellPct, { color }]}>{sec.accuracyPct}%</Text></View>
                    <View style={s.colQs}><Text style={s.cellSub}>{sec.total}</Text></View>
                  </View>
                );
              })}
            </View>
          )}
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SC Real Estate Prep · Final Test Report</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ══════════════ PAGE 2: OVERALL JOURNEY ANALYTICS ══════════════ */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={[s.header, { backgroundColor: "#3B3530" }]}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.appName}>SC Real Estate Prep</Text>
              <Text style={s.headerSubtitle}>Overall Journey Analytics</Text>
              <View style={s.reportBadge}>
                <Text style={s.reportBadgeText}>All Stages · Combined History</Text>
              </View>
            </View>
            <Text style={s.headerDate}>Generated {dateStr}</Text>
          </View>
          <Text style={s.headerTagline}>
            Assessment · Practice · Mistakes Drill · Mock Exam — full performance history
          </Text>
        </View>

        <View style={s.body}>
          {/* ── STAGE SUMMARY CARDS ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Performance by Stage</Text>
          <View style={s.stageGrid}>
            {(["assessment", "practice", "mistakes", "mock"] as const).map((mode) => {
              const series = journey.perMode[mode];
              const color = modeColor(mode);
              const hasData = series.runs.length > 0;
              return (
                <View key={mode} style={s.stageCard}>
                  <View style={[s.stageCardHeader, { backgroundColor: color }]}>
                    <Text style={s.stageCardTitle}>{modeLabel(mode)}</Text>
                    <Text style={s.stageCardCount}>{series.runs.length} session{series.runs.length !== 1 ? "s" : ""}</Text>
                  </View>
                  <View style={s.stageCardBody}>
                    {!hasData ? (
                      <Text style={s.stageNoData}>No sessions yet</Text>
                    ) : (
                      <>
                        <View style={s.stageStatRow}>
                          <Text style={s.stageStatLabel}>Latest score</Text>
                          <Text style={[s.stageStatValue, {
                            color: series.latest != null ? (series.latest >= passPct ? C.success : series.latest >= passPct - 10 ? C.warn : C.danger) : C.inkMuted,
                          }]}>{series.latest != null ? `${series.latest}%` : "—"}</Text>
                        </View>
                        <View style={s.stageStatRow}>
                          <Text style={s.stageStatLabel}>Best score</Text>
                          <Text style={[s.stageStatValue, {
                            color: series.best != null ? (series.best >= passPct ? C.success : series.best >= passPct - 10 ? C.warn : C.danger) : C.inkMuted,
                          }]}>{series.best != null ? `${series.best}%` : "—"}</Text>
                        </View>
                        {series.delta != null && (
                          <View style={s.stageStatRow}>
                            <Text style={s.stageStatLabel}>Trend (last 2)</Text>
                            <Text style={[s.stageStatValue, {
                              color: series.delta > 0 ? C.success : series.delta < 0 ? C.danger : C.inkMuted,
                            }]}>{series.delta > 0 ? `+${series.delta}%` : `${series.delta}%`}</Text>
                          </View>
                        )}
                        {/* Mini sparkline bar — best vs latest */}
                        {series.best != null && series.latest != null && (
                          <View style={{ marginTop: 6 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                              <Text style={{ fontSize: 6.5, color: C.inkMuted }}>0%</Text>
                              <Text style={{ fontSize: 6.5, color: C.inkMuted }}>100%</Text>
                            </View>
                            <View style={{ height: 4, backgroundColor: C.gray, borderRadius: 2, overflow: "hidden" }}>
                              <View style={{ height: 4, width: `${series.best}%`, backgroundColor: color, opacity: 0.35, borderRadius: 2 }} />
                            </View>
                            <View style={{ height: 4, backgroundColor: "transparent", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                              <View style={{ height: 4, backgroundColor: C.gray, borderRadius: 2, overflow: "hidden" }}>
                                <View style={{ height: 4, width: `${series.latest}%`, backgroundColor: color, borderRadius: 2 }} />
                              </View>
                            </View>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 1 }}>
                              <Text style={{ fontSize: 6, color: C.inkMuted }}>Best ▲</Text>
                              <Text style={{ fontSize: 6, color: C.inkMuted }}>Latest ▼</Text>
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          </View>

          {/* ── RECENT SESSION TIMELINE ── */}
          {timeline.length > 0 && (
            <View wrap={false}>
              <Text style={s.sectionTitle}>Recent Session Timeline</Text>
              <View style={s.timelineBox}>
                {timeline.map((pt, i) => {
                  const color = modeColor(pt.mode);
                  const isLast = i === timeline.length - 1;
                  const score = pt.score_pct;
                  return (
                    <View key={pt.id} style={[s.timelineRow, isLast ? s.timelineRowLast : {}]}>
                      <View style={[s.timelineDot, { backgroundColor: color }]} />
                      <Text style={[s.timelineMode, { color }]}>{modeLabel(pt.mode)}</Text>
                      <Text style={s.timelineDate}>{fmtDate(pt.started_at)}</Text>
                      {score != null ? (
                        <>
                          <View style={s.timelineBar}>
                            <View style={[s.timelineBarFill, {
                              width: `${score}%`,
                              backgroundColor: score >= passPct ? C.success : score >= passPct - 10 ? C.warn : C.danger,
                            }]} />
                          </View>
                          <Text style={[s.timelineScore, {
                            color: score >= passPct ? C.success : score >= passPct - 10 ? C.warn : C.danger,
                          }]}>{score}%</Text>
                        </>
                      ) : (
                        <Text style={[s.timelineScore, { color: C.inkMuted }]}>—</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── FINAL EXAM CONTEXT ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Final Exam Context</Text>
          <View style={{
            backgroundColor: C.surface,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: C.border,
            padding: 12,
          }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.national, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  National Portion
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontSize: 7.5, color: C.inkMuted }}>Score</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: nationalColor }}>{report.nationalPct}%</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontSize: 7.5, color: C.inkMuted }}>Correct</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink }}>{report.nationalCorrect}/{report.nationalTotal}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 7.5, color: C.inkMuted }}>Result</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: report.nationalPassed ? C.success : C.danger }}>
                    {report.nationalPassed ? "Cleared ✓" : "Not cleared ✗"}
                  </Text>
                </View>
              </View>
              <View style={{ width: 1, backgroundColor: C.border }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.state, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  SC State Portion
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontSize: 7.5, color: C.inkMuted }}>Score</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: stateColor }}>{report.statePct}%</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontSize: 7.5, color: C.inkMuted }}>Correct</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink }}>{report.stateCorrect}/{report.stateTotal}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 7.5, color: C.inkMuted }}>Result</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: report.statePassed ? C.success : C.danger }}>
                    {report.statePassed ? "Cleared ✓" : "Not cleared ✗"}
                  </Text>
                </View>
              </View>
              {probPct != null && (
                <>
                  <View style={{ width: 1, backgroundColor: C.border }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.inkMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Pass Probability
                    </Text>
                    <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: probPct >= 70 ? C.success : probPct >= 50 ? C.warn : C.danger }}>
                      {probPct}%
                    </Text>
                    <Text style={{ fontSize: 7, color: C.inkMuted, marginTop: 2, lineHeight: 1.4 }}>
                      Statistical estimate based on this session&apos;s per-portion accuracy
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
          </View>

        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SC Real Estate Prep · Final Test Report</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
