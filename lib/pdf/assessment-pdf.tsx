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
import { PDF_BRAND } from "@/lib/brand";

/* ─── Brand colours (matching app globals.css) ─── */
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
  national: "#C15F3C",
  state: "#7A5C3A",
  gray: "#E8E0D4",
  white: "#FFFFFF",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "column" },
  appName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.5,
  },
  headerSub: { fontSize: 8, color: "#F5E0D6", marginTop: 2 },
  headerDate: { fontSize: 8, color: "#F5E0D6", textAlign: "right" },

  /* Body wrapper */
  body: { paddingHorizontal: 28, paddingTop: 20 },

  /* Section heading */
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.primaryLight,
    paddingBottom: 4,
  },

  /* ── Score overview ── */
  overviewRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  scoreCircleBox: {
    width: 90,
    height: 90,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreInsideText: {
    position: "absolute",
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    top: 0,
    left: 0,
  },
  scorePct: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    textAlign: "center",
  },
  scoreLabel: { fontSize: 7, color: C.inkMuted, textAlign: "center" },

  statsColumn: {
    flex: 1,
    justifyContent: "center",
    gap: 7,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: { fontSize: 8, color: C.inkMuted, flex: 1 },
  statValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    minWidth: 22,
    textAlign: "right",
  },
  statPct: { fontSize: 7, color: C.inkMuted, width: 30, textAlign: "right" },

  infoColumn: {
    width: 130,
    gap: 6,
  },
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  infoCardLabel: { fontSize: 7, color: C.inkMuted },
  infoCardValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink },
  infoCardValueSm: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.ink },

  /* ── Section breakdown ── */
  sectionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 16,
  },
  sectionCard: {
    width: "48.5%",
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  sectionCode: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  sectionPct: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
  },
  sectionName: {
    fontSize: 7.5,
    color: C.ink,
    marginBottom: 5,
  },
  progressTrack: {
    height: 5,
    backgroundColor: C.gray,
    borderRadius: 3,
    marginBottom: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  sectionStats: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  sectionStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  sectionStatDot: { width: 5, height: 5, borderRadius: 2.5 },
  sectionStatText: { fontSize: 6.5, color: C.inkMuted },

  /* ── Predictions ── */
  predictionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  predCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  predLabel: { fontSize: 7.5, color: C.inkMuted, marginBottom: 4 },
  predPct: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  predPctSub: { fontSize: 7, color: C.inkMuted, marginTop: 2 },

  /* ── Weak concepts ── */
  conceptsBox: {
    backgroundColor: C.surface,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    gap: 5,
  },
  conceptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E8DC",
    gap: 6,
  },
  conceptTitle: { flex: 1, fontSize: 8, color: C.ink, minWidth: 0 },
  conceptSection: {
    fontSize: 6,
    color: C.primary,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    width: "38%",
    textAlign: "left",
  },
  conceptAccuracy: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    width: "18%",
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
  tutorText: {
    fontSize: 8,
    color: C.inkMuted,
    lineHeight: 1.6,
  },

  /* Footer */
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: C.inkMuted },
});

/* ─── Helpers ─── */
function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

function accuracyColor(pct: number) {
  if (pct >= 70) return C.success;
  if (pct >= 50) return C.warn;
  return C.danger;
}

/** Avoid NaN in react-pdf when total is 0 */
function pctOf(part: number, total: number): number {
  const t = Math.max(total, 1);
  return Math.round((part / t) * 100);
}

/* Donut circle using SVG */
function ScoreDonut({ pct }: { pct: number }) {
  const r = 38;
  const cx = 45;
  const cy = 45;
  const circumference = 2 * Math.PI * r;
  const color = accuracyColor(pct);
  const coloredDash = donutArcStrokeDasharray(pct, circumference);
  /* Rotate -90 so arc starts at top instead of right side */
  const rotateTransform = `rotate(-90, ${cx}, ${cy})`;
  return (
    <View style={s.scoreCircleBox}>
      <Svg width={90} height={90} viewBox="0 0 90 90">
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={C.gray}
          strokeWidth={7}
          fill="none"
        />
        {donutShowColoredArc(pct) && (
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth={7}
            fill="none"
            {...(coloredDash ? { strokeDasharray: coloredDash } : {})}
            transform={rotateTransform}
          />
        )}
      </Svg>
      <View style={s.scoreInsideText}>
        <Text style={[s.scorePct, { color }]}>{pct}%</Text>
        <Text style={s.scoreLabel}>Accuracy</Text>
      </View>
    </View>
  );
}

/* ─── Types ─── */
export interface AssessmentPdfProps {
  summary: AssessmentSummary;
  sessionId: string;
  durationMs: number;
  conceptTitles: Record<string, string>;
  tutorLetter: string | null;
  generatedAt?: string;
}

/* ─── Main PDF Document ─── */
export function AssessmentPdf({
  summary,
  sessionId: _sessionId,
  durationMs,
  conceptTitles,
  tutorLetter,
  generatedAt,
}: AssessmentPdfProps) {
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

  const passPctDisplay = (prob: number) =>
    Number.isFinite(prob) ? Math.round(prob * 100) : 0;
  const passProbColor = (prob: number) => {
    const p = Number.isFinite(prob) ? prob : 0;
    return p >= 0.7 ? C.success : p >= 0.5 ? C.warn : C.danger;
  };

  return (
    <Document
      title="Assessment Report"
      author={PDF_BRAND.author}
      subject="SC Real Estate Salesperson Assessment"
    >
      <Page size="A4" style={s.page} wrap>
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.appName}>{PDF_BRAND.appName}</Text>
            <Text style={s.headerSub}>Assessment Report</Text>
          </View>
          <Text style={s.headerDate}>Generated {dateStr}</Text>
        </View>

        <View style={s.body}>
          {/* ── OVERVIEW ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Overall Performance</Text>
          <View style={s.overviewRow}>
            {/* Score donut */}
            <ScoreDonut pct={summary.accuracy_pct} />

            {/* Stats column */}
            <View style={s.statsColumn}>
              <View style={s.statRow}>
                <View
                  style={[s.statDot, { backgroundColor: C.success }]}
                />
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
              <View
                style={[
                  s.statRow,
                  {
                    marginTop: 4,
                    paddingTop: 4,
                    borderTopWidth: 1,
                    borderTopColor: C.border,
                  },
                ]}
              >
                <Text style={[s.statLabel, { color: C.ink }]}>
                  Effective score (mastered + recovered)
                </Text>
                <Text style={[s.statValue, { color: C.primary }]}>
                  {summary.effective_pct}%
                </Text>
              </View>
            </View>

            {/* Info cards column */}
            <View style={s.infoColumn}>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Total Questions</Text>
                <Text style={s.infoCardValue}>{summary.total}</Text>
              </View>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Time Spent</Text>
                <Text style={s.infoCardValueSm}>{fmtMs(durationMs || summary.total_time_ms)}</Text>
              </View>
              <View style={s.infoCard}>
                <Text style={s.infoCardLabel}>Avg per Question</Text>
                <Text style={s.infoCardValueSm}>
                  {fmtMs(summary.avg_time_ms)}
                </Text>
              </View>
            </View>
          </View>
          </View>

          {/* ── SECTION BREAKDOWN ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Section Breakdown</Text>
          <View style={s.sectionsGrid}>
            {summary.sections.map((sec) => {
              const color = accuracyColor(sec.accuracy);
              return (
                <View key={sec.code} style={s.sectionCard}>
                  <View style={s.sectionCardHeader}>
                    <Text style={[s.sectionName, { flex: 1, paddingRight: 6 }]}>
                      {formatSectionDisplayLabel(sec.code)}
                    </Text>
                    <Text style={[s.sectionPct, { color }]}>
                      {sec.accuracy}%
                    </Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View
                      style={[
                        s.progressFill,
                        {
                          width: `${Math.max(2, sec.accuracy)}%`,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                  <View style={s.sectionStats}>
                    <View style={s.sectionStatItem}>
                      <View
                        style={[
                          s.sectionStatDot,
                          { backgroundColor: C.success },
                        ]}
                      />
                      <Text style={s.sectionStatText}>
                        {sec.mastered} mastered
                      </Text>
                    </View>
                    <View style={s.sectionStatItem}>
                      <View
                        style={[
                          s.sectionStatDot,
                          { backgroundColor: C.danger },
                        ]}
                      />
                      <Text style={s.sectionStatText}>
                        {sec.hard_miss} missed
                      </Text>
                    </View>
                    <Text
                      style={[
                        s.sectionStatText,
                        { marginLeft: "auto", color: C.inkMuted },
                      ]}
                    >
                      {sec.mastered + sec.soft_miss + sec.hard_miss}/{sec.total}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          </View>

          {/* ── PASS PREDICTIONS ── */}
          <View wrap={false}>
          <Text style={s.sectionTitle}>Exam Pass Prediction</Text>
          <View style={s.predictionsRow}>
            <View style={s.predCard}>
              <Text style={s.predLabel}>National Portion (80 Qs)</Text>
              <Text
                style={[
                  s.predPct,
                  { color: passProbColor(national.pass_probability) },
                ]}
              >
                {passPctDisplay(national.pass_probability)}%
              </Text>
              <Text style={s.predPctSub}>
                chance of passing · {national.accuracy_pct}% accuracy on{" "}
                {national.total} Qs sampled
              </Text>
            </View>
            <View style={s.predCard}>
              <Text style={s.predLabel}>State Portion (40 Qs)</Text>
              <Text
                style={[
                  s.predPct,
                  { color: passProbColor(state.pass_probability) },
                ]}
              >
                {passPctDisplay(state.pass_probability)}%
              </Text>
              <Text style={s.predPctSub}>
                chance of passing · {state.accuracy_pct}% accuracy on{" "}
                {state.total} Qs sampled
              </Text>
            </View>
            <View style={s.predCard}>
              <Text style={s.predLabel}>Combined Probability</Text>
              <Text
                style={[
                  s.predPct,
                  {
                    color: passProbColor(
                      summary.predicted.combined_probability,
                    ),
                  },
                ]}
              >
                {passPctDisplay(summary.predicted.combined_probability)}%
              </Text>
              <Text style={s.predPctSub}>
                of passing both portions
              </Text>
            </View>
          </View>
          </View>

          {/* ── WEAK CONCEPTS ── */}
          {summary.weakest_concepts.length > 0 && (
            <View wrap={false}>
              <Text style={s.sectionTitle}>Top Areas to Review</Text>
              <View style={s.conceptsBox}>
                {summary.weakest_concepts.slice(0, 6).map((c, i) => {
                  const title =
                    conceptTitles[c.concept_id] ??
                    c.concept_id.replace(/-/g, " ");
                  const acc = Math.round((c.mastered / Math.max(c.total, 1)) * 100);
                  return (
                    <View
                      key={c.concept_id}
                      style={[
                        s.conceptRow,
                        i === summary.weakest_concepts.slice(0, 6).length - 1
                          ? { borderBottomWidth: 0 }
                          : {},
                      ]}
                    >
                      <Text style={s.conceptSection}>
                        {formatSectionDisplayLabel(c.section_code)}
                      </Text>
                      <Text style={s.conceptTitle}>
                        {title}
                      </Text>
                      <Text
                        style={[
                          s.conceptAccuracy,
                          { color: accuracyColor(acc) },
                        ]}
                      >
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
              <Text style={s.sectionTitle}>{PDF_BRAND.tutorFeedback}</Text>
              <View style={s.tutorBox}>
                <Text style={s.tutorText}>
                  {tutorLetter.replace(/[*#`]/g, "").trim()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{PDF_BRAND.footer("Assessment Report")}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
