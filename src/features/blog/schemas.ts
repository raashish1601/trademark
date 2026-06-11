import { z } from "zod";

export const submitBlogSchema = z.object({
  title: z.string().min(8, "Give it a clear title (8+ chars)").max(120),
  excerpt: z.string().min(20, "Write a short summary (20+ chars)").max(280),
  contentHtml: z.string().min(40, "Your article is too short").max(120_000),
});

export const reviewBlogSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

export type SubmitBlogInput = z.infer<typeof submitBlogSchema>;
