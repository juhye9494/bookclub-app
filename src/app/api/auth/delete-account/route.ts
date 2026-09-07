import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. Check Auth Session
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = user.id;

    // 2. Check if user is host of any active group
    const { data: hostedGroups, error: groupsError } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('host_id', userId)
      .limit(1);

    if (groupsError) {
      return NextResponse.json({ error: 'Failed to verify group host status' }, { status: 500 });
    }
    if (hostedGroups && hostedGroups.length > 0) {
      return NextResponse.json({ error: '운영 중인 독서모임이 있어 탈퇴할 수 없습니다. 고객센터로 문의해주세요.' }, { status: 400 });
    }

    // 3. Prepare Dummy User for anonymization
    const dummyEmail = 'deleted_account@under-line.kr';
    let dummyUserId: string | null = null;
    
    // Check if dummy user exists
    const { data: existingUsersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: 'Failed to initialize system account' }, { status: 500 });
    }

    const existingDummy = existingUsersData.users.find(u => u.email === dummyEmail);
    if (existingDummy) {
      dummyUserId = existingDummy.id;
    } else {
      // Create Dummy User
      const randomPassword = crypto.randomBytes(32).toString('hex') + 'A!1a';
      const { data: newDummy, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: dummyEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { name: '탈퇴회원' },
        ban_duration: '876000h', // Ban for 100 years to prevent login completely
      });
      
      if (createError || !newDummy.user) {
        return NextResponse.json({ error: 'Failed to create system account for anonymization' }, { status: 500 });
      }
      dummyUserId = newDummy.user.id;
      
      // Ensure the dummy user is banned (if ban_duration in createUser wasn't enough)
      await supabaseAdmin.auth.admin.updateUserById(dummyUserId, { ban_duration: '876000h' });
    }

    // 4. Update/Delete related records sequentially for better error tracking and idempotency
    // These operations are strictly idempotent: if they fail midway, retrying will safely resume.
    // Transactional records (orders, book_orders) and their snapshot PII are retained for 5-year legal compliance,
    // but they are decoupled from the user by pointing to the dummy user.
    // All other active participation data and inquiries are immediately destroyed.
    const updateTables = ['orders', 'book_orders', 'insight_comments'];
    for (const table of updateTables) {
      const { error } = await supabaseAdmin.from(table).update({ user_id: dummyUserId }).eq('user_id', userId);
      if (error) {
        console.error(`Failed to anonymize ${table}:`, error);
        return NextResponse.json({ error: '데이터 익명화 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
      }
    }

    const deleteTables = ['group_participants', 'event_participants', 'insight_likes', 'inquiries'];
    for (const table of deleteTables) {
      const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId);
      if (error) {
        console.error(`Failed to delete from ${table}:`, error);
        return NextResponse.json({ error: '데이터 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
      }
    }

    // 5. Delete actual Auth User (This triggers ON DELETE CASCADE for public.profiles)
    // After this step, the user's main profile PII is permanently destroyed.
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error('Failed to delete auth user:', deleteUserError);
      return NextResponse.json({ error: '계정 삭제 처리에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in delete-account:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
