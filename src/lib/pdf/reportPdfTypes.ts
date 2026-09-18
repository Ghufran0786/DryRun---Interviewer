import type { InterviewStats } from "@/lib/evaluation/assemble";
import type { EvaluationPayload } from "@/lib/evaluation/schema";
import type { PdfDiagramSnapshot } from "@/lib/report/pdfDiagramSnapshots";

export type ReportPdfEvaluation = EvaluationPayload & {
  weightedScore: number;
  stats: InterviewStats;
  evaluatedAt: string;
  evaluatorModel: string;
  rubricVersion: string;
};

export type ReportPdfDiagram = PdfDiagramSnapshot & {
  imageDataUri: string;
};

export type ReportPdfData = {
  title: string;
  problem: string;
  candidateName: string;
  sessionDate: string;
  durationLabel: string;
  evaluated: boolean;
  evaluation: ReportPdfEvaluation | null;
  stats: InterviewStats;
  promptTokens: number;
  completionTokens: number;
  transcriptLines: string[];
  diagrams: ReportPdfDiagram[];
  generatedAt: string;
};
