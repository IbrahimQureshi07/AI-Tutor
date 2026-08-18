import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type { UserStats, SectionMastery } from "@/lib/kpi/stats";
import type { Journey } from "@/lib/journey/load";
import type { SessionHistoryRow } from "@/lib/admin/session-history";
import {
  buildFinishedTestScores,
  buildLifetimeMetrics,
  buildModeRunBreakdown,
  mergeJourneyScores,
} from "@/lib/admin/headline-metrics";

/* ─── Brand colours (mirror final-pdf) ─── */
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
  nationalLight: "#DDE8F5",
  state: "#7A5C9A",
  stateLight: "#EDE5F5",
  assessment: "#C15F3C",
  practice: "#5C8DC4",
  mistakes: "#C48230",
  mock: "#7A5C9A",
  final: "#3A7A50",
};

const PASS = 70;

const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingBottom: 60,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
  },
  header: { paddingHorizontal: 32, paddingTop: 22, paddingBottom: 18, backgroundColor: "#3B3530" },
  headerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  appName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.white, letterSpacing: 0.4 },
  headerSubtitle: { fontSize: 8, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  reportBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 5,
    alignSelf: "flex-start",
  },
  reportBadgeText: { fontSize: 7.5, color: C.white, letterSpacing: 1, textTransform: "uppercase" },
  headerDate: { fontSize: 8, color: "rgba(255,255,255,0.75)", textAlign: "right" },
  headerName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.white, marginTop: 10 },
  headerEmail: { fontSize: 8, color: "rgba(255,255,255,0.7)", marginTop: 2 },

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

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
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
  statSublabel: { fontSize: 6, color: C.inkMuted, marginTop: 1, textAlign: "center" },
  noteBox: {
    backgroundColor: "#FDF7EC",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E8D0A0",
    padding: 10,
    marginBottom: 12,
  },
  noteText: { fontSize: 7.5, color: C.inkMuted, lineHeight: 1.45 },

  sectionTable: {
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F0E8DE",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  thCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.inkMuted, letterSpacing: 0.5, textTransform: "uppercase" },
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
  colCode: { width: 30 },
  colName: { flex: 1 },
  colBar: { width: 80, marginHorizontal: 5 },
  colPct: { width: 34, textAlign: "right" },
  colQs: { width: 40, textAlign: "right" },
  cellCode: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    borderRadius: 3,
    textAlign: "center",
  },
  cellName: { fontSize: 8, color: C.ink },
  cellPct: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  cellSub: { fontSize: 7, color: C.inkMuted },
  progressTrack: { height: 5, backgroundColor: C.gray, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 3 },

  twoCol: { flexDirection: "row", gap: 10, marginBottom: 12 },
  listCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
  },
  listTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 6 },
  listRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  listLabel: { fontSize: 7.5, color: C.inkMuted, flex: 1, marginRight: 6 },
  listVal: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  listEmpty: { fontSize: 7.5, color: C.inkMuted, fontStyle: "italic" },

  finishedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F2EBE0",
  },
  finishedMode: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink, width: "28%" },
  finishedMeta: { fontSize: 7, color: C.inkMuted, width: "22%" },
  finishedScores: { flexDirection: "row", gap: 12, width: "50%", justifyContent: "flex-end" },
  finishedScoreLabel: { fontSize: 7, color: C.inkMuted },
  finishedScoreVal: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },

  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 4,
    backgroundColor: C.lightBg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  breakdownLeft: { flexDirection: "row", gap: 6, alignItems: "center", flex: 1 },
  breakdownMode: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.ink },
  breakdownType: {
    fontSize: 6.5,
    color: C.inkMuted,
    backgroundColor: C.gray,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    textTransform: "capitalize",
  },
  breakdownBadges: { flexDirection: "row", gap: 4 },
  badgeFinished: {
    fontSize: 6.5,
    color: C.success,
    backgroundColor: "#E8F3EC",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgePartial: {
    fontSize: 6.5,
    color: C.warn,
    backgroundColor: "#FDF4E8",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },

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

function accColor(pct: number, hasData = true): string {
  if (!hasData) return C.inkMuted;
  if (pct >= PASS) return C.success;
  if (pct >= 50) return C.warn;
  return C.danger;
}

function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return "0h";
  const h = ms / (60 * 60 * 1000);
  if (h < 1) return `${Math.round(ms / (60 * 1000))}m`;
  return `${h.toFixed(1)}h`;
}

export interface StudentReportPdfProps {
  student: {
    fullName: string | null;
    email: string | null;
    role: "student" | "admin";
    isActive: boolean;
    createdAt: string | null;
  };
  stats: UserStats;
  journey: Journey;
  sessions: SessionHistoryRow[];
  generatedAt?: string;
}

function SectionTable({
  title,
  rows,
  accent,
  accentLight,
}: {
  title: string;
  rows: SectionMastery[];
  accent: string;
  accentLight: string;
}) {
  if (rows.length === 0) return null;
  return (
    <View style={s.sectionTable}>
      <View style={s.tableHeader}>
        <View style={s.colCode}><Text style={[s.thCell, { color: accent }]}>Code</Text></View>
        <View style={s.colName}><Text style={s.thCell}>{title}</Text></View>
        <View style={s.colBar}><Text style={s.thCell}>Accuracy</Text></View>
        <View style={s.colPct}><Text style={s.thCell}>Score</Text></View>
        <View style={s.colQs}><Text style={s.thCell}>Qs</Text></View>
      </View>
      {rows.map((sec, i) => {
        const isLast = i === rows.length - 1;
        const hasData = sec.total > 0;
        const color = accColor(sec.accuracy, hasData);
        return (
          <View key={sec.code} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
            <View style={s.colCode}>
              <Text style={[s.cellCode, { backgroundColor: accentLight, color: accent }]}>{sec.code}</Text>
            </View>
            <View style={s.colName}><Text style={s.cellName}>{sec.title}</Text></View>
            <View style={s.colBar}>
              <View style={s.progressTrack}>
                {hasData && (
                  <View style={[s.progressFill, { width: `${Math.max(2, sec.accuracy)}%`, backgroundColor: color }]} />
                )}
              </View>
            </View>
            <View style={s.colPct}><Text style={[s.cellPct, { color }]}>{hasData ? `${sec.accuracy}%` : "—"}</Text></View>
            <View style={s.colQs}><Text style={s.cellSub}>{hasData ? `${sec.correct}/${sec.total}` : "0"}</Text></View>
          </View>
        );
      })}
    </View>
  );
}

export function StudentReportPdf({
  student,
  stats,
  journey,
  sessions,
  generatedAt,
}: StudentReportPdfProps) {
  const dateStr =
    generatedAt ??
    new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const national = stats.mastery.filter((m) => m.group === "National");
  const state = stats.mastery.filter((m) => m.group === "State");
  const coverage = stats.mastery.filter((m) => m.total > 0).length;
  const hasData = stats.totalAttempts > 0;
  const showQuestionOnlyNote =
    hasData && (stats.totalFinishedSessions ?? 0) === 0;

  const lifetime = buildLifetimeMetrics(stats, coverage);
  const finishedScores = mergeJourneyScores(
    buildFinishedTestScores(sessions),
    journey,
  );
  const runBreakdown = buildModeRunBreakdown(sessions);

  return (
    <Document title="Student Report Card" author="SC Real Estate Prep" subject="Student progress report">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.appName}>SC Real Estate Prep</Text>
              <Text style={s.headerSubtitle}>Student Report Card</Text>
              <View style={s.reportBadge}>
                <Text style={s.reportBadgeText}>
                  {student.isActive ? "Active account" : "Deactivated"}
                  {student.role === "admin" ? " · Admin" : ""}
                </Text>
              </View>
            </View>
            <Text style={s.headerDate}>Generated {dateStr}</Text>
          </View>
          <Text style={s.headerName}>{student.fullName || "Unnamed user"}</Text>
          <Text style={s.headerEmail}>{student.email ?? "—"}</Text>
        </View>

        <View style={s.body}>
          <View wrap={false}>
          <Text style={s.sectionTitle}>Lifetime · All Question Attempts</Text>
          <Text style={[s.noteText, { marginBottom: 8 }]}>
            Every question answered — smoke, partial, or complete. Not finished exam scores.
          </Text>
          {showQuestionOnlyNote && (
            <View style={s.noteBox}>
              <Text style={s.noteText}>
                No completed exam sessions yet — accuracy is from individual questions only,
                not a finished test score.
              </Text>
            </View>
          )}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{lifetime.totalQuestions}</Text>
              <Text style={s.statLabel}>Questions{"\n"}Attempted</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: accColor(lifetime.accuracy, hasData) }]}>
                {hasData ? `${lifetime.accuracy}%` : "—"}
              </Text>
              <Text style={s.statLabel}>Lifetime{"\n"}Accuracy</Text>
              <Text style={s.statSublabel}>{lifetime.totalCorrect} correct</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: accColor(lifetime.sevenDayAccuracy, hasData) }]}>
                {hasData ? `${lifetime.sevenDayAccuracy}%` : "—"}
              </Text>
              <Text style={s.statLabel}>7-Day{"\n"}Accuracy</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{coverage}/{stats.mastery.length}</Text>
              <Text style={s.statLabel}>Section{"\n"}Coverage</Text>
            </View>
          </View>

          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: accColor(lifetime.readinessScore, hasData) }]}>
                {lifetime.readinessScore}%
              </Text>
              <Text style={s.statLabel}>Readiness{"\n"}Estimate</Text>
              {showQuestionOnlyNote && (
                <Text style={s.statSublabel}>from question attempts</Text>
              )}
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: lifetime.openMistakes > 0 ? C.warn : C.ink }]}>
                {lifetime.openMistakes}
              </Text>
              <Text style={s.statLabel}>Open{"\n"}Mistakes</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{lifetime.activeDaysLast30}</Text>
              <Text style={s.statLabel}>Active Days{"\n"}(30d)</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{fmtMs(lifetime.studyMsLast30)}</Text>
              <Text style={s.statLabel}>Study Time{"\n"}(30d)</Text>
            </View>
          </View>
          </View>

          <View wrap={false}>
          <Text style={s.sectionTitle}>Finished Test Scores</Text>
          <Text style={[s.noteText, { marginBottom: 8 }]}>
            Only sessions with status = finished. Partial or in-progress runs excluded.
          </Text>
          {(stats.totalFinishedSessions ?? 0) === 0 ? (
            <Text style={[s.listEmpty, { marginBottom: 12 }]}>No finished exam sessions yet.</Text>
          ) : (
            <View style={{ marginBottom: 12 }}>
              {finishedScores.map((row) => (
                <View key={row.mode} style={s.finishedRow}>
                  <Text style={s.finishedMode}>{row.label}</Text>
                  <Text style={s.finishedMeta}>
                    {row.finishedCount > 0
                      ? `${row.finishedCount} finished`
                      : "no finished runs"}
                  </Text>
                  <View style={s.finishedScores}>
                    <Text style={s.finishedScoreLabel}>
                      Latest{" "}
                      <Text style={[s.finishedScoreVal, { color: accColor(row.latest ?? 0, row.latest != null) }]}>
                        {row.latest != null ? `${row.latest}%` : "—"}
                      </Text>
                    </Text>
                    <Text style={s.finishedScoreLabel}>
                      Best{" "}
                      <Text style={s.finishedScoreVal}>
                        {row.best != null ? `${row.best}%` : "—"}
                      </Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          </View>

          <View wrap={false}>
          <Text style={s.sectionTitle}>Session Breakdown by Mode & Type</Text>
          <Text style={[s.noteText, { marginBottom: 8 }]}>
            Run counts by mode and type (smoke, full, etc.) — finished vs partial.
          </Text>
          {runBreakdown.length === 0 ? (
            <Text style={[s.listEmpty, { marginBottom: 12 }]}>No sessions recorded yet.</Text>
          ) : (
            <View style={{ marginBottom: 12 }}>
              {runBreakdown.map((row) => (
                <View key={`${row.mode}-${row.runType}`} style={s.breakdownRow}>
                  <View style={s.breakdownLeft}>
                    <Text style={s.breakdownMode}>{row.modeLabel}</Text>
                    <Text style={s.breakdownType}>{row.runTypeLabel}</Text>
                  </View>
                  <View style={s.breakdownBadges}>
                    {row.finished > 0 && (
                      <Text style={s.badgeFinished}>{row.finished} finished</Text>
                    )}
                    {row.partial > 0 && (
                      <Text style={s.badgePartial}>{row.partial} partial</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>SC Real Estate Prep · Student Report Card</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <View wrap={false}>
          <Text style={[s.sectionTitle, { marginTop: 18 }]}>Section-by-Section Breakdown</Text>
          <Text style={[s.noteText, { marginBottom: 8 }]}>
            Per-section lifetime question accuracy (any mode).
          </Text>
          <SectionTable title="National Section" rows={national} accent={C.national} accentLight={C.nationalLight} />
          <SectionTable title="SC State Section" rows={state} accent={C.state} accentLight={C.stateLight} />
          </View>

          <View wrap={false}>
          <View style={s.twoCol}>
            <View style={s.listCard}>
              <Text style={[s.listTitle, { color: C.success }]}>Top Strengths</Text>
              {stats.topStrengths.length === 0 ? (
                <Text style={s.listEmpty}>No attempts yet.</Text>
              ) : (
                stats.topStrengths.map((m) => (
                  <View key={m.code} style={s.listRow}>
                    <Text style={s.listLabel}>{m.code} · {m.title}</Text>
                    <Text style={[s.listVal, { color: accColor(m.accuracy) }]}>{m.accuracy}%</Text>
                  </View>
                ))
              )}
            </View>
            <View style={s.listCard}>
              <Text style={[s.listTitle, { color: C.danger }]}>Needs Work</Text>
              {stats.topWeaknesses.length === 0 ? (
                <Text style={s.listEmpty}>No attempts yet.</Text>
              ) : (
                stats.topWeaknesses.map((m) => (
                  <View key={m.code} style={s.listRow}>
                    <Text style={s.listLabel}>{m.code} · {m.title}</Text>
                    <Text style={[s.listVal, { color: accColor(m.accuracy) }]}>{m.accuracy}%</Text>
                  </View>
                ))
              )}
            </View>
          </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>SC Real Estate Prep · Student Report Card</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
