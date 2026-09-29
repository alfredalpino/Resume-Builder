/**
 * In-memory Master Profile store keyed by user email (serverless-friendly).
 * Client localStorage remains primary; this syncs when authenticated.
 */
import {
  buildMasterProfile,
  MasterProfileSchema,
  type MasterProfile,
} from "@/lib/profile/master-profile";
import type { StructuredResume } from "@/lib/schema";

const store = new Map<string, MasterProfile>();

function keyFor(email: string | null | undefined): string {
  return (email || "anonymous").trim().toLowerCase() || "anonymous";
}

export function getServerMasterProfile(
  email: string | null | undefined,
): MasterProfile | null {
  return store.get(keyFor(email)) || null;
}

export function upsertServerMasterProfile(
  email: string | null | undefined,
  profile: MasterProfile,
): MasterProfile {
  const parsed = MasterProfileSchema.parse({
    ...profile,
    updatedAt: new Date().toISOString(),
  });
  store.set(keyFor(email), parsed);
  return parsed;
}

export function saveResumeAsMasterProfile(
  email: string | null | undefined,
  resume: StructuredResume,
  extras?: Partial<MasterProfile>,
): MasterProfile {
  const existing = getServerMasterProfile(email);
  const profile = buildMasterProfile(resume, {
    applications: extras?.applications ?? existing?.applications ?? [],
    integrityModeDefault:
      extras?.integrityModeDefault ?? existing?.integrityModeDefault ?? false,
  });
  return upsertServerMasterProfile(email, profile);
}

export function deleteServerMasterProfile(email: string | null | undefined): void {
  store.delete(keyFor(email));
}
