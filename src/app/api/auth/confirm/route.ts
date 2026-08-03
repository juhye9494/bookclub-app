import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const tokenHash = formData.get('token_hash');

    if (!tokenHash || typeof tokenHash !== 'string' || tokenHash.trim() === '' || tokenHash.length > 512) {
      return NextResponse.redirect(new URL('/auth/confirm?status=error', request.url), 303);
    }

    const cleanTokenHash = tokenHash.trim();

    // Create server-side Supabase client with no persist session
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publicSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, publicSupabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: cleanTokenHash,
      type: 'email',
    });

    if (error || !data.user) {
      console.error('[Auth Confirm] Verification failed');
      return NextResponse.redirect(new URL('/auth/confirm?status=error', request.url), 303);
    }

    return NextResponse.redirect(new URL('/auth/confirm?status=success', request.url), 303);
  } catch (err) {
    console.error('[Auth Confirm] Verification failed');
    return NextResponse.redirect(new URL('/auth/confirm?status=error', request.url), 303);
  }
}
