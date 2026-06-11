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
    paddingBottom: 44,
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

  modeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  modeCard: {
    width: "31.5%",
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  modeHeader: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modeTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.white },
  modeCount: { fontSize: 6.5, color: "rgba(255,255,255,0.85)" },
  modeBody: { paddingHorizontal: 8, paddingVertical: 6, gap: 3 },
  modeStatRow: { flexDirection: "row", justifyContent: "space-between" },
  modeStatLabel: { fontSize: 7, color: C.inkMuted },
  modeStatValue: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },

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

function modeColor(mode: string): string {
  switch (mode) {
    case "assessment": return C.assessment;
    case "practice": return C.practice;
    case "mistakes": return C.mistakes;
    case "mock": return C.mock;
    case "final": return C.final;
    default: return C.primary;
  }
}

const MODE_LABELS: Record<string, string> = {
  assessment: "Assessment",
  practice: "Practice",
  mistakes: "Mistakes",
  mock: "Mock Exam",
  final: "Final Test",
};

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

  const modes: Array<"assessment" | "practice" | "mistakes" | "mock" | "final"> = [
    "assessment",
    "practice",
    "mistakes",
    "mock",
    "final",
  ];

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
          <Text style={s.sectionTitle}>Performance Overview</Text>
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: accColor(stats.readinessScore, hasData) }]}>
                {stats.readinessScore}%
              </Text>
              <Text style={s.statLabel}>Readiness</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: accColor(stats.overallAccuracy, hasData) }]}>
                {hasData ? `${stats.overallAccuracy}%` : "—"}
              </Text>
              <Text style={s.statLabel}>Overall{"\n"}Accuracy</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{coverage}/{stats.mastery.length}</Text>
              <Text style={s.statLabel}>Sections{"\n"}Covered</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: stats.unresolvedMistakes > 0 ? C.warn : C.ink }]}>
                {stats.unresolvedMistakes}
              </Text>
              <Text style={s.statLabel}>Open{"\n"}Mistakes</Text>
            </View>
          </View>

          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{stats.totalAttempts}</Text>
              <Text style={s.statLabel}>Total{"\n"}Attempts</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: accColor(stats.sevenDayAccuracy, hasData) }]}>
                {stats.sevenDayAccuracy}%
              </Text>
              <Text style={s.statLabel}>7-Day{"\n"}Accuracy</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{stats.activeDaysLast30}</Text>
              <Text style={s.statLabel}>Active Days{"\n"}(30d)</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{fmtMs(stats.studyMsLast30)}</Text>
              <Text style={s.statLabel}>Study Time{"\n"}(30d)</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>Mode Progress</Text>
          <View style={s.modeGrid}>
            {modes.map((m) => {
              const color = modeColor(m);
              const completed = stats.modeTotals?.[m] ?? 0;
              const series = m === "final" ? undefined : journey.perMode?.[m];
              const latest = series?.latest ?? (m === "mock" ? stats.lastMockScore : null);
              const best = series?.best ?? (m === "mock" ? stats.bestMockScore : null);
              return (
                <View key={m} style={s.modeCard}>
                  <View style={[s.modeHeader, { backgroundColor: color }]}>
                    <Text style={s.modeTitle}>{MODE_LABELS[m]}</Text>
                    <Text style={s.modeCount}>{completed} done</Text>
                  </View>
                  <View style={s.modeBody}>
                    <View style={s.modeStatRow}>
                      <Text style={s.modeStatLabel}>Latest</Text>
                      <Text style={[s.modeStatValue, { color: accColor(latest ?? 0, latest != null) }]}>
                        {latest != null ? `${latest}%` : "—"}
                      </Text>
                    </View>
                    <View style={s.modeStatRow}>
                      <Text style={s.modeStatLabel}>Best</Text>
                      <Text style={[s.modeStatValue, { color: C.ink }]}>
                        {best != null ? `${best}%` : "—"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={s.sectionTitle}>Section-by-Section Breakdown</Text>
          <SectionTable title="National Section" rows={national} accent={C.national} accentLight={C.nationalLight} />
          <SectionTable title="SC State Section" rows={state} accent={C.state} accentLight={C.stateLight} />

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

        <View style={s.footer} fixed>
          <Text style={s.footerText}>SC Real Estate Prep · Student Report Card</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
