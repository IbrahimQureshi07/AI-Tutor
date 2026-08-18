import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  SectionRow,
  DifficultyBlock,
  Verdict,
  Calibration,
} from "@/components/mock/mock-report";
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
  warn: "#C48230",
  danger: "#AE3C22",
  gray: "#E8E0D4",
  white: "#FFFFFF",
  lightBg: "#FAF7F2",
  national: "#5C8DC4",
  state: "#7A5C9A",
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
  headerDate: { fontSize: 8, color: "rgba(255,255,255,0.75)", textAlign: "right" },
  headerTagline: {
    marginTop: 10,
    fontSize: 8,
    color: "rgba(255,255,255,0.65)",
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
  heroRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  heroScoreBlock: { alignItems: "center", justifyContent: "center", width: 100 },
  heroScoreNum: {
    fontSize: 44,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
    textAlign: "center",
  },
  heroScorePct: { fontSize: 16, color: C.inkMuted },
  heroVerdict: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "center",
  },
  heroVerdictText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  heroDetails: { flex: 1, justifyContent: "center", gap: 5 },
  heroDetailRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  heroDetailLabel: { fontSize: 7.5, color: C.inkMuted, width: 90 },
  heroDetailValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },

  /* ── Portion cards ── */
  portionsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
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
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  portionScore: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  portionSub: { fontSize: 7, color: C.inkMuted, marginTop: 2 },
  portionBar: {
    marginTop: 7,
    height: 5,
    backgroundColor: C.gray,
    borderRadius: 3,
    overflow: "hidden",
    position: "relative",
  },
  portionBarFill: { height: 5, borderRadius: 3 },
  portionPassLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: C.ink,
    opacity: 0.4,
  },

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

  colGroup: { width: 32 },
  colCode: { width: 26 },
  colName: { flex: 1 },
  colBar: { width: 70, marginHorizontal: 5 },
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

  /* ── Difficulty ── */
  diffRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  diffCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  diffHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  diffLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },
  diffPct: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  diffSub: { fontSize: 7, color: C.inkMuted, marginTop: 2 },
  diffBar: { marginTop: 6, height: 5, backgroundColor: C.gray, borderRadius: 3, overflow: "hidden" },
  diffBarFill: { height: 5, borderRadius: 3 },

  /* ── Verdict ── */
  verdictCard: {
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  verdictTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 4 },
  verdictText: { fontSize: 8, color: C.inkMuted, lineHeight: 1.5 },
  verdictList: { marginTop: 4, gap: 3 },
  verdictItem: { flexDirection: "row", gap: 4, alignItems: "flex-start" },
  verdictBullet: { fontSize: 8, color: C.primary, width: 8 },
  verdictItemText: { fontSize: 8, color: C.inkMuted, flex: 1 },

  /* ── AI note ── */
  aiNoteBox: {
    backgroundColor: "#FFF9F5",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: C.border,
    borderLeftColor: C.primary,
    marginBottom: 16,
  },
  aiNoteText: { fontSize: 8, color: C.inkMuted, lineHeight: 1.6 },

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
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function pctRound(c: number, t: number) {
  return t > 0 ? Math.round((c / t) * 100) : 0;
}

function scoreColor(pct: number, passPct: number): string {
  if (pct >= passPct) return C.success;
  if (pct >= passPct - 10) return C.warn;
  return C.danger;
}

function accuracyColor(pct: number): string {
  if (pct >= 70) return C.success;
  if (pct >= 50) return C.warn;
  return C.danger;
}

function difficultyColor(level: string): string {
  return level === "easy" ? C.success : level === "medium" ? C.warn : C.danger;
}

/* ─── Types ─── */
export interface MockPdfProps {
  sessionId: string;
  score: number;
  total: number;
  correct: number;
  durationMs: number;
  passPct: number;
  length: "full" | "smoke";
  nationalCorrect: number;
  nationalTotal: number;
  stateCorrect: number;
  stateTotal: number;
  sections: SectionRow[];
  difficulty: DifficultyBlock;
  verdict: Verdict;
  calibration: Calibration;
  aiNote: string;
  generatedAt?: string;
}

/* ─── Main Document ─── */
export function MockPdf({
  score,
  total,
  correct,
  durationMs,
  passPct,
  length,
  nationalCorrect,
  nationalTotal,
  stateCorrect,
  stateTotal,
  sections,
  difficulty,
  verdict,
  calibration,
  aiNote,
  generatedAt,
}: MockPdfProps) {
  const passed = score >= passPct;
  const dateStr =
    generatedAt ??
    new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const nationalPct = pctRound(nationalCorrect, nationalTotal);
  const statePct = pctRound(stateCorrect, stateTotal);

  const nationalSections = sections.filter((s) => s.group === "National");
  const stateSections = sections.filter((s) => s.group === "State");

  const headerBg = passed ? "#2D6B47" : C.primary;

  /* Verdict description */
  let verdictTitle = "";
  let verdictItems: string[] = [];
  if (verdict.kind === "pass") {
    verdictTitle = `Passed with ${verdict.margin}% margin above the pass line`;
    verdictItems = verdict.tighten.length
      ? verdict.tighten.map((s) => `Tighten up: ${s}`)
      : ["Strong performance — maintain this consistency."];
  } else if (verdict.kind === "close") {
    verdictTitle = `${verdict.gap}% below the pass line — very close`;
    verdictItems = verdict.fixSections.map((s) => `Focus on: ${s}`);
  } else {
    verdictTitle = `${verdict.gap}% below the pass line — more practice needed`;
    verdictItems = verdict.leaks.map((s) => `Key gap: ${s}`);
  }

  return (
    <Document
      title="Mock Exam Report"
      author="SC Real Estate Prep"
      subject="SC Real Estate Mock Exam Results"
    >
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={[s.header, { backgroundColor: headerBg }]}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.appName}>SC Real Estate Prep</Text>
              <View style={s.reportBadge}>
                <Text style={s.reportBadgeText}>
                  Mock Exam Report · {length === "smoke" ? "Smoke Test" : "Full Exam"}
                </Text>
              </View>
            </View>
            <Text style={s.headerDate}>Generated {dateStr}</Text>
          </View>
          <Text style={s.headerTagline}>
            {length === "full"
              ? `${nationalTotal}Q National + ${stateTotal}Q State · Pass line: ${passPct}% · SC PSI Salesperson format`
              : `Smoke test · ${total} questions · Pass line: ${passPct}%`}
          </Text>
        </View>

        <View style={s.body}>

          {/* ── SCORE HERO ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Exam Result</Text>
          <View style={s.heroRow}>
            <View style={s.heroScoreBlock}>
              <Text style={[s.heroScoreNum, { color: scoreColor(score, passPct) }]}>
                {score}<Text style={s.heroScorePct}>%</Text>
              </Text>
              <View style={[s.heroVerdict, { backgroundColor: passed ? "#D6EDDF" : "#F5D7CF" }]}>
                <Text style={[s.heroVerdictText, { color: passed ? C.success : C.danger }]}>
                  {passed ? "PASSED" : "NOT YET"}
                </Text>
              </View>
            </View>

            <View style={s.heroDetails}>
              <View style={s.heroDetailRow}>
                <Text style={s.heroDetailLabel}>Correct answers</Text>
                <Text style={s.heroDetailValue}>{correct} / {total}</Text>
              </View>
              <View style={s.heroDetailRow}>
                <Text style={s.heroDetailLabel}>Pass line</Text>
                <Text style={s.heroDetailValue}>{passPct}%</Text>
              </View>
              <View style={s.heroDetailRow}>
                <Text style={s.heroDetailLabel}>
                  {passed ? "Margin above pass" : "Gap to pass"}
                </Text>
                <Text style={[s.heroDetailValue, { color: passed ? C.success : C.danger }]}>
                  {passed
                    ? `+${score - passPct}%`
                    : `-${passPct - score}%`}
                </Text>
              </View>
              <View style={s.heroDetailRow}>
                <Text style={s.heroDetailLabel}>Time taken</Text>
                <Text style={s.heroDetailValue}>{fmtMs(durationMs)}</Text>
              </View>
              {calibration.predicted != null && (
                <View style={s.heroDetailRow}>
                  <Text style={s.heroDetailLabel}>Model prediction</Text>
                  <Text style={[s.heroDetailValue, {
                    color: calibration.kind === "calibrated"
                      ? C.success
                      : calibration.kind === "overestimated"
                        ? C.danger
                        : C.warn,
                  }]}>
                    {calibration.predicted}% predicted · {
                      calibration.kind === "calibrated" ? "well calibrated"
                      : calibration.kind === "overestimated" ? "model was optimistic"
                      : "exceeded prediction"
                    }
                  </Text>
                </View>
              )}
            </View>
          </View>
          </View>

          {/* ── PORTION BREAKDOWN ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>National vs State Breakdown</Text>
          <View style={s.portionsRow}>
            {/* National */}
            <View style={[s.portionCard, { borderTopWidth: 3, borderTopColor: C.national }]}>
              <View style={s.portionHeader}>
                <Text style={s.portionLabel}>National Portion</Text>
                <Text style={[s.portionBadge, { backgroundColor: "#DDE8F5", color: C.national }]}>
                  {nationalTotal} Questions
                </Text>
              </View>
              <Text style={[s.portionScore, { color: scoreColor(nationalPct, passPct) }]}>
                {nationalPct}%
              </Text>
              <Text style={s.portionSub}>
                {nationalCorrect} / {nationalTotal} correct
                {nationalPct >= passPct ? " · CLEARED" : ` · ${passPct - nationalPct}% to pass`}
              </Text>
              <View style={s.portionBar}>
                <View style={[s.portionBarFill, {
                  width: `${nationalPct}%`,
                  backgroundColor: scoreColor(nationalPct, passPct),
                }]} />
                <View style={[s.portionPassLine, { left: `${passPct}%` }]} />
              </View>
            </View>

            {/* State */}
            <View style={[s.portionCard, { borderTopWidth: 3, borderTopColor: C.state }]}>
              <View style={s.portionHeader}>
                <Text style={s.portionLabel}>State (SC) Portion</Text>
                <Text style={[s.portionBadge, { backgroundColor: "#EDE5F5", color: C.state }]}>
                  {stateTotal} Questions
                </Text>
              </View>
              <Text style={[s.portionScore, { color: scoreColor(statePct, passPct) }]}>
                {statePct}%
              </Text>
              <Text style={s.portionSub}>
                {stateCorrect} / {stateTotal} correct
                {statePct >= passPct ? " · CLEARED" : ` · ${passPct - statePct}% to pass`}
              </Text>
              <View style={s.portionBar}>
                <View style={[s.portionBarFill, {
                  width: `${statePct}%`,
                  backgroundColor: scoreColor(statePct, passPct),
                }]} />
                <View style={[s.portionPassLine, { left: `${passPct}%` }]} />
              </View>
            </View>
          </View>
          </View>

          {/* ── SECTION TABLE ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Section-by-Section Breakdown</Text>

          {/* National sections */}
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
                const color = accuracyColor(sec.accuracyPct);
                return (
                  <View key={sec.code} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                    <View style={s.colGroup}>
                      <Text style={[s.cellGroup, { backgroundColor: "#DDE8F5", color: C.national }]}>Nat</Text>
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

          {/* State sections */}
          {stateSections.length > 0 && (
            <View style={[s.sectionTable, { marginBottom: 16 }]}>
              <View style={s.tableHeader}>
                <View style={s.colGroup}><Text style={[s.thCell, { color: C.state }]}>SC</Text></View>
                <View style={s.colName}><Text style={s.thCell}>Section</Text></View>
                <View style={s.colBar}><Text style={s.thCell}>Accuracy</Text></View>
                <View style={s.colPct}><Text style={s.thCell}>Score</Text></View>
                <View style={s.colQs}><Text style={s.thCell}>Qs</Text></View>
              </View>
              {stateSections.map((sec, i) => {
                const isLast = i === stateSections.length - 1;
                const color = accuracyColor(sec.accuracyPct);
                return (
                  <View key={sec.code} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                    <View style={s.colGroup}>
                      <Text style={[s.cellGroup, { backgroundColor: "#EDE5F5", color: C.state }]}>SC</Text>
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

          {/* ── DIFFICULTY ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Performance by Difficulty</Text>
          <View style={s.diffRow}>
            {(["easy", "medium", "hard"] as const).map((level) => {
              const d = difficulty[level];
              const pct = pctRound(d.correct, d.total);
              const color = d.total ? accuracyColor(pct) : C.inkMuted;
              return (
                <View key={level} style={s.diffCard}>
                  <View style={s.diffHeader}>
                    <Text style={s.diffLabel}>{level.charAt(0).toUpperCase() + level.slice(1)}</Text>
                    <Text style={[s.cellSub, { color: difficultyColor(level) }]}>{d.total} Qs</Text>
                  </View>
                  <Text style={[s.diffPct, { color }]}>{d.total ? `${pct}%` : "—"}</Text>
                  <Text style={s.diffSub}>{d.correct}/{d.total} correct</Text>
                  <View style={s.diffBar}>
                    {d.total > 0 && (
                      <View style={[s.diffBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          </View>

          {/* ── VERDICT ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Verdict & Next Steps</Text>
          <View style={[s.verdictCard, {
            borderColor: passed ? "#B0D8BE" : verdict.kind === "close" ? "#E8D0A0" : "#EAB8A8",
            backgroundColor: passed ? "#F2FAF5" : verdict.kind === "close" ? "#FDF7EC" : "#FDF3F0",
          }]}>
            <Text style={[s.verdictTitle, { color: passed ? C.success : C.danger }]}>
              {verdictTitle}
            </Text>
            {verdictItems.length > 0 && (
              <View style={s.verdictList}>
                {verdictItems.slice(0, 5).map((item, i) => (
                  <View key={i} style={s.verdictItem}>
                    <Text style={s.verdictBullet}>›</Text>
                    <Text style={s.verdictItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          </View>

          {/* ── AI NOTE ── */}
          {aiNote && aiNote.length > 10 && (
            <View wrap={false}>
              <Text style={s.sectionTitle}>AI Tutor Feedback</Text>
              <View style={s.aiNoteBox}>
                <Text style={s.aiNoteText}>{aiNote.replace(/[*#`]/g, "").trim()}</Text>
              </View>
            </View>
          )}

        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SC Real Estate Prep · Mock Exam Report</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
