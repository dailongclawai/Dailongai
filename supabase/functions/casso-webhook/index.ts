// Casso webhook receiver — auto-confirm order paid when matching bank transaction arrives.
//
// Casso payload format (https://docs.casso.vn/docs/webhook):
//   POST /functions/v1/casso-webhook
//   Headers: Secure-Token: <token set in Casso dashboard>
//   Body: { error: 0, data: [ { id, tid, description, amount, when, ... } ] }
//
// Matching logic:
//   - Extract DL[8 hex chars] from `description`
//   - Look up order WHERE id::text starts with that 8-hex prefix
//   - Verify abs(amount - sale_price) <= 1000đ
//   - UPDATE orders SET status='approved'→'paid' (triggers notify_order_status_change)
//   - Stamp commission_payouts.paid_at with casso:<tid> reference

// @ts-expect-error — Deno deploy runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CASSO_TOKEN = Deno.env.get('CASSO_WEBHOOK_TOKEN')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') ?? '';

interface CassoTx {
  id: number;
  tid: string;
  description: string;
  amount: number;
  when?: string;
  bank_sub_acc_id?: string;
  subAccId?: string;
  corresponsiveName?: string;
  corresponsiveAccount?: string;
  corresponsiveBankName?: string;
}

interface CassoPayload {
  error: number;
  data: CassoTx[];
}

const MEMO_PATTERN = /DL([0-9A-Fa-f]{8})/;

interface ProcessResult {
  tx_id: number;
  tid: string;
  outcome: string;
  order_id?: string;
  amount?: number;
  telegram?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

async function notifyTelegramPaid(
  sb: ReturnType<typeof createClient>,
  orderId: string,
  tx: CassoTx,
): Promise<string> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) return 'tg_disabled';

  const { data: o, error } = await sb
    .from('orders')
    .select('id, customer_name, customer_phone, sale_price, quantity, model_id, dealer_id')
    .eq('id', orderId)
    .single();
  if (error || !o) return `tg_fetch_failed:${error?.message ?? 'no_row'}`;
  const ord = o as {
    id: string;
    customer_name: string;
    customer_phone: string;
    sale_price: number;
    quantity: number | null;
    model_id: string;
    dealer_id: string;
  };

  const [modelRes, dealerRes] = await Promise.all([
    sb.from('product_models').select('name').eq('id', ord.model_id).single(),
    sb.from('profiles').select('full_name, account_no').eq('id', ord.dealer_id).single(),
  ]);
  const modelName = (modelRes.data as { name?: string } | null)?.name ?? '(model?)';
  const dealer = (dealerRes.data as { full_name?: string; account_no?: number } | null) ?? {};

  const shortId = ord.id.slice(0, 8);
  const qty = ord.quantity ?? 1;
  const lines = [
    '<b>💰 ĐƠN HÀNG ĐÃ THANH TOÁN</b>',
    `Mã: <code>DL${shortId}</code>`,
    `Khách: ${escapeHtml(ord.customer_name)} (${escapeHtml(ord.customer_phone)})`,
    `Sản phẩm: ${escapeHtml(modelName)} × ${qty}`,
    `Số tiền: <b>${formatVND(Number(ord.sale_price))} ₫</b>`,
    `NV: ${escapeHtml(dealer.full_name ?? '(?)')}${dealer.account_no ? ` (#${dealer.account_no})` : ''}`,
    `Casso TID: <code>${escapeHtml(tx.tid)}</code>`,
  ];

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_ADMIN_CHAT_ID,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return `tg_http_${res.status}:${body.slice(0, 120)}`;
  }
  return 'tg_sent';
}

async function processTx(sb: ReturnType<typeof createClient>, tx: CassoTx): Promise<ProcessResult> {
  // Only positive (incoming) amounts
  if (tx.amount <= 0) {
    return { tx_id: tx.id, tid: tx.tid, outcome: 'ignored_outgoing' };
  }

  const match = MEMO_PATTERN.exec(tx.description ?? '');
  if (!match) {
    return { tx_id: tx.id, tid: tx.tid, outcome: 'no_memo_match' };
  }
  const shortId = match[1].toLowerCase();

  const { data: orders, error: findErr } = await sb
    .from('orders')
    .select('id, sale_price, status, dealer_id')
    .filter('id', 'gte', `${shortId}-0000-0000-0000-000000000000`)
    .filter('id', 'lt', `${shortId}-ffff-ffff-ffff-ffffffffffff`)
    .limit(2);

  if (findErr) {
    return { tx_id: tx.id, tid: tx.tid, outcome: `db_error:${findErr.message}` };
  }
  if (!orders || orders.length === 0) {
    return { tx_id: tx.id, tid: tx.tid, outcome: 'order_not_found' };
  }
  if (orders.length > 1) {
    return { tx_id: tx.id, tid: tx.tid, outcome: 'memo_ambiguous' };
  }

  const order = orders[0] as { id: string; sale_price: number; status: string; dealer_id: string };

  if (Math.abs(Number(order.sale_price) - tx.amount) > 1000) {
    return {
      tx_id: tx.id,
      tid: tx.tid,
      outcome: 'amount_mismatch',
      order_id: order.id,
      amount: tx.amount,
    };
  }

  if (order.status === 'paid') {
    return { tx_id: tx.id, tid: tx.tid, outcome: 'already_paid', order_id: order.id };
  }
  if (order.status === 'rejected' || order.status === 'voided') {
    return { tx_id: tx.id, tid: tx.tid, outcome: `order_${order.status}`, order_id: order.id };
  }

  if (order.status === 'pending') {
    const { error: appErr } = await sb
      .from('orders')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: order.dealer_id,
      })
      .eq('id', order.id);
    if (appErr) return { tx_id: tx.id, tid: tx.tid, outcome: `approve_failed:${appErr.message}`, order_id: order.id };
  }

  const { error: paidErr } = await sb
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', order.id);
  if (paidErr) return { tx_id: tx.id, tid: tx.tid, outcome: `mark_paid_failed:${paidErr.message}`, order_id: order.id };

  await sb
    .from('commission_payouts')
    .update({
      paid_at: new Date().toISOString(),
      payment_proof_url: `casso:${tx.id}:${tx.tid}`,
    })
    .eq('order_id', order.id);

  let tgOutcome = 'tg_skipped';
  try {
    tgOutcome = await notifyTelegramPaid(sb, order.id, tx);
  } catch (e) {
    tgOutcome = `tg_threw:${(e as Error).message?.slice(0, 120) ?? 'unknown'}`;
  }

  return {
    tx_id: tx.id,
    tid: tx.tid,
    outcome: 'paid',
    order_id: order.id,
    amount: tx.amount,
    telegram: tgOutcome,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = req.headers.get('secure-token') ?? '';
  if (token !== CASSO_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: CassoPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  if (payload.error !== 0 || !Array.isArray(payload.data)) {
    return Response.json({ ignored: 'invalid_payload', error: payload.error });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const results: ProcessResult[] = [];
  for (const tx of payload.data) {
    results.push(await processTx(sb, tx));
  }

  return Response.json({ ok: true, processed: results.length, results });
});
