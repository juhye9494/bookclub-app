import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { decryptProfilePii, PiiCryptoError } from '@/lib/server/piiCrypto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const match = authHeader.match(/^Bearer ([^\s]+)$/);
    const token = match?.[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const filter = url.searchParams.get('filter') || 'all';
    const selectedCycleId = url.searchParams.get('cycle_id') || 'all';

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authEmailById = new Map<string, string>();
    const perPage = 1000;
    let page = 1;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        return NextResponse.json({ error: 'DB Error' }, { status: 500 });
      }

      for (const authUser of data.users) {
        authEmailById.set(authUser.id, authUser.email ?? '');
      }

      if (data.users.length < perPage) {
        break;
      }
      page += 1;
    }

    const { data: rows, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, phone, address, created_at, has_paid, phone_enc, address_enc, pii_key_version')
      .order('created_at', { ascending: false });

    if (dbError) {
      return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('user_id, cycle_id, payment_status, created_at')
      .eq('payment_status', 'DONE');

    if (ordersError) {
      return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }
    
    const results = [];
    const searchLower = search.toLowerCase();

    for (const row of rows || []) {
      let finalPhone = row.phone;
      
      try {
        if (row.phone_enc) {
          finalPhone = await decryptProfilePii(row.phone_enc, {
            profileId: row.id,
            field: 'phone'
          });
        }
      } catch (err) {
        return NextResponse.json({ error: 'Decryption Error' }, { status: 500 });
      }

      const email = authEmailById.get(row.id) ?? '';
      
      const matchSearch = !search ||
        (row.name || '').toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        (finalPhone || '').includes(search);

      const userOrders = orders.filter((o: any) => o.user_id === row.id);
      const isSub = userOrders.some((o: any) => selectedCycleId === 'all' || o.cycle_id === selectedCycleId);
      const matchFilter = filter === 'all' || (filter === 'subscribed' && isSub) || (filter === 'free' && !isSub);

      if (matchSearch && matchFilter) {
        let cycleStr = '-';
        if (userOrders.length > 0) {
          if (selectedCycleId !== 'all') {
             const cycleOrders = userOrders.filter((o: any) => o.cycle_id === selectedCycleId);
             if (cycleOrders.length > 0) cycleStr = selectedCycleId;
          } else {
             cycleStr = Array.from(new Set(userOrders.map((o: any) => o.cycle_id))).join(', ');
          }
        }

        results.push({
          name: row.name || '',
          email: email,
          phone: finalPhone || '',
          status: isSub ? '구독 회원' : '미결제 회원',
          cycle: cycleStr,
          createdAt: row.created_at ? new Date(row.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : ''
        });
      }
    }

    const header = ['이름', '이메일', '연락처', '구독 상태', '기수', '가입일'];
    const escapeCsv = (str: string) => `"${String(str).replace(/"/g, '""')}"`;
    
    let csvContent = '\uFEFF'; 
    csvContent += header.join(',') + '\n';
    
    for (const res of results) {
      const row = [
        escapeCsv(res.name),
        escapeCsv(res.email),
        escapeCsv(res.phone),
        escapeCsv(res.status),
        escapeCsv(res.cycle),
        escapeCsv(res.createdAt)
      ];
      csvContent += row.join(',') + '\n';
    }

    const dateStr = new Date().toISOString().split('T')[0];
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="underline_members_${dateStr}.csv"`
      }
    });

  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
