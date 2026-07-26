'use strict';

async function serviceRequest(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const result = await fetch(`${process.env.SUPABASE_URL}${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await result.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { result, body };
}
async function requireAdmin(request) {
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const auth = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!auth.ok) return null; const user = await auth.json();
  const admin = await serviceRequest(`/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`);
  return admin.result.ok && Array.isArray(admin.body) && admin.body.length ? user : null;
}
async function completeTask(projectId, title, userId) {
  await serviceRequest(`/rest/v1/onboarding_tasks?project_id=eq.${encodeURIComponent(projectId)}&title=eq.${encodeURIComponent(title)}&status=neq.completed`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), completed_by: userId }) });
}

module.exports = async function activateMember(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });
  const applicationId = request.body?.applicationId;
  if (!applicationId) return response.status(400).json({ error: 'Choose an accepted applicant first.' });
  const appResult = await serviceRequest(`/rest/v1/coaching_applications?id=eq.${encodeURIComponent(applicationId)}&select=id,full_name,email,approved_program,payment_status&limit=1`);
  const application = Array.isArray(appResult.body) ? appResult.body[0] : null;
  if (!application) return response.status(404).json({ error: 'That applicant could not be found.' });
  if (application.payment_status !== 'paid') return response.status(409).json({ error: 'Member access stays locked until Stripe confirms payment.' });
  const projectResult = await serviceRequest(`/rest/v1/onboarding_projects?application_id=eq.${encodeURIComponent(applicationId)}&select=id&limit=1`);
  const project = Array.isArray(projectResult.body) ? projectResult.body[0] : null;
  if (!project) return response.status(409).json({ error: 'The onboarding project is not ready.' });
  const siteUrl = String(process.env.SITE_URL || 'https://www.echelonfitness.co').replace(/\/$/, '');
  const invite = await serviceRequest('/auth/v1/invite', { method: 'POST', body: JSON.stringify({ email: application.email, data: { full_name: application.full_name, program: application.approved_program || 'Echelon Coaching' }, redirect_to: `${siteUrl}/pages/member-reset.html` }) });
  if (!invite.result.ok || !invite.body?.id) return response.status(409).json({ error: 'The invite could not be sent. This person may already have an account; confirm their access in Supabase, then try again.' });
  const now = new Date().toISOString();
  await serviceRequest('/rest/v1/account_access?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: invite.body.id, role: 'member', membership_status: 'active', program: application.approved_program || 'Echelon Coaching', assigned_coach_id: admin.id, approved_by: admin.id, approved_at: now }) });
  await serviceRequest(`/rest/v1/onboarding_projects?id=eq.${encodeURIComponent(project.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: invite.body.id, account_status: 'invitation_sent', membership_status: 'active', onboarding_status: 'in_progress', start_date: new Date().toISOString().slice(0, 10) }) });
  await serviceRequest(`/rest/v1/coaching_applications?id=eq.${encodeURIComponent(applicationId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Member Invite Sent', invited_at: now }) });
  await completeTask(project.id, 'Approve and invite member securely', admin.id);
  await serviceRequest('/rest/v1/automation_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ event_type: 'member_invited_after_payment', application_id: applicationId, project_id: project.id, payload: { member_user_id: invite.body.id, operator_id: admin.id } }) });
  return response.status(200).json({ message: `Member invitation sent to ${application.email}.` });
};

