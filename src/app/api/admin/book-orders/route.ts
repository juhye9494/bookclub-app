import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import {
  decryptOrderPii,
  isEncryptedOrderPii,
} from '@/lib/server/orderPiiCrypto';
import { decryptBookOrderPii } from '@/lib/server/bookOrderPiiCrypto';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function readOrderPii(
  encryptedValue: unknown,
  plaintextValue: unknown,
  field: 'user_name' | 'user_email' | 'user_phone' | 'user_address',
  paymentOrderId: string
): string {
  const hasEncryptedValue =
    typeof encryptedValue === 'string'
      ? encryptedValue.trim() !== ''
      : encryptedValue !== null && encryptedValue !== undefined;

  if (!hasEncryptedValue) {
    // Only used if absolutely missing, but since all are encrypted, this should not trigger for new/migrated orders
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

    if (!serviceRoleKey) {
      return jsonNoStore({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user || !isAdmin(user.email)) {
      return jsonNoStore({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let query = supabaseAdmin
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
        tracking_number,
        created_at,
        updated_at,
        subscription_order:orders!book_orders_subscription_order_id_fkey!inner (
          id,
          user_id,
          payment_order_id,
          payment_status,
          total_amount,
          user_name_enc,
          user_email_enc,
          user_phone_enc,
          user_address_enc,
          pii_key_version
        )
      `)
      .eq('subscription_order.payment_status', 'DONE')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      return jsonNoStore({ error: '목록 조회 실패' }, { status: 500 });
    }

    const orderIds = (data || []).map((order: any) => order.id).filter(Boolean);

    let itemsByOrderId: Record<string, any[]> = {};
    let bookIds: string[] = [];

    if (orderIds.length > 0) {
      const { data: orderItems, error: itemsError } = await supabaseAdmin
        .from('book_order_items')
        .select(`
          id,
          book_order_id,
          book_id,
          book_title_snapshot,
          quantity
        `)
        .in('book_order_id', orderIds);

      if (itemsError) {
        return jsonNoStore({ error: 'Failed to fetch items' }, { status: 500 });
      }

      for (const item of orderItems || []) {
        const orderId = item.book_order_id;
        if (!itemsByOrderId[orderId]) {
          itemsByOrderId[orderId] = [];
        }
        itemsByOrderId[orderId].push(item);
      }

      bookIds = Array.from(
        new Set(
          (orderItems || [])
            .map((item: any) => item.book_id)
            .filter(Boolean)
        )
      );
    }

    let isbnMap: Record<string, string> = {};

    if (bookIds.length > 0) {
      const { data: bookRows, error: booksError } = await supabaseAdmin
        .from('books')
        .select('id, isbn')
        .in('id', bookIds);

      if (booksError) {
        return jsonNoStore(
          { error: 'Failed to fetch book information' },
          { status: 500 }
        );
      }

      isbnMap = Object.fromEntries(
        (bookRows || []).map((book: any) => [
          book.id,
          book.isbn || ''
        ])
      );
    }

    const enrichedOrders = (data || []).map((order: any) => {
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

      const subscriptionOrder = order.subscription_order;
      let safeSubscriptionOrder = null;

      if (subscriptionOrder) {
        const paymentOrderId = subscriptionOrder.payment_order_id;
        
        if (
          typeof paymentOrderId !== 'string' ||
          paymentOrderId.trim() === ''
        ) {
          throw new Error('Invalid order identifier');
        }

        safeSubscriptionOrder = {
          user_email: readOrderPii(
            subscriptionOrder.user_email_enc,
            null, // No fallback
            'user_email',
            paymentOrderId
          ),
          user_name: readOrderPii(
            subscriptionOrder.user_name_enc,
            null,
            'user_name',
            paymentOrderId
          ),
          user_phone: readOrderPii(
            subscriptionOrder.user_phone_enc,
            null,
            'user_phone',
            paymentOrderId
          ),
          user_address: readOrderPii(
            subscriptionOrder.user_address_enc,
            null,
            'user_address',
            paymentOrderId
          ),
          total_amount: subscriptionOrder.total_amount,
          payment_order_id: paymentOrderId,
          payment_status: subscriptionOrder.payment_status,
        };
      }

      return {
        id: order.id,
        subscription_order_id: order.subscription_order_id,
        user_id: order.user_id,
        cycle_id: order.cycle_id,
        order_status: order.order_status,
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_address: shippingAddress,
        tracking_number: order.tracking_number,
        created_at: order.created_at,
        updated_at: order.updated_at,
        subscription_order: safeSubscriptionOrder,
        book_order_items: (itemsByOrderId[order.id] || []).map((item: any) => ({
          ...item,
          isbn: item.book_id ? isbnMap[item.book_id] || '' : '',
        })),
      };
    });

    return jsonNoStore({ orders: enrichedOrders });
  } catch (err: any) {
    console.error('admin book order shipping PII decryption failed');
    return jsonNoStore(
      { error: '도서 주문 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
