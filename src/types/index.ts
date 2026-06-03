export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error';
export type Provider = 'google' | 'microsoft' | 'yahoo';

export interface Profile {
  id: string;
  email: string;
  created_at: string;
  scan_status: ScanStatus;
  photos_count: number;
  has_paid: boolean;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
}

export interface Scan {
  id: string;
  user_id: string;
  nylas_grant_id: string | null;
  gmail_access_token: string | null;
  gmail_refresh_token: string | null;
  provider: string;
  started_at: string;
  completed_at: string | null;
  status: 'pending' | 'running' | 'complete' | 'error';
  emails_processed: number;
  photos_found: number;
  error_message: string | null;
}

export interface Photo {
  id: string;
  user_id: string;
  scan_id: string;
  r2_key: string;
  r2_url: string;
  sender_name: string | null;
  sender_email: string | null;
  email_subject: string | null;
  email_date: string | null;
  file_size: number | null;
  mime_type: string | null;
  ai_confidence: number | null;
  category: string | null;
  created_at: string;
}

export interface ScanStartEvent {
  userId: string;
  scanId: string;
  nylasGrantId: string;
}

export interface EmailProcessEvent {
  userId: string;
  scanId: string;
  emailId: string;
  nylasGrantId: string;
}

export interface PhotoFoundEvent {
  photo: Photo;
}

// ── Inbox cleanup (junk → Trash) ──────────────────────────────────────────

export type CleanupStatus =
  | 'pending'
  | 'scanning'
  | 'review'
  | 'applying'
  | 'complete'
  | 'error';

/** Which trust tier a candidate message falls into. See docs/inbox-cleanup-design.md §2. */
export type CleanupTier = 'auto' | 'review' | 'protected';

/** Per-item lifecycle. */
export type CleanupDecision =
  | 'pending'
  | 'approved'
  | 'skipped'
  | 'trashed'
  | 'restored'
  | 'failed';

/** A single cleanup pass over the inbox. Sibling of `Scan`. */
export interface CleanupRun {
  id: string;
  user_id: string;
  status: CleanupStatus;
  emails_scanned: number;
  junk_found: number;
  auto_enabled: boolean;
  bytes_reclaimed: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

/** One candidate message. Headers/metadata only — never the email body. */
export interface CleanupItem {
  id: string;
  run_id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  sender_email: string | null;
  sender_name: string | null;
  subject: string | null;
  internal_date: string | null;
  size_estimate: number | null;
  gmail_category: string | null;
  has_list_unsubscribe: boolean;
  confidence: number | null;
  reason: string | null;
  tier: CleanupTier;
  decision: CleanupDecision;
  trashed_at: string | null;
  restored_at: string | null;
}

export interface CleanupStartEvent {
  userId: string;
  runId: string;
}

export interface CleanupItemEvent {
  userId: string;
  runId: string;
  emailId: string;
}

export interface CleanupApplyEvent {
  userId: string;
  runId: string;
  approvedIds: string[];
}
