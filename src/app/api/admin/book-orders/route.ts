import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';

export async function GET(req: Request) {
  try {
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

    const { data, error } = await supabaseAdmin
      .from('book_orders')
      .select(`
        *,
        book_order_items (
          id,
          book_id,
          book_title_snapshot,
          quantity
        ),
        subscription_order:orders!book_orders_subscription_order_id_fkey!inner (
          user_email,
          user_name,
          user_phone,
          user_address,
          total_amount,
          payment_order_id,
          payment_status
        )
      `)
      .eq('subscription_order.payment_status', 'DONE')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch book orders:', error.code);
      return NextResponse.json({ error: '목록 조회 실패' }, { status: 500 });
    }

    const bookIds = Array.from(
      new Set(
        (data || [])
          .flatMap((order: any) => order.book_order_items || [])
          .map((item: any) => item.book_id)
          .filter(Boolean)
      )
    );

    let isbnMap: Record<string, string> = {};

    if (bookIds.length > 0) {
      const { data: bookRows, error: booksError } = await supabaseAdmin
        .from('books')
        .select('id, isbn')
        .in('id', bookIds);

      if (booksError) {
        console.error('Failed to fetch books for ISBNs:', booksError.code);
        return NextResponse.json(
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

    const enrichedOrders = (data || []).map((order: any) => ({
      ...order,
      book_order_items: (order.book_order_items || []).map((item: any) => ({
        ...item,
        isbn: item.book_id ? isbnMap[item.book_id] || '' : '',
      })),
    }));

    return NextResponse.json({ orders: enrichedOrders });
  } catch (err: any) {
    console.error('Admin order GET error');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
