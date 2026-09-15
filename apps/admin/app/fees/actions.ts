"use server";

import { revalidatePath } from "next/cache";
import { getPool } from "../../lib/db";

export async function updateFee(feeId: string, formData: FormData) {
  const customerFeePercent = Number(formData.get("customer_fee_percent"));
  const providerCommissionPercent = Number(formData.get("provider_commission_percent"));
  const minFeeAmount = Number(formData.get("min_fee_amount"));
  const maxFeeAmountRaw = formData.get("max_fee_amount");
  const maxFeeAmount = maxFeeAmountRaw ? Number(maxFeeAmountRaw) : null;

  const pool = getPool();
  await pool.query(
    `update platform_fees set customer_fee_percent = $1, provider_commission_percent = $2, min_fee_amount = $3, max_fee_amount = $4
     where id = $5`,
    [customerFeePercent, providerCommissionPercent, minFeeAmount, maxFeeAmount, feeId]
  );
  revalidatePath("/fees");
}
