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

export const materializedStateSchema = z.object({
  generatedAt: isoDateTime,
  sources: z.array(sourceSnapshotSchema)
});

export const appConfigSchema = z.object({
  mininglamp: z.object({
    baseUrl: z.string().url(),
    apiKey: z.string().min(1),
  }).optional(),
});

export type AlertKind = z.infer<typeof alertKindSchema>;
export type CapabilitySet = z.infer<typeof capabilitySchema>;
export type QuotaWindow = z.infer<typeof quotaWindowSchema>;
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export type MaterializedState = z.infer<typeof materializedStateSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
