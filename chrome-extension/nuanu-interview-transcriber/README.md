# Nuanu Interview Transcriber (Chrome Extension)

Captures Google Meet's **built-in live captions** (the CC feature — free for
all Meet users) during interviews and streams the transcript to the Nuanu
ATS. When the session stops, the ATS generates an AI summary (via the
existing Groq → Gemini → Cerebras chain) that appears in the candidate's
**Interview Results** tab.

This is the same mechanism tools like Tactiq use: the extension reads
captions already rendered in **your own browser** while you're in the call.
No bot participant, no separate speech-to-text service.

## ⚠️ Consent policy (agreed with HR)

Before starting transcription, **verbally inform the candidate and all
participants** that the interview is being transcribed for HR
record-keeping. While transcription is active, a red banner is displayed on
the HR user's screen as a constant reminder. Meet's live captions are also
visible to everyone in the call.

## Install (load unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder (`chrome-extension/nuanu-interview-transcriber`)
5. Pin the extension to the toolbar (puzzle-piece icon → pin)

## Use

1. Open the Google Meet interview tab (join the call).
2. Click the extension icon → log in with your **ATS email + password**
   (same credentials as hr.ats.new.nuanu.site).
3. Search and select the candidate this interview is for.
4. Click **Start Transcribing**. The extension will:
   - Try to turn on live captions automatically (clicks the CC button).
   - Show a red banner + "REC" toolbar badge while active.
   - Capture and stream finalized caption lines every ~5 seconds.
5. At the end of the interview, click **Stop & Finalize**. The ATS marks the
   session complete and generates the AI summary — it appears in the
   candidate's Interview Results tab within seconds (the tab auto-refreshes
   while a session is live).

## Troubleshooting

- **"Could not locate captions container"** (in the Meet tab's DevTools
  console, prefix `[nuanu-transcriber]`): live captions are off, or Google
  changed the Meet DOM. Turn captions on manually with the CC button —
  capture starts automatically once captions render. If the warning repeats
  with captions on, the selector list in `content.js`
  (`CAPTION_CONTAINER_SELECTORS`) needs updating.
- **401 on upload**: your password changed — log out and back in in the
  popup.
- **Session stuck "in_progress"**: if the tab closed without Stop, the
  transcript stays in-progress; open the candidate's Interview Results tab
  and use the retry/refresh controls there.

## Privacy / credentials

Your ATS credentials are stored only in this browser's
`chrome.storage.local` and sent with each API request to
`https://hr.ats.new.nuanu.site` for authentication (the same login endpoint
the web app uses). They are never transmitted anywhere else. Transcripts are
attributable to the logged-in HR user.
