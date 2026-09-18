export type VisionTurnPayload = {
  boardImageBase64?: string;
  boardChanged: boolean;
};

export type PreparedVisionTurn = {
  payload: VisionTurnPayload;
  captureMs: number;
  imageBytes: number;
  outcome: "image" | "unchanged" | "empty" | "timeout" | "error";
  commitImageTurn: () => void;
};
