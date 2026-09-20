import { requireUser } from "@/lib/auth/requireUser";
import { buildReportPdfData } from "@/lib/pdf/buildReportPdfData";
import { renderReportPdf } from "@/lib/pdf/renderReportPdf";
import { loadCompletedSessionReportContext } from "@/lib/report/loadCompletedSession";
import { pdfDownloadFilename } from "@/lib/report/filename";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const loaded = await loadCompletedSessionReportContext(id, auth.userId);
  if ("error" in loaded) {
    return loaded.error;
  }

  const pdfData = await buildReportPdfData(loaded);
  const pdfBuffer = await renderReportPdf(pdfData);
  const filename = pdfDownloadFilename(
    loaded.session.title,
    loaded.session.endedAt ?? loaded.session.createdAt,
  );

  console.log("Report PDF generated:", {
    sessionId: id,
    bytes: pdfBuffer.length,
    diagramCount: pdfData.diagrams.length,
    evaluated: pdfData.evaluated,
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
