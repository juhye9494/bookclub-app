import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('AUTH_UNAUTHORIZED');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new Error('AUTH_UNAUTHORIZED');
  }

  // 브라우저 클라이언트 대신 서버 클라이언트(supabaseAdmin) 사용
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user || !user.email) {
    throw new Error('AUTH_UNAUTHORIZED');
  }

  return user;
}
