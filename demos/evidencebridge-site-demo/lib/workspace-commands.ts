import { demoDocuments, scenarios, type ScenarioKey } from './demo-data.ts';

export type WorkspaceView = 'research' | 'documents' | 'audit';
export type WorkspaceCommand = {
  id: string;
  title: string;
  detail: string;
  keywords: string;
} & (
  | { kind: 'view'; value: WorkspaceView }
  | { kind: 'example'; value: ScenarioKey }
  | { kind: 'source'; value: string }
);

export const exampleNames: Record<ScenarioKey, string> = {
  attendance: 'Attendance requirement',
  version: 'Policy deadline',
  legal: 'Legal review',
};
export const workspaceCommands: readonly WorkspaceCommand[] = [
  ...(['research', 'documents', 'audit'] as const).map((value) => ({
    id: `view-${value}`,
    kind: 'view' as const,
    value,
    title: {
      research: 'Research',
      documents: 'Documents',
      audit: 'Audit replay',
    }[value],
    detail: 'Workspace view',
    keywords: '',
  })),
  ...Object.entries(scenarios).map(([key, scenario]) => ({
    id: `example-${key}`,
    kind: 'example' as const,
    value: key as ScenarioKey,
    title: exampleNames[key as ScenarioKey],
    detail: scenario.question,
    keywords: 'guided example',
  })),
  ...demoDocuments.map((doc) => ({
    id: `source-${doc.id}`,
    kind: 'source' as const,
    value: doc.id,
    title: `${doc.title} · v${doc.version}`,
    detail: doc.filename,
    keywords: `source document ${doc.kind}`,
  })),
];

/** This searches UI destinations only. It never generates an answer. */
export function searchCommands(query: string): readonly WorkspaceCommand[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return workspaceCommands.filter((item) => {
    const text =
      `${item.title} ${item.detail} ${item.keywords}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
