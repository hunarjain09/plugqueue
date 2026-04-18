import { z } from 'zod';

export const plateSchema = z
  .string()
  .min(2)
  .max(12)
  .regex(/^[A-Z0-9 \-]+$/i, 'Invalid plate format')
  .transform((v) => v.toUpperCase().trim());

export const joinQueueSchema = z.object({
  plate: plateSchema,
  spot_id: z.string().max(10).optional(),
  device_hash: z.string().min(16).max(128),
  push_sub_id: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const leaveQueueSchema = z.object({
  entry_id: z.string().uuid(),
  device_hash: z.string().min(16).max(128),
});

export const confirmChargeSchema = z.object({
  entry_id: z.string().uuid(),
  device_hash: z.string().min(16).max(128),
});

export const updateStallStatusSchema = z.object({
  stalls: z.array(
    z.object({
      label: z.string().max(10),
      status: z.enum(['available', 'in_use', 'offline', 'unknown']),
    })
  ),
  device_hash: z.string().min(16).max(128),
  observed_at: z.string().datetime(),
});

export const flagEntrySchema = z.object({
  queue_entry_id: z.string().uuid(),
  flagger_device: z.string().min(16).max(128),
  reason: z.string().max(200).optional(),
});

export const pushSubscribeSchema = z.object({
  id: z.string().min(1),
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  device_hash: z.string().min(16).max(128),
});

export const sessionStatSchema = z.object({
  session_id: z.string().min(1),
  provider: z.string().min(1),
  duration_sec: z.number().int().positive(),
  energy_kwh: z.number().positive(),
  cost_usd: z.number().nonnegative().optional(),
  connector_type: z.string().min(1),
  max_kw_observed: z.number().int().positive().optional(),
});

export type JoinQueueInput = z.infer<typeof joinQueueSchema>;
export type LeaveQueueInput = z.infer<typeof leaveQueueSchema>;
export type ConfirmChargeInput = z.infer<typeof confirmChargeSchema>;
export type UpdateStallStatusInput = z.infer<typeof updateStallStatusSchema>;
export type FlagEntryInput = z.infer<typeof flagEntrySchema>;
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
export type SessionStatInput = z.infer<typeof sessionStatSchema>;
