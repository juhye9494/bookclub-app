import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { encryptBookOrderPii } from '@/lib/server/bookOrderPiiCrypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_REGEX = /^[0-9+\-()\s]{7,50}$/;

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: bookOrderId } = await context.params;

    if (!bookOrderId || !UUID_REGEX.test(bookOrderId)) {
      return NextResponse.json({ error: '?òÎ™ª???îÏ≤≠?ÖÎãà??' }, { status: 400 });
    }

    const headersList = await headers();
    const authHeader = headersList.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: '?∏Ï¶ù ?ïÎ≥¥Í∞Ä ?ÜÏäµ?àÎã§.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '?†Ìö®?òÏ? ?äÏ? ?¨Ïö©?êÏûÖ?àÎã§.' }, { status: 401 });
    }

    const body = await req.json();
    const shippingName = typeof body.shipping_name === 'string' ? body.shipping_name.trim() : '';
    const shippingPhone = typeof body.shipping_phone === 'string' ? body.shipping_phone.trim() : '';
    const shippingAddress = typeof body.shipping_address === 'string' ? body.shipping_address.trim() : '';

    let parsedDeliveryNote: string | null = null;
    if (body.deliveryNote !== undefined && body.deliveryNote !== null) {
      const trimmed = String(body.deliveryNote).trim();
      if (trimmed !== '') {
        if (trimmed.length > 200) {
          return NextResponse.json({ error: 'Î∞∞ÏÜ° ?îÏ≤≠?¨Ìï≠?Ä 200???¥ÌïòÎ°??ÖÎ†•??Ï£ºÏÑ∏??' }, { status: 400 });
        }
        if (/[\r\n\t]/.test(trimmed)) {
          return NextResponse.json({ error: 'Î∞∞ÏÜ° ?îÏ≤≠?¨Ìï≠???àÏö©?òÏ? ?äÎäî Î¨∏ÏûêÍ∞Ä ?¨Ìï®?òÏñ¥ ?àÏäµ?àÎã§.' }, { status: 400 });
        }
        parsedDeliveryNote = trimmed;
      }
    }

    if (
      !shippingName || shippingName.length > 100 ||
      !shippingPhone || !PHONE_REGEX.test(shippingPhone) ||
      !shippingAddress || shippingAddress.length > 500
    ) {
      return NextResponse.json({ error: 'Î∞∞ÏÜ°ÏßÄ ?ïÎ≥¥(Î∞õÎäî Î∂? ?∞ÎùΩÏ≤? Ï£ºÏÜå)Î•?Î™®Îëê ?¨Î∞îÎ•¥Í≤å ?ÖÎ†•?¥Ï£º?∏Ïöî.' }, { status: 400 });
    }

    let encryptedShippingName, encryptedShippingPhone, encryptedShippingAddress, encryptedDeliveryNote;
    try {
      encryptedShippingName = encryptBookOrderPii('shipping_name', bookOrderId, shippingName);
      encryptedShippingPhone = encryptBookOrderPii('shipping_phone', bookOrderId, shippingPhone);
      encryptedShippingAddress = encryptBookOrderPii('shipping_address', bookOrderId, shippingAddress);

      if (parsedDeliveryNote) {
        encryptedDeliveryNote = encryptBookOrderPii('delivery_note', bookOrderId, parsedDeliveryNote);
      }

      const keyVersion = encryptedShippingName.keyVersion;
      if (
        !Number.isInteger(keyVersion) ||
        keyVersion <= 0 ||
        encryptedShippingPhone.keyVersion !== keyVersion ||
        encryptedShippingAddress.keyVersion !== keyVersion ||
        (encryptedDeliveryNote && encryptedDeliveryNote.keyVersion !== keyVersion)
      ) {
        throw new Error('Book order shipping encryption version mismatch');
      }
    } catch (err) {
      console.error('book order shipping address update failed');
      return NextResponse.json(
        { error: '?úÎ≤Ñ ?§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.' },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    }

    // Ï°∞Í±¥Î∂Ä UPDATE ?§Ìñâ
    const { data: updateData, error: updateErr } = await supabaseAdmin
      .from('book_orders')
      .update({
        shipping_name: null,
        shipping_phone: null,
        shipping_address: null,
        shipping_name_enc: encryptedShippingName.encryptedValue,
        shipping_phone_enc: encryptedShippingPhone.encryptedValue,
        shipping_address_enc: encryptedShippingAddress.encryptedValue,
        delivery_note_enc: encryptedDeliveryNote ? encryptedDeliveryNote.encryptedValue : null,
        pii_key_version: encryptedShippingName.keyVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookOrderId)
      .eq('user_id', user.id)
      .eq('order_status', 'Ï£ºÎ¨∏?ëÏàò')
      .select('id')
      .maybeSingle();

    if (updateErr) {
      console.error('book order shipping address update failed');
      return NextResponse.json({ error: 'Î∞∞ÏÜ°ÏßÄ Î≥ÄÍ≤?Ï§??§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.' }, { status: 500 });
    }

    if (!updateData) {
      return NextResponse.json({ error: '?¥Î? Î∞∞ÏÜ° Ï§ÄÎπÑÍ? ?úÏûë?òÏñ¥ Î∞∞ÏÜ°ÏßÄÎ•?Î≥ÄÍ≤ΩÌï† ???ÜÏäµ?àÎã§.' }, { status: 409 });
    }

    return NextResponse.json({ success: true, data: updateData });

  } catch (err: any) {
    console.error('book order shipping address update failed');
    return NextResponse.json({ error: '?úÎ≤Ñ ?§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.' }, { status: 500 });
  }
}
