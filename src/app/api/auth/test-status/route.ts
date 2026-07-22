import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ isTestUser: false });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.json({ isTestUser: false });
    }

    const testUserIds = (process.env.INTERNAL_PAYMENT_TEST_USER_IDS || '').split(',').map(id => id.trim());
    const isTestUser = testUserIds.includes(user.id);

    return NextResponse.json({ isTestUser });
  } catch (err) {
    return NextResponse.json({ isTestUser: false });
  }
}
