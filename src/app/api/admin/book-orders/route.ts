import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import {
  decryptOrderPii,
  isEncryptedOrderPii,
} from '@/lib/server/orderPiiCrypto';

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
        *,

        subscription_order:orders!book_orders_subscription_order_id_fkey!inner (
          user_email,
          user_name,
          user_phone,
          user_address,
          user_name_enc,
          user_email_enc,
          user_phone_enc,
          user_address_enc,
          total_amount,
          payment_order_id,
          payment_status
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
      const subscriptionOrder = order.subscription_order;
      let safeSubscriptionOrder = subscriptionOrder;

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
            subscriptionOrder.user_email,
            'user_email',
            paymentOrderId
          ),
          user_name: readOrderPii(
            subscriptionOrder.user_name_enc,
            subscriptionOrder.user_name,
            'user_name',
            paymentOrderId
          ),
          user_phone: readOrderPii(
            subscriptionOrder.user_phone_enc,
            subscriptionOrder.user_phone,
            'user_phone',
            paymentOrderId
          ),
          user_address: readOrderPii(
            subscriptionOrder.user_address_enc,
            subscriptionOrder.user_address,
            'user_address',
            paymentOrderId
          ),
          total_amount: subscriptionOrder.total_amount,
          payment_order_id: paymentOrderId,
          payment_status: subscriptionOrder.payment_status,
        };
      }

      return {
        ...order,
        subscription_order: safeSubscriptionOrder,
        book_order_items: (itemsByOrderId[order.id] || []).map((item: any) => ({
          ...item,
          isbn: item.book_id ? isbnMap[item.book_id] || '' : '',
        })),
      };
    });

    return jsonNoStore({ orders: enrichedOrders });
  } catch (err: any) {
    return jsonNoStore({ error: 'Internal Server Error' }, { status: 500 });
  }
}
