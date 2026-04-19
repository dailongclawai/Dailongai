import { z } from "zod";

const PHONE_RE = /^(?:0[1-9]\d{8,9}|\+84\d{9,10})$/;

export const BetaLeadSchema = z.object({
  name: z.string().trim().max(100).optional().default(""),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s/g, ""))
    .refine((v) => PHONE_RE.test(v), { message: "Invalid phone format" }),
  turnstileToken: z.string().trim().max(2048).optional().default(""),
});

export const TtsSchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.enum(["nova", "alloy", "echo", "fable", "onyx", "shimmer"]).optional().default("nova"),
});

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(4000),
});

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(50),
});

export const StatsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});

export type BetaLeadInput = z.infer<typeof BetaLeadSchema>;
export type TtsInput = z.infer<typeof TtsSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
