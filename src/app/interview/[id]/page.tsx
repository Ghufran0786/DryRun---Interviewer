import { InterviewRoom } from "@/components/interview/InterviewRoom";
import { TranscriptStoreProvider } from "@/components/transcript/TranscriptStore";
import { getOwnerIdFromSession } from "@/lib/auth/ownerSession";
import { findSessionForUser } from "@/lib/sessionScope";
import { parseSceneJson } from "@/lib/scenePayload";
import { getDeepgramTransport } from "@/lib/deepgramTransport";
import { getSettings } from "@/lib/settings";
import { isInterviewPhase } from "@/lib/interviewPhases";
import { isTargetLevel } from "@/lib/validation";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function InterviewPage({ params }: PageProps) {
  const { id } = await params;
  const ownerId = (await getOwnerIdFromSession()) ?? "local";
  const session = await findSessionForUser(id, ownerId);
  if (!session) {
    notFound();
  }
  if (session.status === "completed") {
    redirect(`/report/${session.id}`);
  }

  const settings = await getSettings();
  const targetLevel = isTargetLevel(session.targetLevel)
    ? session.targetLevel
    : "SDE-2";

  const startedAtMs = (
    session.startedAt ?? session.createdAt
  ).getTime();

  return (
    <TranscriptStoreProvider>
      <InterviewRoom
        sessionId={session.id}
        title={session.title}
        targetLevel={targetLevel}
        interviewerModel={settings.interviewerModel}
        keyterms={settings.keyterms}
        interviewDurationMin={settings.interviewDurationMin}
        ttsEnabled={settings.ttsEnabled}
        ttsProvider={
          settings.ttsProvider === "openrouter" ? "openrouter" : "browser"
        }
        browserVoiceName={settings.browserVoiceName}
        browserVoiceRate={settings.browserVoiceRate}
        usingHeadphones={settings.usingHeadphones}
        currentPhase={
          isInterviewPhase(session.currentPhase)
            ? session.currentPhase
            : "requirements"
        }
        status={session.status}
        startedAtMs={startedAtMs}
        initialScene={parseSceneJson(session.sceneJson)}
        deepgramTransport={getDeepgramTransport()}
      />
    </TranscriptStoreProvider>
  );
}
