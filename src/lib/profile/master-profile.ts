/**
 * Master Candidate Profile — persists across applications (local + optional server).
 * R&D §44 Candidate Master Profile.
 */
import { z } from "zod";
import { extractEvidenceGraph, EvidenceItemSchema } from "@/lib/evidence/graph";
import { StructuredResumeSchema, type StructuredResume } from "@/lib/schema";

export const ApplicationHistoryEntrySchema = z.object({
  id: z.string(),
  targetRole: z.string().default(""),
  companyHint: z.string().default(""),
  jdSnippet: z.string().default(""),
  intensity: z.enum(["subtle", "medium", "hard"]).optional(),
  matchRate: z.number().optional(),
  atsRobustness: z.number().optional(),
  integrityScore: z.number().optional(),
  createdAt: z.string(),
});

export type ApplicationHistoryEntry = z.infer<typeof ApplicationHistoryEntrySchema>;

export const MasterProfileSchema = z.object({
  version: z.literal(1),
  resume: StructuredResumeSchema,
  evidence: z.array(EvidenceItemSchema).default([]),
  applications: z.array(ApplicationHistoryEntrySchema).default([]),
  integrityModeDefault: z.boolean().default(false),
  updatedAt: z.string(),
});

export type MasterProfile = z.infer<typeof MasterProfileSchema>;

export const MASTER_PROFILE_KEY = "alfred-terminal-master-profile-v1";

export function buildMasterProfile(
  resume: StructuredResume,
  extras?: Partial<MasterProfile>,
): MasterProfile {
  return MasterProfileSchema.parse({
    version: 1,
    resume,
    evidence: extractEvidenceGraph(resume),
    applications: extras?.applications || [],
    integrityModeDefault: extras?.integrityModeDefault ?? false,
    updatedAt: new Date().toISOString(),
  });
}

export function mergeApplication(
  profile: MasterProfile,
  entry: {
    id?: string;
    createdAt?: string;
    targetRole?: string;
    companyHint?: string;
    jdSnippet?: string;
    intensity?: ApplicationHistoryEntry["intensity"];
    matchRate?: number;
    atsRobustness?: number;
    integrityScore?: number;
  },
): MasterProfile {
  const next: ApplicationHistoryEntry = {
    id: entry.id || `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    targetRole: entry.targetRole || "",
    companyHint: entry.companyHint || "",
    jdSnippet: (entry.jdSnippet || "").slice(0, 400),
    intensity: entry.intensity,
    matchRate: entry.matchRate,
    atsRobustness: entry.atsRobustness,
    integrityScore: entry.integrityScore,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  const applications = [next, ...profile.applications].slice(0, 40);
  return {
    ...profile,
    applications,
    updatedAt: new Date().toISOString(),
  };
}

export function loadMasterProfileFromStorage(): MasterProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MASTER_PROFILE_KEY);
    if (!raw) return null;
    const parsed = MasterProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveMasterProfileToStorage(profile: MasterProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MASTER_PROFILE_KEY, JSON.stringify(profile));
}

export function clearMasterProfileStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MASTER_PROFILE_KEY);
}
