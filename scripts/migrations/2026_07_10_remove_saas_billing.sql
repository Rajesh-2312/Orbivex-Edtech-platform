-- ═══════════════════════════════════════════════════════════════════
-- Orbivex — Remove SaaS Billing Schema
-- Migration: 2026_07_10_remove_saas_billing.sql
--
-- The Razorpay-based billing/subscription layer has been removed from
-- the app (routes/billing.js, middleware/tenantBilling.js, the
-- SaaS admin revenue portal, and the plan-selection step in onboarding).
-- Run this in the Supabase SQL Editor to drop the now-unused tables
-- from an existing project. Safe to skip on a fresh project that never
-- ran 2026_06_06_saas_billing.sql.
-- ═══════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.mrr_dashboard;

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
DROP TRIGGER IF EXISTS update_demo_requests_updated_at ON public.demo_requests;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS public.billing_events;
DROP TABLE IF EXISTS public.subscriptions;
DROP TABLE IF EXISTS public.demo_requests;
DROP TABLE IF EXISTS public.college_onboarding;
