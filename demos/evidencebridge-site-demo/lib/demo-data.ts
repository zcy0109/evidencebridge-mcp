/**
 * Static, synthetic demonstration content. Nothing in this module calls a
 * model, retrieves live documents, records an audit event or creates a review.
 * Source lines mirror evidencebridge-mcp/examples/materials; blanks count.
 */
export type ScenarioKey = 'attendance' | 'version' | 'legal';

export type DemoDocument = {
  readonly id: string;
  readonly title: string;
  readonly filename: string;
  readonly version: string;
  readonly kind: string;
  readonly lines: readonly string[];
};

export type Scenario = {
  readonly question: string;
  readonly answer: string;
  readonly sourceId: string;
  readonly previousSourceId?: string;
  readonly quote: string;
  readonly sourceLine: number;
  readonly review: boolean;
  readonly tools: readonly { readonly name: string; readonly detail: string }[];
};

export type AuditReplayEvent = {
  sequence: number;
  event: string;
  detail: string;
  outcome: string;
};

const documentContent: DemoDocument[] = [
  {
    id: 'teaching-handbook',
    title: 'Teaching Handbook',
    filename: 'teaching-handbook.md',
    version: '1',
    kind: 'Course material',
    lines: [
      '# Synthetic Teaching Handbook',
      '',
      'Students must attend at least 80 percent of seminars. Recorded lectures are available for 30 days. Assessment extensions require documented exceptional circumstances. Group projects may contain no more than five students. Office hours take place on Tuesdays from 2 PM to 4 PM. Feedback is released within 15 working days. Course materials use the Creative Commons Attribution 4.0 license.',
    ],
  },
  {
    id: 'research-policy-v2',
    title: 'Research Policy',
    filename: 'research-policy-v2.md',
    version: '2',
    kind: 'Policy',
    lines: [
      '# Synthetic University Research Policy — Version 2',
      '',
      'This document is synthetic and is provided solely for reproducible software evaluation.',
      '',
      'Applications close on 15 May. Applicants must retain consent records for five years. Appeals must be submitted in writing within 21 calendar days. Decisions involving personal data require human review. The research office acknowledges submissions within three business days. Approved projects receive an identifier beginning with RPV2. Data exports must use encrypted storage with multifactor approval.',
    ],
  },
  {
    id: 'research-policy-v1',
    title: 'Research Policy',
    filename: 'research-policy-v1.md',
    version: '1',
    kind: 'Policy',
    lines: [
      '# Synthetic University Research Policy — Version 1',
      '',
      'This document is synthetic and is provided solely for reproducible software evaluation.',
      '',
      'Applications close on 1 May. Applicants must retain consent records for three years. Appeals must be submitted in writing within 14 calendar days. Decisions involving personal data require human review. The research office acknowledges submissions within two business days. Approved projects receive an identifier beginning with RP. Data exports must use encrypted storage.',
    ],
  },
  {
    id: 'legal-clinic-protocol',
    title: 'Legal Clinic Protocol',
    filename: 'legal-clinic-protocol.md',
    version: '1',
    kind: 'Protocol',
    lines: [
      '# Synthetic Legal Clinic Protocol',
      '',
      'The clinic provides general legal information, not legal advice. Clients must sign a consent form before an interview. Interview recordings are deleted after 90 days. A supervising solicitor reviews every external letter. Conflicts checks must finish before case allocation. Emergency matters are referred to an approved external service. Minors must attend with an authorised adult unless a safeguarding exception applies.',
    ],
  },
  {
    id: 'public-information-guide',
    title: 'Public Information Guide',
    filename: 'public-information-guide.md',
    version: '1',
    kind: 'Reference',
    lines: [
      '# Synthetic Public Information Guide',
      '',
      'Information requests are acknowledged within five working days. Standard requests are answered within 20 working days. Urgent requests require a written explanation. Fees are waived when the total is below 50 Hong Kong dollars. Records are supplied in accessible electronic format by default. Requesters may ask for Cantonese or English communication. Complaints are reviewed by an officer not involved in the original decision.',
    ],
  },
  {
    id: 'community-access-policy',
    title: 'Community Access Policy',
    filename: 'community-access-policy.md',
    version: '1',
    kind: 'Policy',
    lines: [
      '# Synthetic Community Access Policy',
      '',
      'Community workshops are free of charge. Registration opens 28 days before each workshop. Cancellations must be made at least 24 hours in advance. Venues provide step-free access. Interpretation can be requested seven days before an event. Attendance certificates are emailed within three working days. Participants may request deletion of optional profile data.',
    ],
  },
];

export const demoDocuments: readonly DemoDocument[] = Object.freeze(
  documentContent.map((document) => Object.freeze({ ...document, lines: Object.freeze(document.lines) })),
);

const scenarioContent: Record<ScenarioKey, Scenario> = {
  attendance: {
    question: 'What seminar attendance is required?',
    answer: 'Students must attend at least 80 percent of seminars.',
    sourceId: 'teaching-handbook',
    quote: 'Students must attend at least 80 percent of seminars.',
    sourceLine: 3,
    review: false,
    tools: [
      { name: 'search_documents', detail: 'Teaching handbook selected in this example.' },
      { name: 'get_evidence', detail: 'Source excerpt: teaching-handbook.md, line 3.' },
      { name: 'verify_citation', detail: 'The example quote matches the displayed source text.' },
    ],
  },
  version: {
    question: 'When do applications close in the latest policy?',
    answer: 'Applications close on 15 May in version 2. The earlier version states 1 May.',
    sourceId: 'research-policy-v2',
    previousSourceId: 'research-policy-v1',
    quote: 'Applications close on 15 May.',
    sourceLine: 5,
    review: false,
    tools: [
      { name: 'search_documents', detail: 'Both synthetic research policy versions are available.' },
      { name: 'compare_document_versions', detail: 'Application date: 1 May in version 1 → 15 May in version 2.' },
      { name: 'get_evidence', detail: 'Source excerpt: research-policy-v2.md, line 5.' },
      { name: 'verify_citation', detail: 'The example quote matches version 2, not version 1.' },
    ],
  },
  legal: {
    question: 'Should I appeal within 21 days?',
    answer: 'This example withholds a legal recommendation and illustrates the human-review boundary. The policy excerpt is context, not advice. No review request is created by this public demo.',
    sourceId: 'research-policy-v2',
    quote: 'Appeals must be submitted in writing within 21 calendar days.',
    sourceLine: 5,
    review: true,
    tools: [
      { name: 'search_documents', detail: 'The synthetic appeal policy is selected as context.' },
      { name: 'get_evidence', detail: 'Source excerpt: research-policy-v2.md, line 5.' },
      { name: 'verify_citation', detail: 'Textual matching does not establish legal applicability.' },
      { name: 'request_human_review', detail: 'Review boundary illustrated only; no request is submitted.' },
    ],
  },
};

for (const scenario of Object.values(scenarioContent)) {
  scenario.tools.forEach(Object.freeze);
  Object.freeze(scenario.tools);
  Object.freeze(scenario);
}

export const scenarios: Readonly<Record<ScenarioKey, Scenario>> = Object.freeze(scenarioContent);

function normalizeQuestion(question: string): string {
  return question.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?.!]+$/, '');
}

/** Exact normalized matching only: unsupported input never acquires an answer. */
export function resolveScenario(question: string): ScenarioKey | null {
  const normalized = normalizeQuestion(question);
  return (Object.keys(scenarios) as ScenarioKey[]).find(
    (key) => normalizeQuestion(scenarios[key].question) === normalized,
  ) ?? null;
}

/** Sequence numbers indicate replay order, not wall-clock or measured latency. */
export function getAuditReplay(key: ScenarioKey): AuditReplayEvent[] {
  const scenario = scenarios[key];
  return [
    {
      sequence: 1,
      event: 'demo.scenario_selected',
      detail: scenario.question,
      outcome: 'Replay',
    },
    ...scenario.tools.map((tool, index) => ({
      sequence: index + 2,
      event: tool.name,
      detail: tool.detail,
      outcome: tool.name === 'request_human_review' ? 'Illustrated' : 'Replay',
    })),
    {
      sequence: scenario.tools.length + 2,
      event: scenario.review ? 'demo.review_boundary_shown' : 'demo.answer_shown',
      detail: scenario.review
        ? 'Recommendation withheld. No live review task exists.'
        : 'Prewritten example shown alongside its synthetic source.',
      outcome: scenario.review ? 'Review required' : 'Example shown',
    },
  ];
}
