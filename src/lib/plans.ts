import { Plan } from "@/generated/prisma/client";

export interface PlanLimits {
  maxForms: number;
  maxSubmissionsPerMonth: number;
  canCollectPayments: boolean;
  canUploadBanner: boolean;
  canCustomizeSlug: boolean;
  maxStorageMB: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxForms: 5,
    maxSubmissionsPerMonth: 100,
    canCollectPayments: false,
    canUploadBanner: false,
    canCustomizeSlug: false,
    maxStorageMB: 100,
  },
  PRO: {
    maxForms: 50,
    maxSubmissionsPerMonth: 1000,
    canCollectPayments: false,
    canUploadBanner: true,
    canCustomizeSlug: true,
    maxStorageMB: 1024,
  },
  BUSINESS: {
    maxForms: Infinity,
    maxSubmissionsPerMonth: 10000,
    canCollectPayments: true,
    canUploadBanner: true,
    canCustomizeSlug: true,
    maxStorageMB: 10240,
  },
};

export function getPlanLimits(plan: Plan | undefined | null): PlanLimits {
  return PLAN_LIMITS[plan ?? "FREE"];
}
