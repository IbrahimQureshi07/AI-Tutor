import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Circle,
} from "@react-pdf/renderer";
import type { AssessmentSummary } from "@/lib/assessment/summary";
import {
  donutArcStrokeDasharray,
  donutShowColoredArc,
} from "@/lib/pdf/donut-stroke";
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
  successBg: "#D6EDDF",
  warn: "#C48230",
  warnBg: "#F5E6CC",
  danger: "#AE3C22",
  dangerBg: "#F5D7CF",
  national: "#5C8DC4",
  state: "#7A5C9A",
  gray: "#E8E0D4",
  white: "#FFFFFF",
  lightBg: "#FAF7F2",
};

/* ─── Styles ─── */
const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingBottom: 60,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
  },

  /* Header */
  header: {
    backgroundColor: C.primary,
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
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.4,
  },
  reportBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  reportBadgeText: {
    fontSize: 7.5,
    color: C.white,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerDate: {
    fontSize: 8,
    color: "rgba(255,255,255,0.75)",
    textAlign: "right",
  },
  headerTagline: {
    marginTop: 10,
    fontSize: 8,
    color: "rgba(255,255,255,0.65)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 8,
  },

  /* Body */
  body: { paddingHorizontal: 28, paddingTop: 18 },

  /* Section title */
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

  /* ── Score overview ── */
  overviewRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  scoreBox: {
    width: 92,
    height: 92,
    alignItems: "center",
    position: "relative",
  },
  scoreInsideText: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scorePct: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  scoreSubLabel: {
    fontSize: 6.5,
    color: C.inkMuted,
    textAlign: "center",
  },

  statsCol: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 8, color: C.inkMuted, flex: 1 },
  statValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink, minWidth: 22, textAlign: "right" },
  statPct: { fontSize: 7, color: C.inkMuted, width: 28, textAlign: "right" },

  infoGrid: {
    width: 130,
    gap: 6,
  },
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: 5,
    padding: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoCardLabel: { fontSize: 6.5, color: C.inkMuted },
  infoCardValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 1 },
  infoCardValueSm: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 1 },

  /* ── Section comparison table ── */
  comparisonTable: {
    marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F0E8DE",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    alignItems: "center",
  },
  tableHeaderCell: {
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
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableRowAlt: {
    backgroundColor: C.lightBg,
  },
  colCode: { width: 28 },
  colName: { flex: 1 },
  colBar: { width: 80, marginHorizontal: 6 },
  colPct: { width: 32, textAlign: "right" },
  colMastered: { width: 32, textAlign: "right" },
  colMiss: { width: 28, textAlign: "right" },
  colGroup: { width: 40, textAlign: "center" },

  cellCode: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 3,
    textAlign: "center",
  },
  cellName: { fontSize: 8, color: C.ink },
  cellPct: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  cellSub: { fontSize: 7, color: C.inkMuted },
  cellGroup: {
    fontSize: 6.5,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    textAlign: "center",
  },

  progressTrack: {
    height: 6,
    backgroundColor: C.gray,
    borderRadius: 3,
    overflow: "hidden",
    flexDirection: "row",
  },
  progressSegment: { height: 6 },

  /* ── Portion cards ── */
  portionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  portionCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  portionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  portionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },
  portionBadge: {
    fontSize: 6.5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: "Helvetica-Bold",
  },
  portionPct: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  portionSub: { fontSize: 7, color: C.inkMuted },
  portionBar: {
    marginTop: 6,
    height: 5,
    backgroundColor: C.gray,
    borderRadius: 3,
    overflow: "hidden",
  },
  portionBarFill: { height: 5, borderRadius: 3 },

  /* ── Highlights ── */
  highlightsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 5,
  },
  highlightTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.inkMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#F2EBE0",
  },
  highlightRowLast: { borderBottomWidth: 0 },
  highlightCode: {
    fontSize: 7,
    color: C.primary,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    width: 22,
    textAlign: "center",
  },
  highlightName: { flex: 1, fontSize: 7.5, color: C.ink },
  highlightPct: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  /* ── Weak concepts ── */
  conceptsBox: {
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  conceptRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F2EBE0",
    gap: 7,
  },
  conceptNum: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#F5D7CF",
    alignItems: "center",
    justifyContent: "center",
  },
  conceptNumText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.danger,
    textAlign: "center",
  },
  conceptTitle: { flex: 1, fontSize: 8, color: C.ink },
  conceptSection: {
    fontSize: 7,
    color: C.primary,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    width: 24,
    textAlign: "center",
  },
  conceptAccuracy: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    width: 36,
    textAlign: "right",
  },

  /* ── Tutor letter ── */
  tutorBox: {
    backgroundColor: "#FFF9F5",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: C.border,
    borderLeftColor: C.primary,
    marginBottom: 16,
  },
  tutorText: { fontSize: 8, color: C.inkMuted, lineHeight: 1.6 },

  /* ── Sessions timeline ── */
  timelineBox: {
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    overflow: "hidden",
  },

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
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function accuracyColor(pct: number): string {
  if (pct >= 70) return C.success;
  if (pct >= 50) return C.warn;
  return C.danger;
}

function pctOf(part: number, total: number): number {
  const t = Math.max(total, 1);
  return Math.round((part / t) * 100);
}

function passProbColor(prob: number): string {
  if (prob >= 0.7) return C.success;
  if (prob >= 0.5) return C.warn;
  return C.danger;
}

/* Score donut */
function ScoreDonut({ pct }: { pct: number }) {
  const r = 38;
  const cx = 46;
  const cy = 46;
  const circ = 2 * Math.PI * r;
  const color = accuracyColor(pct);
  const coloredDash = donutArcStrokeDasharray(pct, circ);
  return (
    <View style={s.scoreBox}>
      <Svg width={92} height={92} viewBox="0 0 92 92">
        <Circle cx={cx} cy={cy} r={r} stroke={C.gray} strokeWidth={7} fill="none" />
        {donutShowColoredArc(pct) && (
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth={7}
            fill="none"
            {...(coloredDash ? { strokeDasharray: coloredDash } : {})}
            transform={`rotate(-90, ${cx}, ${cy})`}
          />
        )}
      </Svg>
      <View style={s.scoreInsideText}>
        <Text style={[s.scorePct, { color }]}>{pct}%</Text>
        <Text style={s.scoreSubLabel}>Accuracy</Text>
      </View>
    </View>
  );
}

/* Stacked progress bar: mastered (green) / soft (amber) / hard (red) */
function StackedBar({ mastered, soft, hard, total }: {
  mastered: number; soft: number; hard: number; total: number;
}) {
  if (!total) return <View style={s.progressTrack} />;
  const mPct = Math.max(0, (mastered / total) * 100);
  const sPct = Math.max(0, (soft / total) * 100);
  const hPct = Math.max(0, (hard / total) * 100);
  return (
    <View style={s.progressTrack}>
      {mPct > 0 && <View style={[s.progressSegment, { width: `${mPct}%`, backgroundColor: C.success }]} />}
      {sPct > 0 && <View style={[s.progressSegment, { width: `${sPct}%`, backgroundColor: C.warn }]} />}
      {hPct > 0 && <View style={[s.progressSegment, { width: `${hPct}%`, backgroundColor: C.danger }]} />}
    </View>
  );
}

/* ─── Types ─── */
export interface OverallAssessmentPdfProps {
  summary: AssessmentSummary;
  totalSessions: number;
  totalDurationMs: number;
  conceptTitles: Record<string, string>;
  tutorLetter: string | null;
  generatedAt?: string;
}

/* ─── Main PDF Document ─── */
export function OverallAssessmentPdf({
  summary,
  totalSessions,
  totalDurationMs,
  conceptTitles,
  tutorLetter,
  generatedAt,
}: OverallAssessmentPdfProps) {
  const dateStr =
    generatedAt ??
    new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const national = summary.predicted.national;
  const state = summary.predicted.state;
  const nationalSections = summary.sections.filter((s) => s.code.startsWith("A"));
  const stateSections = summary.sections.filter((s) => s.code.startsWith("B"));

  return (
    <Document
      title="Overall Assessment Report"
      author="SC Real Estate Prep"
      subject="SC Real Estate Full Assessment Overview"
    >
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.appName}>SC Real Estate Prep</Text>
              <View style={s.reportBadge}>
                <Text style={s.reportBadgeText}>Overall Assessment Report · All 12 Sections</Text>
              </View>
            </View>
            <Text style={s.headerDate}>Generated {dateStr}</Text>
          </View>
          <Text style={s.headerTagline}>
            Comprehensive diagnostic across all National + State sections · SC PSI Salesperson Exam
          </Text>
        </View>

        <View style={s.body}>

          {/* ── OVERALL PERFORMANCE ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Overall Performance</Text>
          <View style={s.overviewRow}>
            <ScoreDonut pct={summary.accuracy_pct} />

            <View style={s.statsCol}>
              <View style={s.statRow}>
                <View style={[s.statDot, { backgroundColor: C.success }]} />
                <Text style={s.statLabel}>Mastered (first try)</Text>
                <Text style={s.statValue}>{summary.mastered}</Text>
                <Text style={s.statPct}>{pctOf(summary.mastered, summary.total)}%</Text>
              </View>
              <View style={s.statRow}>
                <View style={[s.statDot, { backgroundColor: C.warn }]} />
                <Text style={s.statLabel}>Recovered (hint/retry)</Text>
                <Text style={s.statValue}>{summary.soft_miss}</Text>
                <Text style={s.statPct}>{pctOf(summary.soft_miss, summary.total)}%</Text>
              </View>
              <View style={s.statRow}>
                <View style={[s.statDot, { backgroundColor: C.danger }]} />
                <Text style={s.statLabel}>Hard miss (needs review)</Text>
                <Text style={s.statValue}>{summary.hard_miss}</Text>
                <Text style={s.statPct}>{pctOf(summary.hard_miss, summary.total)}%</Text>
              </View>
              <View style={[s.statRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border }]}>
                <Text style={[s.statLabel, { color: C.ink }]}>Effective score (mastered + recovered)</Text>
                <Text style={[s.statValue, { color: C.primary }]}>{summary.effective_pct}%</Text>
              </View>
            </View>

            <View style={s.infoGrid}>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Total Questions</Text>
                <Text style={s.infoCardValue}>{summary.total}</Text>
              </View>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Sessions Taken</Text>
                <Text style={s.infoCardValue}>{totalSessions}</Text>
              </View>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Total Study Time</Text>
                <Text style={s.infoCardValueSm}>{fmtMs(totalDurationMs)}</Text>
              </View>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Avg per Question</Text>
                <Text style={s.infoCardValueSm}>{fmtMs(summary.avg_time_ms)}</Text>
              </View>
            </View>
          </View>
          </View>

          {/* ── SECTION COMPARISON TABLE ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Section-by-Section Comparison</Text>

          {/* National */}
          <View style={[s.comparisonTable, { marginBottom: 8 }]}>
            <View style={s.tableHeader}>
              <View style={s.colGroup}><Text style={[s.tableHeaderCell, { color: C.national }]}>National</Text></View>
              <View style={s.colName}><Text style={s.tableHeaderCell}>Section</Text></View>
              <View style={s.colBar}><Text style={s.tableHeaderCell}>Breakdown</Text></View>
              <View style={s.colPct}><Text style={s.tableHeaderCell}>Accuracy</Text></View>
              <View style={s.colMastered}><Text style={s.tableHeaderCell}>✓</Text></View>
              <View style={s.colMiss}><Text style={s.tableHeaderCell}>✗</Text></View>
            </View>
            {nationalSections.map((sec, i) => {
              const color = accuracyColor(sec.accuracy);
              const isLast = i === nationalSections.length - 1;
              return (
                <View key={sec.code} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                  <View style={s.colGroup}>
                    <Text style={[s.cellGroup, { backgroundColor: "#DDE8F5", color: C.national }]}>Nat</Text>
                  </View>
                  <View style={s.colName}>
                    <Text style={s.cellName}>{formatSectionDisplayLabel(sec.code)}</Text>
                  </View>
                  <View style={s.colBar}>
                    <StackedBar mastered={sec.mastered} soft={sec.soft_miss} hard={sec.hard_miss} total={sec.total} />
                  </View>
                  <View style={s.colPct}>
                    <Text style={[s.cellPct, { color }]}>{sec.accuracy}%</Text>
                  </View>
                  <View style={s.colMastered}>
                    <Text style={[s.cellSub, { color: C.success }]}>{sec.mastered}</Text>
                  </View>
                  <View style={s.colMiss}>
                    <Text style={[s.cellSub, { color: C.danger }]}>{sec.hard_miss}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* State */}
          <View style={[s.comparisonTable, { marginBottom: 16 }]}>
            <View style={s.tableHeader}>
              <View style={s.colGroup}><Text style={[s.tableHeaderCell, { color: C.state }]}>State</Text></View>
              <View style={s.colName}><Text style={s.tableHeaderCell}>Section</Text></View>
              <View style={s.colBar}><Text style={s.tableHeaderCell}>Breakdown</Text></View>
              <View style={s.colPct}><Text style={s.tableHeaderCell}>Accuracy</Text></View>
              <View style={s.colMastered}><Text style={s.tableHeaderCell}>✓</Text></View>
              <View style={s.colMiss}><Text style={s.tableHeaderCell}>✗</Text></View>
            </View>
            {stateSections.map((sec, i) => {
              const color = accuracyColor(sec.accuracy);
              const isLast = i === stateSections.length - 1;
              return (
                <View key={sec.code} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                  <View style={s.colGroup}>
                    <Text style={[s.cellGroup, { backgroundColor: "#EDE5F5", color: C.state }]}>SC</Text>
                  </View>
                  <View style={s.colName}>
                    <Text style={s.cellName}>{formatSectionDisplayLabel(sec.code)}</Text>
                  </View>
                  <View style={s.colBar}>
                    <StackedBar mastered={sec.mastered} soft={sec.soft_miss} hard={sec.hard_miss} total={sec.total} />
                  </View>
                  <View style={s.colPct}>
                    <Text style={[s.cellPct, { color }]}>{sec.accuracy}%</Text>
                  </View>
                  <View style={s.colMastered}>
                    <Text style={[s.cellSub, { color: C.success }]}>{sec.mastered}</Text>
                  </View>
                  <View style={s.colMiss}>
                    <Text style={[s.cellSub, { color: C.danger }]}>{sec.hard_miss}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          </View>

          {/* ── EXAM PASS PREDICTION ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Exam Pass Prediction</Text>
          <View style={s.portionsRow}>
            {/* National */}
            <View style={s.portionCard}>
              <View style={s.portionHeader}>
                <Text style={s.portionLabel}>National Portion</Text>
                <Text style={[s.portionBadge, {
                  backgroundColor: "#DDE8F5",
                  color: C.national,
                }]}>80 Questions</Text>
              </View>
              <Text style={[s.portionPct, { color: passProbColor(national.pass_probability) }]}>
                {Math.round(national.pass_probability * 100)}%
              </Text>
              <Text style={s.portionSub}>
                pass probability · {national.accuracy_pct}% accuracy
              </Text>
              <View style={s.portionBar}>
                <View style={[s.portionBarFill, {
                  width: `${Math.round(national.pass_probability * 100)}%`,
                  backgroundColor: passProbColor(national.pass_probability),
                }]} />
              </View>
            </View>

            {/* State */}
            <View style={s.portionCard}>
              <View style={s.portionHeader}>
                <Text style={s.portionLabel}>State Portion</Text>
                <Text style={[s.portionBadge, {
                  backgroundColor: "#EDE5F5",
                  color: C.state,
                }]}>40 Questions</Text>
              </View>
              <Text style={[s.portionPct, { color: passProbColor(state.pass_probability) }]}>
                {Math.round(state.pass_probability * 100)}%
              </Text>
              <Text style={s.portionSub}>
                pass probability · {state.accuracy_pct}% accuracy
              </Text>
              <View style={s.portionBar}>
                <View style={[s.portionBarFill, {
                  width: `${Math.round(state.pass_probability * 100)}%`,
                  backgroundColor: passProbColor(state.pass_probability),
                }]} />
              </View>
            </View>

            {/* Combined */}
            <View style={[s.portionCard, { borderColor: C.primaryLight, borderWidth: 1.5 }]}>
              <View style={s.portionHeader}>
                <Text style={s.portionLabel}>Combined</Text>
                <Text style={[s.portionBadge, {
                  backgroundColor: C.primaryLight,
                  color: C.primary,
                }]}>Both Portions</Text>
              </View>
              <Text style={[s.portionPct, { color: passProbColor(summary.predicted.combined_probability) }]}>
                {Math.round(summary.predicted.combined_probability * 100)}%
              </Text>
              <Text style={s.portionSub}>chance of passing both</Text>
              <View style={s.portionBar}>
                <View style={[s.portionBarFill, {
                  width: `${Math.round(summary.predicted.combined_probability * 100)}%`,
                  backgroundColor: passProbColor(summary.predicted.combined_probability),
                }]} />
              </View>
            </View>
          </View>
          </View>

          {/* ── HIGHLIGHTS ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Section Highlights</Text>
          <View style={s.highlightsRow}>
            {/* Strongest sections */}
            <View wrap={false} style={s.highlightCard}>
              <Text style={s.highlightTitle}>Top Performing Sections</Text>
              {[...summary.sections]
                .filter(s => s.total > 0)
                .sort((a, b) => b.accuracy - a.accuracy)
                .slice(0, 4)
                .map((sec, i, arr) => (
                  <View key={sec.code} style={[s.highlightRow, i === arr.length - 1 ? s.highlightRowLast : {}]}>
                    <Text style={[s.highlightName, { flex: 1 }]}>
                      {formatSectionDisplayLabel(sec.code)}
                    </Text>
                    <Text style={[s.highlightPct, { color: C.success }]}>{sec.accuracy}%</Text>
                  </View>
                ))}
            </View>

            {/* Weakest sections */}
            <View wrap={false} style={s.highlightCard}>
              <Text style={s.highlightTitle}>Sections Needing Focus</Text>
              {[...summary.sections]
                .filter(s => s.total > 0)
                .sort((a, b) => a.accuracy - b.accuracy)
                .slice(0, 4)
                .map((sec, i, arr) => (
                  <View key={sec.code} style={[s.highlightRow, i === arr.length - 1 ? s.highlightRowLast : {}]}>
                    <Text style={[s.highlightName, { flex: 1 }]}>
                      {formatSectionDisplayLabel(sec.code)}
                    </Text>
                    <Text style={[s.highlightPct, { color: accuracyColor(sec.accuracy) }]}>{sec.accuracy}%</Text>
                  </View>
                ))}
            </View>
          </View>
          </View>

          {/* ── WEAK CONCEPTS ── */}
          {summary.weakest_concepts.length > 0 && (
            <View wrap={false}>
              <Text style={s.sectionTitle}>Top Concepts to Review</Text>
              <View style={s.conceptsBox}>
                {summary.weakest_concepts.slice(0, 6).map((c, i, arr) => {
                  const title = conceptTitles[c.concept_id] ?? c.concept_id.replace(/-/g, " ");
                  const acc = Math.round((c.mastered / Math.max(c.total, 1)) * 100);
                  return (
                    <View key={c.concept_id} style={[s.conceptRow, i === arr.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                      <View style={s.conceptNum}>
                        <Text style={s.conceptNumText}>{i + 1}</Text>
                      </View>
                      <Text style={s.conceptSection}>
                        {formatSectionDisplayLabel(c.section_code)}
                      </Text>
                      <Text style={s.conceptTitle}>{title}</Text>
                      <Text style={[s.conceptAccuracy, { color: accuracyColor(acc) }]}>
                        {acc}% ({c.mastered}/{c.total})
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── AI TUTOR LETTER ── */}
          {tutorLetter && (
            <View wrap={false}>
              <Text style={s.sectionTitle}>AI Tutor Feedback</Text>
              <View style={s.tutorBox}>
                <Text style={s.tutorText}>{tutorLetter.replace(/[*#`]/g, "").trim()}</Text>
              </View>
            </View>
          )}

        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SC Real Estate Prep · Overall Assessment Report · All 12 Sections</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
