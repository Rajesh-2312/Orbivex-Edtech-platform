-- ═══════════════════════════════════════════════════════════════════
-- Orbivex SaaS Billing Schema — Run in Supabase SQL Editor
-- Migration: 2026_06_06_saas_billing.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── Subscriptions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id                UUID REFERENCES public.colleges(id) ON DELETE CASCADE,
  admin_user_id             UUID REFERENCES auth.users(id),
  plan_id                   TEXT NOT NULL CHECK (plan_id IN ('starter', 'growth', 'enterprise')),
  billing_cycle             TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  status                    TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'cancel_at_period_end', 'expired')),
  amount_paid               NUMERIC(10,2) DEFAULT 0,
  currency                  TEXT DEFAULT 'INR',
  razorpay_order_id         TEXT,
  razorpay_payment_id       TEXT,
  razorpay_subscription_id  TEXT,
  trial_ends_at             TIMESTAMPTZ,
  current_period_start      TIMESTAMPTZ DEFAULT NOW(),
  current_period_end        TIMESTAMPTZ,
  cancellation_reason       TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (college_id)
);

-- ── Billing Events (audit log) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  event_type          TEXT NOT NULL,  -- payment_success, payment_failed, payment_captured, cancellation_requested, subscription_charged
  amount              NUMERIC(10,2) DEFAULT 0,
  currency            TEXT DEFAULT 'INR',
  razorpay_payment_id TEXT,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Demo Requests (leads from landing page) ───────────────────────
CREATE TABLE IF NOT EXISTS public.demo_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  college_name    TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT NOT NULL,
  student_count   TEXT,
  plan_interest   TEXT DEFAULT 'growth',
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'converted', 'lost')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── College Onboarding Status ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.college_onboarding (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id          UUID REFERENCES public.colleges(id) ON DELETE CASCADE,
  step_completed      TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_complete         BOOLEAN DEFAULT FALSE,
  onboarded_by        UUID REFERENCES auth.users(id),
  go_live_date        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (college_id)
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_college_id ON public.subscriptions(college_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_billing_events_subscription_id ON public.billing_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at ON public.billing_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON public.demo_requests(status);

-- ── RLS Policies ──────────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_onboarding ENABLE ROW LEVEL SECURITY;

-- Admins can view their own college's subscription (backend uses service role, so these are for reference)
CREATE POLICY "Admins can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = admin_user_id);

-- Demo requests: insert only (anonymous)
CREATE POLICY "Anyone can submit demo request" ON public.demo_requests
  FOR INSERT WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_demo_requests_updated_at
  BEFORE UPDATE ON public.demo_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── View: MRR Dashboard ───────────────────────────────────────────
CREATE OR REPLACE VIEW public.mrr_dashboard AS
SELECT
  s.plan_id,
  s.billing_cycle,
  s.status,
  COUNT(*) AS college_count,
  SUM(CASE
    WHEN s.billing_cycle = 'annual' THEN
      CASE s.plan_id
        WHEN 'starter' THEN 76800.0 / 12
        WHEN 'growth'  THEN 144000.0 / 12
        WHEN 'enterprise' THEN 240000.0 / 12
      END
    ELSE
      CASE s.plan_id
        WHEN 'starter' THEN 8000.0
        WHEN 'growth'  THEN 15000.0
        WHEN 'enterprise' THEN 25000.0
      END
  END) AS mrr
FROM public.subscriptions s
WHERE s.status IN ('active', 'trialing')
GROUP BY s.plan_id, s.billing_cycle, s.status;

-- ── Comment ───────────────────────────────────────────────────────
COMMENT ON TABLE public.subscriptions IS 'SaaS subscription records per college. One row per college.';
COMMENT ON TABLE public.billing_events IS 'Immutable audit log of all billing events from Razorpay.';
COMMENT ON TABLE public.demo_requests IS 'Leads from landing page demo request form.';
