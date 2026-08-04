import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    return NextResponse.json(
      { orders: orders || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
