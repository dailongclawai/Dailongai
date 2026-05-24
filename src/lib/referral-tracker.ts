// Client-side referral tracker.
// Logs QR/link views + conversions to Supabase via public RPC track_referral_event.
// Privacy: generates a per-browser UUID in localStorage; hashes (session+ref+day) → visitor_hash.

import { getSupabaseClient } from './supabase';

const SESSION_KEY = 'dlai-tracker-session';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function visitorHashFor(refKey: string): Promise<string> {
  const session = getSessionId();
  const day = new Date().toISOString().slice(0, 10);
  return await sha256Hex(`${session}|${refKey}|${day}`);
}

function utmSource(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('utm_source');
}

export type ReferralEventType =
  | 'supervisor_view'
  | 'supervisor_signup'
  | 'supervisor_first_order'
  | 'dealer_view'
  | 'dealer_order';

interface TrackArgs {
  eventType: ReferralEventType;
  supervisorId?: string | null;
  dealerId?: string | null;
}

export async function trackReferral({ eventType, supervisorId, dealerId }: TrackArgs): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!supervisorId && !dealerId) return;
  try {
    const refKey = supervisorId ?? dealerId ?? '';
    const visitor_hash = await visitorHashFor(`${eventType}:${refKey}`);
    await getSupabaseClient().rpc('track_referral_event', {
      p_event_type: eventType,
      p_supervisor_id: supervisorId ?? null,
      p_dealer_id: dealerId ?? null,
      p_visitor_hash: visitor_hash,
      p_user_agent: navigator.userAgent ?? null,
      p_referrer: document.referrer || null,
      p_utm_source: utmSource(),
    });
  } catch {
    // Tracking must never break the page
  }
}
