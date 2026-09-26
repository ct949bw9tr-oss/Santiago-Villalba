import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

/** Server-only secrets. Never import this from client components. */
export function serverEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY?.trim(),
  });
  if (!parsed.success) throw new Error("Missing environment variable: SUPABASE_SECRET_KEY. See .env.example.");
  return parsed.data;
}
