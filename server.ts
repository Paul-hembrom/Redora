import express from 'express';
import { Cartesia } from '@cartesia/cartesia-js';
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
import { processVideoLessonJob, processSceneAssets, processInteractiveProJob } from './server/videoPipeline.js';
import { synthesizeSpeech } from './server/synthesizeSpeech.js';
import { getUserRoleInOrg } from './server/roles.js';
import { generateChapterMetadata, generateSearchQueries, callLLM } from './src/lib/gemini.js';
import { normalizeTextWithLLM } from './src/lib/llmNormalizer.js';
import { createConcurrencyLimit } from './src/lib/documentProcessor.js';
import { safeParseJSON } from './src/lib/utils.js';


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
  const isAuthExempt = ['/api/auth/login', '/api/auth/signup', '/api/auth/me', '/api/auth/logout'].includes(req.path);
  if (!dbReady && !isTokenExchange && !isAuthExempt && (req.path.startsWith('/api/') || req.path.startsWith('/auth/'))) {
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
    if (!dbReady) {
      return res.status(503).json({ error: 'Our database is temporarily unavailable. Please try again in a few minutes.' });
    }
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
    if (!dbReady) {
      return res.status(503).json({ error: 'Our database is temporarily unavailable. Please try again in a few minutes.' });
    }
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
      if (!dbReady) {
        return res.status(503).json({ error: 'Our database is temporarily unavailable. Please try again in a few minutes.' });
      }
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
      await tx`DELETE FROM chats WHERE chapter_id IN (SELECT id::text FROM chapters WHERE document_id = ${docId})`;
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

app.post('/api/lessons/generate-pro', authenticate, generateLessonLimiter, async (req: any, res) => {
  try {
    const orgId = req.body.org_id || req.query.org_id || req.cookies?.['sb-org-id'];
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    
    // Gating Interactive Pro to admin/teachers, just like the regular video generation pipeline.
    // Self-serve for students would be risky since every click triggers a DeepSeek call, Kokoro calls, and Veo/Manim renders.
    // These heavy backend processes require rate limiting and real cost considerations.
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });
    
    try {
      await verifyAndIncrementUsage(req.userId, 'video', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }
    
    const { chapterId } = req.body;
    if (!chapterId) return res.status(400).json({ error: 'chapterId is required' });

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
    processInteractiveProJob(jobId, chapterId, org_id, document_id).catch(console.error);
    
    // Return early, same job ID system as existing generation pipeline
    res.status(202).json({ job_id: jobId });
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
              model: 'deepseek-v4-flash',
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
    const keywordPrompt = `You are an Educational Search Assistant. Based on the chapter title, key concepts, and a detailed content summary, generate a single, precise search keyword that can be used on a photo/diagram search engine to find a relevant educational image. Return ONLY a JSON object: {"keyword": "string"}

Chapter Title: ${title}
Key Concepts: ${conceptsStr}
Content Summary: ${summary ? summary.substring(0, 2000) : ''}`;

    let searchQuery = '';
    try {
      const raw = await callLLM(keywordPrompt, undefined, 'json_object');
      const parsed = JSON.parse(raw);
      if (parsed.keyword) {
        searchQuery = parsed.keyword.trim();
      }
    } catch (err) {
      console.error("DeepSeek query generation failed, using fallback query", err);
      // Smarter fallback
      const stopWords = new Set(["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "this", "to", "was", "will", "with"]);
      let words = (summary ? summary.substring(0, 2000) : "").toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
      let wordCounts: Record<string, number> = {};
      words.forEach((w: string) => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
      let topWords = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]).slice(0, 3).join(' ');
      searchQuery = `${title} ${topWords || conceptsStr}`.substring(0, 50).trim();
    }
    
    // Ensure we have a fallback if even the above is empty
    if (!searchQuery) {
      searchQuery = title;
    }

    const pexelsKey = process.env.IMAGE_SEARCH_API_KEY;
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    
    async function fetchImagesForQuery(query: string) {
      const imgs: any[] = [];
      if (pexelsKey) {
        try {
          const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6`, {
            headers: { Authorization: pexelsKey }
          });
          if (pexelsRes.ok) {
            const data = await pexelsRes.json();
            if (data.photos && data.photos.length > 0) {
              for (const photo of data.photos) {
                imgs.push({
                  url: photo.src.large || photo.src.original,
                  thumbnail: photo.src.medium,
                  alt: photo.alt || `Image for ${query}`,
                  source: "pexels"
                });
              }
            }
          }
        } catch (err) {
          console.error("Pexels search failed", err);
        }
      }
      
      if (imgs.length === 0 && unsplashKey) {
        try {
          const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6`, {
            headers: { Authorization: `Client-ID ${unsplashKey}` }
          });
          if (unsplashRes.ok) {
            const data = await unsplashRes.json();
            if (data.results && data.results.length > 0) {
              for (const photo of data.results) {
                imgs.push({
                  url: photo.urls.regular || photo.urls.full,
                  thumbnail: photo.urls.small,
                  alt: photo.alt_description || `Image for ${query}`,
                  source: "unsplash"
                });
              }
            }
          }
        } catch (err) {
          console.error("Unsplash search failed", err);
        }
      }

      if (imgs.length === 0) {
        try {
          const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + " diagram")}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`;
          const wikiRes = await fetch(wikiUrl);
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            const pages = wikiData.query?.pages;
            if (pages) {
              for (const pageId in pages) {
                const info = pages[pageId].imageinfo?.[0];
                if (info?.url) {
                  imgs.push({ url: info.url, thumbnail: info.url, alt: query, source: "wikimedia-commons" });
                  if (imgs.length >= 3) break;
                }
              }
            }
          }
        } catch (err) {
          console.error("Wikimedia Commons search failed", err);
        }
      }
      return imgs;
    }

    let images: any[] = [];
    let message = undefined;
    
    const isSTEMGuess = /math|science|computer|physics|chemistry|biology|algebra|geometry|calculus|programming|algorithm/i.test(title + ' ' + conceptsStr);
    
    if (isSTEMGuess && process.env.WOLFRAM_APP_ID) {
        const wolframPrompt = `You are a query generator for Wolfram|Alpha. Given the topic title and concepts, generate a concise query (max 50 characters) to find a relevant diagram or mathematical plot. Return ONLY a JSON object: {"query": "string"}
Topic: ${title}
Concepts: ${conceptsStr}`;
        try {
          const rawWolf = await callLLM(wolframPrompt, undefined, 'json_object');
          const parsedWolf = JSON.parse(rawWolf.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim());
          if (parsedWolf.query) {
            const wolframUrls = await fetchWolframImages(parsedWolf.query.trim(), process.env.WOLFRAM_APP_ID);
            images = wolframUrls.map(url => ({
                url: url,
                thumbnail: url,
                alt: `Wolfram|Alpha plot for ${parsedWolf.query}`,
                source: 'wolfram'
            }));
          }
        } catch(e) {
          console.error("Wolfram query generation failed", e);
        }
    }

    if (images.length === 0) {
        images = await fetchImagesForQuery(searchQuery);
    }

    // Safety Filter (skip wolfram images as they are safe)
    if (images.length > 0 && images[0]?.source !== 'wolfram') {
       const unsafeWords = ["woman", "model", "fashion", "lingerie", "sexy", "bikini", "girl", "boy", "man", "attractive", "beautiful", "handsome"];
       images = images.filter(img => {
           const alt = (img.alt || "").toLowerCase();
           return !unsafeWords.some(w => alt.includes(w));
       });
       if (images.length === 0) {
           console.log("Images filtered or empty. Retrying with educational diagram keyword.");
           const safeQuery = `${title} educational diagram`;
           images = await fetchImagesForQuery(safeQuery);
           images = images.filter(img => {
               const alt = (img.alt || "").toLowerCase();
               return !unsafeWords.some(w => alt.includes(w));
           });
       }
    }

    // Relevance Check
    if (images.length > 0) {
      const combinedText = images.map(img => (img.alt || "").toLowerCase()).join(" ");
      const titleWords = title.toLowerCase().split(/\s+/);
      const conceptWords = conceptsStr.toLowerCase().split(/[\s,]+/);
      const checkWords = [...titleWords, ...conceptWords].filter(w => w.length > 2);
      
      const isRelevant = checkWords.some(w => combinedText.includes(w));
      
      if (!isRelevant && checkWords.length > 0) {
        console.log(`Images flagged as irrelevant for '${searchQuery}'. Retrying with broader keyword.`);
        // Broader keyword: Title + First key concept
        const firstConcept = Array.isArray(key_concepts) && key_concepts.length > 0 ? key_concepts[0] : '';
        const broaderQuery = `${title} ${firstConcept}`.trim();
        const retryImages = await fetchImagesForQuery(broaderQuery);
        
        if (retryImages.length > 0) {
           images = retryImages;
        } else {
           message = "Images may not be perfectly relevant. Try refining your search.";
        }
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

    res.json(message ? { images, message } : { images });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



app.post('/api/tts/stream/prewarm', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(200).json({ status: 'skip' });
    const voiceId = 'JwEIvMzFlLwrArLvqeM5';
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3&with_timestamps=true&output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({ text: ".", model_id: 'eleven_flash_v2_5' })
    }).catch(() => {});
    res.json({ status: 'ok' });
  } catch(e) {
    res.json({ status: 'error' });
  }
});



function normalizeTextForCartesia(text: string): string {
    let t = text;

    // --- List Processing ---
    let bulletCounter = 1;
    
    // For numbered lists (add a spoken pause by ensuring the previous line ended with a period, and formatting as "1: ")
    t = t.replace(/([.!?])\s*\n\s*(\d+)\.\s+/g, (match, punct, num) => {
        bulletCounter = 1; // reset bullet counter
        return `${punct} ${num}: `;
    });
    t = t.replace(/(^|[^.!?])\s*\n\s*(\d+)\.\s+/g, (match, prevChar, num) => {
        bulletCounter = 1;
        return `${prevChar}. ${num}: `; // Add a period for spoken pause before the number
    });
    t = t.replace(/^\s*(\d+)\.\s+/g, (match, num) => {
        bulletCounter = 1;
        return `${num}: `;
    });
    
    // For bullet lists: replace with "Point X: "
    t = t.replace(/([.!?])\s*\n\s*([-*•])\s+/g, (match, punct) => {
        return `${punct} Point ${bulletCounter++}: `;
    });
    t = t.replace(/(^|[^.!?])\s*\n\s*([-*•])\s+/g, (match, prevChar) => {
        return `${prevChar}. Point ${bulletCounter++}: `; // Add period for pause
    });
    t = t.replace(/^\s*([-*•])\s+/g, () => {
        return `Point ${bulletCounter++}: `;
    });
    
    // Also handle flattened lists (where chunkDocumentText replaced \n with space after a period)
    t = t.replace(/([.!?])\s+([-*•])\s+/g, (match, punct) => {
        return `${punct} Point ${bulletCounter++}: `;
    });
    t = t.replace(/([.!?])\s+(\d+)\.\s+/g, (match, punct, num) => {
        bulletCounter = 1;
        return `${punct} ${num}: `;
    });
    // --- End List Processing ---

    // Strip LaTeX delimiters
    t = t.replace(/\$\$(.*?)\$\$/g, ' $1 ');
    t = t.replace(/\$(.*?)\$/g, ' $1 ');

    // Acronyms and abbreviations
    t = t.replace(/\bCOVID-19\b/gi, 'Covid nineteen');
    t = t.replace(/\bAI\b/g, 'A.I.');
    t = t.replace(/\be\.g\./gi, 'for example');
    t = t.replace(/\bi\.e\./gi, 'that is');
    t = t.replace(/\betc\./gi, 'etcetera');

    // Function notation (simple like f(x))
    t = t.replace(/\b([a-zA-Z])\(([a-zA-Z0-9_]+)\)/g, '$1 of $2');

    // Fractions \frac{a}{b} -> a over b
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2');

    // Square roots \sqrt{a} -> the square root of a
    t = t.replace(/\\sqrt\{([^}]+)\}/g, 'the square root of $1');

    // Exponents
    t = t.replace(/([a-zA-Z0-9]+)\^2/g, '$1 squared');
    t = t.replace(/([a-zA-Z0-9]+)\^3/g, '$1 cubed');
    t = t.replace(/([a-zA-Z0-9]+)\^\{([^}]+)\}/g, '$1 to the power of $2');

    // Common math symbols
    t = t.replace(/π/g, ' pi ');
    t = t.replace(/∞/g, ' infinity ');
    t = t.replace(/±/g, ' plus or minus ');
    t = t.replace(/≤/g, ' less than or equal to ');
    t = t.replace(/≥/g, ' greater than or equal to ');

    // Basic math operators
    t = t.replace(/\s+\+\s+/g, ' plus ');
    t = t.replace(/\s+-\s+/g, ' minus ');
    t = t.replace(/\s+=\s+/g, ' equals ');
    t = t.replace(/\s+\/\s+/g, ' divided by ');
    t = t.replace(/\s+\*\s+/g, ' times ');

    // Clean up extra spaces
    t = t.replace(/\s+/g, ' ').trim();

    return t;
}

function chunkDocumentText(text: string, maxChunkSize = 300) {
    const chunks: { text: string; domIndex: number }[] = [];
    const blocks = text.split(/\n\n+/).map((s: string) => s.trim()).filter(Boolean);
    blocks.forEach((block: string, domIndex: number) => {
        const sentences = block.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [block];
        let currentChunk = "";
        sentences.forEach((s: string) => {
            const t = s.trim();
            if (t.length > 0) {
                if (currentChunk.length + t.length > maxChunkSize && currentChunk.length > 0) {
                    chunks.push({ text: currentChunk.trim(), domIndex });
                    currentChunk = t;
                } else {
                    currentChunk = currentChunk ? currentChunk + " " + t : t;
                }
            }
        });
        if (currentChunk.length > 0) {
            chunks.push({ text: currentChunk.trim(), domIndex });
        }
    });
    return chunks;
}

function createFloat32WavHeader(dataLength: number, sampleRate: number): Buffer {
    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(3, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 4, 28);
    buffer.writeUInt16LE(4, 32);
    buffer.writeUInt16LE(32, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    return buffer;
}



// Available Kokoro voices:
// - bf_emma
// - bf_isabella
// - bm_george
// - bm_lewis
// - af_bella
async function synthesizeKokoroSpeech(text: string, voice = "af_sarah") {
  // Ensure we map to a supported voice, default to af_bella
  const supportedVoices = ["bf_emma", "bf_isabella", "bm_george", "bm_lewis", "af_bella", "af_sarah"];
  const kokoroVoice = supportedVoices.includes(voice) ? voice : "af_sarah";

  let extractedText = typeof text === 'string' ? text : ((text as any)?.text || String(text));
  try {
    const parsed = typeof extractedText === 'string' ? JSON.parse(extractedText) : null;
    if (parsed && typeof parsed.text === 'string') {
      extractedText = parsed.text;
    }
  } catch (e) {
    // Not JSON, ignore
  }

  // Remove any JSON braces, brackets, or other non-speakable characters
  let cleanText = extractedText.replace(/[^a-zA-Z0-9\s.,!?\-:;()]/g, ' ');
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  const response = await fetch("https://paulhemb-redora.hf.space/v1/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: cleanText, voice: kokoroVoice, speed: 1.0 })
  });

  if (!response.ok) {
    throw new Error(`Kokoro TTS failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.audio_base64 || !data.timestamps) {
    throw new Error("Invalid response format from Kokoro");
  }

  console.log('[Kokoro] Raw timestamps count from API:', data.timestamps.length);

  let mappedTimestamps = data.timestamps.map((t: any) => ({
    word: t.word,
    start: t.start !== undefined ? t.start : t.start_time,
    end: t.end !== undefined ? t.end : t.end_time
  }));

  console.log(`[Kokoro] Native timestamps count: ${mappedTimestamps.length}`);
  if (mappedTimestamps.length > 0) {
    console.log(`[Kokoro] First native timestamp: ${JSON.stringify(mappedTimestamps[0])}`);
  }

  const audioUrl = `data:audio/wav;base64,${data.audio_base64}`;

  const audioBuffer = Buffer.from(data.audio_base64, 'base64');
  const audioBytes = audioBuffer.length;
  
  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  if (audioBytes > 44) {
    numChannels = audioBuffer.readUInt16LE(22);
    sampleRate = audioBuffer.readUInt32LE(24);
    bitsPerSample = audioBuffer.readUInt16LE(34);
  }
  const dataSize = audioBytes - 44;
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = numChannels * bytesPerSample;
  const totalFrames = dataSize / bytesPerFrame;
  const calculatedRawDuration = Math.max(0, totalFrames / sampleRate);
  const rawDuration = data.playbackDuration !== undefined ? data.playbackDuration : calculatedRawDuration;
  const playbackDuration = rawDuration;

  if (mappedTimestamps.length === 0 && data.audio_base64.length > 300) {
    const words = cleanText
      .split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z]/g, ''))
      .filter(w => w.length > 0);
      
    if (words.length > 0) {
      const totalChars = words.reduce((sum, w) => sum + w.length, 0);
      let currentTime = 0;
      
      mappedTimestamps = words.map((word) => {
        const wordDuration = (word.length / totalChars) * playbackDuration;
        const timestamp = {
          word,
          start: currentTime,
          end: currentTime + wordDuration
        };
        currentTime += wordDuration;
        return timestamp;
      });
      console.log(`[Kokoro] Raw duration: ${rawDuration.toFixed(2)}s, Playback duration: ${playbackDuration.toFixed(2)}s, Words: ${words.length}`);
    }
  } else if (mappedTimestamps.length > 0) {
      
  }

  console.log('[Kokoro] Returning audioUrl (length)', audioUrl.length, 'timestamps count:', mappedTimestamps.length);
  if (mappedTimestamps.length > 0) {
    console.log('[Kokoro] First timestamp after mapping:', JSON.stringify(mappedTimestamps[0]));
  }

  console.log('[Kokoro] RETURNING – rawDuration:', rawDuration?.toFixed(2), 'playbackDuration:', playbackDuration?.toFixed(2));
  if (mappedTimestamps.length > 0) {
    console.log('[Kokoro] First timestamp:', JSON.stringify(mappedTimestamps[0]));
    console.log('[Kokoro] Last timestamp:', JSON.stringify(mappedTimestamps[mappedTimestamps.length - 1]));
  }
  return {
    audioUrl,
    timestamps: mappedTimestamps,
    rawDuration,
    playbackDuration
  };
}

app.post('/api/tts/cartesia', async (req, res) => {
  try {
    const { text, hq } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });

    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not set');
      return res.status(500).json({ error: 'ElevenLabs API key missing' });
    }

    const chunks = chunkDocumentText(text);
    let responseStream: any;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(JSON.stringify({ totalChunks: chunks.length }) + '\n');

    try {
      for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          
          // We use the original chunk.text directly so that word-level timestamps
          // generated by the TTS engine perfectly match the DOM text.
          // Normalization changes word counts (e.g., ± -> 'plus or minus') and
          // breaks the frontend highlighting.
          let spokenText = chunk.text;

          try {
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 40)); // 40ms delay
            }

            // Try Kokoro first
            let kokoroResult = await synthesizeKokoroSpeech(spokenText);
            
            // Check for empty audio OR empty timestamps
            const hasValidAudio = kokoroResult.audioUrl && kokoroResult.audioUrl.length >= 300;
            const hasValidTimestamps = kokoroResult.timestamps && kokoroResult.timestamps.length > 0;

            if (!hasValidAudio || !hasValidTimestamps) {
              console.warn(
                `[Kokoro] Chunk ${i} invalid - audio: ${!!hasValidAudio}, timestamps: ${kokoroResult.timestamps?.length || 0}, retrying...`
              );
              await new Promise(resolve => setTimeout(resolve, 1000));
              kokoroResult = await synthesizeKokoroSpeech(spokenText);

              const retryAudio = kokoroResult.audioUrl && kokoroResult.audioUrl.length >= 300;
              const retryTimestamps = kokoroResult.timestamps && kokoroResult.timestamps.length > 0;

              if (!retryAudio || !retryTimestamps) {
                throw new Error("Kokoro returned empty audio or timestamps after retry");
              }
            }
            res.write(JSON.stringify({
                index: i,
                domIndex: chunk.domIndex,
                text: chunk.text,
                audioUrl: kokoroResult.audioUrl,
                timestamps: kokoroResult.timestamps,
                rawDuration: kokoroResult.rawDuration,
                playbackDuration: kokoroResult.playbackDuration
            }) + '\n');
          } catch (kokoroErr) {
            console.error('Kokoro TTS failed, falling back to Cartesia:', kokoroErr.message);
            
            // Fallback to ElevenLabs
            const voiceId = 'JwEIvMzFlLwrArLvqeM5'; // Katrina R
            const modelId = hq ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5';
            console.log(`[TTS] ElevenLabs model: ${modelId} (${hq ? 'HQ' : 'Standard'})`);

            const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3&with_timestamps=true&output_format=mp3_44100_128`;
            try {
               const response = await fetch(url, {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                   'xi-api-key': apiKey,
                 },
                 body: JSON.stringify({
                   text: spokenText,
                   model_id: modelId,
                   voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                 }),
               });
               
               if (!response.ok) {
                 console.error("ElevenLabs streaming API error:", await response.text());
                 res.write(JSON.stringify({
                     index: i,
                     domIndex: chunk.domIndex,
                     text: chunk.text,
                     audioUrl: null,
                     timestamps: []
                 }) + '\n');
                 continue;
               }

               const decoder = new TextDecoder();
               const reader = response.body.getReader();
               let buffer = '';
               let finalAudioBase64 = '';
               let chars = [];
               let startTimes = [];
               let durations = [];

               while (true) {
                   const { done, value } = await reader.read();
                   if (done) break;
                   buffer += decoder.decode(value, { stream: true });
                   let boundary = buffer.indexOf('\n');
                   while (boundary !== -1) {
                       const line = buffer.slice(0, boundary).trim();
                       buffer = buffer.slice(boundary + 1);
                       if (line) {
                           try {
                               const data = JSON.parse(line);
                               if (data.audio_base64) finalAudioBase64 += data.audio_base64;
                               if (data.alignment) {
                                   if (data.alignment.chars) chars.push(...data.alignment.chars);
                                   if (data.alignment.charStartTimesMs) startTimes.push(...data.alignment.charStartTimesMs);
                                   if (data.alignment.charDurationsMs) durations.push(...data.alignment.charDurationsMs);
                               }
                           } catch(e) {}
                       }
                       boundary = buffer.indexOf('\n');
                   }
               }

               if (buffer.trim()) {
                   try {
                       const data = JSON.parse(buffer);
                       if (data.audio_base64) finalAudioBase64 += data.audio_base64;
                       if (data.alignment) {
                           if (data.alignment.chars) chars.push(...data.alignment.chars);
                           if (data.alignment.charStartTimesMs) startTimes.push(...data.alignment.charStartTimesMs);
                           if (data.alignment.charDurationsMs) durations.push(...data.alignment.charDurationsMs);
                       }
                   } catch(e) {}
               }

               let timestamps = [];
               let currentWord = "";
               let wordStart = null;
               let wordEnd = null;

               for (let j = 0; j < chars.length; j++) {
                   const char = chars[j];
                   const start = startTimes[j];
                   const duration = durations[j];

                   if (char.trim() === "") {
                       if (currentWord.length > 0) {
                           timestamps.push({ word: currentWord, start: wordStart / 1000, end: wordEnd / 1000, start_time: wordStart / 1000, end_time: wordEnd / 1000 });
                           currentWord = "";
                           wordStart = null;
                       }
                   } else {
                       if (currentWord.length === 0) wordStart = start;
                       currentWord += char;
                       wordEnd = start + duration;
                   }
               }
               if (currentWord.length > 0) {
                   timestamps.push({ word: currentWord, start: wordStart / 1000, end: wordEnd / 1000, start_time: wordStart / 1000, end_time: wordEnd / 1000 });
               }

               if (finalAudioBase64) {
                 const audioUrl = `data:audio/mpeg;base64,${finalAudioBase64}`;
                 res.write(JSON.stringify({
                    index: i,
                    domIndex: chunk.domIndex,
                    text: chunk.text,
                    audioUrl: audioUrl,
                    timestamps: timestamps
                 }) + '\n');
               } else {
                 res.write(JSON.stringify({
                    index: i,
                    domIndex: chunk.domIndex,
                    text: chunk.text,
                    audioUrl: null,
                    timestamps: []
                 }) + '\n');
               }
            } catch (elErr: any) {
               console.error("ElevenLabs fallback failed:", elErr.message);
               res.write(JSON.stringify({
                  index: i,
                  domIndex: chunk.domIndex,
                  text: chunk.text,
                  audioUrl: null,
                  timestamps: []
               }) + '\n');
            }
          }
      }
    } catch (wsLoopErr) {
      console.error('Cartesia chunk streaming error:', wsLoopErr);
    } finally {
      try { responseStream?.close?.(); } catch (e) {}
      res.end();
    }
  } catch (err: any) {
    console.error("Cartesia TTS error:", err);
    res.end();
  }
});

app.post('/api/tts/stream', async (req, res) => {
  try {
    const { text, hq } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const voiceId = 'JwEIvMzFlLwrArLvqeM5'; // Katrina R
    const modelId = hq ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3&with_timestamps=true&output_format=mp3_44100_128`;

    console.log(hq ? '[TTS] ElevenLabs model: eleven_multilingual_v2 (HQ)' : '[TTS] ElevenLabs model: eleven_flash_v2_5 (Standard)');
    // Chunk by Markdown blocks (paragraphs, lists, etc) separated by double newlines.
    // This perfectly matches the frontend ReactMarkdown block splitting so IDs align perfectly.
    const rawBlocks = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    
    const chunkRequests: { text: string, domIndex: number, index: number }[] = [];
    rawBlocks.forEach((block, domIndex) => {
        // Force the first sentence to be short
        if (domIndex === 0 && block.length > 80) {
            let splitIndex = -1;
            const match = block.match(/^(.{15,100}?[.,;:!?])\s/);
            if (match) {
                splitIndex = match[1].length;
            } else {
                const spaceMatch = block.match(/^(.{50,100}?)\s/);
                if (spaceMatch) splitIndex = spaceMatch[1].length;
            }
            if (splitIndex > 0) {
                chunkRequests.push({ text: block.substring(0, splitIndex).trim(), domIndex, index: chunkRequests.length });
                chunkRequests.push({ text: block.substring(splitIndex).trim(), domIndex, index: chunkRequests.length });
                return;
            }
        }
        chunkRequests.push({ text: block, domIndex, index: chunkRequests.length });
    });

    const ttsLimiter = createConcurrencyLimit(3);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    console.log(`[TTS] Created ${chunkRequests.length} chunk(s) from ${rawBlocks.length} markdown block(s).`);
    res.write(JSON.stringify({ totalChunks: chunkRequests.length }) + '\n');

    const fetchWithTimeout = async (url: string, options: any, timeoutMs: number) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    };

    const chunks = await Promise.all(chunkRequests.map(async (reqChunk) => {
      return ttsLimiter(async () => {
        let retries = 0;
        
        while (retries <= 1) {
           try {
               console.log(`[TTS] Calling ElevenLabs API for chunk ${reqChunk.index}`);
               const response = await fetchWithTimeout(url, {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                   'xi-api-key': apiKey,
                 },
                 body: JSON.stringify({
                   text: reqChunk.text,
                   model_id: modelId,
                   voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                 }),
               }, 2000); // 2 second timeout per user request
               
               console.log(`[TTS] ElevenLabs streaming API response status: ${response.status} for chunk ${reqChunk.index}`);
               if (!response.ok) {
                 const errBody = await response.text().catch(() => 'could not read error body');
                 console.error(`[TTS] ElevenLabs streaming API error (${response.status}): ${errBody} (voice: ${voiceId}, model: ${modelId}, text length: ${reqChunk.text.length})`);
                 retries++;
                 continue;
               }
               
               const decoder = new TextDecoder();
               const reader = response.body.getReader();
               let buffer = '';
               let finalAudioBase64 = '';
               let chars = [];
               let startTimes = [];
               let durations = [];
               
               while (true) {
                   const { done, value } = await reader.read();
                   if (done) break;
                   buffer += decoder.decode(value, { stream: true });
                   
                   let boundary = buffer.indexOf('\n');
                   while (boundary !== -1) {
                       const line = buffer.slice(0, boundary).trim();
                       buffer = buffer.slice(boundary + 1);
                       if (line) {
                           try {
                               const data = JSON.parse(line);
                               if (data.audio_base64) finalAudioBase64 += data.audio_base64;
                               if (data.alignment) {
                                   if (data.alignment.chars) chars.push(...data.alignment.chars);
                                   if (data.alignment.charStartTimesMs) startTimes.push(...data.alignment.charStartTimesMs);
                                   if (data.alignment.charDurationsMs) durations.push(...data.alignment.charDurationsMs);
                               }
                           } catch(e) {}
                       }
                       boundary = buffer.indexOf('\n');
                   }
               }
               
               if (buffer.trim()) {
                   try {
                       const data = JSON.parse(buffer);
                       if (data.audio_base64) finalAudioBase64 += data.audio_base64;
                       if (data.alignment) {
                           if (data.alignment.chars) chars.push(...data.alignment.chars);
                           if (data.alignment.charStartTimesMs) startTimes.push(...data.alignment.charStartTimesMs);
                           if (data.alignment.charDurationsMs) durations.push(...data.alignment.charDurationsMs);
                       }
                   } catch(e) {}
               }
               
               if (!finalAudioBase64) {
                   retries++;
                   continue;
               }
               
               let timestamps = [];
               let currentWord = "";
               let wordStart = null;
               let wordEnd = null;
               
               for (let i = 0; i < chars.length; i++) {
                   const char = chars[i];
                   const start = startTimes[i];
                   const duration = durations[i];
                   
                   if (char.trim() === "") {
                       if (currentWord.length > 0) {
                           timestamps.push({ word: currentWord, start: wordStart / 1000, end: wordEnd / 1000, start_time: wordStart / 1000, end_time: wordEnd / 1000 });
                           currentWord = "";
                           wordStart = null;
                       }
                   } else {
                       if (currentWord.length === 0) wordStart = start;
                       currentWord += char;
                       wordEnd = start + duration;
                   }
               }
               if (currentWord.length > 0) {
                   timestamps.push({ word: currentWord, start: wordStart / 1000, end: wordEnd / 1000, start_time: wordStart / 1000, end_time: wordEnd / 1000 });
               }
               
               const result = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: `data:audio/mpeg;base64,${finalAudioBase64}`, timestamps };
               res.write(JSON.stringify(result) + '\n');
               return result;
           } catch(e) {
               console.error(`[TTS] ElevenLabs streaming API fetch error:`, e);
               retries++;
           }
        }
        // Fallback to non-streaming if stream failed
        try {
            const fallbackUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
            const fallbackResponse = await fetchWithTimeout(fallbackUrl, {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                   'xi-api-key': apiKey,
                 },
                 body: JSON.stringify({
                   text: reqChunk.text,
                   model_id: modelId,
                   voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                 }),
            }, 3000);
            
            console.log(`[TTS] ElevenLabs fallback API response status: ${fallbackResponse.status} for chunk ${reqChunk.index}`);
            if (fallbackResponse.ok) {
                const fbBuffer = await fallbackResponse.arrayBuffer();
                if (fbBuffer.byteLength >= 500) {
                    const fbBase64 = Buffer.from(fbBuffer).toString('base64');
                    const fbResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: `data:audio/mpeg;base64,${fbBase64}`, timestamps: [] };
                    res.write(JSON.stringify(fbResult) + '\n');
                    return fbResult;
                } else {
                    console.error(`[TTS] ElevenLabs fallback API returned too small buffer: ${fbBuffer.byteLength} bytes`);
                }
            } else {
                const errBody = await fallbackResponse.text().catch(() => 'could not read error body');
                console.error(`[TTS] ElevenLabs fallback API error (${fallbackResponse.status}): ${errBody}`);
            }
        } catch(e) {
            console.error(`[TTS] ElevenLabs fallback API fetch error:`, e);
        }
        
        console.error(`[TTS] Chunk ${reqChunk.index} failed completely. Returning null audioUrl.`);
        const errResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: null };
        res.write(JSON.stringify(errResult) + '\n');
        return errResult;
      });
    }));

    res.end();
  } catch (err: any) {
    console.error('ElevenLabs TTS endpoint error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.end();
    }
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
    const { orgId, title, content } = req.body;
    
    // Default orgId if missing, or we can use a dummy
    const actualOrgId = orgId || req.userId || req.cookies?.['sb-org-id'] || 'default_org';

    try {
      await verifyAndIncrementUsage(req.userId, 'interactive', actualOrgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    const steps = await createInteractiveLesson(id, actualOrgId, req.userId, title, content);
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
      await sql`ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_chapter_id_fkey`;
      await sql`ALTER TABLE chats ALTER COLUMN chapter_id TYPE TEXT`;
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
    console.error('GET /api/chats/:chapterId error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats', authenticate, async (req: any, res) => {
  const { id, chapterId, role, text, relationshipGraph, followUps, type, actionData, recommended_videos, images } = req.body;
  try {
    try {
      await sql`ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_chapter_id_fkey`;
      await sql`ALTER TABLE chats ALTER COLUMN chapter_id TYPE TEXT`;
    } catch(e) {}
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
    console.error('POST /api/chats error:', err);
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

    await sql`DELETE FROM chats WHERE chapter_id IN (SELECT id::text FROM chapters WHERE document_id = ${docId})`;
    
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

app.post('/api/search-news', authenticate, async (req: any, res) => {
  try {
    const { query, topicTitle, keyConcepts } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'SERPER_API_KEY is not configured' });
    }

    const response = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "us",
        hl: "en",
        tbs: "qdr:m",
      }),
    });
    if (!response.ok) {
      console.error('Serper News API error:', await response.text());
      return res.json({ summary: "Failed to fetch news." });
    }

    const data = await response.json();
    const news = [];

    if (data.news && Array.isArray(data.news)) {
      for (const item of data.news) {
        news.push({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          date: item.date,
          source: item.source
        });
      }
    }

    const topNews = news.slice(0, 5);
    
    if (topNews.length === 0) {
      return res.json({ summary: `I couldn't find any recent news for "${query}".` });
    }

    const { callLLM } = await import('./src/lib/gemini.js');

    const systemPrompt = `You are an engaging classroom news assistant.
Your goal is to help students see how what they are learning in class connects to exciting developments, ongoing research, and cutting-edge projects happening in the world today.

TOPIC/CHAPTER CONTEXT:
"${topicTitle || query}"

RECENT NEWS ARTICLES:
${JSON.stringify(topNews)}

INSTRUCTIONS:
1. **The Bridge (1-2 sentences)**: Start with an inspiring opening that links the textbook concept to today's news. (e.g., "While your textbook explores how computers evolved from mechanical gears to room-sized vacuum tubes, today's computer history is being written in quantum labs!")
2. **Current Developments**: Summarize 2-3 of the most exciting ongoing projects or technological breakthroughs from the provided news articles in an easy-to-understand way.
3. **Tone & Structure**: Keep it engaging and suitable for students (200-300 words). Embed source links naturally in the body text like [Source Name](URL).
4. **Sources Section**: End with a horizontal rule (---) followed by a "### Sources" bulleted list of all articles referenced.
`;

    const userPrompt = `Please generate the summary based on the provided news articles and topic.`;

    const summaryText = await callLLM(userPrompt, systemPrompt, "text", 1024, 0.7);

    res.json({ summary: summaryText });
  } catch (err: any) {
    console.error('Error in /api/search-news:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/search-images', authenticate, async (req: any, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'SERPER_API_KEY is not configured' });
    }

    const response = await fetch(`https://google.serper.dev/images?q=${encodeURIComponent(query)}&apiKey=${apiKey}`);
    if (!response.ok) {
      console.error('Serper API error:', await response.text());
      return res.json([]);
    }

    const data = await response.json();
    const images = [];

    if (data.images && Array.isArray(data.images)) {
      for (const img of data.images) {
        images.push({
          url: img.imageUrl,
          thumbnail: img.thumbnailUrl || img.imageUrl,
          alt: img.title || query,
          source: 'google'
        });
      }
    }

    res.json(images.slice(0, 10)); // return top 10 images
  } catch (err: any) {
    console.error('Error in /api/search-images:', err);
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


async function fetchWolframImages(query: string, appId: string): Promise<string[]> {
  if (!appId) return [];
  
  // The Simple API returns an image directly. For multiple images, use the Full Results API.
  // We'll use the Simple API for a single diagram, and the Full Results API for multiple images.
  
  // Full Results API approach:
  const fullUrl = `https://api.wolframalpha.com/v2/query?appid=${appId}&input=${encodeURIComponent(query)}&format=image&output=json`;
  
  try {
    const response = await fetch(fullUrl);
    if (!response.ok) return [];
    const data = await response.json();
    
    // Extract image URLs from the pods
    const imageUrls: string[] = [];
    if (data.queryresult?.pods) {
      for (const pod of data.queryresult.pods) {
        if (pod.subpods) {
          for (const subpod of pod.subpods) {
            if (subpod.img?.src) {
              imageUrls.push(subpod.img.src);
            }
          }
        }
      }
    }
    return imageUrls.slice(0, 3); // max 3 images
  } catch (err) {
    console.warn('[Wolfram] Error fetching images:', err);
    return [];
  }
}

console.log('>>> REGISTERING CURRICULUM GENERATE ROUTE <<<');
app.post('/api/curriculum/generate', authenticate, async (req: any, res) => {
  console.log('>>> CURRICULUM GENERATE HANDLER CALLED <<<');
  try {
    if (!process.env.SUPERADMIN_EMAIL) {
      console.warn('SUPERADMIN_EMAIL environment variable is not set.');
      return res.status(500).json({ error: 'Server misconfiguration: SUPERADMIN_EMAIL not set' });
    }

    const userRows = await sql`SELECT email FROM users WHERE id = ${req.userId}`;
    if (userRows.length === 0 || userRows[0].email !== process.env.SUPERADMIN_EMAIL) {
      return res.status(403).json({ error: 'Only the superadmin can generate curriculum content.' });
    }

    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Expected an array' });
    }

    try {
      await sql`ALTER TABLE curriculum_library ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0`;
    } catch(e) {}

    const results = [];
    let currentChapter = "";
    let chapterIndex = 0;
    let subtopicIndex = 0;
    
    for (const item of items) {
      const { grade, subject, title, subtopic, generateQuestions } = item;
      
      if (title !== currentChapter) {
        currentChapter = title;
        chapterIndex++;
        subtopicIndex = 1;
      } else {
        subtopicIndex++;
      }
      
      try {
        // 1. Generate Content
        const contentPrompt = `You are an expert textbook writer for the Nepal CDC curriculum.  
Write a high‑quality, classroom‑ready explanation for the subtopic below.

Grade: ${grade}
Subject: ${subject}
Chapter: ${title}
Subtopic: ${subtopic}

RULES:
1. Strictly follow the CDC syllabus for this grade and subject. Do NOT add topics outside the given subtopic.
2. Use clear, age‑appropriate language suitable for ${grade} students.
3. Structure the explanation in plain paragraphs (no markdown headings, no bullet points). Use natural flow.
4. For math, science, computer science and optional mathematics  topics that involve formulas, equations, or problem‑solving:
   - Include 2‑3 fully worked examples with step‑by‑step solutions.
   - Explain each step in simple words.
5. For non‑math topics (history, geography, etc.):
   - Include one relevant real‑life example or case study.
6. Keep the total length between 200‑400 words. If the topic requires worked examples, you may extend up to 500 words.
7. Never invent data, names, or facts. Base everything strictly on the CDC curriculum.
8. Return ONLY the final explanation text. No additional commentary.`;
        const generatedContent = await callLLM(contentPrompt);

        // 2. Fetch Images
        const keywordPrompt = `You are a safe educational image search assistant. Given the following textbook explanation for a subtopic, generate a single, highly specific search keyword that would find a relevant, classroom‑appropriate educational diagram or illustration on Pexels/Unsplash.

The image must be suitable for students of ${grade}.

Avoid any keyword that could return fashion, celebrity, or adult content.

Return ONLY a JSON object: {"keyword": "string"}

Subtopic: ${subtopic}
Full explanation: ${generatedContent ? generatedContent.substring(0, 2000) : ''}`;
        
        let searchQuery = subtopic;
        try {
          const raw = await callLLM(keywordPrompt, undefined, 'json_object');
          const parsed = JSON.parse(raw.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim());
          if (parsed.keyword) searchQuery = parsed.keyword.trim();
        } catch(e) {
           console.error("DeepSeek query generation failed, using fallback query", e);
           const stopWords = new Set(["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these", "they", "this", "to", "was", "will", "with"]);
           let words = (generatedContent || "").toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
           let wordCounts: Record<string, number> = {};
           words.forEach((w: string) => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
           let topWords = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]).slice(0, 3).join(' ');
           searchQuery = `${title} ${topWords}`.substring(0, 50).trim();
        }
        
        if (!searchQuery) searchQuery = subtopic;
        
        const pexelsKey = process.env.IMAGE_SEARCH_API_KEY;
        const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
        let images: any[] = [];
        
        async function fetchImagesForQuery(query: string) {
          const imgs: any[] = [];
          if (pexelsKey) {
            try {
              const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3`, {
                headers: { Authorization: pexelsKey }
              });
              if (pexelsRes.ok) {
                const data = await pexelsRes.json();
                if (data.photos && data.photos.length > 0) {
                  for (const photo of data.photos) {
                    imgs.push({
                      url: photo.src.large || photo.src.original,
                      thumbnail: photo.src.medium,
                      alt: photo.alt || `Image for ${query}`,
                      source: "pexels"
                    });
                  }
                }
              }
            } catch (err) {}
          }
          
          if (imgs.length === 0 && unsplashKey) {
            try {
              const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3`, {
                headers: { Authorization: `Client-ID ${unsplashKey}` }
              });
              if (unsplashRes.ok) {
                const data = await unsplashRes.json();
                if (data.results && data.results.length > 0) {
                  for (const photo of data.results) {
                    imgs.push({
                      url: photo.urls.regular || photo.urls.full,
                      thumbnail: photo.urls.small,
                      alt: photo.alt_description || `Image for ${query}`,
                      source: "unsplash"
                    });
                  }
                }
              }
            } catch (err) {}
          }

          if (imgs.length === 0) {
            try {
              const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + " diagram")}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`;
              const wikiRes = await fetch(wikiUrl);
              if (wikiRes.ok) {
                const wikiData = await wikiRes.json();
                const pages = wikiData.query?.pages;
                if (pages) {
                  for (const pageId in pages) {
                    const info = pages[pageId].imageinfo?.[0];
                    if (info?.url) {
                      imgs.push({ url: info.url, thumbnail: info.url, alt: query, source: "wikimedia-commons" });
                      if (imgs.length >= 3) break;
                    }
                  }
                }
              }
            } catch (err) {}
          }
          return imgs;
        }

        let isSTEM = false;
        if (subject) {
            const subjectLower = subject.toLowerCase();
            isSTEM = subjectLower.includes('math') || subjectLower.includes('science') || subjectLower.includes('computer');
        }

        if (isSTEM && process.env.WOLFRAM_APP_ID) {
            const wolframPrompt = `You are a query generator for Wolfram|Alpha. Given the subtopic and content, generate a concise query (max 50 characters) to find a relevant diagram or mathematical plot. Return ONLY a JSON object: {"query": "string"}
Subtopic: ${subtopic}
Content: ${generatedContent ? generatedContent.substring(0, 500) : ''}`;
            try {
              const rawWolf = await callLLM(wolframPrompt, undefined, 'json_object');
              const parsedWolf = JSON.parse(rawWolf.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim());
              if (parsedWolf.query) {
                const wolframUrls = await fetchWolframImages(parsedWolf.query.trim(), process.env.WOLFRAM_APP_ID);
                images = wolframUrls.map(url => ({
                    url: url,
                    thumbnail: url,
                    alt: `Wolfram|Alpha plot for ${parsedWolf.query}`,
                    source: 'wolfram'
                }));
              }
            } catch(e) {
              console.error("Wolfram query generation failed", e);
            }
        }

        if (images.length === 0) {
            images = await fetchImagesForQuery(searchQuery);
        }

        // Safety filter
        const unsafeWords = ["woman", "model", "fashion", "lingerie", "sexy", "bikini", "girl", "boy", "man", "attractive", "beautiful", "handsome"];
        images = images.filter(img => {
            const alt = (img.alt || "").toLowerCase();
            return !unsafeWords.some(w => alt.includes(w));
        });

        if (images.length === 0) {
           console.log("Images filtered or empty. Retrying with educational diagram keyword.");
           const safeQuery = `${subtopic} educational diagram`;
           images = await fetchImagesForQuery(safeQuery);
           images = images.filter(img => {
               const alt = (img.alt || "").toLowerCase();
               return !unsafeWords.some(w => alt.includes(w));
           });
        }

        // Relevance check
        if (images.length > 0) {
           const firstAlt = (images[0].alt || "").toLowerCase();
           const topicWords = subtopic.toLowerCase().split(/\s+/).concat(subject.toLowerCase().split(/\s+/));
           const checkWords = [...topicWords].filter(w => w.length > 2);
           const isRelevant = checkWords.length === 0 || checkWords.some(w => firstAlt.includes(w));
           if (!isRelevant) {
              const broaderQuery = `${subject} ${title}`.trim();
              let retryImages = await fetchImagesForQuery(broaderQuery);
              retryImages = retryImages.filter(img => {
                  const alt = (img.alt || "").toLowerCase();
                  return !unsafeWords.some(w => alt.includes(w));
              });
              if (retryImages.length > 0) {
                 images = retryImages;
              }
           }
        }

        // 3. Fetch Videos
        const videoPrompt = `You are an expert Educational Video Retrieval Engine.
Your task is to find the best educational YouTube videos for a specific chapter context.
Grade Level: ${grade}
Chapter Title: ${title}
Subject: ${subject}
Summary: ${generatedContent.substring(0, 1500)}

Generate 3 highly optimized YouTube search queries suitable for the specified class context.
Return ONLY valid JSON exactly matching this schema:
{
  "recommended_videos": [
    {
      "title": "string",
      "search_query_used": "string",
      "quality_score": number
    }
  ]
}`;
        let videos: any[] = [];
        try {
          const rawVid = await callLLM(videoPrompt, undefined, 'json_object');
          const parsedVid = JSON.parse(rawVid.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim());
          if (parsedVid.recommended_videos) {
            for (const vid of parsedVid.recommended_videos.slice(0, 3)) {
              try {
                const searchResult = await ytSearch(vid.search_query_used || vid.title);
                if (searchResult && searchResult.videos.length > 0) {
                  videos.push({
                    video_id: searchResult.videos[0].videoId,
                    title: searchResult.videos[0].title,
                    channel: searchResult.videos[0].author.name,
                    quality_score: vid.quality_score || 80
                  });
                }
              } catch(e) {}
            }
          }
        } catch(e) {}

        // 4. Generate Questions
        let questions: any[] = [];
        if (generateQuestions) {
          const qPrompt = `Based on this content: ${generatedContent}

Generate 3 multiple-choice questions for ${grade} ${subject}. Return JSON exactly matching this array schema: [{"question":"...","options":["A","B","C","D"],"answer":"A"}]`;
          try {
            const rawQ = await callLLM(qPrompt, undefined, 'json_object');
            const parsedQ = JSON.parse(rawQ.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim());
            questions = Array.isArray(parsedQ) ? parsedQ : (parsedQ.questions || []);
          } catch(e) {}
          
          if (!Array.isArray(questions) || questions.length === 0) {
            const firstSentence = generatedContent.split(/[.!?] /)[0] + '.';
            questions = [{
              question: `True or False: ${firstSentence}`,
              options: ['True', 'False'],
              answer: 'True'
            }];
          }
        }

        const orderIndex = (chapterIndex * 1000) + subtopicIndex;

        // 5. Insert into DB
        await sql`
          INSERT INTO curriculum_library (grade, subject, title, subtopic, content, images, videos, questions, order_index)
          VALUES (${grade}, ${subject}, ${title}, ${subtopic}, ${generatedContent}, ${sql.json(images)}, ${sql.json(videos)}, ${sql.json(questions)}, ${orderIndex})
        `;

        results.push({ subtopic, status: "success" });
        
      } catch(err: any) {
        console.error(`Error generating curriculum for ${subtopic}:`, err);
        results.push({ subtopic, status: "error", error: err.message });
      }
    }
    
    res.json(results);
  } catch(err: any) {
    console.error("Error in /api/curriculum/generate:", err);
    res.status(500).json({ error: err.message });
  }
});

console.log('=== END ROUTES ===');

app.get('/api/curriculum-test', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
  app.get("/api/curriculum", async (req: any, res) => {
  console.log('>>> /api/curriculum HIT – query:', req.query);
  try {
    let { grade, subject } = req.query;
    console.log(`[Curriculum API] Received request - raw grade: "${grade}", raw subject: "${subject}"`);
    
    if (!grade || !subject) {
      return res.status(400).json({ error: 'grade and subject are required' });
    }
    let rows;
    try {
      rows = await sql`SELECT * FROM curriculum_library WHERE grade = ${grade} AND subject = ${subject} ORDER BY order_index ASC`;
    } catch (e) {
      console.log(`[Curriculum API] order_index might be missing, falling back to title, subtopic sort. Error: ${e}`);
      rows = await sql`SELECT * FROM curriculum_library WHERE grade = ${grade} AND subject = ${subject} ORDER BY title ASC, subtopic ASC`;
    }
    
    console.log(`[Curriculum API] Query complete. Found ${rows.length} rows for grade: "${grade}", subject: "${subject}".`);
    if (rows.length > 0) {
       console.log(`[Curriculum API] First row subtopic: "${rows[0].subtopic}", images type: "${typeof rows[0].images}"`);
    }

    if (rows.length === 0) {
      const docId = `curr_${grade}_${subject}`.replace(/\s+/g, '_');
      const doc = {
          id: docId,
          name: `${grade} - ${subject} Curriculum`,
          uploadDate: new Date().toISOString(),
          chapters: [] as any[],
          isPublic: true
      };
      console.log('>>> /api/curriculum sending doc – chapters:', doc.chapters?.length, 'first title:', doc.chapters?.[0]?.title);
      return res.json(doc);
    }
    


    // Group by title
    const docId = `curr_${grade}_${subject}`.replace(/\s+/g, '_');
    const doc = { 
       id: docId, 
       name: `${grade} - ${subject} Curriculum`, 
       uploadDate: new Date().toISOString(), 
       chapters: [] as any[], 
       isPublic: true
    };
    
    let chapterNumber = 1;
    let topicNumber = 1;
    const chaptersMap = new Map<string, any>();
    
    for (const row of rows) {
       if (!chaptersMap.has(row.title)) {
          chaptersMap.set(row.title, {
             id: `chap_${docId}_${chapterNumber}`,
             chapterNumber,
             title: row.title,
             summary: '',
             content: '',
             type: 'chapter',
             sortOrder: chapterNumber * 100,
             children: []
          });
          chapterNumber++;
          topicNumber = 1;
       }
       
       const chap = chaptersMap.get(row.title);
       
       const images = safeParseJSON(row.images);
       const videos = safeParseJSON(row.videos);
       const questions = safeParseJSON(row.questions);
       console.log(`Topic: ${row.subtopic}, images count: ${images.length}`);

       let fullContent = row.content || '';

       if (videos.length > 0) {
         fullContent += '\n\n### Related Videos\n\n';
         videos.forEach((vid: any) => {
           fullContent += `- [${(vid.title || 'Video').replace(/\[|\]/g, '')}](https://www.youtube.com/watch?v=${vid.video_id}) (Channel: ${vid.channel})\n`;
         });
       }

       if (questions.length > 0) {
         fullContent += '\n\n### Practice Questions\n\n';
         questions.forEach((q: any, i: number) => {
           fullContent += `**Q${i+1}: ${q.question}**\n`;
           if (q.options) {
             q.options.forEach((opt: string) => { fullContent += `- ${opt}\n`; });
           }
           fullContent += `*Answer: ${q.answer}*\n\n`;
         });
       } else {
         fullContent += '\n\n### Practice Questions\n\n';
         const firstSentence = (row.content || '').split(/[.?!]/)[0].trim();
         if (firstSentence) {
           fullContent += `**Q1: True or False: ${firstSentence}?**\n*Answer: True*\n\n`;
         } else {
           fullContent += `**Q1: What is the main idea of this section?**\n*Answer: Review the content above to formulate your own answer.*\n\n`;
         }
       }

       console.log('>>> [Curriculum API] fullContent snippet:', fullContent.substring(0, 300));

       const topic = {
          id: `topic_${docId}_${chap.id}_${topicNumber}`,
          chapterNumber: topicNumber,
          title: row.subtopic,
          summary: '',
          content: fullContent,
          type: 'topic',
          parentId: chap.id,
          sortOrder: chap.sortOrder + topicNumber,
          children: []
       };
       chap.children.push(topic);
       topicNumber++;
    }
    
    doc.chapters = Array.from(chaptersMap.values());
    
    // Sort all by sortOrder
    doc.chapters.sort((a, b) => a.sortOrder - b.sortOrder);
    
    const jsonStr = JSON.stringify(doc);
    console.log(`[Curriculum API] Response JSON (truncated): ${jsonStr.substring(0, 500)}...`);
    console.log('>>> /api/curriculum sending doc – chapters:', doc.chapters?.length, 'first title:', doc.chapters?.[0]?.title);
    res.json(doc);
  } catch(err: any) {
    console.error('[Curriculum API] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

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