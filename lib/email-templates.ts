export type EmailTemplate = {
  id: string;
  label: string;
  subject: string;
  body: string;
};

/**
 * Shared email templates used by the compose pages.
 * The `{{candidateName}}` placeholder in each body is replaced at render
 * time with the actual candidate's full name.
 */
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "process-slow",
    label: "Process Slow",
    subject: "Recruitment Process Update",
    body: `Dear {{candidateName}},

Thank you for your patience throughout our recruitment process.

We would like to inform you that the hiring process is currently taking longer than expected due to ongoing internal discussions and evaluations.

Your application is still being considered, and we sincerely appreciate your understanding while we complete the next stages of the process. We will keep you updated as soon as there is further progress.

Thank you again for your continued interest in Nuanu.

Warm regards,
HR Team – Nuanu`,
  },
  {
    id: "rejected",
    label: "Rejected",
    subject: "Thank You for Applying to Nuanu",
    body: `Dear {{candidateName}},

Thank you for your interest in joining Nuanu and for taking the time to participate in our recruitment process.

After careful consideration, we regret to inform you that we will not be moving forward with your application at this stage. While we truly appreciate your background and experience, we have decided to proceed with other candidates whose qualifications more closely match our current needs.

We sincerely appreciate your interest in Nuanu and wish you all the best in your future career journey.

Warm regards,
HR Team – Nuanu`,
  },
  {
    id: "on-hold",
    label: "On Hold",
    subject: "Thank You for Your Patience",
    body: `Dear {{candidateName}},

Thank you for your continued interest in opportunities at Nuanu.

We would like to inform you that your application is currently on hold as we are still reviewing our hiring priorities and internal requirements.

Please be assured that your profile remains under consideration, and we will reach out again should there be any updates regarding the recruitment process.

We appreciate your patience and understanding throughout this process.

Warm regards,
HR Team – Nuanu`,
  },
  {
    id: "not-open",
    label: "Not Open",
    subject: "Thank You for Your Interest in Nuanu",
    body: `Dear {{candidateName}},

Thank you for your interest in career opportunities at Nuanu.

At the moment, the position you applied for is currently not open or not actively hiring. As a result, we are unable to proceed with the recruitment process at this time.

We truly appreciate your enthusiasm toward joining Nuanu and encourage you to stay connected for future opportunities.

Thank you once again for considering Nuanu as part of your career journey.

Warm regards,
HR Team – Nuanu`,
  },
  {
    id: "been-fulfilled",
    label: "Been Fulfilled",
    subject: "Update on Your Application at Nuanu",
    body: `Dear {{candidateName}},

Thank you for your interest in opportunities at Nuanu and for taking the time to participate in our recruitment process.

We would like to inform you that the position has now been filled by another candidate.

We sincerely appreciate your time, effort, and interest in becoming part of Nuanu. We will keep your profile in our database for future opportunities that may align with your background and experience.

We wish you continued success in your career journey and hope our paths may cross again in the future.

Warm regards,
HR Team – Nuanu`,
  },
];

/**
 * Replaces the {{candidateName}} placeholder in a template body with the
 * actual candidate's full name.
 */
export function fillTemplate(body: string, candidateName: string): string {
  return body.replace(/\{\{candidateName\}\}/g, candidateName);
}

/**
 * Dropdown options for the template selector — includes a placeholder
 * "Select a template..." option at the top.
 */
export const TEMPLATE_OPTIONS = [
  { value: "", label: "Select a template..." },
  ...EMAIL_TEMPLATES.map((t) => ({ value: t.id, label: t.label })),
];
