import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await context.params;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { tracking_number } = body;

    if (typeof tracking_number !== 'string') {
      return NextResponse.json({ error: '송장번호 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const trimmedTracking = tracking_number.trim();

    if (trimmedTracking.length > 100) {
      return NextResponse.json({ error: '송장번호는 최대 100자까지 입력 가능합니다.' }, { status: 400 });
    }

    // Verify order exists
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('book_orders')
      .select('id')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('book_orders')
      .update({ tracking_number: trimmedTracking })
      .eq('id', orderId)
      .select('id')
      .single();

    if (updateError || !updated) {
      console.error('Update tracking error:', updateError);
      return NextResponse.json({ error: '송장번호 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Admin order tracking error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
