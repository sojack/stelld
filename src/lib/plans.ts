import { Plan } from "@/generated/prisma/client";

export interface PlanLimits {
  maxForms: number;
  maxSubmissionsPerMonth: number;
  canCollectPayments: boolean;
  maxStorageMB: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxForms: 5,
    maxSubmissionsPerMonth: 100,
    canCollectPayments: false,
    maxStorageMB: 100,
  },
  PRO: {
    maxForms: 50,
    maxSubmissionsPerMonth: 1000,
    canCollectPayments: false,
    maxStorageMB: 1024,
  },
  BUSINESS: {
    maxForms: Infinity,
    maxSubmissionsPerMonth: 10000,
    canCollectPayments: true,
    maxStorageMB: 10240,
  },
};

export function getPlanLimits(plan: Plan | undefined | null): PlanLimits {
  return PLAN_LIMITS[plan ?? "FREE"];
}
