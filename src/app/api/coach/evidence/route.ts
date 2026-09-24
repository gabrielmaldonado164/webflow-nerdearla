import { buildEvidence } from "@/coach/evidence";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const result = buildEvidence(body);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });
  return Response.json(result.evidence);
}
