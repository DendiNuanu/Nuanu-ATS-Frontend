export const TIMELINE_EVENT_TYPES = {
  APPLICATION_RECEIVED: "application_received",
  RESUME_PARSED: "resume_parsed",
  AI_MATCH: "ai_match",
  PIPELINE_STAGE: "pipeline_stage",
  BLACKLIST: "blacklist",
} as const;

export type TimelineEventType =
  (typeof TIMELINE_EVENT_TYPES)[keyof typeof TIMELINE_EVENT_TYPES];

export function buildTimelineEventKey(eventType: string, eventKey: string): string {
  return `${eventType}:${eventKey}`;
}

export function isEditableTimelineEventType(eventType: string): boolean {
  return Object.values(TIMELINE_EVENT_TYPES).includes(eventType as TimelineEventType);
}
