import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptProfilePii, PiiCryptoError } from '@/lib/server/piiCrypto';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: Request) {
  try {
    const { email, password, name, phone, address } = await req.json();

    if (!email || !password || !name || !phone || !address) {
      return jsonNoStore({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }
      }
    );

    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://underline.hankyung.com';

    const { data, error } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteOrigin}/auth/confirm`,
        data: {
          name,
        }
      }
    });

    if (error) {
      console.error('signup auth creation failed');
      return jsonNoStore({ error: error.code || 'Auth creation failed' }, { status: 400 });
    }

    if (!data.user) {
      console.error('signup auth creation failed');
      return jsonNoStore({ error: 'Auth creation failed' }, { status: 500 });
    }

    const userId = data.user.id;
    let phoneEnc;
    let addressEnc;
    
    try {
      phoneEnc = encryptProfilePii(phone.trim(), { profileId: userId, field: 'phone' });
      addressEnc = encryptProfilePii(address.trim(), { profileId: userId, field: 'address' });
    } catch (err) {
      console.error('signup profile completion failed');
      return jsonNoStore({ error: 'Failed to encrypt profile' }, { status: 500 });
    }

    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        name: name.trim(),
        phone: null,
        phone_enc: phoneEnc,
        address: null,
        address_enc: addressEnc,
        pii_key_version: 1
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('signup profile completion failed');
      return jsonNoStore({ error: 'Failed to save profile' }, { status: 500 });
    }

    return jsonNoStore({ success: true, confirmationRequired: true });

  } catch (err) {
    console.error('signup auth creation failed');
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}
