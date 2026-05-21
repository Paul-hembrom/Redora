import express from 'express';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import sql from './server/db.js';
import { generateStoryboardJob, regenerateScene } from './server/storyboardEngine.js';
import { processVideoLessonJob, processSceneAssets } from './server/videoPipeline.js';
import { getUserRoleInOrg } from './server/roles.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-me-in-prod';

export const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(cookieParser());

// --- Freemium Usage Check Helper ---
async function checkUsageAndLimits(userId: string, type: 'document' | 'video' | 'image' | 'interactive' | 'youtube') {
  const subs = await sql`SELECT plan, credits_remaining FROM subscriptions WHERE user_id = ${userId}`;
  let plan = 'free';
  if (subs.length > 0 && subs[0].plan) {
    plan = subs[0].plan;
  }
  const isFree = plan === 'free' || plan === 'Starter';
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

  // Free Tier Limits: books 4/mo, video 2/mo, images 20/mo, interactive 10/mo, youtube 10/day
  // Pro Tier Limits: books unlimited, video 10/mo, images 50/mo, interactive 30/mo, youtube 50/day
  // Assuming Pro means 'unlimited' or the named Pro tiers for this individual user
  
  let limits = {
     document: isPro ? Infinity : 4,
     video: isPro ? 10 : 2,
     image: isPro ? 50 : 20,
     interactive: isPro ? 30 : 10,
     youtube: isPro ? 50 : 10
  };

  if (plan === 'unlimited') {
      limits = { document: Infinity, video: Infinity, image: Infinity, interactive: Infinity, youtube: Infinity };
  }

  if (type === 'document' && usage.books_uploaded_this_month >= limits.document) {
      throw new Error(`Monthly limit reached for Document Uploads (${limits.document}). Upgrade your plan.`);
  }
  if (type === 'video' && usage.video_generations_this_month >= limits.video) {
      throw new Error(`Monthly limit reached for Video Generations (${limits.video}). Upgrade your plan.`);
  }
  if (type === 'image' && usage.image_searches_this_month >= limits.image) {
      throw new Error(`Monthly limit reached for Image Searches (${limits.image}). Upgrade your plan.`);
  }
  if (type === 'interactive' && usage.interactive_lessons_this_month >= limits.interactive) {
      throw new Error(`Monthly limit reached for Interactive Lessons (${limits.interactive}). Upgrade your plan.`);
  }
  if (type === 'youtube' && usage.youtube_searches_today >= limits.youtube) {
      throw new Error(`Daily video search limit reached. Upgrade to Pro for 50 searches/day.`);
  }

  if (type === 'document') {
    await sql`UPDATE user_usage SET books_uploaded_this_month = books_uploaded_this_month + 1 WHERE user_id = ${userId}`;
  } else if (type === 'video') {
    await sql`UPDATE user_usage SET video_generations_this_month = video_generations_this_month + 1 WHERE user_id = ${userId}`;
  } else if (type === 'image') {
    await sql`UPDATE user_usage SET image_searches_this_month = image_searches_this_month + 1 WHERE user_id = ${userId}`;
  } else if (type === 'interactive') {
    await sql`UPDATE user_usage SET interactive_lessons_this_month = interactive_lessons_this_month + 1 WHERE user_id = ${userId}`;
  } else if (type === 'youtube') {
    await sql`UPDATE user_usage SET youtube_searches_today = youtube_searches_today + 1 WHERE user_id = ${userId}`;
  }
}

export class SubscriptionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionLimitError";
  }
}

async function enforceSchoolLimits(userId: string, type: 'video' | 'image' | 'interactive', requestedOrgId?: string): Promise<boolean> {
  let schoolId = null;
  if (requestedOrgId && requestedOrgId !== 'demo' && requestedOrgId !== 'default_org') {
    const orgs = await sql`SELECT school_id FROM organizations WHERE id = ${requestedOrgId}`;
    if (orgs.length > 0) schoolId = orgs[0].school_id;
  }
  if (!schoolId) {
    const userOrgs = await sql`SELECT o.school_id FROM organizations o JOIN organization_users ou ON o.id = ou.organization_id WHERE ou.user_id = ${userId} LIMIT 1`;
    if (userOrgs.length > 0) schoolId = userOrgs[0].school_id;
  }
  
  if (!schoolId) return false; // not part of a school

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

  let limit = 0;
  let currentUsage = 0;
  let errorMsg = '';

  if (type === 'video') {
    currentUsage = usage.videos_generated_this_month;
    limit = plan === 'Enterprise' ? 50 : (plan === 'Growth' ? 25 : 10);
    errorMsg = 'Monthly video limit reached. Upgrade your plan.';
  } else if (type === 'image') {
    currentUsage = usage.image_searches_this_month;
    limit = plan === 'Enterprise' ? Infinity : (plan === 'Growth' ? 50 : 20);
    errorMsg = 'Monthly image limit reached. Upgrade your plan.';
  } else if (type === 'interactive') {
    currentUsage = usage.interactive_lessons_this_month;
    limit = plan === 'Enterprise' ? 30 : (plan === 'Growth' ? 10 : 5);
    errorMsg = 'Monthly interactive lesson limit reached. Upgrade your plan.';
  }

  if (currentUsage >= limit) {
    throw new SubscriptionLimitError(errorMsg);
  }

  if (type === 'video') {
    await sql`UPDATE school_usage SET videos_generated_this_month = videos_generated_this_month + 1 WHERE school_id = ${schoolId}`;
  } else if (type === 'image') {
    await sql`UPDATE school_usage SET image_searches_this_month = image_searches_this_month + 1 WHERE school_id = ${schoolId}`;
  } else if (type === 'interactive') {
    await sql`UPDATE school_usage SET interactive_lessons_this_month = interactive_lessons_this_month + 1 WHERE school_id = ${schoolId}`;
  }
  
  return true;
}

// --- Gateway Token Exchange Route ---
app.get('/auth/token-exchange', async (req, res) => {
  const token = req.query.token as string;
  const role = req.query.role as string;
  if (!token) {
    return res.status(400).send('Missing token');
  }

  try {
    // Verify the token using the existing JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-jwt-key-change-me-in-prod') as any;
    
    // School Lock Check
    if (decoded.org_id) {
       const orgs = await sql`SELECT school_id FROM organizations WHERE id = ${decoded.org_id}`;
       if (orgs.length > 0 && orgs[0].school_id) {
          const subs = await sql`SELECT status FROM school_subscriptions WHERE school_id = ${orgs[0].school_id}`;
          if (subs.length > 0 && subs[0].status === 'locked') {
             return res.status(403).send('School account suspended');
          }
       }
    }

    // If verification succeeds, set the cookie exactly as your existing login does
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    if (role) {
      res.cookie('sb-role', role, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }

    if (decoded.org_id) {
      res.cookie('sb-org-id', decoded.org_id, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }

    // Redirect to the home page (the user's workspace will load automatically)
    res.redirect('/');
  } catch (err) {
    return res.status(401).send('Invalid token');
  }
});

// --- Auth Middleware ---
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const preventStudentModification = (req: any, res: any, next: any) => {
  if (req.path.startsWith('/api/') && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const role = req.cookies['sb-role'];
    if (role === 'student') {
      const allowedStudentEndpoints = [
        '/api/auth/logout',
        '/api/auth/login',
        '/api/auth/signup',
        '/api/retrieve-videos',
        '/api/chats',
        '/api/nvidia/chat/completions'
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

// --- Auth Routes ---
app.get('/api/me/role', (req, res) => {
  res.json({ role: req.cookies['sb-role'] || 'user' });
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

app.get('/api/auth/me', authenticate, async (req: any, res) => {
  try {
    const users = await sql`SELECT id, name, email FROM users WHERE id = ${req.userId}`;
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const role = req.cookies['sb-role'] || 'user';
    res.json({ user: { ...user, role } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});

// --- Document Routes ---
app.get('/api/documents', authenticate, async (req: any, res) => {
  try {
    const docs = await sql`SELECT * FROM documents WHERE user_id = ${req.userId} ORDER BY upload_date DESC`;
    
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
    const orgId = org_id || req.query.org_id;
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    await checkUsageAndLimits(req.userId, 'document');

    await sql.begin(async (tx: any) => {
      await tx`INSERT INTO documents (id, user_id, name, tags) VALUES (${id}, ${req.userId}, ${name}, ${tags ? JSON.stringify(tags) : '[]'})`;
      
      if (chapters && chapters.length > 0) {
        const flatChapters: any[] = [];
        const flatten = (nodes: any[], parentId: string | null = null) => {
          nodes.forEach((ch, idx) => {
            flatChapters.push({
              id: ch.id,
              document_id: id,
              chapter_number: ch.chapterNumber || (idx + 1),
              title: ch.title,
              summary: ch.summary || '',
              content: ch.content || '',
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
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
      WHERE c.id = ${chapterId} AND d.user_id = ${req.userId}
    `;
    if (docQuery.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to edit this chapter' });
    }
    
    await sql`UPDATE chapters SET summary = ${summary} WHERE id = ${chapterId}`;
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
    
    const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND user_id = ${req.userId}`;
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
    
    const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND user_id = ${req.userId}`;
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
    const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND user_id = ${req.userId}`;
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
    const orgId = req.body.org_id || req.query.org_id;
    const userRole = await getUserRoleInOrg(req.userId, orgId);
    if (userRole === 'student') return res.status(403).json({ error: 'Students cannot modify content' });

    let isSchool = false;
    try {
      isSchool = await enforceSchoolLimits(req.userId, 'video', orgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    if (!isSchool) {
      try {
        await checkUsageAndLimits(req.userId, 'video');
      } catch (e: any) {
        return res.status(403).json({ error: e.message });
      }
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

app.post('/api/retrieve-videos', authenticate, async (req: any, res) => {
  try {
    let isSchool = false;
    try {
      isSchool = await enforceSchoolLimits(req.userId, 'video', req.body.org_id || req.query.org_id);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    if (!isSchool) {
      try {
        await checkUsageAndLimits(req.userId, 'youtube');
      } catch (e: any) {
        return res.status(403).json({ error: e.message });
      }
    }

    const { title, summary, subject, grade, keyConcepts, class_context } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    console.log("Gemini response text:", responseText);
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
    let isSchool = false;
    try {
      isSchool = await enforceSchoolLimits(req.userId, 'image', req.body.org_id || req.body.org_context || req.query.org_id);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    if (!isSchool) {
      try {
        await checkUsageAndLimits(req.userId, 'image');
      } catch (e: any) {
        return res.status(403).json({ error: e.message });
      }
    }

    const { org_context, title, key_concepts, summary } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    
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

    if (images.length < 2) {
      const svgPrompt = `Generate a visually appealing, colorful SVG diagram illustrating the concept: ${title}. Key concepts: ${conceptsStr}. Return ONLY valid SVG code. No markdown. No HTML around it. Make sure it uses <svg viewBox="0 0 500 400" xmlns="http://www.w3.org/2000/svg">`;
      try {
        const svgRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: svgPrompt
        });
        let svgCode = svgRes.text?.trim() || "";
        svgCode = svgCode.replace(/^```(xml|svg|html)?/i, '').replace(/```$/i, '').trim();
        if (svgCode.startsWith('<svg')) {
          const base64Svg = "data:image/svg+xml;base64," + Buffer.from(svgCode).toString('base64');
          images.push({
            url: base64Svg,
            thumbnail: base64Svg,
            alt: `Generated diagram for ${title}`,
            source: "generated"
          });
        }
      } catch (err) {
        console.error("SVG generation error", err);
      }
    }

    res.json({ images });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

import { synthesizeSpeech } from './server/synthesizeSpeech.js';

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

// --- Interactive Lesson Route ---
app.post('/api/topics/:id/start-lesson', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { orgId } = req.body;
    
    // Default orgId if missing, or we can use a dummy
    const actualOrgId = orgId || req.userId || 'default_org';

    let isSchool = false;
    try {
      isSchool = await enforceSchoolLimits(req.userId, 'interactive', actualOrgId);
    } catch (e: any) {
      if (e.name === 'SubscriptionLimitError') return res.status(403).json({ error: e.message });
      throw e;
    }

    if (!isSchool) {
      try {
        await checkUsageAndLimits(req.userId, 'interactive');
      } catch (e: any) {
        return res.status(403).json({ error: e.message });
      }
    }

    const steps = await createInteractiveLesson(id, actualOrgId);
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
    
    if (orgId && orgId !== 'demo' && orgId !== 'default_org') {
      const orgs = await sql`SELECT school_id FROM organizations WHERE id = ${orgId}`;
      if (orgs.length > 0) schoolId = orgs[0].school_id;
    }
    if (!schoolId) {
      const userOrgs = await sql`SELECT o.school_id FROM organizations o JOIN organization_users ou ON o.id = ou.organization_id WHERE ou.user_id = ${req.userId} LIMIT 1`;
      if (userOrgs.length > 0) schoolId = userOrgs[0].school_id;
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

// --- Chat Routes ---
app.get('/api/chats/:chapterId', authenticate, async (req: any, res) => {
  try {
    const chats = await sql`SELECT * FROM chats WHERE chapter_id = ${req.params.chapterId} AND user_id = ${req.userId} ORDER BY created_at ASC`;
    const result = chats.map(c => ({
      id: c.id,
      role: c.role,
      text: c.text,
      relationshipGraph: c.relationship_graph ? JSON.parse(c.relationship_graph) : undefined,
      followUps: c.follow_ups ? JSON.parse(c.follow_ups) : undefined,
      type: c.type,
      actionData: c.action_data ? JSON.parse(c.action_data) : undefined,
      recommended_videos: c.recommended_videos ? JSON.parse(c.recommended_videos) : undefined
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats', authenticate, async (req: any, res) => {
  const { id, chapterId, role, text, relationshipGraph, followUps, type, actionData, recommended_videos } = req.body;
  try {
    await sql`
      INSERT INTO chats (id, chapter_id, user_id, role, text, relationship_graph, follow_ups, type, action_data, recommended_videos) 
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
        ${recommended_videos ? JSON.stringify(recommended_videos) : null}
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
    const docs = await sql`SELECT id FROM documents WHERE id = ${docId} AND user_id = ${req.userId}`;
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
      WHERE user_id = ${req.userId} AND (name ILIKE ${fuzzyPattern} OR tags ILIKE ${searchPattern})
      LIMIT 10
    `;

    // Search chapters
    const chapters = await sql`
      SELECT c.id, c.document_id, c.chapter_number, c.title, c.summary, d.name as doc_name
      FROM chapters c
      JOIN documents d ON c.document_id = d.id
      WHERE d.user_id = ${req.userId} AND (c.title ILIKE ${fuzzyPattern} OR c.summary ILIKE ${searchPattern} OR c.content ILIKE ${searchPattern} OR d.tags ILIKE ${searchPattern})
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
