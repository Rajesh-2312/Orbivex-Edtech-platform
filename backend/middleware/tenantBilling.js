/**
 * Tenant Billing Middleware
 * Checks subscription status and gates features by plan tier.
 * Attach after authMiddleware on routes that require an active subscription.
 */
const { supabaseAdmin } = require('../config/supabase');

const PLAN_FEATURES = {
  starter:    ['ai_quiz', 'courses', 'progress', 'jobs', 'analytics_basic'],
  growth:     ['ai_quiz', 'ai_course_gen', 'courses', 'progress', 'jobs', 'company_prep', 'placement_analytics', 'lsrw', 'question_bank', 'tests', 'analytics_advanced'],
  enterprise: ['ai_quiz', 'ai_course_gen', 'courses', 'progress', 'jobs', 'company_prep', 'placement_analytics', 'lsrw', 'question_bank', 'tests', 'analytics_advanced', 'ai_tutor', 'custom_branding', 'sla'],
};

const PLAN_STUDENT_LIMITS = {
  starter:    500,
  growth:     2000,
  enterprise: null, // unlimited
};

// Cache subscriptions in memory for 60s to avoid DB on every request
const subCache = new Map(); // college_id → { sub, expiry }

async function getSubscription(collegeId) {
  const cached = subCache.get(collegeId);
  if (cached && cached.expiry > Date.now()) return cached.sub;

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('college_id', collegeId)
    .single();

  subCache.set(collegeId, { sub, expiry: Date.now() + 60_000 });
  return sub;
}

/**
 * requireActiveSubscription — blocks request if college has no active/trialing subscription.
 * Pass skipForRoles to exempt super-admins or internal accounts.
 */
function requireActiveSubscription(options = {}) {
  return async (req, res, next) => {
    try {
      const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL;

      // Super-admin always bypasses (only when env var is explicitly set)
      if (SUPER_ADMIN && req.user?.email === SUPER_ADMIN) return next();

      // If billing enforcement is disabled (dev mode), skip
      if (process.env.BILLING_ENFORCEMENT === 'false') return next();

      const collegeId = req.user?.college_id;
      if (!collegeId) {
        // No college linked — likely a platform-level admin, allow
        return next();
      }

      const sub = await getSubscription(collegeId);

      if (!sub) {
        return res.status(402).json({
          success: false,
          error: 'No active subscription',
          code: 'SUBSCRIPTION_REQUIRED',
          action: 'Please subscribe to access this feature.',
          billing_url: '/billing',
        });
      }

      const now = new Date();
      const periodEnd = new Date(sub.current_period_end);

      if (now > periodEnd || sub.status === 'expired' || sub.status === 'cancelled') {
        return res.status(402).json({
          success: false,
          error: 'Subscription expired',
          code: 'SUBSCRIPTION_EXPIRED',
          action: 'Your subscription has expired. Please renew to continue.',
          billing_url: '/billing',
          expired_at: sub.current_period_end,
        });
      }

      // Attach subscription info to req for downstream use
      req.subscription = {
        plan_id: sub.plan_id,
        status: sub.status,
        features: PLAN_FEATURES[sub.plan_id] || [],
        student_limit: PLAN_STUDENT_LIMITS[sub.plan_id],
        days_remaining: Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24)),
        is_trial: sub.status === 'trialing',
      };

      next();
    } catch (err) {
      console.error('[tenantBilling] Error:', err);
      // On billing check failure, allow request to avoid blocking college operations
      next();
    }
  };
}

/**
 * requireFeature(featureName) — blocks if the college's plan doesn't include the feature.
 * Must come after requireActiveSubscription.
 */
function requireFeature(featureName) {
  return (req, res, next) => {
    const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL;
    if (SUPER_ADMIN && req.user?.email === SUPER_ADMIN) return next();
    if (process.env.BILLING_ENFORCEMENT === 'false') return next();

    const features = req.subscription?.features || [];
    if (!features.includes(featureName)) {
      return res.status(403).json({
        success: false,
        error: `This feature (${featureName}) requires a higher plan`,
        code: 'FEATURE_NOT_AVAILABLE',
        upgrade_url: '/billing/upgrade',
        required_plan: getMinPlanForFeature(featureName),
      });
    }
    next();
  };
}

function getMinPlanForFeature(feature) {
  if (PLAN_FEATURES.starter.includes(feature)) return 'starter';
  if (PLAN_FEATURES.growth.includes(feature)) return 'growth';
  return 'enterprise';
}

/**
 * addTrialWarning — attaches X-Trial-Warning header if trial ending within 3 days.
 * Non-blocking — attach on all authenticated routes.
 */
async function addTrialWarning(req, res, next) {
  try {
    const collegeId = req.user?.college_id;
    if (!collegeId) return next();

    const sub = await getSubscription(collegeId);
    if (!sub || sub.status !== 'trialing') return next();

    const now = new Date();
    const trialEnd = new Date(sub.trial_ends_at);
    const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 3 && daysLeft > 0) {
      res.setHeader('X-Trial-Warning', `Trial ends in ${daysLeft} day(s)`);
      res.setHeader('X-Trial-Days-Remaining', daysLeft);
    } else if (daysLeft <= 0) {
      res.setHeader('X-Trial-Warning', 'Trial expired');
    }
  } catch (err) {
    // Non-blocking
  }
  next();
}

module.exports = { requireActiveSubscription, requireFeature, addTrialWarning };
