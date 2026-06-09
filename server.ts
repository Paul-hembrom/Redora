import express from 'express';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import sql, { dbReady } from './server/db.js';
import { generateStoryboardJob, regenerateScene } from './server/storyboardEngine.js';
import { processVideoLessonJob, processSceneAssets } from './server/videoPipeline.js';
import { getUserRoleInOrg } from './server/roles.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-me-in-prod';

export const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(cookieParser());

// --- Trust Proxy for Secure Cookies Behind Vercel ---
app.set('trust proxy', 1);

// --- Gateway Token Exchange Route ---
app.all(['/auth/token-exchange', '/api/auth/token-exchange'], async (req, res) => {
  console.log('token-exchange route HIT');
  console.log('method:', req.method);
  // Disable caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const accessToken = (req.query.access_token || req.query.token || req.body?.access_token || req.body?.token) as string;
  const role = (req.query.role || req.body?.role) as string;
  const queryOrgId = (req.query.org_id || req.body?.org_id) as string;
  
  if (!accessToken) {
    return res.status(400).send('Missing access_token');
  }

  try {
    let _adminClient: any = null;
    const getAdminClient = async () => {
      if (_adminClient) return _adminClient;
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
      if (!url || !key) throw new Error('Supabase env vars missing');
      _adminClient = createClient(url, key);
      return _adminClient;
    };

    let supabaseAdmin;
    try {
      supabaseAdmin = await getAdminClient();
    } catch (envErr) {
      console.error('Missing Supabase environment variables', envErr);
      return res.status(500).send('Server configuration error');
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    
    if (error || !user) {
      console.error('Supabase auth error:', error);
      return res.status(401).send('Invalid token');
    }

    const org_id = queryOrgId || user.user_metadata?.org_id;

    // School Lock Check
    if (org_id) {
       try {
         const orgs = await sql`SELECT school_id FROM organizations WHERE id = ${org_id}`;
         if (orgs.length > 0 && orgs[0].school_id) {
            const subs = await sql`SELECT status FROM school_subscriptions WHERE school_id = ${orgs[0].school_id}`;
            if (subs.length > 0 && subs[0].status === 'locked') {
               return res.status(403).send('School account suspended');
            }
         }
       } catch (err: any) {
         if (err.message && !err.message.includes('does not exist')) {
           console.error('Error during school lock check:', err);
         }
       }
    }

    const userId = user.id;
    const email = user.email || user.user_metadata?.email || '';

    // Generate a local HS256 token for our own auth middleware to use seamlessly
    const localToken = jwt.sign(
      { userId }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    const cookieDomain = req.hostname.endsWith('.alphanexoraai.com') ? '.alphanexoraai.com' : undefined;
    const cookieOptions: any = { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...(cookieDomain ? { domain: cookieDomain } : {})
    };

    console.log('Setting tokens. Local token prefix:', localToken.substring(0, 15));
    console.log('Local userId:', userId, 'email:', email);

    // If verification succeeds, set the cookie exactly as your existing login does
    res.cookie('token', localToken, cookieOptions);
    
    if (role) {
      res.cookie('sb-role', role, cookieOptions);
    }

    if (org_id) {
      res.cookie('sb-org-id', org_id, cookieOptions);
    }

    // Redirect to the home page (the user's workspace will load automatically)
    res.redirect('/');
  } catch (err) {
    console.error('Exchange error:', err);
    return res.status(401).send('Invalid token');
  }
});

// Database readiness check
app.use((req, res, next) => {
  if (!dbReady && (req.path.startsWith('/api/') || req.path.startsWith('/auth/'))) {
    return res.status(503).json({ error: 'Database service unavailable' });
  }
  next();
});

// Restrict write access for students
app.use((req, res, next) => {
  if (req.method === 'GET') {
    return next();
  }
  
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }
  
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
     const role = req.cookies?.['sb-role'];
     if (role === 'student') {
        return res.status(403).json({ error: "Students have view-only access." });
     }
  }
  
  next();
});

export class SubscriptionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionLimitError";
  }
}

async function verifyAndIncrementUsage(userId: string, type: string, orgId?: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let useSchool = false;
  if (orgId && orgId !== 'demo' && orgId !== 'default_org' && uuidRegex.test(orgId)) {
    useSchool = true;
  }

  if (!useSchool) {
    // Personal Usage
    let usageRows = await sql`SELECT * FROM user_usage WHERE user_id = ${userId}`;
    if (usageRows.length === 0) {
      await sql`INSERT INTO user_usage (user_id, books_uploaded_this_month, video_generations_this_month, image_searches_this_month, interactive_lessons_this_month, youtube_searches_today, last_reset_date, last_daily_reset_date) VALUES (${userId}, 0, 0, 0, 0, 0, CURRENT_DATE, CURRENT_DATE)`;
      usageRows = await sql`SELECT * FROM user_usage WHERE user_id = ${userId}`;
    }
    const subs = await sql`SELECT * FROM subscriptions WHERE user_id = ${userId}`;
    const usage = usageRows[0] || {};
    const sub = subs[0] || {};
    const plan = sub.plan || 'free';
    const isPro = plan === 'pro' || plan === 'Pro' || plan === 'lifetime' || plan === 'Growth' || plan === 'Enterprise' || plan === 'unlimited';
    
    // Daily/Monthly resets
    const todayDate = new Date();
    const resetDate = usage.last_reset_date ? new Date(usage.last_reset_date) : new Date(0);
    const dailyResetDate = usage.last_daily_reset_date ? new Date(usage.last_daily_reset_date) : new Date(0);
    
    if (todayDate.getMonth() !== resetDate.getMonth() || todayDate.getFullYear() !== resetDate.getFullYear()) {
      await sql`UPDATE user_usage SET video_generations_this_month = 0, image_searches_this_month = 0, interactive_lessons_this_month = 0, books_uploaded_this_month = 0, last_reset_date = CURRENT_DATE WHERE user_id = ${userId}`;
      usage.video_generations_this_month = 0;
      usage.image_searches_this_month = 0;
      usage.interactive_lessons_this_month = 0;
      usage.books_uploaded_this_month = 0;
    }
  
    if (todayDate.getDate() !== dailyResetDate.getDate() || todayDate.getMonth() !== dailyResetDate.getMonth() || todayDate.getFullYear() !== dailyResetDate.getFullYear()) {
      await sql`UPDATE user_usage SET youtube_searches_today = 0, last_daily_reset_date = CURRENT_DATE WHERE user_id = ${userId}`;
      usage.youtube_searches_today = 0;
    }

    let limits: any = plan === 'unlimited' ? {
       document: 'unlimited', video: 'unlimited', image: 'unlimited', interactive: 'unlimited', youtube: 'unlimited'
    } : {
       document: isPro ? 'unlimited' : 4,
       video: isPro ? 10 : 2,
       image: isPro ? 50 : 20,
       interactive: isPro ? 30 : 10,
       youtube: isPro ? 50 : 10
    };

    let count = 0;
    const limit = limits[type];
    
    if (type === 'video') count = usage.video_generations_this_month || 0;
    if (type === 'image') count = usage.image_searches_this_month || 0;
    if (type === 'interactive') count = usage.interactive_lessons_this_month || 0;
    if (type === 'document') count = usage.books_uploaded_this_month || 0;
    if (type === 'youtube') count = usage.youtube_searches_today || 0;

    if (limit !== 'unlimited' && count >= limit) {
      throw new SubscriptionLimitError(`Personal limit reached for ${type}. Upgrade your plan.`);
    }

    // Increment
    if (type === 'document') {
      await sql`UPDATE user_usage SET books_uploaded_this_month = COALESCE(books_uploaded_this_month, 0) + 1 WHERE user_id = ${userId}`;
    } else if (type === 'video') {
      await sql`UPDATE user_usage SET video_generations_this_month = COALESCE(video_generations_this_month, 0) + 1 WHERE user_id = ${userId}`;
    } else if (type === 'image') {
      await sql`UPDATE user_usage SET image_searches_this_month = COALESCE(image_searches_this_month, 0) + 1 WHERE user_id = ${userId}`;
    } else if (type === 'interactive') {
      await sql`UPDATE user_usage SET interactive_lessons_this_month = COALESCE(interactive_lessons_this_month, 0) + 1 WHERE user_id = ${userId}`;
    } else if (type === 'youtube') {
      await sql`UPDATE user_usage SET youtube_searches_today = COALESCE(youtube_searches_today, 0) + 1 WHERE user_id = ${userId}`;
    }

    return;
  }

  // School Usage
  const orgs = await sql`SELECT school_id FROM organizations WHERE id = ${orgId}`;
  if (!orgs.length || !orgs[0].school_id) throw new SubscriptionLimitError('Organization not found.');
  const schoolId = orgs[0].school_id;

  const subs = await sql`SELECT * FROM school_subscriptions WHERE school_id = ${schoolId}`;
  const sub = subs[0];
  if (!sub) throw new SubscriptionLimitError('No school subscription exists.');
  const status = sub.status || 'trialing';

  if (status === 'locked') throw new SubscriptionLimitError('School account suspended.');

  const usageRows = await sql`SELECT * FROM school_usage WHERE school_id = ${schoolId}`;
  const usage = usageRows[0] || {};

  if (status === 'trialing' || status === 'trial') {
    if (type === 'video' || type === 'image') {
      throw new SubscriptionLimitError(`${type} features are not available during trial. Please upgrade.`);
    }
    if (type === 'interactive') {
      if ((usage.interactive_lessons_this_month || 0) >= 2) throw new SubscriptionLimitError('Trial limit reached for interactive lessons (2 max).');
    }
    if (type === 'document') {
      const orgUsers = await sql`SELECT user_id FROM organization_members WHERE organization_id = ${orgId}`;
      const userIds = orgUsers.map((u: any) => u.user_id);
      let bookCount = 0;
      if (userIds.length > 0) {
        const books = await sql`SELECT count(*) FROM documents WHERE user_id IN ${sql(userIds)}`;
        bookCount = Number(books[0].count);
      }
      if (bookCount >= 10) throw new SubscriptionLimitError('Trial limit reached for books (10 max).');
    }
  } else {
    // Active usage checks
    const planName = sub.plan_type || 'Starter';
    const planLimits: any = {
      'Starter': { document: 1000, video: 10, image: 20, interactive: 5, youtube: 50 },
      'Growth': { document: 5000, video: 25, image: 50, interactive: 20, youtube: 100 },
      'Enterprise': { document: 10000, video: 100, image: 200, interactive: 100, youtube: 500 }
    };
    const currentLimits = planLimits[planName] || planLimits['Starter'];
    let count = 0;
    if (type === 'video') count = usage.video_generations_this_month || 0;
    if (type === 'image') count = usage.image_searches_this_month || 0;
    if (type === 'interactive') count = usage.interactive_lessons_this_month || 0;
    if (type === 'document') count = usage.books_uploaded_this_month || 0;
    if (type === 'youtube') count = usage.youtube_searches_today || 0;

    if (count >= currentLimits[type]) {
      throw new SubscriptionLimitError(`Plan limit reached for ${planName} plan.`);
    }
  }

  // Increment school (using sql.unsafe to bypass prepared-statement cache)
  if (type === 'document') {
    await sql.unsafe(`UPDATE school_usage SET books_uploaded_this_month = COALESCE(books_uploaded_this_month, 0) + 1 WHERE school_id = '${schoolId}'`);
  } else if (type === 'video') {
    await sql.unsafe(`UPDATE school_usage SET video_generations_this_month = COALESCE(video_generations_this_month, 0) + 1 WHERE school_id = '${schoolId}'`);
  } else if (type === 'image') {
    await sql.unsafe(`UPDATE school_usage SET image_searches_this_month = COALESCE(image_searches_this_month, 0) + 1 WHERE school_id = '${schoolId}'`);
  } else if (type === 'interactive') {
    await sql.unsafe(`UPDATE school_usage SET interactive_lessons_this_month = COALESCE(interactive_lessons_this_month, 0) + 1 WHERE school_id = '${schoolId}'`);
  } else if (type === 'youtube') {
    await sql.unsafe(`UPDATE school_usage SET youtube_searches_today = COALESCE(youtube_searches_today, 0) + 1 WHERE school_id = '${schoolId}'`);
  }
}




// --- Auth Middleware ---
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('Authenticate: No token found in cookies or headers');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let validUserId = null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string, sub?: string };
    validUserId = decoded.userId || decoded.sub;
  } catch (err) {
    try {
      if (process.env.SUPABASE_JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] }) as any;
        validUserId = decoded.sub || decoded.userId;
      } else {
        throw new Error('Invalid token');
      }
    } catch (err2: any) {
      console.log('Authenticate error:', err2.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
  
  if (!validUserId) return res.status(401).json({ error: 'Invalid token' });
  req.userId = validUserId;
  
  const orgId = req.cookies['sb-org-id'];
  req.orgId = null;
  if (orgId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (orgId === 'demo' || orgId === 'default_org') {
       req.orgId = orgId;
    } else if (uuidRegex.test(orgId)) {
      try {
        const membership = await sql`SELECT 1 FROM organization_members WHERE organization_id = ${orgId} AND user_id = ${req.userId}`;
        if (membership.length === 0) {
           return res.status(403).json({ error: 'Forbidden: Not a member of this organization' });
        }
        req.orgId = orgId;
      } catch (err: any) {
        if (!err.message || !err.message.includes('does not exist')) {
           console.error('Org access check error:', err);
           return res.status(500).json({ error: 'Server error check org membership' });
        }
      }
    }
  }
  next();
};

function getDocUserFilter(req: any) {
  if (req.orgId && req.orgId !== 'demo' && req.orgId !== 'default_org') {
    return sql`user_id IN (SELECT user_id FROM organization_members WHERE organization_id = ${req.orgId})`;
  }
  return sql`user_id = ${req.userId}`;
}

function getDocAliasUserFilter(req: any, alias: string) {
  if (req.orgId && req.orgId !== 'demo' && req.orgId !== 'default_org') {
    if (alias === 'd') return sql`d.user_id IN (SELECT user_id FROM organization_members WHERE organization_id = ${req.orgId})`;
    if (alias === 'c') return sql`c.document_id IN (SELECT id FROM documents WHERE user_id IN (SELECT user_id FROM organization_members WHERE organization_id = ${req.orgId}))`;
  }
  if (alias === 'd') return sql`d.user_id = ${req.userId}`;
  if (alias === 'c') return sql`c.document_id IN (SELECT id FROM documents WHERE user_id = ${req.userId})`;
  return sql`user_id = ${req.userId}`;
}

const preventStudentModification = (req: any, res: any, next: any) => {
  if (req.path.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const role = req.cookies['sb-role'];
    if (role === 'student') {
      const allowedStudentEndpoints = [
        '/api/auth/logout',
        '/api/auth/login',
        '/api/auth/signup',
        '/api/retrieve-videos',
        '/api/chats',
        '/api/nvidia/chat/completions',
        '/api/tts',
        '/api/stt/transcribe'
      ];
      
      const isTopicsImagesOrLesson = req.path.match(/^\/api\/topics\/[a-zA-Z0-9_\-]+\/(images|start-lesson)$/);
      
      if (!allowedStudentEndpoints.includes(req.path) && !isTopicsImagesOrLesson) {
        return res.status(403).json({ error: 'Students have view-only access.' });
      }
    }
  }
  next();
};
app.use(preventStudentModification);

// --- Trial & Feature Gating limits ---
async function checkFeatureAllowed(orgId: string | undefined, feature: string, userId: string): Promise<{allowed: boolean, reason?: string}> {
  if (!orgId) {
    let usageRows = await sql`SELECT * FROM user_usage WHERE user_id = ${userId}`;
    if (usageRows.length === 0) {
      return { allowed: true };
    }
    const subs = await sql`SELECT * FROM subscriptions WHERE user_id = ${userId}`;
    const usage = usageRows[0] || {};
    const sub = subs[0] || {};
    const plan = sub.plan || 'free';
    const isPro = plan === 'pro' || plan === 'Pro' || plan === 'lifetime' || plan === 'Growth' || plan === 'Enterprise' || plan === 'unlimited';
    
    let limits: any = plan === 'unlimited' ? {
       document: 'unlimited', video: 'unlimited', image: 'unlimited', interactive: 'unlimited', youtube: 'unlimited'
    } : {
       document: isPro ? 'unlimited' : 4,
       video: isPro ? 10 : 2,
       image: isPro ? 50 : 20,
       interactive: isPro ? 30 : 10,
       youtube: isPro ? 50 : 10
    };

    let count = 0;
    let limit = limits[feature];
    if (limit === 'unlimited') return { allowed: true };
    
    if (feature === 'video') count = usage.video_generations_this_month || 0;
    if (feature === 'image') count = usage.image_searches_this_month || 0;
    if (feature === 'interactive') count = usage.interactive_lessons_this_month || 0;
    if (feature === 'document') {
       const docs = await sql`SELECT count(*) FROM documents WHERE user_id = ${userId}`;
       count = Number(docs[0].count) || 0;
    }
    if (feature === 'chat') return { allowed: true };
    if (feature === 'youtube') count = usage.youtube_searches_today || 0;

    if (count >= limit) return { allowed: false, reason: 'Personal limit reached.' };
    return { allowed: true };
  }

  const orgs = await sql`SELECT school_id FROM organizations WHERE id = ${orgId}`;
  if (!orgs.length || !orgs[0].school_id) return { allowed: false, reason: 'Organization not found.' };
  
  const schoolId = orgs[0].school_id;
  const subs = await sql`SELECT * FROM school_subscriptions WHERE school_id = ${schoolId}`;
  const sub = subs[0];
  if (!sub) return { allowed: false, reason: 'No school subscription.' };
  
  const status = sub.status || 'trialing'; 
  if (status === 'locked') return { allowed: false, reason: 'School account suspended.' };

  const usageRows = await sql`SELECT * FROM school_usage WHERE school_id = ${schoolId}`;
  const usage = usageRows[0] || {};
  
  if (status === 'trialing' || status === 'trial') {
    if (feature === 'video') return { allowed: false, reason: 'Video generation is not available during trial. Please upgrade.' };
    if (feature === 'image') return { allowed: false, reason: 'Image search is not available during trial. Please upgrade.' };
    if (feature === 'interactive') {
       if ((usage.interactive_lessons_this_month || 0) < 2) return { allowed: true };
       return { allowed: false, reason: 'Trial limit reached for interactive lessons (2 max).' };
    }
    if (feature === 'document') {
       const orgUsers = await sql`SELECT user_id FROM organization_members WHERE organization_id = ${orgId}`;
       const userIds = orgUsers.map((u: any) => u.user_id);
       let bookCount = 0;
       if (userIds.length > 0) {
         const books = await sql`SELECT count(*) FROM documents WHERE user_id IN ${sql(userIds)}`;
         bookCount = Number(books[0].count);
       }
       if (bookCount < 10) return { allowed: true };
       return { allowed: false, reason: 'Trial limit reached for books (10 max).' };
    }
    if (feature === 'chat' || feature === 'youtube') return { allowed: true };
    return { allowed: false, reason: 'Feature not allowed during trial.' };
  }

  const plan = sub.plan_type || 'Starter';
  const limits: any = {
    'Starter': { document: 1000, video: 10, image: 20, interactive: 5, youtube: 50 },
    'Growth': { document: 5000, video: 25, image: 50, interactive: 20, youtube: 100 },
    'Enterprise': { document: 10000, video: 100, image: 200, interactive: 100, youtube: 500 }
  };
  
  const currentLimits = limits[plan] || limits['Starter'];
  let count = 0;
  if (feature === 'video') count = usage.video_generations_this_month || 0;
  if (feature === 'image') count = usage.image_searches_this_month || 0;
  if (feature === 'interactive') count = usage.interactive_lessons_this_month || 0;
  if (feature === 'document') count = usage.books_uploaded_this_month || 0; 
  if (feature === 'youtube') count = usage.youtube_searches_today || 0;
  if (feature === 'chat') return { allowed: true };

  if (count >= currentLimits[feature]) {
     return { allowed: false, reason: `Plan limit reached for ${plan} plan.` };
  }
  
  return { allowed: true };
}

// --- Auth Routes ---
app.get('/api/me/role', (req, res) => {
  res.json({ role: req.cookies['sb-role'] || 'user' });
});

app.get('/api/me/context', authenticate, async (req: any, res) => {
  try {
    const orgId = req.cookies['sb-org-id'];
    const role = req.cookies['sb-role'] || 'user';
    const userId = req.userId;

    if (orgId) {
      const orgs = await sql`SELECT name, school_id FROM organizations WHERE id = ${orgId}`;
      if (orgs.length > 0 && orgs[0].school_id) {
        const schoolId = orgs[0].school_id;
        const subs = await sql`SELECT * FROM school_subscriptions WHERE school_id = ${schoolId}`;
        const usageRows = await sql`SELECT * FROM school_usage WHERE school_id = ${schoolId}`;
        const usage = usageRows[0] || {};
        const sub = subs[0] || {};
        const isTrial = sub.status === 'trialing' || sub.status === 'trial';
        const isPro = sub.status === 'active' || isTrial;
        let trial_days_left = 0;
        if (isTrial && sub.trial_end) {
           const end = new Date(sub.trial_end);
           const now = new Date();
           trial_days_left = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24)));
        } else if (isTrial && sub.trial_end_date) {
           const end = new Date(sub.trial_end_date);
           const now = new Date();
           trial_days_left = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24)));
        }

        const planName = sub.plan_type || 'Starter';
        const planLimits: any = {
          'Starter': { document: 1000, video: 10, image: 20, interactive: 5, youtube: 50 },
          'Growth': { document: 5000, video: 25, image: 50, interactive: 20, youtube: 100 },
          'Enterprise': { document: 10000, video: 100, image: 200, interactive: 100, youtube: 500 }
        };
        
        const limits = planLimits[planName] || planLimits['Starter'];
        
        let videosLimit = isTrial ? 0 : limits.video;
        let imagesLimit = isTrial ? 0 : limits.image;
        let interactiveLimit = isTrial ? 2 : limits.interactive;
        let booksLimit = isTrial ? 10 : limits.document;
        
        if (sub.status === 'locked') {
          videosLimit = 0;
          imagesLimit = 0;
          interactiveLimit = 0;
          booksLimit = 0;
        }

        return res.json({
          context: 'school',
          role,
          orgId,
          orgName: orgs[0].name,
          subscription: sub,
          is_trial: isTrial,
          trial_days_left,
          plan: planName,
          status: sub.status || 'trialing',
          limits,
          usage: {
             videos: { used: usage.video_generations_this_month || 0, limit: videosLimit },
             images: { used: usage.image_searches_this_month || 0, limit: imagesLimit },
             interactive_lessons: { used: usage.interactive_lessons_this_month || 0, limit: interactiveLimit },
             books: { used: usage.books_uploaded_this_month || 0, limit: booksLimit },
             chat: { used: usage.chat_messages_today || 0, limit: null },
             youtube: { used: usage.youtube_searches_today || 0, limit: null },
             // Keep old names for fallback if needed:
             books_uploaded_this_month: usage.books_uploaded_this_month || 0,
             video_generations_this_month: usage.video_generations_this_month || 0,
             image_searches_this_month: usage.image_searches_this_month || 0,
             interactive_lessons_this_month: usage.interactive_lessons_this_month || 0,
             chat_messages_today: usage.chat_messages_today || 0,
             youtube_searches_today: usage.youtube_searches_today || 0
          }
        });
      }
    }

    const subs = await sql`SELECT * FROM subscriptions WHERE user_id = ${userId}`;
    let usageRows = await sql`SELECT * FROM user_usage WHERE user_id = ${userId}`;
    if (usageRows.length === 0) {
      await sql`INSERT INTO user_usage (user_id, books_uploaded_this_month, video_generations_this_month, image_searches_this_month, interactive_lessons_this_month, youtube_searches_today, last_reset_date, last_daily_reset_date) VALUES (${userId}, 0, 0, 0, 0, 0, CURRENT_DATE, CURRENT_DATE)`;
      usageRows = await sql`SELECT * FROM user_usage WHERE user_id = ${userId}`;
    }

    const usage = usageRows[0] || {};
    const sub = subs[0] || {};
    const plan = sub.plan || 'free';
    const isPro = plan === 'pro' || plan === 'Pro' || plan === 'lifetime' || plan === 'Growth' || plan === 'Enterprise' || plan === 'unlimited';
    
    // Limits
    const limits = plan === 'unlimited' ? {
       document: 'unlimited', video: 'unlimited', image: 'unlimited', interactive: 'unlimited', youtube: 'unlimited'
    } : {
       document: isPro ? 'unlimited' : 4,
       video: isPro ? 10 : 2,
       image: isPro ? 50 : 20,
       interactive: isPro ? 30 : 10,
       youtube: isPro ? 50 : 10
    };

    return res.json({
      context: 'personal',
      role,
      subscription: sub,
      plan,
      status: plan === 'free' ? 'trialing' : 'active',
      limits,
      usage: {
        videos: { used: usage.video_generations_this_month || 0, limit: limits.video === 'unlimited' ? null : limits.video },
        images: { used: usage.image_searches_this_month || 0, limit: limits.image === 'unlimited' ? null : limits.image },
        interactive_lessons: { used: usage.interactive_lessons_this_month || 0, limit: limits.interactive === 'unlimited' ? null : limits.interactive },
        books: { used: usage.books_uploaded_this_month || 0, limit: limits.document === 'unlimited' ? null : limits.document },
        chat: { used: usage.chat_messages_today || 0, limit: plan === 'free' || plan === 'Starter' ? 10 : null },
        youtube: { used: usage.youtube_searches_today || 0, limit: limits.youtube === 'unlimited' ? null : limits.youtube },
        // Fallbacks
        books_uploaded_this_month: usage.books_uploaded_this_month || 0,
        video_generations_this_month: usage.video_generations_this_month || 0,
        image_searches_this_month: usage.image_searches_this_month || 0,
        interactive_lessons_this_month: usage.interactive_lessons_this_month || 0,
        chat_messages_today: usage.youtube_searches_today || 0, // wait chat usage isn't really tracked properly in user_usage, using 0 for now since it's just frontend
        youtube_searches_today: usage.youtube_searches_today || 0
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) return res.status(400).json({ error: 'Email already in use' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    await sql`INSERT INTO users (id, name, email, password_hash) VALUES (${id}, ${name}, ${email}, ${hash})`;

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id, name, email } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = users[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req: any, res) => {
  console.log('GET /api/auth/me hit.', 'Cookies:', Object.keys(req.cookies || {}));
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.sub;
    const role = req.cookies['sb-role'] || 'user';
    const orgId = req.cookies['sb-org-id'] || null;
    let user;
    
    try {
      const users = await sql`SELECT id, name, email FROM users WHERE id = ${userId}`;
      if (users.length > 0) {
        user = users[0];
      }
    } catch (e) {
      // Ignored
    }

    if (!user) {
      user = { id: userId, name: role.charAt(0).toUpperCase() + role.slice(1) || 'Gateway User', email: '' };
    }
    
    console.log('Returning user:', user.id, 'Role:', role);
    res.json({ user: { ...user, role, org_id: orgId }, token });
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});


// --- Organizations Route ---
app.get('/api/organizations', authenticate, async (req: any, res) => {
  try {
    const orgs = await sql`
      SELECT o.* FROM organizations o 
      JOIN organization_members m ON o.id = m.organization_id 
      WHERE m.user_id = ${req.userId}
    `;
    res.json(orgs);
  } catch (err: any) {
    if (err.message && err.message.includes('does not exist')) {
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

// --- Document Routes ---
app.get('/api/documents', authenticate, async (req: any, res) => {
  try {
    let docs;
    if (req.orgId && req.orgId !== 'demo' && req.orgId !== 'default_org') {
      docs = await sql`
        SELECT DISTINCT d.* FROM documents d
        JOIN organization_members om ON d.user_id = om.user_id
        WHERE om.organization_id = ${req.orgId}
        ORDER BY d.upload_date DESC
      `;
    } else {
      docs = await sql`SELECT * FROM documents WHERE user_id = ${req.userId} ORDER BY upload_date DESC`;
    }
    
    // Fetch all chapters for these documents
    const docIds = docs.map(d => d.id);
    let allChapters: any[] = [];
    if (docIds.length > 0) {
      allChapters = await sql`SELECT * FROM chapters WHERE document_id IN ${sql(docIds)}`;
    }

    const result = docs.map(doc => {
      const flatChapters = allChapters.filter(ch => ch.document_id === doc.id);
      
      const chapterMap = new Map();
      const roots: any[] = [];
      flatChapters.forEach(ch => {
        chapterMap.set(ch.id, {
          id: ch.id,
          chapterNumber: ch.chapter_number,
          title: ch.title,
          summary: ch.summary,
          content: ch.content,
          parentId: ch.parent_id,
          sortOrder: ch.sort_order || 0,
          type: ch.type || 'chapter',
          children: []
        });
      });

      Array.from(chapterMap.values()).forEach(ch => {
        if (ch.parentId && chapterMap.has(ch.parentId)) {
          chapterMap.get(ch.parentId).children.push(ch);
        } else {
          roots.push(ch);
        }
      });

      const sortTree = (nodes: any[]) => {
        nodes.sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          return a.chapterNumber - b.chapterNumber;
        });
        nodes.forEach(n => sortTree(n.children));
      };
      sortTree(roots);

      return {
        id: doc.id,
        name: doc.name,
        uploadDate: doc.upload_date,
        tags: doc.tags ? JSON.parse(doc.tags) : [],
        isPublic: doc.is_public,
        chapters: roots
      };
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', authenticate, async (req: any, res) => {
  const { id, name, chapters, tags, org_id } = req.body;
  
  try {
    const orgId = org_id || req.query.org_id || req.cookies?.['sb-org-id'];
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    try {
      await verifyAndIncrementUsage(req.userId, 'document', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    await sql.begin(async (tx: any) => {
      const cleanName = (name || '').replace(/\x00/g, '');
      const isPublic = false;
      const safeTags = tags ? JSON.stringify(tags) : '[]';
      await tx`
        INSERT INTO documents (id, user_id, name, upload_date, tags, is_public) 
        VALUES (${id}, ${req.userId}, ${cleanName}, NOW(), ${safeTags}, ${isPublic})
      `;
      
      if (chapters && chapters.length > 0) {
        const flatChapters: any[] = [];
        const flatten = (nodes: any[], parentId: string | null = null) => {
          nodes.forEach((ch, idx) => {
            flatChapters.push({
              id: ch.id,
              document_id: id,
              chapter_number: ch.chapterNumber || (idx + 1),
              title: (ch.title || '').replace(/\x00/g, ''),
              summary: (ch.summary || '').replace(/\x00/g, ''),
              content: (ch.content || '').replace(/\x00/g, ''),
              parent_id: parentId || ch.parentId || null,
              sort_order: ch.sortOrder || idx,
              type: ch.type || (parentId ? 'topic' : 'chapter')
            });
            if (ch.children && ch.children.length > 0) {
              flatten(ch.children, ch.id);
            }
          });
        };
        flatten(chapters);

        await tx`INSERT INTO chapters ${tx(flatChapters)}`;
      }
    });
    res.json({ success: true, document_id: id });
  } catch (err: any) {
    // Log the FULL error so we can see exactly what column/constraint is failing
    console.error('DOCUMENT UPLOAD FAILED', {
      message: err.message,
      code: err.code,
      routine: err.routine,
      column: err.column,
      stack: err.stack
    });

    let errorMessage = 'Database sync failed. Please try again.';
    
    // If it's a missing column, tell us exactly which one
    if (err.code === '42703') {
      errorMessage = `Database column missing: ${err.message}`;
      console.error('MISSING COLUMN:', err.message);
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

app.put('/api/chapters/:id', authenticate, async (req: any, res) => {
  const chapterId = req.params.id;
  const { summary, org_id } = req.body;
  try {
    const orgId = org_id || req.query.org_id;
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    // Verify ownership
    const docQuery = await sql`
      SELECT d.id FROM documents d
      JOIN chapters c ON c.document_id = d.id
      WHERE c.id = ${chapterId} AND ${getDocAliasUserFilter(req, 'd')}
    `;
    if (docQuery.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to edit this chapter' });
    }
    
    await sql`UPDATE chapters SET summary = ${summary.replace(/\x00/g, '')} WHERE id = ${chapterId}`;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:id/tags', authenticate, async (req: any, res) => {
  try {
    const orgId = req.body.org_id || req.query.org_id;
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    const docId = req.params.id;
    const { tags } = req.body;
    
    const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND ${getDocUserFilter(req)}`;
    if (docs.length === 0) return res.status(404).json({ error: 'Document not found' });

    await sql`UPDATE documents SET tags = ${JSON.stringify(tags)} WHERE id = ${docId}`;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:id/share', authenticate, async (req: any, res) => {
  try {
    const orgId = req.body.org_id || req.query.org_id;
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    const docId = req.params.id;
    const { isPublic } = req.body;
    
    const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND ${getDocUserFilter(req)}`;
    if (docs.length === 0) return res.status(404).json({ error: 'Document not found' });

    await sql`UPDATE documents SET is_public = ${isPublic} WHERE id = ${docId}`;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/shared/:id', async (req: any, res) => {
  try {
    const docId = req.params.id;
    const docs = await sql`SELECT * FROM documents WHERE id = ${docId} AND is_public = TRUE`;
    if (docs.length === 0) return res.status(404).json({ error: 'Document not found or not public' });
    
    const doc = docs[0];
    const allChapters = await sql`SELECT * FROM chapters WHERE document_id = ${docId}`;
    
    const chapterMap = new Map();
    const roots: any[] = [];
    allChapters.forEach(ch => {
      chapterMap.set(ch.id, {
        id: ch.id,
        chapterNumber: ch.chapter_number,
        title: ch.title,
        summary: ch.summary,
        content: ch.content,
        parentId: ch.parent_id,
        sortOrder: ch.sort_order || 0,
        type: ch.type || 'chapter',
        children: []
      });
    });

    Array.from(chapterMap.values()).forEach(ch => {
      if (ch.parentId && chapterMap.has(ch.parentId)) {
        chapterMap.get(ch.parentId).children.push(ch);
      } else {
        roots.push(ch);
      }
    });

    const sortTree = (nodes: any[]) => {
      nodes.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.chapterNumber - b.chapterNumber;
      });
      nodes.forEach(n => sortTree(n.children));
    };
    sortTree(roots);
    
    res.json({
      id: doc.id,
      name: doc.name,
      uploadDate: doc.upload_date,
      tags: doc.tags ? JSON.parse(doc.tags) : [],
      isPublic: doc.is_public,
      chapters: roots
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:id', authenticate, async (req: any, res) => {
  try {
    const orgId = req.body.org_id || req.query.org_id;
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    const docId = req.params.id;
    // Verify ownership
    const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND ${getDocUserFilter(req)}`;
    if (docs.length === 0) return res.status(404).json({ error: 'Document not found' });

    // With ON DELETE CASCADE in the schema, deleting the document will delete chapters and chats automatically.
    // However, to be safe and explicit (or if cascade isn't fully set up on existing DBs), we can delete manually:
    await sql.begin(async (tx: any) => {
      await tx`DELETE FROM chats WHERE chapter_id IN (SELECT id FROM chapters WHERE document_id = ${docId})`;
      await tx`DELETE FROM chapters WHERE document_id = ${docId}`;
      await tx`DELETE FROM documents WHERE id = ${docId}`;
    });
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Storyboard / Educational Rendering Layer Routes ---

app.post('/api/lessons/generate', authenticate, async (req: any, res) => {
  try {
    const orgId = req.body.organization_id || req.query.org_id;
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    const { 
      organization_id, document_id, chapter_id, title, summary, 
      key_concepts, subject, grade_level, visual_style, narration_style 
    } = req.body;

    if (!organization_id || !chapter_id) {
      return res.status(400).json({ error: 'organization_id and chapter_id are required' });
    }

    const jobId = uuidv4();
    
    // Create initial storyboard job entry
    await sql`
      INSERT INTO storyboards (
        id, organization_id, document_id, chapter_id, title, 
        visual_style, narration_style, grade_level, subject, status
      ) VALUES (
        ${jobId}, ${organization_id}, ${document_id}, ${chapter_id}, ${title},
        ${visual_style}, ${narration_style}, ${grade_level}, ${subject}, 'pending'
      )
    `;

    // Start async generation
    generateStoryboardJob(
      jobId, organization_id, document_id, chapter_id, title, summary,
      key_concepts, subject, grade_level, visual_style, narration_style
    ).catch(console.error);

    res.json({ success: true, jobId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/storyboards/:id', authenticate, async (req: any, res) => {
  try {
    const sbId = req.params.id;
    const sbs = await sql`SELECT * FROM storyboards WHERE id = ${sbId}`;
    if (sbs.length === 0) return res.status(404).json({ error: 'Storyboard not found' });
    
    // Check if the user is authorized for this organization (skipping tight auth for now, or assume organization_id is valid for user)
    // Could add user-to-organization checks here if orgs were modeled
    
    const sb = sbs[0];
    const scenes = await sql`
      SELECT s.*, 
             v.image_url, v.model_used, 
             n.asset_url as narration_url
      FROM scenes s
      LEFT JOIN visual_metadata v ON v.scene_id = s.id
      LEFT JOIN narration_assets n ON n.scene_id = s.id
      WHERE s.storyboard_id = ${sbId} 
      ORDER BY s.scene_number ASC
    `;
    
    res.json({
      storyboard: sb,
      scenes: scenes.map(s => ({
        ...s,
        labels: s.labels ? JSON.parse(s.labels) : [],
        educational_metadata: s.educational_metadata ? JSON.parse(s.educational_metadata) : {}
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW VIDEO LESSON PIPELINE ROUTES ---
app.post('/api/chapters/:id/generate-lesson', authenticate, async (req: any, res) => {
  try {
    const orgId = req.body.org_id || req.query.org_id || req.cookies?.['sb-org-id'];
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    try {
      await verifyAndIncrementUsage(req.userId, 'video', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const chapterId = req.params.id;
    const { org_id = 'default_org', document_id = 'doc123' } = req.body;
    
    const jobId = uuidv4();
    await sql`
      INSERT INTO generation_jobs (id, org_id, document_id, chapter_id, status, progress)
      VALUES (${jobId}, ${org_id}, ${document_id}, ${chapterId}, 'pending', 0)
    `;
    
    // Start background processing
    processVideoLessonJob(jobId, chapterId, org_id, document_id).catch(console.error);

    res.json({ job_id: jobId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chapters/:id/generation-job', authenticate, async (req: any, res) => {
  try {
    const jobs = await sql`SELECT * FROM generation_jobs WHERE chapter_id = ${req.params.id} ORDER BY created_at DESC LIMIT 1`;
    if (!jobs.length) {
      return res.json({ job: null });
    }
    
    const job = jobs[0];
    let storyboard = null;
    let scenes = [];
    
    if (job.status === 'completed' || job.progress > 10) {
      const sbs = await sql`SELECT * FROM storyboards WHERE generation_job_id = ${job.id}`;
      if (sbs.length) {
        storyboard = sbs[0];
        const scns = await sql`
          SELECT s.*, 
                 v.image_url, v.model_used, 
                 n.asset_url as narration_url
          FROM scenes s
          LEFT JOIN visual_metadata v ON v.scene_id = s.id
          LEFT JOIN narration_assets n ON n.scene_id = s.id
          WHERE s.storyboard_id = ${storyboard.id} 
          ORDER BY s.scene_number ASC
        `;
        scenes = scns;
      }
    }

    res.json({ job, storyboard, scenes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/scenes/:id', authenticate, async (req: any, res) => {
  try {
    const sceneId = req.params.id;
    const { narration, visual_prompt } = req.body;
    const scenes = await sql`SELECT * FROM scenes WHERE id = ${sceneId}`;
    if (!scenes.length) return res.status(404).json({ error: 'Scene not found' });
    
    // update only provided fields
    if (narration !== undefined) {
      await sql`UPDATE scenes SET narration = ${narration} WHERE id = ${sceneId}`;
    }
    if (visual_prompt !== undefined) {
      await sql`UPDATE scenes SET visual_prompt = ${visual_prompt} WHERE id = ${sceneId}`;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scenes/:id/regenerate', authenticate, async (req: any, res) => {
  try {
    const orgId = req.body.org_id || req.query.org_id;
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    const sceneId = req.params.id;
    
    // Grab scene
    const scenes = await sql`SELECT * FROM scenes WHERE id = ${sceneId}`;
    if (!scenes.length) return res.status(404).json({ error: 'Scene not found' });
    const scene = scenes[0];
    
    // Asynchronously regenerate that particular scene assets
    processSceneAssets(scene.id, scene.organization_id, scene.visual_prompt, scene.narration, scene.estimated_duration_seconds).catch(console.error);
    
    res.json({ status: 'regenerating' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
// ----------------------------------------



// --- Video Retrieval Route ---
import ytSearch from 'yt-search';
import { GoogleGenAI } from '@google/genai';
import { getSubtitles } from 'youtube-captions-scraper';

app.get('/api/youtube/:videoId/captions', authenticate, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const captions = await getSubtitles({
      videoID: videoId,
      lang: 'en'
    });
    res.json(captions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/retrieve-videos', authenticate, async (req: any, res) => {
  try {
    try {
      await verifyAndIncrementUsage(req.userId, 'youtube', req.body.org_id || req.query.org_id || req.cookies?.['sb-org-id']);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const { title, summary, subject, grade, keyConcepts, class_context } = req.body;
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        retryOptions: {
          attempts: 5
        }
      }
    });
    const conceptsStr = Array.isArray(keyConcepts) ? keyConcepts.join(', ') : '';

    const contextPrefix = class_context ? `Class Context: ${class_context}` : `Grade Level: ${grade}`;

    const prompt = `
You are an expert Educational Video Retrieval Engine.
Your task is to find the best educational YouTube videos for a specific chapter context.

${contextPrefix}
Chapter Title: ${title}
Subject: ${subject}
Summary: ${summary}
Key Concepts: ${conceptsStr}

Step 1: Extract the core learning intent from the chapter summary.
Step 2: Break down the learning intent into key concepts (especially visual ones).
Step 3: Generate 5-10 highly optimized YouTube search queries suitable for the specified class context. If Class Context is provided, strongly prefix or bias the search queries with it (e.g. "${class_context}: Photosynthesis animation").
Step 4: Predict ideal videos and assign a "quality_score" out of 100 based on expected educational clarity, animation quality, and context match.

Return ONLY valid JSON exactly matching this schema:
{
  "chapter": "string",
  "learning_intent": "string",
  "intent_quality_score": number,
  "key_concepts": ["string"],
  "search_queries": ["string"],
  "recommended_videos": [
    {
      "title": "string",
      "channel": "string",
      "reason": "string",
      "search_query_used": "string",
      "video_id": "string",
      "embed_type": "string",
      "quality_score": number
    }
  ]
}
Leave "video_id" empty if unsure, do not invent 11-char IDs.
`;

    let responseText = '{}';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      responseText = response.text || '{}';
    } catch (geminiError: any) {
      console.warn("Gemini retrieve-videos failed:", geminiError.message, "- trying DeepSeek fallback");
      const dsKey = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
      let dsSucceeded = false;

      if (dsKey) {
        try {
          const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${dsKey}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat', // Use deepseek-chat or deepseek-v4-flash depending on config, but deepseek-chat is standard for text
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' }
            })
          });
          
          if (dsRes.ok) {
            const dsData = await dsRes.json();
            responseText = dsData.choices[0].message.content || '{}';
            dsSucceeded = true;
          } else {
            console.warn("DeepSeek fallback failed with status:", dsRes.status);
          }
        } catch (dsError) {
          console.warn("DeepSeek fetch failed:", dsError);
        }
      }

      if (!dsSucceeded) {
        console.warn("Using Fallback #2 for retrieve-videos.");
        const fallbackQueries = [`${title} ${keyConcepts?.slice(0,3).join(' ') || ''}`.trim(), title];
        responseText = JSON.stringify({
          chapter: title,
          learning_intent: summary || title,
          intent_quality_score: 50,
          key_concepts: keyConcepts || [],
          search_queries: fallbackQueries,
          recommended_videos: fallbackQueries.map(q => ({
            title: q,
            search_query_used: q,
            quality_score: 50
          }))
        });
      }
    }

    console.log("LLM response text:", responseText);
    let parsedData;
    try {
      parsedData = JSON.parse(responseText.trim().replace(/^```json/, '').replace(/```$/, ''));
    } catch (e) {
      console.error("Failed to parse Gemini response:", e);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    if (!parsedData.recommended_videos || !Array.isArray(parsedData.recommended_videos)) {
      return res.json({ videos: [] });
    }

    // Grounding with yt-search
    const groundedVideos = [];
    for (const vid of parsedData.recommended_videos) {
      if (!vid.video_id || vid.video_id.length !== 11) {
        try {
          const searchResult = await ytSearch(vid.search_query_used || vid.title);
          if (searchResult && searchResult.videos.length > 0) {
            vid.video_id = searchResult.videos[0].videoId;
            vid.real_title = searchResult.videos[0].title;
            if (!vid.channel) vid.channel = searchResult.videos[0].author.name;
          }
        } catch (e) {
          console.error("YT Search Error:", e);
        }
      }
      
      if (vid.video_id && vid.video_id.length === 11) {
        groundedVideos.push(vid);
      }
    }

    // Sort by quality score desc
    groundedVideos.sort((a, b) => b.quality_score - a.quality_score);
    parsedData.recommended_videos = groundedVideos;

    res.json(parsedData);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/topics/:id/images', authenticate, async (req: any, res) => {
  try {
    try {
      await verifyAndIncrementUsage(req.userId, 'image', req.body.org_id || req.query.org_id || req.cookies?.['sb-org-id']);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const { org_context, title, key_concepts, summary } = req.body;
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        retryOptions: {
          attempts: 5
        }
      }
    });
    
    const conceptsStr = Array.isArray(key_concepts) ? key_concepts.join(', ') : '';
    
    const prompt = `Generate a concise image search query for an educational diagram about: ${org_context || ''} - ${title}. Key concepts: ${conceptsStr}. Summary: ${summary}. The image should be suitable for the grade level. Return only the query string.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    
    const search_query = response.text?.trim() || title;

    const images: any[] = [];
    const pexelsKey = process.env.IMAGE_SEARCH_API_KEY;

    if (pexelsKey) {
      try {
        const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(search_query)}&per_page=6`, {
          headers: { Authorization: pexelsKey }
        });
        if (pexelsRes.ok) {
          const data = await pexelsRes.json();
          if (data.photos && data.photos.length > 0) {
            data.photos.forEach((photo: any) => {
              images.push({
                url: photo.src.original,
                thumbnail: photo.src.medium,
                alt: photo.alt || "Educational diagram",
                source: "real"
              });
            });
          }
        }
      } catch (err) {
         console.error("Pexels fetch error", err);
      }
    }

    res.json({ images });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

import { synthesizeSpeech } from './server/synthesizeSpeech.js';

app.post('/api/lessons/study-plan', authenticate, async (req: any, res) => {
  try {
    const { docId } = req.body;
    let chapters;
    if (docId) {
       const docs = await sql`SELECT chapters FROM documents WHERE id = ${docId} AND ${getDocUserFilter(req)}`;
       if (!docs || docs.length === 0) return res.status(404).json({error: "Not found"});
       chapters = typeof docs[0].chapters === 'string' ? JSON.parse(docs[0].chapters) : docs[0].chapters;
    } else {
       const docs = await sql`SELECT name, chapters FROM documents WHERE ${getDocUserFilter(req)}`;
       chapters = docs.map((d: any) => ({
         title: "Project: " + d.name,
         children: typeof d.chapters === 'string' ? JSON.parse(d.chapters) : d.chapters
       }));
    }
    
    // We send to gemini to create a schedule
    const text = JSON.stringify(chapters, ['title', 'summary', 'children']);
    
    const prompt = `You are a learning expert. Given the following document chapter hierarchy, generate a multi-day study schedule.
Format it in Markdown, with headings for Day 1, Day 2, etc., and bullet points for what chapters or parts to study. Break it down reasonably.

Chapter data:
${text.substring(0, 50000)}`;
    
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || ''
    });
    const result = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }]}]
    });
    
    let plan = result.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Failed to generate study plan.';
    res.json({ plan });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "missing text" });
    }
    const audioUrl = await synthesizeSpeech(text);
    res.json({ audioUrl });
  } catch (err: any) {
    console.error("TTS generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

const upload = multer();

app.post('/api/stt/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing audio file" });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing ELEVENLABS_API_KEY" });
    }

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, 'audio.webm');
    formData.append('model_id', 'scribe_v1');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey
      },
      body: formData as any
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs STT error:", errText);
      return res.status(response.status).json({ error: "Transcription failed" });
    }

    const data = await response.json();
    res.json({ text: data.text });
  } catch (err: any) {
    console.error("STT transcription exception:", err);
    res.status(500).json({ error: err.message });
  }
});

import { createInteractiveLesson } from './server/lessonOrchestrator.js';
import { saveSessionMemory } from './server/studentMemory.js';

app.post('/api/topics/:id/memory', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { chatHistory } = req.body;
    
    // Save memory asynchronously
    if (chatHistory && chatHistory.length > 0) {
      await saveSessionMemory(req.userId, id, chatHistory);
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error saving memory:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Interactive Lesson Route ---
app.post('/api/topics/:id/start-lesson', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { orgId } = req.body;
    
    // Default orgId if missing, or we can use a dummy
    const actualOrgId = orgId || req.userId || req.cookies?.['sb-org-id'] || 'default_org';

    try {
      await verifyAndIncrementUsage(req.userId, 'interactive', actualOrgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const steps = await createInteractiveLesson(id, actualOrgId, req.userId);
    res.json({ steps });
  } catch (err: any) {
    console.error("Error starting lesson:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/user/usage', authenticate, async (req: any, res) => {
  try {
    const userId = req.userId;
    const subs = await sql`SELECT plan FROM subscriptions WHERE user_id = ${userId}`;
    let plan = 'free';
    if (subs.length > 0 && subs[0].plan) {
      plan = subs[0].plan;
    }
    const isPro = plan === 'pro' || plan === 'Pro' || plan === 'lifetime' || plan === 'Growth' || plan === 'Enterprise' || plan === 'unlimited';

    let usageRows = await sql`SELECT * FROM user_usage WHERE user_id = ${userId}`;
    if (usageRows.length === 0) {
      await sql`INSERT INTO user_usage (user_id, books_uploaded_this_month, video_generations_this_month, image_searches_this_month, interactive_lessons_this_month, youtube_searches_today, last_reset_date, last_daily_reset_date) VALUES (${userId}, 0, 0, 0, 0, 0, CURRENT_DATE, CURRENT_DATE)`;
      usageRows = await sql`SELECT * FROM user_usage WHERE user_id = ${userId}`;
    }
    const usage = usageRows[0];

    const todayDate = new Date();
    const resetDate = new Date(usage.last_reset_date);
    const dailyResetDate = usage.last_daily_reset_date ? new Date(usage.last_daily_reset_date) : new Date(0);
    
    if (todayDate.getMonth() !== resetDate.getMonth() || todayDate.getFullYear() !== resetDate.getFullYear()) {
      await sql`UPDATE user_usage SET video_generations_this_month = 0, image_searches_this_month = 0, interactive_lessons_this_month = 0, books_uploaded_this_month = 0, last_reset_date = CURRENT_DATE WHERE user_id = ${userId}`;
      usage.video_generations_this_month = 0;
      usage.image_searches_this_month = 0;
      usage.interactive_lessons_this_month = 0;
      usage.books_uploaded_this_month = 0;
    }

    if (todayDate.getDate() !== dailyResetDate.getDate() || todayDate.getMonth() !== dailyResetDate.getMonth() || todayDate.getFullYear() !== dailyResetDate.getFullYear()) {
      await sql`UPDATE user_usage SET youtube_searches_today = 0, last_daily_reset_date = CURRENT_DATE WHERE user_id = ${userId}`;
      usage.youtube_searches_today = 0;
    }

    let limits: any = {
       document: isPro ? 'unlimited' : 4,
       video: isPro ? 10 : 2,
       image: isPro ? 50 : 20,
       interactive: isPro ? 30 : 10,
       youtube: isPro ? 50 : 10
    };

    if (plan === 'unlimited') {
        limits = { document: 'unlimited', video: 'unlimited', image: 'unlimited', interactive: 'unlimited', youtube: 'unlimited' };
    }

    res.json({
      plan,
      usage: {
        books_uploaded_this_month: usage.books_uploaded_this_month,
        video_generations_this_month: usage.video_generations_this_month,
        image_searches_this_month: usage.image_searches_this_month,
        interactive_lessons_this_month: usage.interactive_lessons_this_month,
        chat_messages_today: 0, // placeholder
        youtube_searches_today: usage.youtube_searches_today || 0
      },
      limits: limits
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- School Usage Route ---
app.get('/api/school/usage', authenticate, async (req: any, res) => {
  try {
    let schoolId = null;
    const orgId = req.query.orgId;
    
    try {
      if (orgId && orgId !== 'demo' && orgId !== 'default_org') {
        const orgs = await sql`SELECT school_id FROM organizations WHERE id = ${orgId}`;
        if (orgs.length > 0) schoolId = orgs[0].school_id;
      }
      if (!schoolId) {
        const userOrgs = await sql`SELECT o.school_id FROM organizations o JOIN organization_members ou ON o.id = ou.organization_id WHERE ou.user_id = ${req.userId} LIMIT 1`;
        if (userOrgs.length > 0) schoolId = userOrgs[0].school_id;
      }
    } catch (err: any) {
      if (err.message && err.message.includes('does not exist')) {
        return res.json({ error: 'No school associated with this account (tables missing)' });
      }
      throw err;
    }
    
    if (!schoolId) {
      return res.json({ error: 'No school associated with this account' });
    }

    const subs = await sql`SELECT plan FROM school_subscriptions WHERE school_id = ${schoolId}`;
    const plan = subs.length > 0 ? (subs[0].plan || 'Starter') : 'Starter';

    let usages = await sql`SELECT * FROM school_usage WHERE school_id = ${schoolId}`;
    if (usages.length === 0) {
      await sql`INSERT INTO school_usage (school_id, videos_generated_this_month, image_searches_this_month, interactive_lessons_this_month, billing_period_start) VALUES (${schoolId}, 0, 0, 0, CURRENT_DATE)`;
      usages = await sql`SELECT * FROM school_usage WHERE school_id = ${schoolId}`;
    }
    let usage = usages[0];

    const today = new Date();
    const bpStart = new Date(usage.billing_period_start);
    if (today.getMonth() !== bpStart.getMonth() || today.getFullYear() !== bpStart.getFullYear()) {
      await sql`UPDATE school_usage 
                SET videos_generated_this_month = 0, 
                    image_searches_this_month = 0, 
                    interactive_lessons_this_month = 0, 
                    billing_period_start = CURRENT_DATE 
                WHERE school_id = ${schoolId}`;
      usage.videos_generated_this_month = 0;
      usage.image_searches_this_month = 0;
      usage.interactive_lessons_this_month = 0;
    }

    const videoLimit = plan === 'Enterprise' ? 50 : (plan === 'Growth' ? 25 : 10);
    const imageLimit = plan === 'Enterprise' ? 'unlimited' : (plan === 'Growth' ? 50 : 20);
    const interactiveLimit = plan === 'Enterprise' ? 30 : (plan === 'Growth' ? 10 : 5);

    res.json({
      plan,
      usage: {
        videos_generated_this_month: usage.videos_generated_this_month,
        image_searches_this_month: usage.image_searches_this_month,
        interactive_lessons_this_month: usage.interactive_lessons_this_month
      },
      limits: {
        videos: videoLimit,
        images: imageLimit,
        interactive: interactiveLimit
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function safeParse(val: any) {
  if (!val) return undefined;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch(e) { return undefined; }
  }
  return val;
}

// --- Chat Routes ---
app.get('/api/chats/:chapterId', authenticate, async (req: any, res) => {
  try {
    try {
      await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb`;
      await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb`;
    } catch(e) {}
    const chats = await sql`SELECT * FROM chats WHERE chapter_id = ${req.params.chapterId} AND user_id = ${req.userId} ORDER BY created_at ASC`;
    const result = chats.map((c: any) => ({
      id: c.id,
      role: c.role,
      text: c.text,
      relationshipGraph: safeParse(c.relationship_graph),
      followUps: safeParse(c.follow_ups),
      type: c.type,
      actionData: safeParse(c.action_data),
      recommended_videos: safeParse(c.recommended_videos),
      images: safeParse(c.images),
      reactions: safeParse(c.reactions) || undefined,
      pinned: c.pinned
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/chats/:id/pin', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { pinned } = req.body;
    await sql`UPDATE chats SET pinned = ${pinned} WHERE id = ${id} AND user_id = ${req.userId}`;
    res.json({ success: true, pinned });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats/:messageId/react', authenticate, async (req: any, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  if (!['👍', '👎', '❤️', '😂', '😮', '🔖'].includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }
  try {
    const chatsRecord = await sql`SELECT reactions FROM chats WHERE id = ${messageId}`;
    if (chatsRecord.length === 0) return res.status(404).json({ error: 'Message not found' });
    let reactions = chatsRecord[0].reactions || {};
    reactions[emoji] = reactions[emoji] || [];
    if (reactions[emoji].includes(req.userId)) {
      reactions[emoji] = reactions[emoji].filter((id: string) => id !== req.userId);
    } else {
      reactions[emoji].push(req.userId);
    }
    await sql`UPDATE chats SET reactions = ${reactions} WHERE id = ${messageId}`;
    res.json({ success: true, reactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats', authenticate, async (req: any, res) => {
  const { id, chapterId, role, text, relationshipGraph, followUps, type, actionData, recommended_videos, images } = req.body;
  try {
    await sql`
      INSERT INTO chats (id, chapter_id, user_id, role, text, relationship_graph, follow_ups, type, action_data, recommended_videos, images) 
      VALUES (
        ${id}, 
        ${chapterId}, 
        ${req.userId}, 
        ${role}, 
        ${text}, 
        ${relationshipGraph ? JSON.stringify(relationshipGraph) : null}, 
        ${followUps ? JSON.stringify(followUps) : null},
        ${type ? type : null},
        ${actionData ? JSON.stringify(actionData) : null},
        ${recommended_videos ? JSON.stringify(recommended_videos) : null},
        ${images ? JSON.stringify(images) : null}
      )
    `;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chats/document/:docId', authenticate, async (req: any, res) => {
  try {
    const orgId = req.body.org_id || req.query.org_id;
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    const docId = req.params.docId;
    // Verify ownership
    const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND ${getDocUserFilter(req)}`;
    if (docs.length === 0) return res.status(404).json({ error: 'Document not found' });

    await sql`DELETE FROM chats WHERE chapter_id IN (SELECT id FROM chapters WHERE document_id = ${docId})`;
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Search Route ---
app.get('/api/search', authenticate, async (req: any, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string') {
    return res.json({ documents: [], chapters: [], chats: [] });
  }

  try {
    const searchPattern = `%${query}%`;
    const fuzzyChars = query.replace(/\s+/g, '').split('').join('%');
    const fuzzyPattern = `%${fuzzyChars}%`;
    
    // Search documents
    const docs = await sql`
      SELECT id, name, upload_date 
      FROM documents 
      WHERE ${getDocUserFilter(req)} AND (name ILIKE ${fuzzyPattern} OR tags ILIKE ${searchPattern})
      LIMIT 10
    `;

    // Search chapters
    const chapters = await sql`
      SELECT c.id, c.document_id, c.chapter_number, c.title, c.summary, d.name as doc_name
      FROM chapters c
      JOIN documents d ON c.document_id = d.id
      WHERE ${getDocAliasUserFilter(req, 'd')} AND (c.title ILIKE ${fuzzyPattern} OR c.summary ILIKE ${searchPattern} OR c.content ILIKE ${searchPattern} OR d.tags ILIKE ${searchPattern})
      LIMIT 10
    `;

    // Search chats
    const chats = await sql`
      SELECT ch.id, ch.chapter_id, ch.text, ch.role, c.title as chapter_title, d.name as doc_name, d.id as doc_id
      FROM chats ch
      JOIN chapters c ON ch.chapter_id = c.id
      JOIN documents d ON c.document_id = d.id
      WHERE ch.user_id = ${req.userId} AND ch.text ILIKE ${searchPattern}
      LIMIT 10
    `;

    res.json({
      documents: docs,
      chapters: chapters,
      chats: chats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- NVIDIA AI Proxy Routes ---
app.post('/api/nvidia/chat/completions', authenticate, async (req: any, res) => {
  const apiKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "NVIDIA_API_KEY is missing on the server." });
  }

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).set({ 'Retry-After': response.headers.get('Retry-After') || '' }).send(errText);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Mock Upgrade Route ---
app.post('/api/upgrade', authenticate, async (req: any, res) => {
  try {
    const { plan } = req.body;
    
    // Upsert the new plan
    const existingSub = await sql`SELECT user_id FROM subscriptions WHERE user_id = ${req.userId}`;
    if (existingSub.length > 0) {
      await sql`UPDATE subscriptions SET plan = ${plan} WHERE user_id = ${req.userId}`;
    } else {
      await sql`INSERT INTO subscriptions (user_id, plan, credits_remaining) VALUES (${req.userId}, ${plan}, 0)`;
    }
    
    res.json({ success: true, plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DEBUG: Log all registered routes
console.log('=== REGISTERED ROUTES ===');
app._router.stack.forEach((middleware: any) => {
  if (middleware.route) {
    console.log(`${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler: any) => {
      if (handler.route) {
        console.log(`${Object.keys(handler.route.methods)} ${handler.route.path}`);
      }
    });
  }
});
console.log('=== END ROUTES ===');

async function startServer() {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // --- Vite Middleware ---
  app.use(express.static(path.join(process.cwd(), 'public')));
  
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;