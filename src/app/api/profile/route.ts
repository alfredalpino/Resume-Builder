import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiError, requireSession } from "@/lib/api";
import {
  buildMasterProfile,
  MasterProfileSchema,
  mergeApplication,
} from "@/lib/profile/master-profile";
import {
  deleteServerMasterProfile,
  getServerMasterProfile,
  upsertServerMasterProfile,
} from "@/lib/profile/server-store";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

/** Load master profile for the signed-in user. */
export async function GET() {
  const { error, session } = await requireSession();
  if (error) return error;
  const email = session?.user?.email;
  const profile = getServerMasterProfile(email);
  return NextResponse.json({ profile });
}

/** Save / update master profile. */
export async function PUT(req: Request) {
  const { error, session } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const resume = StructuredResumeSchema.parse(body.resume);
    const existing = getServerMasterProfile(session?.user?.email);
    let profile = buildMasterProfile(resume, {
      applications: body.applications ?? existing?.applications ?? [],
      integrityModeDefault: Boolean(
        body.integrityModeDefault ?? existing?.integrityModeDefault,
      ),
    });

    if (body.application) {
      profile = mergeApplication(profile, body.application);
    }

    profile = upsertServerMasterProfile(session?.user?.email, profile);
    return NextResponse.json({ profile, ok: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Save failed", 400);
  }
}

/** Replace full profile payload (from client localStorage sync). */
export async function POST(req: Request) {
  const { error, session } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = MasterProfileSchema.safeParse(body.profile);
    if (!parsed.success) {
      return apiError("Invalid master profile payload");
    }
    const profile = upsertServerMasterProfile(session?.user?.email, parsed.data);
    return NextResponse.json({ profile, ok: true });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Sync failed", 400);
  }
}

/** Privacy: delete stored master profile. */
export async function DELETE() {
  const { error, session } = await requireSession();
  if (error) return error;
  deleteServerMasterProfile(session?.user?.email);
  return NextResponse.json({ ok: true, deleted: true });
}
