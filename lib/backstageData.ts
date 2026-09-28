import { createAdminClient } from "@/utils/supabase/admin";
import {
  byDeadlineUrgency,
  deliveryDeadline,
  isAtRisk,
  type DeliveryDeadline,
} from "@/lib/deliveryDeadline";

// Server-side reads for the backstage. All queries run with the service-role
// key, so every caller MUST sit behind requireBackstage().

export interface OrderRow {
  id: string;
  order_no: string;
  created_at: string;
  updated_at: string | null;
  status: string;
  locale: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  country: string | null;
  delivery_method: string | null;
  /** Payment lifecycle (0006_payments.sql). Drives the §6.2a delivery clock. */
  payment_status: string;
  paid_at: string | null;
  design_spec: Record<string, unknown>;
  design: Record<string, unknown> | null;
  kit_price_czk: number | null;
  total_price_czk: number | null;
  accepted_at: string;
  accepted_doc_versions: Record<string, string>;
  acknowledged_custom_withdrawal_exclusion: boolean;
  custom_specification: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
}

export interface SubscriberRow {
  id: string;
  email: string;
  locale: string;
  source: string;
  consented_at: string;
  unsubscribed_at: string | null;
  resend_contact_id: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  name: string;
  email: string;
  message: string;
  locale: string;
  created_at: string;
  handled_at: string | null;
}

export interface DesignRow {
  id: string;
  slug: string;
  locale: string;
  source: string;
  created_at: string;
}

/** True when the timestamp falls inside the trailing window (lint-safe for RSC bodies). */
export function isWithinDays(iso: string, days: number): boolean {
  return Date.parse(iso) > Date.now() - days * 86_400_000;
}

export const ORDER_STATUSES = [
  "received",
  "confirmed",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export async function fetchOrders(statusFilter?: string): Promise<OrderRow[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (statusFilter && (ORDER_STATUSES as readonly string[]).includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }
  const { data, error } = await query;
  if (error) throw new Error(`orders query failed: ${error.message}`);
  return (data ?? []) as OrderRow[];
}

export interface OrderWithDeadline {
  order: OrderRow;
  deadline: DeliveryDeadline;
}

/**
 * Orders classified against the T&C §6.2a 28-day delivery deadline, most urgent
 * first. The whole list is measured against a single instant so rows cannot
 * disagree about "now", and the clock is read here rather than in the page so
 * the render stays pure.
 */
export async function fetchOrdersWithDeadlines(statusFilter?: string): Promise<{
  orders: OrderWithDeadline[];
  atRisk: OrderWithDeadline[];
  overdue: OrderWithDeadline[];
}> {
  const rows = await fetchOrders(statusFilter);
  const now = Date.now();
  const orders = rows
    .map((order) => ({ order, deadline: deliveryDeadline(order, now) }))
    .sort((a, b) => byDeadlineUrgency(a.deadline, b.deadline));
  const atRisk = orders.filter((o) => isAtRisk(o.deadline));
  return { orders, atRisk, overdue: atRisk.filter((o) => o.deadline.level === "overdue") };
}

export async function fetchOrder(id: string): Promise<OrderRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`order query failed: ${error.message}`);
  return (data as OrderRow) ?? null;
}

/** The §6.2a clock for a single order. Kept here so pages never read the clock. */
export function fetchOrderDeadline(order: OrderRow): DeliveryDeadline {
  return deliveryDeadline(order, Date.now());
}

export async function fetchSubscribers(): Promise<SubscriberRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("id,email,locale,source,consented_at,unsubscribed_at,resend_contact_id,created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`newsletter query failed: ${error.message}`);
  return (data ?? []) as SubscriberRow[];
}

export async function fetchMessages(): Promise<MessageRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contact_messages")
    .select("id,name,email,message,locale,created_at,handled_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`messages query failed: ${error.message}`);
  return (data ?? []) as MessageRow[];
}

export async function fetchDesigns(): Promise<DesignRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("designs")
    .select("id,slug,locale,source,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`designs query failed: ${error.message}`);
  return (data ?? []) as DesignRow[];
}

// ── Dashboard aggregates ─────────────────────────────────────────────────────

export interface DashboardStats {
  revenueTotalCzk: number;
  revenue30dCzk: number;
  ordersTotal: number;
  orders30d: number;
  ordersByStatus: Record<string, number>;
  subscribersActive: number;
  subscribers30d: number;
  messagesUnhandled: number;
  designsTotal: number;
  /** Last 14 days, oldest first. */
  dailyOrders: { day: string; orders: number; signups: number }[];
  recentOrders: OrderRow[];
  recentMessages: MessageRow[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [orders, subscribers, messages, designs] = await Promise.all([
    fetchOrders(),
    fetchSubscribers(),
    fetchMessages(),
    fetchDesigns(),
  ]);

  const now = Date.now();
  const cutoff30d = now - 30 * 86_400_000;
  const paid = orders.filter((o) => o.status !== "cancelled");

  const ordersByStatus: Record<string, number> = {};
  for (const s of ORDER_STATUSES) ordersByStatus[s] = 0;
  for (const o of orders) ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;

  const days: { day: string; orders: number; signups: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    days.push({ day: d.toISOString().slice(0, 10), orders: 0, signups: 0 });
  }
  const byDay = new Map(days.map((d) => [d.day, d]));
  for (const o of orders) {
    const bucket = byDay.get(o.created_at.slice(0, 10));
    if (bucket) bucket.orders += 1;
  }
  for (const s of subscribers) {
    const bucket = byDay.get(s.created_at.slice(0, 10));
    if (bucket) bucket.signups += 1;
  }

  return {
    revenueTotalCzk: paid.reduce((sum, o) => sum + (o.total_price_czk ?? 0), 0),
    revenue30dCzk: paid
      .filter((o) => Date.parse(o.created_at) > cutoff30d)
      .reduce((sum, o) => sum + (o.total_price_czk ?? 0), 0),
    ordersTotal: orders.length,
    orders30d: orders.filter((o) => Date.parse(o.created_at) > cutoff30d).length,
    ordersByStatus,
    subscribersActive: subscribers.filter((s) => !s.unsubscribed_at).length,
    subscribers30d: subscribers.filter((s) => Date.parse(s.created_at) > cutoff30d).length,
    messagesUnhandled: messages.filter((m) => !m.handled_at).length,
    designsTotal: designs.length,
    dailyOrders: days,
    recentOrders: orders.slice(0, 8),
    recentMessages: messages.filter((m) => !m.handled_at).slice(0, 5),
  };
}
