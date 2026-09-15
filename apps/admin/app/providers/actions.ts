"use server";

import { revalidatePath } from "next/cache";
import { getPool } from "../../lib/db";

export async function approveProvider(providerId: string) {
  const pool = getPool();
  await pool.query(
    `update provider_verifications set state = 'identity_verified', reviewed_at = now(), rejection_reason = null where provider_id = $1`,
    [providerId]
  );
  await pool.query(`update provider_profiles set verification_state = 'identity_verified', is_verified = true where id = $1`, [providerId]);
  revalidatePath("/providers");
}

export async function rejectProvider(providerId: string) {
  const pool = getPool();
  await pool.query(`update provider_verifications set state = 'rejected', reviewed_at = now(), rejection_reason = 'Revisión manual' where provider_id = $1`, [
    providerId,
  ]);
  await pool.query(`update provider_profiles set verification_state = 'rejected', is_verified = false where id = $1`, [providerId]);
  revalidatePath("/providers");
}
