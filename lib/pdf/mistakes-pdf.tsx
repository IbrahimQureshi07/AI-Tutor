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
import type { MistakesStats } from "@/lib/mistakes/results";
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
  warn: "#C48230",
  danger: "#AE3C22",
  gray: "#E8E0D4",
  white: "#FFFFFF",
  lightBg: "#FAF7F2",
};

const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingBottom: 60,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
  },

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

  /* ── Overview ── */
  overviewRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  scoreBox: { width: 92, height: 92, alignItems: "center", position: "relative" },
  scoreInsideText: {
    position: "absolute",
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    top: 0,
    left: 0,
  },
  scorePct: { fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "center" },
  scoreSubLabel: { fontSize: 6.5, color: C.inkMuted, textAlign: "center" },

  statsCol: { flex: 1, justifyContent: "center", gap: 7 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 8, color: C.inkMuted, flex: 1 },
  statValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink, minWidth: 22, textAlign: "right" },
  statPct: { fontSize: 7, color: C.inkMuted, width: 28, textAlign: "right" },

  infoGrid: { width: 130, gap: 6 },
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

  /* ── KPI row ── */
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 9,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  kpiLabel: { fontSize: 7, color: C.inkMuted, textAlign: "center", marginBottom: 3 },
  kpiValue: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center" },
  kpiSub: { fontSize: 6.5, color: C.inkMuted, textAlign: "center", marginTop: 2 },

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

  colCode: { width: 28 },
  colName: { flex: 1 },
  colBar: { width: 80, marginHorizontal: 6 },
  colPct: { width: 36, textAlign: "right" },
  colQs: { width: 28, textAlign: "right" },

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

  progressTrack: { height: 6, backgroundColor: C.gray, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },

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
  diffHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  diffLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },
  diffPct: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  diffSub: { fontSize: 7, color: C.inkMuted, marginTop: 2 },
  diffBar: { marginTop: 6, height: 5, backgroundColor: C.gray, borderRadius: 3, overflow: "hidden" },
  diffBarFill: { height: 5, borderRadius: 3 },

  /* ── Speed ── */
  speedRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  speedCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  speedLabel: { fontSize: 7.5, color: C.inkMuted, marginBottom: 3 },
  speedValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  speedSub: { fontSize: 7, color: C.inkMuted, marginTop: 2 },

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

function accuracyColor(pct: number): string {
  if (pct >= 70) return C.success;
  if (pct >= 50) return C.warn;
  return C.danger;
}

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
        <Text style={s.scoreSubLabel}>Recovered</Text>
      </View>
    </View>
  );
}

/* ─── Types ─── */
export interface MistakesPdfProps {
  stats: MistakesStats;
  sessionId: string;
  durationMs: number;
  aiNote: string;
  generatedAt?: string;
}

/* ─── Main Document ─── */
export function MistakesPdf({
  stats,
  durationMs,
  aiNote,
  generatedAt,
}: MistakesPdfProps) {
  const dateStr =
    generatedAt ??
    new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const diffColor = (level: string) =>
    level === "easy" ? C.success : level === "medium" ? C.warn : C.danger;

  const leakPct = stats.total
    ? Math.round((stats.still_leaking / stats.total) * 100)
    : 0;

  return (
    <Document
      title="Mistakes Drill Report"
      author="SC Real Estate Prep"
      subject="SC Real Estate Mistakes Drill Results"
    >
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.appName}>SC Real Estate Prep</Text>
              <View style={s.reportBadge}>
                <Text style={s.reportBadgeText}>Mistakes Drill Report</Text>
              </View>
            </View>
            <Text style={s.headerDate}>Generated {dateStr}</Text>
          </View>
          <Text style={s.headerTagline}>
            Targeted re-drill of previously missed questions · {stats.total} resurfaced · SC PSI Salesperson Exam preparation
          </Text>
        </View>

        <View style={s.body}>

          {/* ── OVERALL PERFORMANCE ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Overall Recovery Performance</Text>
          <View style={s.overviewRow}>
            <ScoreDonut pct={stats.accuracy_pct} />

            <View style={s.statsCol}>
              <View style={s.statRow}>
                <View style={[s.statDot, { backgroundColor: C.success }]} />
                <Text style={s.statLabel}>Recovered (correct this time)</Text>
                <Text style={s.statValue}>{stats.recovered}</Text>
                <Text style={s.statPct}>{stats.accuracy_pct}%</Text>
              </View>
              <View style={s.statRow}>
                <View style={[s.statDot, { backgroundColor: C.danger }]} />
                <Text style={s.statLabel}>Still leaking (missed again)</Text>
                <Text style={s.statValue}>{stats.still_leaking}</Text>
                <Text style={s.statPct}>{leakPct}%</Text>
              </View>
              <View style={s.statRow}>
                <View style={[s.statDot, { backgroundColor: C.warn }]} />
                <Text style={s.statLabel}>Hints used</Text>
                <Text style={s.statValue}>{stats.hint_count}</Text>
                <Text style={s.statPct}>{stats.hint_pct}%</Text>
              </View>
              <View style={[s.statRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border }]}>
                <Text style={[s.statLabel, { color: C.ink }]}>Total questions drilled</Text>
                <Text style={[s.statValue, { color: C.primary }]}>{stats.total}</Text>
              </View>
            </View>

            <View style={s.infoGrid}>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Total Drilled</Text>
                <Text style={s.infoCardValue}>{stats.total}</Text>
              </View>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Time Spent</Text>
                <Text style={s.infoCardValueSm}>{fmtMs(durationMs || stats.total_time_ms)}</Text>
              </View>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Avg per Question</Text>
                <Text style={s.infoCardValueSm}>{fmtMs(stats.avg_time_ms)}</Text>
              </View>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Hints Used</Text>
                <Text style={s.infoCardValue}>{stats.hint_count}</Text>
              </View>
            </View>
          </View>
          </View>

          {/* ── KPI CARDS ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Key Metrics</Text>
          <View style={s.kpiRow}>
            <View style={[s.kpiCard, { borderColor: stats.accuracy_pct >= 70 ? C.success : C.border }]}>
              <Text style={s.kpiLabel}>Recovery Rate</Text>
              <Text style={[s.kpiValue, { color: accuracyColor(stats.accuracy_pct) }]}>
                {stats.accuracy_pct}%
              </Text>
              <Text style={s.kpiSub}>{stats.recovered} of {stats.total} fixed</Text>
            </View>
            <View style={[s.kpiCard, { borderColor: leakPct === 0 ? C.success : C.border }]}>
              <Text style={s.kpiLabel}>Still Leaking</Text>
              <Text style={[s.kpiValue, { color: leakPct === 0 ? C.success : C.danger }]}>
                {leakPct}%
              </Text>
              <Text style={s.kpiSub}>{stats.still_leaking} need more work</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Hint Rate</Text>
              <Text style={[s.kpiValue, { color: stats.hint_pct > 30 ? C.warn : C.ink }]}>
                {stats.hint_pct}%
              </Text>
              <Text style={s.kpiSub}>{stats.hint_count} hints used</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Avg Time / Q</Text>
              <Text style={[s.kpiValue, { color: C.ink }]}>
                {fmtMs(stats.avg_time_ms)}
              </Text>
              <Text style={s.kpiSub}>
                Best: {stats.fastest_correct_ms ? fmtMs(stats.fastest_correct_ms) : "—"}
              </Text>
            </View>
          </View>
          </View>

          {/* ── SECTION BREAKDOWN ── */}
          {stats.bySection.length > 0 && (
            <View wrap={false}>
              <Text style={s.sectionTitle}>Section Recovery Breakdown</Text>
              <View style={s.sectionTable}>
                <View style={s.tableHeader}>
                  <View style={s.colName}><Text style={s.thCell}>Section</Text></View>
                  <View style={s.colBar}><Text style={s.thCell}>Recovery</Text></View>
                  <View style={s.colPct}><Text style={s.thCell}>Rate</Text></View>
                  <View style={s.colQs}><Text style={s.thCell}>Qs</Text></View>
                </View>
                {stats.bySection.map((sec, i) => {
                  const color = accuracyColor(sec.accuracy);
                  const isLast = i === stats.bySection.length - 1;
                  return (
                    <View key={sec.code} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}, isLast ? s.tableRowLast : {}]}>
                      <View style={s.colName}>
                        <Text style={s.cellName}>{formatSectionDisplayLabel(sec.code)}</Text>
                      </View>
                      <View style={s.colBar}>
                        <View style={s.progressTrack}>
                          <View style={[s.progressFill, { width: `${Math.max(2, sec.accuracy)}%`, backgroundColor: color }]} />
                        </View>
                      </View>
                      <View style={s.colPct}>
                        <Text style={[s.cellPct, { color }]}>{sec.accuracy}%</Text>
                      </View>
                      <View style={s.colQs}>
                        <Text style={s.cellSub}>{sec.total}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── DIFFICULTY ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Recovery by Difficulty</Text>
          <View style={s.diffRow}>
            {stats.byDifficulty.map((d) => {
              const color = d.total ? accuracyColor(d.accuracy) : C.inkMuted;
              return (
                <View key={d.level} style={s.diffCard}>
                  <View style={s.diffHeader}>
                    <Text style={s.diffLabel}>{d.level.charAt(0).toUpperCase() + d.level.slice(1)}</Text>
                    <Text style={[s.cellSub, { color: diffColor(d.level) }]}>{d.total} Qs</Text>
                  </View>
                  <Text style={[s.diffPct, { color }]}>
                    {d.total ? `${d.accuracy}%` : "—"}
                  </Text>
                  <Text style={s.diffSub}>{d.recovered}/{d.total} recovered</Text>
                  <View style={s.diffBar}>
                    {d.total > 0 && (
                      <View style={[s.diffBarFill, { width: `${d.accuracy}%`, backgroundColor: color }]} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          </View>

          {/* ── SPEED ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Speed Breakdown</Text>
          <View style={s.speedRow}>
            <View style={s.speedCard}>
              <Text style={s.speedLabel}>Total time spent</Text>
              <Text style={[s.speedValue, { color: C.ink }]}>{fmtMs(durationMs || stats.total_time_ms)}</Text>
              <Text style={s.speedSub}>Across all {stats.total} questions</Text>
            </View>
            <View style={s.speedCard}>
              <Text style={s.speedLabel}>Average per question</Text>
              <Text style={[s.speedValue, { color: C.ink }]}>{fmtMs(stats.avg_time_ms)}</Text>
              <Text style={s.speedSub}>Including wrong answers</Text>
            </View>
            <View style={s.speedCard}>
              <Text style={s.speedLabel}>Fastest correct answer</Text>
              <Text style={[s.speedValue, { color: C.success }]}>
                {stats.fastest_correct_ms ? fmtMs(stats.fastest_correct_ms) : "—"}
              </Text>
              <Text style={s.speedSub}>Quick recall = strong memory</Text>
            </View>
            <View style={s.speedCard}>
              <Text style={s.speedLabel}>Slowest question</Text>
              <Text style={[s.speedValue, { color: C.warn }]}>
                {stats.slowest_ms ? fmtMs(stats.slowest_ms) : "—"}
              </Text>
              <Text style={s.speedSub}>May need deeper review</Text>
            </View>
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
          <Text style={s.footerText}>SC Real Estate Prep · Mistakes Drill Report</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
