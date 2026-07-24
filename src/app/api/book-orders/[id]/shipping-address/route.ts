import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: bookOrderId } = await context.params;
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '유효하지 않은 사용자입니다.' }, { status: 401 });
    }

    const body = await req.json();
    const shippingName = typeof body.shipping_name === 'string' ? body.shipping_name.trim() : '';
    const shippingPhone = typeof body.shipping_phone === 'string' ? body.shipping_phone.trim() : '';
    const shippingAddress = typeof body.shipping_address === 'string' ? body.shipping_address.trim() : '';

    if (!shippingName || !shippingPhone || !shippingAddress) {
      return NextResponse.json({ error: '배송지 정보(받는 분, 연락처, 주소)를 모두 입력해주세요.' }, { status: 400 });
    }

    // 조건부 UPDATE 실행
    const { data: updateData, error: updateErr } = await supabaseAdmin
      .from('book_orders')
      .update({
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_address: shippingAddress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookOrderId)
      .eq('user_id', user.id)
      .eq('order_status', '주문접수')
      .select('id, shipping_name, shipping_phone, shipping_address')
      .maybeSingle();

    if (updateErr) {
      console.error('shipping address update error:', updateErr);
      return NextResponse.json({ error: '배송지 변경 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!updateData) {
      return NextResponse.json({ error: '이미 배송 준비가 시작되어 배송지를 변경할 수 없습니다.' }, { status: 409 });
    }

    return NextResponse.json({ success: true, data: updateData });

  } catch (err: any) {
    console.error('Shipping Address Update API Error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
