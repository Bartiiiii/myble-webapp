import { createAdminClient } from "@/utils/supabase/admin";

// Server-side reads scoped to a single customer's session e-mail. Distinct
// from lib/backstageData.ts (unscoped, admin-only reads) — every function
// here takes the caller's normalized e-mail and filters by it, so it's safe
// to call from a route that only knows "who is logged in," never "give me
// everything."

export interface AccountDesignRow {
  id: string;
  slug: string;
  name: string | null;
  design: Record<string, unknown>;
  locale: string;
  created_at: string;
  /** private | pending | published | rejected — see 0007_community.sql. */
  share_status: string;
  /** The title given when sharing to the library (null while private). */
  title: string | null;
  review_note: string | null;
}

export interface AccountOrderRow {
  order_no: string;
  created_at: string;
  status: string;
  delivery_method: string | null;
  city: string | null;
  total_price_czk: number | null;
  design_spec: Record<string, unknown>;
}

export async function fetchAccountDesigns(email: string): Promise<AccountDesignRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("designs")
    .select("id,slug,name,design,locale,created_at,share_status,title,review_note")
    .eq("user_email", email)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`account designs query failed: ${error.message}`);
  return (data ?? []) as AccountDesignRow[];
}

// Customer-safe columns only — never design (full cut-list), custom_specification,
// ip, user_agent, or any rules_* column. Orders are guest checkout (email is
// free text from the order form, not a real identity link), so this is a
// best-effort match, not a guaranteed-ownership query.
export async function fetchAccountOrders(email: string): Promise<AccountOrderRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("order_no,created_at,status,delivery_method,city,total_price_czk,design_spec")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`account orders query failed: ${error.message}`);
  return (data ?? []) as AccountOrderRow[];
}
