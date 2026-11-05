import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptProfilePii, PiiCryptoError } from '@/lib/server/piiCrypto';
import { CURRENT_CONSENT_VERSION } from '@/constants/marketingTerms';
import { jsonNoStore } from '@/lib/server/jsonNoStore';

export async function POST(req: Request) {
  try {
    const { email, password, name, phone, address, marketingConsent } = await req.json();

    if (!email || !password || !name || !phone || !address) {
      return jsonNoStore({ error: 'Missing required fields' }, { status: 400 });
    }

    const reqPrivacy = Boolean(marketingConsent?.privacy);
    const reqEmail = Boolean(marketingConsent?.email);
    const reqSms = Boolean(marketingConsent?.sms);

    if ((reqEmail || reqSms) && !reqPrivacy) {
      return jsonNoStore(
        { error: '광고성 정보 이메일 또는 문자 수신에 동의하시려면 마케팅 목적의 개인정보 수집·이용에 동의해 주세요.' },
        { status: 400 }
      );
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

    // 마케팅 수신 동의 정보 저장 (선택 사항)
    // 선택 동의 저장만 실패한 경우, 이미 생성된 회원의 가입까지 실패했다고 표시하지 않고 구분 안내합니다.
    let consentSaveFailed = false;
    try {
      const privacy = reqPrivacy;
      const emailConsent = privacy ? reqEmail : false;
      const smsConsent = privacy ? reqSms : false;
      const isAnyAgreed = privacy;
      const now = new Date().toISOString();

      const confirmDueDate = new Date();
      confirmDueDate.setFullYear(confirmDueDate.getFullYear() + 2);

      const consentRecord = {
        user_id: userId,
        status: isAnyAgreed ? 'agreed' : 'unanswered',
        privacy_marketing_consent: privacy,
        email_marketing_consent: emailConsent,
        sms_marketing_consent: smsConsent,
        consent_version: CURRENT_CONSENT_VERSION,
        consent_source: 'signup',
        consented_at: isAnyAgreed ? now : null,
        next_confirm_due: isAnyAgreed && (emailConsent || smsConsent) ? confirmDueDate.toISOString() : null,
        created_at: now,
        updated_at: now,
      };

      const { error: consentError } = await supabaseAdmin
        .from('marketing_consents')
        .upsert(consentRecord, { onConflict: 'user_id' });

      if (consentError) {
        console.error('Failed to upsert marketing consent:', consentError);
        consentSaveFailed = true;
      } else if (isAnyAgreed) {
        const { data: latestHist, error: fetchHistError } = await supabaseAdmin
          .from('marketing_consent_history')
          .select('privacy_marketing_consent,email_marketing_consent,sms_marketing_consent,status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (fetchHistError) {
          console.error('Failed to fetch latest consent history:', fetchHistError);
          consentSaveFailed = true;
        } else {
          const needInsert =
            !latestHist?.length ||
            latestHist[0].privacy_marketing_consent !== privacy ||
            latestHist[0].email_marketing_consent !== emailConsent ||
            latestHist[0].sms_marketing_consent !== smsConsent ||
            latestHist[0].status !== 'agreed';

          if (needInsert) {
            const { error: histError } = await supabaseAdmin
              .from('marketing_consent_history')
              .insert({
                user_id: userId,
                status: 'agreed',
                privacy_marketing_consent: privacy,
                email_marketing_consent: emailConsent,
                sms_marketing_consent: smsConsent,
                action_type: 'agree',
                consent_version: CURRENT_CONSENT_VERSION,
                consent_source: 'signup',
                created_at: now,
              });
            if (histError) {
              console.error('Failed to insert marketing consent history:', histError);
              consentSaveFailed = true;
            }
          }
        }
      }
    } catch (mErr) {
      console.error('Unexpected error during marketing consent handling:', mErr);
      consentSaveFailed = true;
    }

    return jsonNoStore({
      success: true,
      confirmationRequired: true,
      ...(consentSaveFailed ? { consentSaveFailed: true, retryUrl: '/consent' } : {})
    });

  } catch (err) {
    console.error('signup auth creation failed');
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}
