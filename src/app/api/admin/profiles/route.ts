import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { decryptProfilePii, PiiCryptoError } from '@/lib/server/piiCrypto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const match = authHeader.match(/^Bearer ([^\s]+)$/);
    const token = match?.[1];

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ error: '회원정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!user.email || !isAdmin(user.email)) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: rows, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, phone, address, created_at, has_paid, phone_enc, address_enc, pii_key_version')
      .order('created_at', { ascending: false });

    if (dbError) {
      return NextResponse.json({ error: '회원정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const profiles = [];

    for (const row of rows || []) {
      let finalPhone = row.phone;
      let finalAddress = row.address;

      try {
        if (row.phone_enc) {
          finalPhone = await decryptProfilePii(row.phone_enc, {
            profileId: row.id,
            field: 'phone'
          });
        }
        if (row.address_enc) {
          finalAddress = await decryptProfilePii(row.address_enc, {
            profileId: row.id,
            field: 'address'
          });
        }
      } catch (err) {
        if (err instanceof PiiCryptoError) {
          return NextResponse.json({ error: '회원정보를 안전하게 불러오지 못했습니다.' }, { status: 500 });
        }
        return NextResponse.json({ error: '회원정보를 안전하게 불러오지 못했습니다.' }, { status: 500 });
      }

      profiles.push({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: finalPhone,
        address: finalAddress,
        has_paid: row.has_paid,
        created_at: row.created_at,
      });
    }

    return NextResponse.json(
      { profiles },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ error: '회원정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
