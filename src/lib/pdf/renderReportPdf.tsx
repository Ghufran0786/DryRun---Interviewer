import { DryRunReportDocument } from "@/lib/pdf/DryRunReportDocument";
import type { ReportPdfData } from "@/lib/pdf/reportPdfTypes";
import { renderToBuffer } from "@react-pdf/renderer";

export async function renderReportPdf(data: ReportPdfData): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <DryRunReportDocument data={data} />,
  );
  return Buffer.from(buffer);
}
