/**
 * Orbivex Billing Routes — Razorpay Subscription Management
 * Handles: plan listing, subscription creation, webhooks, status checks, invoices
 */
const express = require('express');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { success, error } = require('../utils/response');

const router = express.Router();

// ─── Plan Definitions ───────────────────────────────────────────────────────
const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price_monthly: 8000,
    price_annual: 76800, // 20% off
    currency: 'INR',
    student_limit: 500,
    features: ['ai_quiz', 'courses', 'progress', 'jobs', 'analytics_basic'],
    razorpay_plan_id_monthly: process.env.RAZORPAY_PLAN_STARTER_MONTHLY,
    razorpay_plan_id_annual: process.env.RAZORPAY_PLAN_STARTER_ANNUAL,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price_monthly: 15000,
    price_annual: 144000,
    currency: 'INR',
    student_limit: 2000,
    features: ['ai_quiz', 'ai_course_gen', 'courses', 'progress', 'jobs', 'company_prep', 'placement_analytics', 'lsrw', 'question_bank', 'tests', 'analytics_advanced'],
    razorpay_plan_id_monthly: process.env.RAZORPAY_PLAN_GROWTH_MONTHLY,
    razorpay_plan_id_annual: process.env.RAZORPAY_PLAN_GROWTH_ANNUAL,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price_monthly: 25000,
    price_annual: 240000,
    currency: 'INR',
    student_limit: null, // unlimited
    features: ['ai_quiz', 'ai_course_gen', 'courses', 'progress', 'jobs', 'company_prep', 'placement_analytics', 'lsrw', 'question_bank', 'tests', 'analytics_advanced', 'ai_tutor', 'custom_branding', 'sla', 'dedicated_support'],
    razorpay_plan_id_monthly: process.env.RAZORPAY_PLAN_ENTERPRISE_MONTHLY,
    razorpay_plan_id_annual: process.env.RAZORPAY_PLAN_ENTERPRISE_ANNUAL,
  },
};

// ─── Helper: Razorpay API call ───────────────────────────────────────────────
async function razorpayRequest(method, path, body = null) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const url = `https://api.razorpay.com/v1${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.description || 'Razorpay API error');
  return data;
}

// ─── GET /api/billing/plans ──────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  const plans = Object.values(PLANS).map(p => ({
    id: p.id,
    name: p.name,
    price_monthly: p.price_monthly,
    price_annual: p.price_annual,
    currency: p.currency,
    student_limit: p.student_limit,
    features: p.features,
  }));
  res.json(success(plans));
});

// ─── POST /api/billing/demo-request ─────────────────────────────────────────
router.post('/demo-request', async (req, res) => {
  try {
    const { name, college, phone, email, students, plan } = req.body;
    if (!name || !college || !phone || !email) {
      return res.status(400).json(error('All fields required'));
    }

    const { error: dbErr } = await supabaseAdmin
      .from('demo_requests')
      .insert({ name, college_name: college, phone, email, student_count: students, plan_interest: plan || 'growth', status: 'pending' });

    if (dbErr) console.warn('Demo request DB error (table may not exist yet):', dbErr.message);

    // TODO: Send email notification to sales team via Resend
    // await sendDemoRequestEmail({ name, college, phone, email, students });

    return res.json(success({ message: 'Demo request received. We will call you within 24 hours.' }));
  } catch (err) {
    console.error('Demo request error:', err);
    return res.status(500).json(error('Failed to submit demo request'));
  }
});

// ─── POST /api/billing/create-order ─────────────────────────────────────────
// Creates a Razorpay order for plan purchase (one-time or subscription first payment)
router.post('/create-order', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { plan_id, billing_cycle = 'monthly' } = req.body;
    const plan = PLANS[plan_id];
    if (!plan) return res.status(400).json(error('Invalid plan'));

    const amount = billing_cycle === 'annual' ? plan.price_annual : plan.price_monthly;
    const amountPaise = amount * 100; // Razorpay uses paise

    const order = await razorpayRequest('POST', '/orders', {
      amount: amountPaise,
      currency: 'INR',
      receipt: `orbivex_${req.user.id}_${Date.now()}`,
      notes: {
        plan_id,
        billing_cycle,
        college_admin_id: req.user.id,
        college_email: req.user.email,
      },
    });

    return res.json(success({
      order_id: order.id,
      amount: amountPaise,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID,
      plan_name: plan.name,
    }));
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json(error(err.message || 'Failed to create payment order'));
  }
});

// ─── POST /api/billing/verify-payment ───────────────────────────────────────
// After Razorpay checkout, verify signature and activate subscription
router.post('/verify-payment', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, billing_cycle } = req.body;
    // Always use the authenticated user's college, never trust client-supplied college_id
    const college_id = req.user.college_id;

    // Verify Razorpay signature
    const generatedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSig !== razorpay_signature) {
      return res.status(400).json(error('Payment verification failed — invalid signature'));
    }

    const plan = PLANS[plan_id];
    if (!plan) return res.status(400).json(error('Invalid plan'));

    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + (billing_cycle === 'annual' ? 12 : 1));

    // Upsert subscription in DB
    const { data: sub, error: dbErr } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        college_id,
        admin_user_id: req.user.id,
        plan_id,
        billing_cycle,
        status: 'active',
        razorpay_order_id,
        razorpay_payment_id,
        amount_paid: billing_cycle === 'annual' ? plan.price_annual : plan.price_monthly,
        currency: 'INR',
        current_period_start: now.toISOString(),
        current_period_end: nextBilling.toISOString(),
        trial_ends_at: null, // trial ended, paid
        updated_at: now.toISOString(),
      }, { onConflict: 'college_id' })
      .select()
      .single();

    if (dbErr) {
      console.error('Subscription DB error:', dbErr);
      return res.status(500).json(error('Payment verified but failed to activate subscription. Contact support.'));
    }

    // Log billing event
    await supabaseAdmin.from('billing_events').insert({
      subscription_id: sub.id,
      event_type: 'payment_success',
      amount: sub.amount_paid,
      currency: 'INR',
      razorpay_payment_id,
      metadata: { plan_id, billing_cycle },
    });

    return res.json(success({ message: 'Subscription activated!', subscription: sub }));
  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json(error('Payment verification failed'));
  }
});

// ─── POST /api/billing/start-trial ──────────────────────────────────────────
// Start 14-day trial without payment
router.post('/start-trial', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { plan_id } = req.body;
    const college_id = req.user.college_id; // always use server-authoritative value
    const plan = PLANS[plan_id];
    if (!plan) return res.status(400).json(error('Invalid plan'));

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 14);

    // Check if already has subscription
    const { data: existing } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status')
      .eq('college_id', college_id)
      .single();

    if (existing) {
      return res.status(409).json(error('This college already has an active subscription or trial'));
    }

    const { data: sub, error: dbErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        college_id,
        admin_user_id: req.user.id,
        plan_id,
        billing_cycle: 'monthly',
        status: 'trialing',
        amount_paid: 0,
        currency: 'INR',
        trial_ends_at: trialEnd.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
      })
      .select()
      .single();

    if (dbErr) {
      console.error('Trial start error:', dbErr);
      return res.status(500).json(error('Failed to start trial'));
    }

    return res.json(success({ message: 'Trial started! Enjoy 14 days free.', trial_ends_at: trialEnd, subscription: sub }));
  } catch (err) {
    console.error('Start trial error:', err);
    return res.status(500).json(error('Failed to start trial'));
  }
});

// ─── GET /api/billing/status ─────────────────────────────────────────────────
// Returns current subscription status for the admin's college
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('college_id', req.user.college_id)
      .single();

    if (!sub) {
      return res.json(success({ status: 'no_subscription', plan: null }));
    }

    // Check if trial or period has expired
    const now = new Date();
    const periodEnd = new Date(sub.current_period_end);
    const isExpired = now > periodEnd;

    const plan = PLANS[sub.plan_id];

    return res.json(success({
      status: isExpired ? 'expired' : sub.status,
      plan_id: sub.plan_id,
      plan_name: plan?.name,
      billing_cycle: sub.billing_cycle,
      current_period_end: sub.current_period_end,
      trial_ends_at: sub.trial_ends_at,
      student_limit: plan?.student_limit,
      features: plan?.features || [],
      days_remaining: Math.max(0, Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24))),
    }));
  } catch (err) {
    console.error('Billing status error:', err);
    return res.status(500).json(error('Failed to fetch billing status'));
  }
});

// ─── GET /api/billing/invoices ───────────────────────────────────────────────
router.get('/invoices', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { data: events } = await supabaseAdmin
      .from('billing_events')
      .select(`
        *,
        subscriptions!inner(college_id, plan_id, billing_cycle)
      `)
      .eq('subscriptions.college_id', req.user.college_id)
      .eq('event_type', 'payment_success')
      .order('created_at', { ascending: false });

    return res.json(success(events || []));
  } catch (err) {
    console.error('Invoices error:', err);
    return res.status(500).json(error('Failed to fetch invoices'));
  }
});

// ─── POST /api/billing/webhook ───────────────────────────────────────────────
// Razorpay webhook — verify and process subscription events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Billing Webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting all webhook calls');
      return res.status(400).json({ error: 'Webhook not configured' });
    }

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');

    if (expectedSig !== signature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(req.body.toString());
    console.log(`[Billing Webhook] Event: ${event.event}`);

    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        const notes = payment.notes || {};

        await supabaseAdmin.from('billing_events').insert({
          event_type: 'payment_captured',
          amount: payment.amount / 100,
          currency: payment.currency,
          razorpay_payment_id: payment.id,
          metadata: notes,
        });
        break;
      }

      case 'payment.failed': {
        const payment = event.payload.payment.entity;
        await supabaseAdmin.from('billing_events').insert({
          event_type: 'payment_failed',
          amount: payment.amount / 100,
          currency: payment.currency,
          razorpay_payment_id: payment.id,
          metadata: { error: payment.error_description },
        });
        break;
      }

      case 'subscription.charged': {
        const sub = event.payload.subscription.entity;
        // Auto-renew: extend subscription period
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_end: new Date(sub.current_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('razorpay_subscription_id', sub.id);
        break;
      }

      case 'subscription.cancelled': {
        const sub = event.payload.subscription.entity;
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('razorpay_subscription_id', sub.id);
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─── GET /api/billing/saas-metrics ───────────────────────────────────────────
// Super-admin only: MRR, ARR, churn, all tenants
router.get('/saas-metrics', authMiddleware, async (req, res) => {
  try {
    const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
    if (!SUPER_ADMIN_EMAIL || req.user.email !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json(error('Super admin access required'));
    }

    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        colleges(id, name, code)
      `)
      .order('created_at', { ascending: false });

    const activeSubs = (subs || []).filter(s => s.status === 'active');
    const trialing = (subs || []).filter(s => s.status === 'trialing');
    const cancelled = (subs || []).filter(s => s.status === 'cancelled');

    const mrr = activeSubs.reduce((sum, s) => {
      const plan = PLANS[s.plan_id];
      if (!plan) return sum;
      return sum + (s.billing_cycle === 'annual' ? plan.price_annual / 12 : plan.price_monthly);
    }, 0);

    const arr = mrr * 12;

    return res.json(success({
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      active_count: activeSubs.length,
      trial_count: trialing.length,
      cancelled_count: cancelled.length,
      total_colleges: (subs || []).length,
      plan_breakdown: {
        starter: activeSubs.filter(s => s.plan_id === 'starter').length,
        growth: activeSubs.filter(s => s.plan_id === 'growth').length,
        enterprise: activeSubs.filter(s => s.plan_id === 'enterprise').length,
      },
      subscriptions: subs || [],
    }));
  } catch (err) {
    console.error('SaaS metrics error:', err);
    return res.status(500).json(error('Failed to fetch metrics'));
  }
});

// ─── POST /api/billing/cancel ────────────────────────────────────────────────
router.post('/cancel', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { reason } = req.body;

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('college_id', req.user.college_id)
      .single();

    if (!sub) return res.status(404).json(error('No active subscription found'));

    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancel_at_period_end', cancellation_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', sub.id);

    await supabaseAdmin.from('billing_events').insert({
      subscription_id: sub.id,
      event_type: 'cancellation_requested',
      amount: 0,
      metadata: { reason },
    });

    return res.json(success({ message: 'Cancellation scheduled. Access continues until end of billing period.' }));
  } catch (err) {
    console.error('Cancel error:', err);
    return res.status(500).json(error('Failed to cancel subscription'));
  }
});

module.exports = router;
