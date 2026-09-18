"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { TranscriptKind } from "@/lib/types";

export type TranscriptSource = "deepgram" | "database";

export type TranscriptFinal = {
  id: string;
  role: "candidate" | "interviewer" | "system";
  kind: TranscriptKind | null;
  text: string;
  tsMs: number;
  suppressed: boolean;
  source: TranscriptSource;
};

type TranscriptState = {
  finals: TranscriptFinal[];
  interim: string;
  interviewerSpeaking: boolean;
};

type TranscriptAction =
  | { type: "hydrate"; entries: TranscriptFinal[] }
  | { type: "append-final"; entry: TranscriptFinal }
  | { type: "set-interim"; text: string }
  | { type: "set-interviewer-speaking"; speaking: boolean };

type TranscriptContextValue = TranscriptState & {
  dispatch: Dispatch<TranscriptAction>;
  setInterviewerSpeaking: (speaking: boolean) => void;
};

const TranscriptContext = createContext<TranscriptContextValue | null>(null);

function reducer(
  state: TranscriptState,
  action: TranscriptAction,
): TranscriptState {
  switch (action.type) {
    case "hydrate": {
      const local = state.finals.filter((entry) => entry.source === "deepgram");
      const databaseIds = new Set(action.entries.map((entry) => entry.id));
      return {
        ...state,
        finals: [
          ...action.entries,
          ...local.filter((entry) => !databaseIds.has(entry.id)),
        ].sort((a, b) => a.tsMs - b.tsMs),
      };
    }
    case "append-final":
      return {
        ...state,
        finals: [...state.finals, action.entry],
        interim: "",
      };
    case "set-interim":
      return { ...state, interim: action.text };
    case "set-interviewer-speaking":
      return { ...state, interviewerSpeaking: action.speaking };
  }
}

export function TranscriptStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    finals: [],
    interim: "",
    interviewerSpeaking: false,
  });

  const setInterviewerSpeaking = useCallback((speaking: boolean) => {
    dispatch({ type: "set-interviewer-speaking", speaking });
  }, []);

  const value = useMemo(
    () => ({ ...state, dispatch, setInterviewerSpeaking }),
    [state, setInterviewerSpeaking],
  );

  return (
    <TranscriptContext.Provider value={value}>
      {children}
    </TranscriptContext.Provider>
  );
}

export function useTranscriptStore(): TranscriptContextValue {
  const context = useContext(TranscriptContext);
  if (!context) {
    throw new Error("useTranscriptStore must be used within TranscriptStoreProvider");
  }
  return context;
}
