import express from 'express';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import sql, { dbReady } from './server/db.js';
import { generateStoryboardJob, regenerateScene } from './server/storyboardEngine.js';
import { processVideoLessonJob, processSceneAssets } from './server/videoPipeline.js';
import { synthesizeSpeech } from './server/synthesizeSpeech.js';
import { getUserRoleInOrg } from './server/roles.js';
import { generateChapterMetadata, generateSearchQueries, callLLM } from './src/lib/gemini.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-me-in-prod';


export const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(cookieParser());

// --- Trust Proxy for Secure Cookies Behind Vercel ---
app.set('trust proxy', 1);

// --- Security Headers Middleware ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.deepseek.com https://api.elevenlabs.io https://integrate.api.nvidia.com"
  );
  next();
});

// --- Rate Limiters ---
const createLimiter = (maxRequests: number) => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: (req: any, res: any) => {
      const role = req.cookies?.['sb-role'];
      let hasToken = false;
      if (req.cookies?.token || req.headers?.authorization) {
        hasToken = true;
      }
      return (role === 'student' || !hasToken) ? maxRequests : 30;
    },
    keyGenerator: (req: any, res: any) => {
      // Use userId if available from authenticate middleware, else fallback to IP
      return req.userId || ipKeyGenerator(req, res);
    },
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

const retrieveVideosLimiter = createLimiter(10);
const imagesLimiter = createLimiter(10);
const generateLessonLimiter = createLimiter(5);
const startLessonLimiter = createLimiter(5);
const secureLlmLimiter = createLimiter(20);

app.use('/api/secure-llm', secureLlmLimiter);

const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req: any, res: any) => {
    const role = req.cookies?.['sb-role'];
    let hasToken = false;
    if (req.cookies?.token || req.headers?.authorization) {
      hasToken = true;
    }
    return (role === 'student' || !hasToken) ? 10 : 30;
  },
  keyGenerator: (req: any, res: any) => {
    try {
      const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.decode(token) as any;
        if (decoded && (decoded.userId || decoded.sub)) {
           return decoded.userId || decoded.sub;
        }
      }
    } catch(e) {}
    return ipKeyGenerator(req, res);
  },
  skip: (req: any) => {
    const path = req.path;
    
    // Exempt token-exchange
    if (path === '/auth/token-exchange' || path === '/api/auth/token-exchange') return true;
    
    // Exempt vercel health checks
    if (path.startsWith('/_vercel/')) return true;

    // Exempt workspace-loading endpoints
    if (req.method === 'GET') {
      if (path === '/api/auth/me') return true;
      if (path === '/api/me/context') return true;
      if (path === '/api/me/role') return true;
      if (path === '/api/documents') return true;
      if (path === '/api/organizations') return true;
      if (path.match(/^\/api\/chapters\/[^\/]+$/)) return true;
    }
    
    return false;
  },
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', globalApiLimiter);

// DO NOT REMOVE – Gateway token exchange for teachers/students
app.all(['/auth/token-exchange', '/api/auth/token-exchange'], async (req, res) => {
  console.log('=== TOKEN-EXCHANGE HIT ===');
  console.log('Method:', req.method);
  console.log('Query params:', req.query);
  console.log('Cookies present:', Object.keys(req.cookies || {}));
  console.log('access_token present:', !!req.query.access_token);
  console.log('token present:', !!req.query.token);
  console.log('role:', req.query.role);
  console.log('org_id:', req.query.org_id);

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
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...(cookieDomain ? { domain: cookieDomain } : {})
    };

    console.log('Supabase token verified. User ID:', userId);
    console.log('Generated local token (first 20 chars):', localToken.substring(0, 20));
    console.log('Setting cookies with domain:', cookieDomain || 'none');
    console.log('Cookie options:', JSON.stringify(cookieOptions));
    
    // If verification succeeds, set the cookie exactly as your existing login does
    res.cookie('token', localToken, cookieOptions);
    
    if (role) {
      res.cookie('sb-role', role, cookieOptions);
    }

    if (org_id) {
      res.cookie('sb-org-id', org_id, cookieOptions);
    }

    console.log('Redirecting to /');
    // Redirect to the home page (the user's workspace will load automatically)
    res.redirect(`/?_nocache=${Date.now()}`);
  } catch (err: any) {
    console.error('Exchange error:', err.message, err.stack);
    return res.status(401).send('Invalid token');
  }
});


// --- Student Blocking Middleware ---
const preventStudentModification = (req: any, res: any, next: any) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const role = req.cookies['sb-role'];
    if (role === 'student') {
      const allowedStudentPrefixes = [
        '/api/auth/',
        '/auth/token-exchange',
        '/api/retrieve-videos',
        '/api/chats',
        '/api/tts',
        '/api/stt/transcribe',
        '/api/nvidia/'
      ];
      
      const isAllowedPrefix = allowedStudentPrefixes.some(prefix => req.path.startsWith(prefix));
      
      if (!isAllowedPrefix) {
        return res.status(403).json({ error: 'Students have view-only access.' });
      }
    }
  }
  next();
};
app.use(preventStudentModification);



// Database readiness check
app.use((req, res, next) => {
  const isTokenExchange = req.path === '/auth/token-exchange' || req.path === '/api/auth/token-exchange';
  if (!dbReady && !isTokenExchange && (req.path.startsWith('/api/') || req.path.startsWith('/auth/'))) {
    return res.status(503).json({ error: 'Database service unavailable' });
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
  req.orgRole = 'personal';

  if (orgId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (orgId === 'demo' || orgId === 'default_org') {
       req.orgId = orgId;
    } else if (uuidRegex.test(orgId)) {
      try {
        const membership = await sql`SELECT role FROM organization_members WHERE organization_id = ${orgId} AND user_id = ${req.userId}`;
        if (membership.length === 0) {
           return res.status(403).json({ error: 'Forbidden: Not a member of this organization' });
        }
        req.orgId = orgId;
        req.orgRole = membership[0].role;
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
    const orgId = req.orgId || req.cookies['sb-org-id'];
    const role = req.orgRole || req.cookies['sb-role'] || 'user';
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
    const role = req.cookies['sb-role'] || 'user';
    const orgId = req.cookies['sb-org-id'] || null;
    res.json({ user: { id, name, email, role, org_id: orgId }, token });
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
    const role = req.cookies['sb-role'] || 'user';
    const orgId = req.cookies['sb-org-id'] || null;
    res.json({ user: { id: user.id, name: user.name, email: user.email, role, org_id: orgId }, token });
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
      const role = req.cookies?.['sb-role'];
      if (role === 'student') {
        docs = [];
      } else {
        docs = await sql`SELECT * FROM documents WHERE user_id = ${req.userId} ORDER BY upload_date DESC`;
      }
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
  try {
    const { processDocument } = await import('./src/lib/documentProcessor.js');
    // Using dynamic import as requested to isolate it from client bundle when SSR is involved.
  } catch (err) {
    console.error('Failed to load document processor:', err);
    // Ignore error and proceed as normal since we don't actually process it here.
  }
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

// --- NO-LIMITS ON-DEMAND SUMMARIZATION ROUTE ---
app.post('/api/chapters/:id/summarize', authenticate, async (req: any, res) => {
  try {
    const chapterId = req.params.id;
    const { summaryDetail = 'detailed', org_id } = req.body;
    
    // Check if user is a student attempting to summarize a chapter they don't have access to?
    // "The button must be visible for all user types" - We skip strict read-checks to speed this up, 
    // or just rely on the existing read checks if needed.
    
    const chaps = await sql`SELECT content, parent_id, document_id FROM chapters WHERE id = ${chapterId}`;
    if (!chaps.length) return res.status(404).json({ error: 'Chapter not found' });
    
    // We intentionally SKIP verifyAndIncrementUsage for on-demand summaries to keep it accessible.
    // However, if we wanted to enforce it:
    // await verifyAndIncrementUsage(req.userId, 'summary', orgId);
    
    const content = chaps[0].content || '';
    if (!content.trim()) {
      return res.json({ title: 'Section', summary: 'No content available to summarize.' });
    }

    // Call AI
    const meta = await generateChapterMetadata(content, summaryDetail);
    
    // Update DB
    await sql`
      UPDATE chapters 
      SET summary = ${meta.summary},
          title = CASE WHEN parent_id IS NOT NULL THEN ${meta.title} ELSE title END
      WHERE id = ${chapterId}
    `;
    
    res.json(meta);
  } catch (err: any) {
    if (err.name === 'SubscriptionLimitError') {
      return res.status(403).json({ error: err.message });
    }
    console.error('Summarize error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- NEW VIDEO LESSON PIPELINE ROUTES ---
app.post('/api/chapters/:id/generate-lesson', authenticate, generateLessonLimiter, async (req: any, res) => {
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
    let { org_id } = req.body;
    if (!org_id || org_id === 'default') org_id = orgId || 'default_org';

    const chaps = await sql`SELECT document_id FROM chapters WHERE id = ${chapterId}`;
    if (!chaps.length) return res.status(404).json({ error: 'Chapter not found' });
    const document_id = chaps[0].document_id;
    
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

app.post('/api/retrieve-videos', authenticate, retrieveVideosLimiter, async (req: any, res) => {
  try {
    try {
      await verifyAndIncrementUsage(req.userId, 'youtube', req.body.org_id || req.query.org_id || req.cookies?.['sb-org-id']);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const { title, summary, content, subject, grade, keyConcepts, class_context, search_queries } = req.body;
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        retryOptions: {
          attempts: 2
        }
      }
    });

    const conceptsStr = Array.isArray(keyConcepts) ? keyConcepts.join(', ') : '';
    const contextPrefix = class_context ? `Class Context: ${class_context}` : `Grade Level: ${grade}`;
    const prompt = `You are an expert Educational Video Retrieval Engine.
Your task is to find the best educational YouTube videos for a specific chapter context.

${contextPrefix}
Chapter Title: ${title}
Subject: ${subject}
Summary: ${summary || ''}
Content Snippet: ${content ? content.substring(0, 1500) : ''}
Key Concepts: ${conceptsStr}

Step 1: Extract the core learning intent from the chapter summary and content snippet.
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
Leave "video_id" empty if unsure, do not invent 11-char IDs.`;

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
              model: 'deepseek-chat',
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
        const fallbackQueries = search_queries || [`${title} ${keyConcepts?.slice(0,3).join(' ') || ''}`.trim(), title];
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
      parsedData = JSON.parse(responseText.trim().replace(/^\s*```json/, '').replace(/```\s*$/, ''));
    } catch (e) {
      console.error("Failed to parse AI response:", e);
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

app.post('/api/topics/:id/images', authenticate, imagesLimiter, async (req: any, res) => {
  try {
    try {
      await verifyAndIncrementUsage(req.userId, 'image', req.body.org_id || req.query.org_id || req.cookies?.['sb-org-id']);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const { org_context, title, key_concepts, summary } = req.body;
    
    const conceptsStr = Array.isArray(key_concepts) ? key_concepts.join(', ') : '';
    const keywordPrompt = `You are an Educational Search Assistant. Your job is to extract a single, precise, physical or scientific search keyword from the provided chapter and subtopics that can be used on photo/diagram search engines. Return ONLY a JSON object matching this format: {"keyword": "string"}

Chapter Title: ${title}
Key Concepts: ${conceptsStr}`;

    let searchQuery = `${title} ${conceptsStr}`.substring(0, 50).trim();
    try {
      const raw = await callLLM(keywordPrompt, undefined, 'json_object');
      const parsed = JSON.parse(raw);
      if (parsed.keyword) {
        searchQuery = parsed.keyword.trim();
      }
    } catch (err) {
      console.error("DeepSeek query generation failed, using fallback query", err);
    }

    const pexelsKey = process.env.IMAGE_SEARCH_API_KEY;
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    const images: any[] = [];

    if (pexelsKey) {
      try {
        const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=6`, {
          headers: { Authorization: pexelsKey }
        });
        if (pexelsRes.ok) {
          const data = await pexelsRes.json();
          if (data.photos && data.photos.length > 0) {
            for (const photo of data.photos) {
              images.push({
                url: photo.src.large || photo.src.original,
                thumbnail: photo.src.medium,
                alt: photo.alt || `Image for ${searchQuery}`,
                source: "pexels"
              });
            }
          }
        }
      } catch (err) {
        console.error("Pexels search failed", err);
      }
    }
    
    if (images.length === 0 && unsplashKey) {
      try {
        const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=6`, {
          headers: { Authorization: `Client-ID ${unsplashKey}` }
        });
        if (unsplashRes.ok) {
          const data = await unsplashRes.json();
          if (data.results && data.results.length > 0) {
            for (const photo of data.results) {
              images.push({
                url: photo.urls.regular || photo.urls.full,
                thumbnail: photo.urls.small,
                alt: photo.alt_description || `Image for ${searchQuery}`,
                source: "unsplash"
              });
            }
          }
        }
      } catch (err) {
        console.error("Unsplash search failed", err);
      }
    }

    if (images.length === 0) {
      try {
        const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchQuery + " diagram")}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`;
        const wikiRes = await fetch(wikiUrl);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          const pages = wikiData.query?.pages;
          if (pages) {
            for (const pageId in pages) {
              const info = pages[pageId].imageinfo?.[0];
              if (info?.url) {
                images.push({ url: info.url, thumbnail: info.url, alt: searchQuery, source: "wikimedia-commons" });
                if (images.length >= 3) break;
              }
            }
          }
        }
      } catch (err) {
        console.error("Wikimedia Commons search failed", err);
      }
    }

    if (images.length === 0 && req.body.generateDiagram === true) {
      try {
        const krokiPrompt = `Generate a simple Mermaid.js diagram description for the following topic. Only return the Mermaid code, no other text.
Topic: ${title} (${conceptsStr})`;
        
        const rawKroki = await callLLM(krokiPrompt);
        const cleanedMermaid = rawKroki.replace(/```mermaid\s*/gi, '').replace(/```\s*/gi, '').trim();
        
        if (cleanedMermaid) {
           const krokiUrl = `https://kroki.io/mermaid/svg/${encodeURIComponent(cleanedMermaid)}`;
           images.push({
             url: krokiUrl,
             thumbnail: krokiUrl,
             alt: `Diagram for ${title}`,
             source: "kroki"
           });
        }
      } catch (err) {
        console.error("Kroki diagram generation failed", err);
      }
    }

    if (images.length === 0) {
      return res.json({ images: [], message: "No images found. Try searching for videos instead." });
    }

    res.json({ images });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tts/elevenlabs', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Use fetch instead of SDK for simplicity (SDK not needed)
    const voiceId = 'JBFqnCBsd6RMkjVDRZzb'; // George
    const modelId = 'eleven_v3';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`ElevenLabs TTS API error: ${response.status}`, errText);
      return res.status(500).json({ error: 'TTS generation failed' });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64}`;

    res.json({ audioUrl });
  } catch (err: any) {
    console.error('ElevenLabs TTS endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
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

    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
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
app.post('/api/topics/:id/start-lesson', authenticate, startLessonLimiter, async (req: any, res) => {
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