import { RUBRIC_DIMENSIONS } from "@/lib/evaluation/rubric";
import type { ReportPdfData } from "@/lib/pdf/reportPdfTypes";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    color: "#0A0A0A",
    fontFamily: "Helvetica",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#6B6B6B",
    textAlign: "center",
  },
  h1: { fontSize: 16, fontWeight: "bold", marginBottom: 6 },
  h2: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#6B6B6B",
  },
  muted: { color: "#6B6B6B" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingVertical: 4,
  },
  cellLabel: { width: "28%" },
  cellWeight: { width: "10%", textAlign: "right" },
  cellScore: { width: "8%", textAlign: "right" },
  cellBar: { width: "22%" },
  cellImprovement: { width: "32%", fontSize: 9 },
  barSegment: {
    width: 14,
    height: 6,
    marginRight: 2,
    borderWidth: 1,
    borderColor: "#0A0A0A",
  },
  barFilled: { backgroundColor: "#0A0A0A" },
  bullet: { marginBottom: 3 },
  diagram: { width: "100%", marginTop: 6, marginBottom: 4 },
  caption: { fontSize: 9, color: "#6B6B6B", marginBottom: 4 },
  digest: { fontSize: 8, lineHeight: 1.35, marginBottom: 10, color: "#0A0A0A" },
  appendix: { fontSize: 8, lineHeight: 1.35 },
  mono: { fontSize: 7, lineHeight: 1.35, fontFamily: "Courier" },
  timelinePhase: { width: "40%" },
  timelineMinutes: { width: "20%", textAlign: "right" },
});

function ScoreBar({ score }: { score: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {[1, 2, 3, 4].map((segment) => (
        <View
          key={segment}
          style={[
            styles.barSegment,
            segment <= score ? styles.barFilled : undefined,
          ]}
        />
      ))}
    </View>
  );
}

function footerText(data: ReportPdfData): string {
  if (!data.evaluated || !data.evaluation) {
    return `DryRun · analysis packet · generated ${data.generatedAt}`;
  }
  return `DryRun · evaluated with ${data.evaluation.evaluatorModel} · rubric ${data.evaluation.rubricVersion} · generated ${data.generatedAt}`;
}

function StatsLine({
  data,
  includeTokens,
}: {
  data: ReportPdfData;
  includeTokens: boolean;
}) {
  const base = `Duration ${data.stats.durationMin} min · ${data.stats.candidateWords} candidate words · ${data.stats.interviewerTurns} interviewer turns · ${data.stats.nudgeCount} nudges · ${data.stats.reconnectCount} audio reconnect${data.stats.reconnectCount === 1 ? "" : "s"}`;
  if (!includeTokens) {
    return <Text>{base}</Text>;
  }
  return (
    <Text>
      {base} · {data.promptTokens} prompt / {data.completionTokens} completion
      tokens
    </Text>
  );
}

function PhaseTimelineSection({ data }: { data: ReportPdfData }) {
  return (
    <>
      <Text style={styles.h2}>Phase timeline</Text>
      {data.stats.phaseTimeline.map((row) => (
        <View key={`${row.phase}-${row.minutes}`} style={styles.row}>
          <Text style={styles.timelinePhase}>{row.phase}</Text>
          <Text style={styles.timelineMinutes}>{row.minutes} min</Text>
        </View>
      ))}
      {data.phaseNotes.length > 0 ? (
        <>
          <Text style={{ marginTop: 8, fontSize: 9, fontWeight: "bold" }}>
            Phase notes
          </Text>
          {data.phaseNotes.map((note) => (
            <Text key={note} style={styles.bullet}>• {note}</Text>
          ))}
        </>
      ) : null}
    </>
  );
}

function ExternalEvalInstructionsPage({ data }: { data: ReportPdfData }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h2}>How to evaluate this packet</Text>
      <Text style={styles.mono}>{data.externalEvalInstructions}</Text>
      <Text fixed style={styles.footer}>{footerText(data)}</Text>
    </Page>
  );
}

function DiagramsSection({ data }: { data: ReportPdfData }) {
  if (data.diagrams.length === 0) {
    return null;
  }
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h2}>Diagrams</Text>
      {data.diagrams.map((diagram) => (
        <View key={diagram.id} wrap={false}>
          <Text style={styles.caption}>{diagram.caption}</Text>
          <Image style={styles.diagram} src={diagram.imageDataUri} />
          <Text style={styles.digest}>
            {diagram.digest.trim().length > 0
              ? diagram.digest
              : "(empty whiteboard)"}
          </Text>
        </View>
      ))}
      <Text fixed style={styles.footer}>{footerText(data)}</Text>
    </Page>
  );
}

export function DryRunReportDocument({ data }: { data: ReportPdfData }) {
  const evaluation = data.evaluation;
  const scoreByDimension = new Map(
    evaluation?.scores.map((score) => [score.dimension, score]) ?? [],
  );

  if (!data.evaluated || !evaluation) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Analysis packet — not locally evaluated</Text>
          <Text>{data.problem}</Text>
          <Text style={styles.muted}>
            {data.candidateName} · {data.targetLevel} · {data.sessionDate} ·{" "}
            {data.durationLabel}
          </Text>

          <Text style={styles.h2}>Stats</Text>
          <StatsLine data={data} includeTokens={false} />

          <PhaseTimelineSection data={data} />

          <Text fixed style={styles.footer}>{footerText(data)}</Text>
        </Page>

        <DiagramsSection data={data} />

        <Page size="A4" style={styles.page}>
          <Text style={styles.h2}>Transcript appendix</Text>
          {data.transcriptLines.map((line) => (
            <Text key={line} style={styles.appendix}>{line}</Text>
          ))}
          <Text fixed style={styles.footer}>{footerText(data)}</Text>
        </Page>

        <ExternalEvalInstructionsPage data={data} />
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>DryRun interview report</Text>
        <Text>{data.problem}</Text>
        <Text style={styles.muted}>
          {data.candidateName} · {data.sessionDate} · {data.durationLabel}
        </Text>
        <View style={{ marginTop: 8 }}>
          <Text>
            {evaluation.verdict} · {evaluation.weightedScore.toFixed(2)}/4 ·{" "}
            {evaluation.levelEstimate}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 9 }}>{evaluation.wouldPass}</Text>
        </View>

        <Text style={styles.h2}>Score table</Text>
        {RUBRIC_DIMENSIONS.map((dimension) => {
          const row = scoreByDimension.get(dimension.key);
          const score = row?.score ?? 0;
          return (
            <View key={dimension.key} style={styles.row}>
              <Text style={styles.cellLabel}>{dimension.label}</Text>
              <Text style={styles.cellWeight}>{dimension.weight}</Text>
              <Text style={styles.cellScore}>{score}</Text>
              <View style={styles.cellBar}>
                <ScoreBar score={score} />
              </View>
              <Text style={styles.cellImprovement}>
                {row?.improvement ?? "—"}
              </Text>
            </View>
          );
        })}

        <Text style={styles.h2}>Strengths</Text>
        {evaluation.strengths.map((item) => (
          <Text key={item} style={styles.bullet}>• {item}</Text>
        ))}
        <Text style={styles.h2}>Gaps</Text>
        {evaluation.gaps.map((item) => (
          <Text key={item} style={styles.bullet}>• {item}</Text>
        ))}
        <Text style={styles.h2}>Action items</Text>
        {evaluation.actionItems.map((item, index) => (
          <Text key={`${index}-${item}`} style={styles.bullet}>
            {index + 1}. {item}
          </Text>
        ))}

        <Text style={styles.h2}>Phase timeline</Text>
        {evaluation.phaseAnalysis.map((phase) => (
          <Text key={`${phase.phase}-${phase.minutes}`} style={styles.bullet}>
            {phase.phase}: {phase.minutes} min — {phase.assessment}
          </Text>
        ))}

        <Text style={styles.h2}>Evidence</Text>
        {RUBRIC_DIMENSIONS.map((dimension) => {
          const row = scoreByDimension.get(dimension.key);
          return (
            <View key={dimension.key} style={{ marginBottom: 6 }}>
              <Text style={{ fontWeight: "bold" }}>{dimension.label}</Text>
              {(row?.evidence ?? []).map((item) => (
                <Text key={item} style={styles.bullet}>• {item}</Text>
              ))}
            </View>
          );
        })}

        <Text style={styles.h2}>Stats</Text>
        <StatsLine data={data} includeTokens={true} />

        <Text fixed style={styles.footer}>{footerText(data)}</Text>
      </Page>

      <DiagramsSection data={data} />

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Transcript appendix</Text>
        {data.transcriptLines.map((line) => (
          <Text key={line} style={styles.appendix}>{line}</Text>
        ))}
        <Text fixed style={styles.footer}>{footerText(data)}</Text>
      </Page>

      <ExternalEvalInstructionsPage data={data} />
    </Document>
  );
}
