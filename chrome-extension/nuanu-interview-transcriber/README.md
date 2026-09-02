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

- **Popup shows "Captions: not detected"**: the extension has not found any
  caption text in the Meet DOM yet. It keeps trying to switch captions on
  (every ~5s) until it succeeds. If it stays amber, turn captions on
  manually with the CC button — capture starts automatically once captions
  render. The status turns green ("Captions: detected ✓") when hooked.
- **"Could not locate captions container"** (in the Meet tab's DevTools
  console, prefix `[nuanu-transcriber]`): live captions are off, or Google
  changed the Meet DOM. Turn captions on manually with the CC button —
  capture starts automatically once captions render. If the warning repeats
  with captions on, the selector list in `content.js`
  (`CAPTION_CONTAINER_SELECTORS`) needs updating.
- **"Captions still not detected after ~15s" console dump**: printed once
  per session when captions were never detected. If captions are visibly
  ON when it appears, copy the dump (candidate elements + open shadow
  roots) and send it to the developer — it contains everything needed to
  update the selectors without guesswork.
- **401 on upload**: your password changed — log out and back in in the
  popup.
- **Session stuck "in_progress"**: if the tab closed without Stop, the
  transcript stays in-progress; open the candidate's Interview Results tab
  and use the retry/refresh controls there.

## Notes on caption detection (v1.1)

- The CC button is found via its `aria-label`, matching `caption`,
  `subtitle`, `subtitel` (Indonesian UI), or the locale-independent
  shortcut hint `ctrl+shift+c` that Meet appends in every UI language.
- Switching captions on is retried every relocate cycle (~5s) until caption
  text is detected; after detection the extension never touches the CC
  button again (so it can't fight a user who turns captions off manually).
- Speaker labels vs caption text: a text node is treated as a speaker name
  only when it is short, unpunctuated, alone in its own wrapper with a
  following text-bearing sibling, and not rendered in white (Meet draws
  caption text white, speaker names colored). All checks fail safe — text
  is kept as a caption line when in doubt.

## Privacy / credentials

Your ATS credentials are stored only in this browser's
`chrome.storage.local` and sent with each API request to
`https://hr.ats.new.nuanu.site` for authentication (the same login endpoint
the web app uses). They are never transmitted anywhere else. Transcripts are
attributable to the logged-in HR user.
