import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptBookOrderPii } from '@/lib/server/bookOrderPiiCrypto';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function readBookOrderPii(
  encryptedValue: unknown,
  plaintextValue: unknown,
  field: 'shipping_name' | 'shipping_phone' | 'shipping_address',
  bookOrderId: string,
  keyVersion: unknown
): string {
  const hasEncryptedValue =
    typeof encryptedValue === 'string' &&
    encryptedValue.trim().length > 0;

  if (!hasEncryptedValue) {
    return typeof plaintextValue === 'string' ? plaintextValue : '';
  }

  if (!Number.isInteger(keyVersion) || (keyVersion as number) <= 0) {
    throw new Error('Missing or invalid pii_key_version');
  }

  const decrypted = decryptBookOrderPii(field, bookOrderId, encryptedValue as string, keyVersion as number);
  if (decrypted.trim().length === 0) {
    throw new Error('Invalid decrypted shipping PII');
  }
  return decrypted;
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonNoStore({ error: 'Server configuration error' }, { status: 500 });
    }

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
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    });

    // Fetch user's orders (subscription orders) to restrict book_orders lookup
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .neq('payment_status', 'PENDING');

    if (ordersError) {
      return jsonNoStore({ error: 'Failed to fetch user orders' }, { status: 500 });
    }

    const orderIds = (orders || []).map(o => o.id).filter(Boolean);

    if (orderIds.length === 0) {
      return jsonNoStore({ bookOrders: [] });
    }

    // Fetch book_orders
    const { data: bookOrdersData, error: bookOrdersError } = await supabaseAdmin
      .from('book_orders')
      .select(`
        id,
        subscription_order_id,
        user_id,
        cycle_id,
        order_status,
        shipping_name,
        shipping_phone,
        shipping_address,
        shipping_name_enc,
        shipping_phone_enc,
        shipping_address_enc,
        pii_key_version,
        created_at,
        updated_at,
        book_order_items (
          id,
          book_order_id,
          book_id,
          book_title_snapshot,
          quantity,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .in('subscription_order_id', orderIds)
      .order('created_at', { ascending: false });

    if (bookOrdersError) {
      return jsonNoStore({ error: '도서 주문 정보를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const processedBookOrders = (bookOrdersData || []).map((order: any) => {
      const hasShippingEnc =
        (typeof order.shipping_name_enc === 'string' && order.shipping_name_enc.trim().length > 0) ||
        (typeof order.shipping_phone_enc === 'string' && order.shipping_phone_enc.trim().length > 0) ||
        (typeof order.shipping_address_enc === 'string' && order.shipping_address_enc.trim().length > 0);

      const hasShippingVersion = Number.isInteger(order.pii_key_version) && order.pii_key_version > 0;

      if (hasShippingVersion && !hasShippingEnc) {
        throw new Error('Incomplete book order encrypted data');
      }

      if (hasShippingEnc && !hasShippingVersion) {
        throw new Error('Incomplete book order encrypted data');
      }

      const shippingName = readBookOrderPii(
        order.shipping_name_enc,
        order.shipping_name,
        'shipping_name',
        order.id,
        order.pii_key_version
      );

      const shippingPhone = readBookOrderPii(
        order.shipping_phone_enc,
        order.shipping_phone,
        'shipping_phone',
        order.id,
        order.pii_key_version
      );

      const shippingAddress = readBookOrderPii(
        order.shipping_address_enc,
        order.shipping_address,
        'shipping_address',
        order.id,
        order.pii_key_version
      );

      return {
        id: order.id,
        subscription_order_id: order.subscription_order_id,
        user_id: order.user_id,
        cycle_id: order.cycle_id,
        order_status: order.order_status,
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_address: shippingAddress,
        created_at: order.created_at,
        updated_at: order.updated_at,
        book_order_items: order.book_order_items || []
      };
    });

    return jsonNoStore({ bookOrders: processedBookOrders });
  } catch (err: any) {
    console.error('mypage book order request failed');
    return jsonNoStore(
      { error: '도서 주문 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
