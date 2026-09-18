import type { exportToBlob as ExportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { DryRunExcalidrawElement } from "@/lib/excalidrawElement";
import type { SnapshotTrigger } from "@/lib/snapshotStorage";

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function captureSnapshotFromApi(
  api: ExcalidrawImperativeAPI,
  sessionId: string,
  trigger: SnapshotTrigger,
): Promise<{ capturedAt: string } | null> {
  const elements = api.getSceneElements() as readonly DryRunExcalidrawElement[];
  const files = api.getFiles();

  // Imported lazily: evaluating @excalidraw/excalidraw touches `window`, so a
  // static import would break the server render of the interview room.
  const { exportToBlob } = await import("@excalidraw/excalidraw");

  const blob = await exportToBlob({
    elements: elements as Parameters<typeof ExportToBlob>[0]["elements"],
    files,
    mimeType: "image/png",
    appState: {
      exportWithDarkMode: false,
      viewBackgroundColor: "#ffffff",
      exportBackground: true,
    },
  });

  const pngBase64 = await blobToBase64(blob);
  const elementsJson = JSON.stringify(elements);

  const res = await fetch(`/api/sessions/${sessionId}/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pngBase64, elementsJson, trigger }),
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as { capturedAt: string };
  return { capturedAt: data.capturedAt };
}
