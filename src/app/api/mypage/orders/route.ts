import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  decryptOrderPii,
  isEncryptedOrderPii,
} from '@/lib/server/orderPiiCrypto';

function readOrderPii(
  encryptedValue: unknown,
  plaintextValue: unknown,
  field: 'user_name' | 'user_phone' | 'user_address',
  paymentOrderId: string
): string {
  const hasEncryptedValue =
    typeof encryptedValue === 'string'
      ? encryptedValue.trim() !== ''
      : encryptedValue !== null && encryptedValue !== undefined;

  if (!hasEncryptedValue) {
    return typeof plaintextValue === 'string' ? plaintextValue : '';
  }

  if (!isEncryptedOrderPii(encryptedValue)) {
    throw new Error('Invalid encrypted order data');
  }

  return decryptOrderPii(encryptedValue, {
    field,
    paymentOrderId,
  });
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Failed to load orders' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
    
    // Auth client to verify token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    // Admin client to fetch orders
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    });

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        user_id,
        user_name,
        user_phone,
        user_address,
        user_name_enc,
        user_phone_enc,
        user_address_enc,
        total_amount,
        payment_order_id,
        payment_status,
        cycle_id,
        created_at
      `)
      .eq('user_id', user.id)
      .neq('payment_status', 'PENDING')
      .order('created_at', { ascending: false });

    if (ordersError) {
      return NextResponse.json({ error: 'Failed to load orders' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const publicOrders = (orders || []).map((order) => {
      const paymentOrderId = order.payment_order_id;
    
      if (
        typeof paymentOrderId !== 'string' ||
        paymentOrderId.trim() === ''
      ) {
        throw new Error('Invalid order identifier');
      }
    
      return {
        id: order.id,
        user_id: order.user_id,
        user_name: readOrderPii(
          order.user_name_enc,
          order.user_name,
          'user_name',
          paymentOrderId
        ),
        user_phone: readOrderPii(
          order.user_phone_enc,
          order.user_phone,
          'user_phone',
          paymentOrderId
        ),
        user_address: readOrderPii(
          order.user_address_enc,
          order.user_address,
          'user_address',
          paymentOrderId
        ),
        total_amount: order.total_amount,
        payment_order_id: paymentOrderId,
        payment_status: order.payment_status,
        cycle_id: order.cycle_id,
        created_at: order.created_at,
      };
    });

    return NextResponse.json(
      { orders: publicOrders },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
