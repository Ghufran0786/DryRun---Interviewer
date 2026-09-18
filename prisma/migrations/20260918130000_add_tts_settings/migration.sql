ALTER TABLE "Settings" ADD COLUMN "ttsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "ttsModel" TEXT NOT NULL DEFAULT 'mistralai/voxtral-mini-tts-2603';
ALTER TABLE "Settings" ADD COLUMN "ttsVoice" TEXT NOT NULL DEFAULT 'en_paul_neutral';
ALTER TABLE "Settings" ADD COLUMN "usingHeadphones" BOOLEAN NOT NULL DEFAULT true;
