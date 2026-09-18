import type { exportToCanvas as ExportToCanvas } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const MAX_VISION_IMAGE_SIDE = 1280;

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not encode the board as PNG"));
      }
    }, "image/png");
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not encode the board image"));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the board image"));
    reader.readAsDataURL(blob);
  });
}

export async function exportBoardForVision(
  api: ExcalidrawImperativeAPI,
): Promise<{
  imageDataUrl: string;
  imageBytes: number;
  width: number;
  height: number;
}> {
  // Lazy for the same SSR-safety reason as the persisted snapshot exporter.
  const { exportToCanvas } = await import("@excalidraw/excalidraw");
  const canvas = await exportToCanvas({
    elements: api.getSceneElements() as Parameters<
      typeof ExportToCanvas
    >[0]["elements"],
    files: api.getFiles(),
    maxWidthOrHeight: MAX_VISION_IMAGE_SIDE,
    appState: {
      exportWithDarkMode: false,
      viewBackgroundColor: "#ffffff",
      exportBackground: true,
    },
  });
  const blob = await canvasToPng(canvas);
  return {
    imageDataUrl: await blobToDataUrl(blob),
    imageBytes: blob.size,
    width: canvas.width,
    height: canvas.height,
  };
}
