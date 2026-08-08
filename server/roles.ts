import sql from './db.js';

/**
 * Returns the effective role of a user within an organization.
 * If no orgId is provided, returns 'personal' (implies full access for independent usage).
 * Otherwise queries the organization_members table.
 */
export async function getUserRoleInOrg(userId: string, orgId?: string | null): Promise<'personal' | 'admin' | 'teacher' | 'student'> {
  if (!orgId || orgId === 'demo' || orgId === 'default_org') return 'personal';

  try {
    const rows = await sql`
      SELECT role FROM organization_members 
      WHERE user_id = ${userId} 
        AND organization_id = ${orgId} 
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      // If user is not explicitly listed in organization_members, allow full teacher access
      return 'teacher';
    }

    return rows[0].role as 'admin' | 'teacher' | 'student';
  } catch (err: any) {
    if (err.message?.includes('does not exist')) {
      // If table doesn't exist yet, default to personal to avoid breaking the app entirely
      console.warn('organization_members table does not exist. Defaulting to personal role.');
      return 'personal';
    }
    console.error('Error fetching user role:', err);
    return 'teacher';
  }
}
