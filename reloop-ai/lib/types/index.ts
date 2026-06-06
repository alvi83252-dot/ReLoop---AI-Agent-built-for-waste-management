import { z } from "zod";

export const DeviceTypeSchema = z.enum([
  "laptop",
  "monitor",
  "switch",
  "server",
  "tablet",
  "phone",
  "networking",
]);

export const RecoveryActionSchema = z.enum([
  "reuse",
  "repair",
  "resell",
  "donate",
  "recycle",
]);

export const InventoryItemSchema = z.object({
  id: z.string(),
  deviceType: DeviceTypeSchema,
  quantity: z.number().int().positive(),
  conditionScore: z.number().min(0).max(1),
  estimatedAgeYears: z.number().min(0),
  brand: z.string().optional(),
  notes: z.string().optional(),
});

export const AssetPayloadSchema = z.object({
  deviceType: z.string(),
  conditionScore: z.number(),
  estimatedAge: z.number(),
  quantity: z.number().default(1),
  location: z.enum(["edge", "cloud"]),
  processedAt: z.string().optional(),
  confidence: z.number().optional(),
});

export const OptimizationResultSchema = z.object({
  action: RecoveryActionSchema,
  confidence: z.number(),
  carbonSavedKg: z.number(),
  valueRecoveredGBP: z.number(),
  destination: z.string(),
  reasoning: z.string().optional(),
});

export const AgentStepSchema = z.object({
  id: z.string(),
  agent: z.string(),
  layer: z.enum(["edge", "dgx", "synthesis", "execution"]),
  status: z.enum(["pending", "running", "complete", "error"]),
  message: z.string(),
  timestamp: z.number(),
  confidence: z.number().optional(),
  output: z.record(z.string(), z.unknown()).optional(),
});

export const PipelineResultSchema = z.object({
  inventory: z.array(InventoryItemSchema),
  assetPayloads: z.array(AssetPayloadSchema),
  optimizations: z.array(OptimizationResultSchema),
  timeline: z.array(AgentStepSchema),
  summary: z.object({
    totalDevices: z.number(),
    devicesRescued: z.number(),
    carbonSavedKg: z.number(),
    valueRecoveredGBP: z.number(),
    landfillAvoidedKg: z.number(),
    circularEconomyScore: z.number(),
    environmentalScore: z.number(),
  }),
  reports: z.object({
    recoveryPlan: z.string(),
    carbonReport: z.string(),
    economicReport: z.string(),
    reflectionNotes: z.string(),
  }),
  knowledgeGraph: z.object({
    nodes: z.array(
      z.object({ id: z.string(), label: z.string(), type: z.string() })
    ),
    edges: z.array(
      z.object({ from: z.string(), to: z.string(), label: z.string() })
    ),
  }),
  voiceSummary: z.string(),
  sponsors: z.object({
    edge: z.literal("HP ZGX Nano AI Station"),
    core: z.literal("NVIDIA DGX Spark"),
    inference: z.literal("NVIDIA CUDA / TensorRT"),
    cloudBackup: z.literal("Nebius"),
    voice: z.literal("ElevenLabs"),
  }),
  demoMode: z.boolean(),
});

export type DeviceType = z.infer<typeof DeviceTypeSchema>;
export type RecoveryAction = z.infer<typeof RecoveryActionSchema>;
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type AssetPayload = z.infer<typeof AssetPayloadSchema>;
export type OptimizationResult = z.infer<typeof OptimizationResultSchema>;
export type AgentStep = z.infer<typeof AgentStepSchema>;
export type PipelineResult = z.infer<typeof PipelineResultSchema>;

export interface AgentContext {
  inventory: InventoryItem[];
  assets: AssetPayload[];
  lifecycle: Record<string, unknown>[];
  circular: OptimizationResult[];
  carbon: Record<string, unknown>[];
  economic: Record<string, unknown>[];
  matches: Record<string, unknown>[];
  risks: Record<string, unknown>[];
  reflection: string;
  timeline: AgentStep[];
}
