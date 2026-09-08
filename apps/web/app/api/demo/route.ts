import { flaskFetch } from "@/lib/flask";

const samples = [
  { title: "Campus Research Policy", version: "1", filename: "research-policy-v1.md", content: "# Research Policy\nApplications close on 1 May.\nApplicants must retain consent records for three years.\nAppeals must be submitted in writing within 14 calendar days.\nDecisions involving personal data require human review." },
  { title: "Campus Research Policy", version: "2", filename: "research-policy-v2.md", content: "# Research Policy\nApplications close on 15 May.\nApplicants must retain consent records for five years.\nAppeals must be submitted in writing within 21 calendar days.\nDecisions involving personal data require human review." },
  { title: "Teaching Handbook", version: "1", filename: "teaching-handbook.md", content: "# Teaching Handbook\nStudents must attend at least 80 percent of seminars.\nRecorded lectures are available for 30 days.\nAssessment extensions require documented exceptional circumstances." },
];

export async function POST(request: Request) {
  const { workspaceId } = (await request.json()) as { workspaceId?: string };
  if (!workspaceId) return Response.json({ error: { message: "workspaceId is required" } }, { status: 400 });
  const created = [];
  for (const sample of samples) {
    const form = new FormData();
    form.set("workspace_id", workspaceId);
    form.set("title", sample.title);
    form.set("version", sample.version);
    form.set("file", new File([sample.content], sample.filename, { type: "text/markdown" }));
    const response = await flaskFetch("/api/documents", { method: "POST", body: form });
    if (!response.ok) return new Response(await response.text(), { status: response.status });
    created.push(await response.json());
  }
  return Response.json({ documents: created });
}
