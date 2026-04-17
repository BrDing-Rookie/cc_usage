import { z } from 'zod';

const isoDateTime = z.string().datetime({ offset: true });

export const alertKindSchema = z.enum([
  'quota_low',
  'refresh_stale',
  'auth_invalid',
  'source_broken'
]);

export const capabilitySchema = z.object({
  percent: z.boolean(),
  absoluteAmount: z.boolean(),
  resetTime: z.boolean(),
  planName: z.boolean(),
  healthSignal: z.boolean()
});

export const quotaWindowSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    percent: z.number().min(0).max(100).nullable(),
    usedAmount: z.number().nonnegative().nullable(),
    totalAmount: z.number().positive().nullable(),
    unit: z.string().min(1).nullable(),
    resetAt: isoDateTime.nullable()
  })
  .superRefine((value, ctx) => {
    const pair = [value.usedAmount, value.totalAmount];
    const bothNull = pair[0] === null && pair[1] === null;
    const bothPresent = pair[0] !== null && pair[1] !== null;

    if (!bothNull && !bothPresent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'usedAmount and totalAmount must both be null or both be present'
      });
    }
  });

export const sourceSnapshotSchema = z
  .object({
    sourceId: z.string().min(1),
    vendorFamily: z.string().min(1),
    sourceKind: z.enum([
      'official_api',
      'official_cli_or_local_state',
      'custom_endpoint',
      'browser_automation'
    ]),
    accountLabel: z.string().min(1),
    planName: z.string().min(1).nullable(),
    usagePercent: z.number().min(0).max(100).nullable(),
    usedAmount: z.number().nonnegative().nullable(),
    totalAmount: z.number().positive().nullable(),
    amountUnit: z.string().min(1).nullable(),
    resetAt: isoDateTime.nullable(),
    refreshStatus: z.enum(['ok', 'stale', 'auth_invalid', 'source_broken']),
    lastSuccessAt: isoDateTime.nullable(),
    lastError: z.string().min(1).nullable(),
    alertKind: alertKindSchema.nullable(),
    capabilities: capabilitySchema,
    windows: z.array(quotaWindowSchema)
  })
  .superRefine((value, ctx) => {
    const bothNull = value.usedAmount === null && value.totalAmount === null;
    const bothPresent = value.usedAmount !== null && value.totalAmount !== null;

    if (!bothNull && !bothPresent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'usedAmount and totalAmount must both be null or both be present'
      });
    }

    if (!value.capabilities.absoluteAmount && !bothNull) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'absolute amounts must be null when absoluteAmount capability is false'
      });
    }
  });

export const gatewayIdSchema = z.enum(['llm-gateway', 'vibe']);

export const gatewaySummarySchema = z.object({
  gatewayId: gatewayIdSchema,
  accountCount: z.number().int().nonnegative(),
  healthyCount: z.number().int().nonnegative(),
  brokenCount: z.number().int().nonnegative(),
  usagePercent: z.number().min(0).max(100).nullable(),
  usedAmount: z.number().nonnegative().nullable(),
  totalAmount: z.number().positive().nullable(),
  amountUnit: z.string().min(1).nullable(),
  topAlertKind: alertKindSchema.nullable(),
  lastSuccessAt: isoDateTime.nullable()
});

export const accountSnapshotSchema = sourceSnapshotSchema.extend({
  gatewayId: gatewayIdSchema,
  accountId: z.string().min(1)
});

export const materializedStateSchema = z.object({
  generatedAt: isoDateTime,
  gateways: z.array(gatewaySummarySchema),
  accounts: z.array(accountSnapshotSchema)
});

export const accountConfigSchema = z.object({
  accountId: z.string().min(1),
  label: z.string().min(1),
  apiKey: z.string().min(1),
  enabled: z.boolean().default(true)
});

export const appConfigSchema = z.object({
  statusBar: z
    .object({
      pinnedAccountId: z.string().min(1).nullable().default(null)
    })
    .default({ pinnedAccountId: null }),
  gateways: z.array(
    z.object({
      gatewayId: gatewayIdSchema,
      accounts: z.array(accountConfigSchema)
    })
  )
});

export type AlertKind = z.infer<typeof alertKindSchema>;
export type CapabilitySet = z.infer<typeof capabilitySchema>;
export type GatewaySummary = z.infer<typeof gatewaySummarySchema>;
export type AccountSnapshot = z.infer<typeof accountSnapshotSchema>;
export type AccountConfig = z.infer<typeof accountConfigSchema>;
export type QuotaWindow = z.infer<typeof quotaWindowSchema>;
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export type MaterializedState = z.infer<typeof materializedStateSchema>;
export type GatewayId = z.infer<typeof gatewayIdSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
