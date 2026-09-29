import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import {
  applyIntegrityGate,
  buildClaimIntegrityReport,
  extractEvidenceGraph,
} from "@/lib/evidence/graph";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

/** Build evidence graph + claim integrity vs source. Optional enforce gate. */
export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const tailored = StructuredResumeSchema.parse(body.resume || body.tailored);
    const source = body.source
      ? StructuredResumeSchema.parse(body.source)
      : tailored;
    const enforce = Boolean(body.enforceIntegrityGate);

    const evidence = extractEvidenceGraph(source);
    const report = buildClaimIntegrityReport(source, tailored);

    if (enforce) {
      const gated = applyIntegrityGate(source, tailored);
      return NextResponse.json({
        evidence,
        report: gated.report,
        resume: gated.resume,
        removed: gated.removed,
        enforced: true,
      });
    }

    return NextResponse.json({
      evidence,
      report,
      resume: tailored,
      removed: 0,
      enforced: false,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Evidence analysis failed", 400);
  }
}
