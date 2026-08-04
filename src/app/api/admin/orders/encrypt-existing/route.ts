import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import {
  encryptOrderPii,
  createOrderPiiHmac,
  isEncryptedOrderPii,
  isOrderPiiHmac,
} from '@/lib/server/orderPiiCrypto';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isNullOrBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }

    const authMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!authMatch || !authMatch[1].trim()) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authMatch[1].trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const piiEncryptionKeyV1 = process.env.PII_ENCRYPTION_KEY_V1;
    const piiHmacKeyV1 = process.env.PII_HMAC_KEY_V1;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey ||
      !piiEncryptionKeyV1 ||
      !piiHmacKeyV1
    ) {
      return jsonNoStore(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError || !user) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.email || !isAdmin(user.email)) {
      return jsonNoStore({ error: 'Forbidden' }, { status: 403 });
    }

    if (process.env.PII_ENCRYPTION_ACTIVE_VERSION !== '1') {
      return jsonNoStore({ error: 'Server configuration error' }, { status: 500 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonNoStore({ error: 'Bad Request' }, { status: 400 });
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body)
    ) {
      return jsonNoStore({ error: 'Bad Request' }, { status: 400 });
    }

    const allowedKeys = ['mode', 'confirmation'];
    const bodyKeys = Object.keys(body);
    if (bodyKeys.some((k) => !allowedKeys.includes(k))) {
      return jsonNoStore({ error: 'Bad Request' }, { status: 400 });
    }

    const mode = body.mode;
    if (mode !== 'dry-run' && mode !== 'execute') {
      return jsonNoStore({ error: 'Bad Request' }, { status: 400 });
    }

    if (mode === 'dry-run' && 'confirmation' in body) {
      return jsonNoStore({ error: 'Bad Request' }, { status: 400 });
    }

    if (mode === 'execute' && body.confirmation !== 'ENCRYPT_EXISTING_ORDERS') {
      return jsonNoStore({ error: 'Bad Request' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        payment_order_id,
        user_name,
        user_email,
        user_phone,
        user_address,
        user_name_enc,
        user_email_enc,
        user_phone_enc,
        user_address_enc,
        user_name_hmac,
        user_email_hmac,
        pii_key_version
      `);

    if (fetchError || !orders) {
      return jsonNoStore({ error: 'Database error' }, { status: 500 });
    }

    const categorized = {
      total: orders.length,
      alreadyProtected: 0,
      needsMigration: 0,
      partialOrInvalid: 0,
      invalidSource: 0,
    };

    const needsMigrationOrders: any[] = [];

    for (const order of orders) {
      const {
        id,
        payment_order_id,
        user_name,
        user_email,
        user_phone,
        user_address,
        user_name_enc,
        user_email_enc,
        user_phone_enc,
        user_address_enc,
        user_name_hmac,
        user_email_hmac,
        pii_key_version,
      } = order;

      const fullyProtected =
        isEncryptedOrderPii(user_name_enc) &&
        isEncryptedOrderPii(user_email_enc) &&
        isEncryptedOrderPii(user_phone_enc) &&
        isEncryptedOrderPii(user_address_enc) &&
        isOrderPiiHmac(user_name_hmac) &&
        isOrderPiiHmac(user_email_hmac) &&
        pii_key_version === 1;

      if (fullyProtected) {
        categorized.alreadyProtected++;
        continue;
      }

      const hasSource =
        typeof payment_order_id === 'string' && payment_order_id.trim() !== '' &&
        typeof user_name === 'string' && user_name.trim() !== '' &&
        typeof user_email === 'string' && user_email.trim() !== '' &&
        typeof user_phone === 'string' && user_phone.trim() !== '' &&
        typeof user_address === 'string' && user_address.trim() !== '';

      if (!hasSource) {
        categorized.invalidSource++;
        continue;
      }

      const isAllEmpty =
        isNullOrBlank(user_name_enc) &&
        isNullOrBlank(user_email_enc) &&
        isNullOrBlank(user_phone_enc) &&
        isNullOrBlank(user_address_enc) &&
        isNullOrBlank(user_name_hmac) &&
        isNullOrBlank(user_email_hmac) &&
        isNullOrBlank(pii_key_version);

      if (isAllEmpty) {
        categorized.needsMigration++;
        needsMigrationOrders.push(order);
      } else {
        categorized.partialOrInvalid++;
      }
    }

    if (mode === 'dry-run') {
      const canExecute =
        categorized.partialOrInvalid === 0 &&
        categorized.invalidSource === 0 &&
        categorized.needsMigration > 0;

      return jsonNoStore({
        mode: 'dry-run',
        total: categorized.total,
        alreadyProtected: categorized.alreadyProtected,
        needsMigration: categorized.needsMigration,
        partialOrInvalid: categorized.partialOrInvalid,
        invalidSource: categorized.invalidSource,
        canExecute,
      });
    }

    // execute
    if (categorized.partialOrInvalid > 0 || categorized.invalidSource > 0 || categorized.needsMigration === 0) {
      return jsonNoStore(
        {
          mode: 'execute',
          total: categorized.total,
          alreadyProtected: categorized.alreadyProtected,
          needsMigration: categorized.needsMigration,
          partialOrInvalid: categorized.partialOrInvalid,
          invalidSource: categorized.invalidSource,
          canExecute: false,
        },
        { status: 409 }
      );
    }

    const result = {
      mode: 'execute',
      total: categorized.total,
      alreadyProtected: categorized.alreadyProtected,
      targeted: categorized.needsMigration,
      updated: 0,
      skippedConcurrent: 0,
      failed: 0,
    };

    for (const order of needsMigrationOrders) {
      try {
        const { id, payment_order_id, user_name, user_email, user_phone, user_address } = order;

        const userNameEnc = encryptOrderPii(user_name, { field: 'user_name', paymentOrderId: payment_order_id });
        const userEmailEnc = encryptOrderPii(user_email, { field: 'user_email', paymentOrderId: payment_order_id });
        const userPhoneEnc = encryptOrderPii(user_phone, { field: 'user_phone', paymentOrderId: payment_order_id });
        const userAddressEnc = encryptOrderPii(user_address, { field: 'user_address', paymentOrderId: payment_order_id });

        const userNameHmac = createOrderPiiHmac(user_name, { field: 'user_name' });
        const userEmailHmac = createOrderPiiHmac(user_email, { field: 'user_email' });

        let updateQuery = supabaseAdmin
          .from('orders')
          .update({
            user_name_enc: userNameEnc,
            user_email_enc: userEmailEnc,
            user_phone_enc: userPhoneEnc,
            user_address_enc: userAddressEnc,
            user_name_hmac: userNameHmac,
            user_email_hmac: userEmailHmac,
            pii_key_version: 1,
          })
          .eq('id', id)
          .eq('payment_order_id', payment_order_id);

        const originalSecurityValues = [
          ['user_name_enc', order.user_name_enc],
          ['user_email_enc', order.user_email_enc],
          ['user_phone_enc', order.user_phone_enc],
          ['user_address_enc', order.user_address_enc],
          ['user_name_hmac', order.user_name_hmac],
          ['user_email_hmac', order.user_email_hmac],
          ['pii_key_version', order.pii_key_version],
        ] as const;

        for (const [column, originalValue] of originalSecurityValues) {
          if (originalValue === null || originalValue === undefined) {
            updateQuery = updateQuery.is(column, null);
          } else {
            updateQuery = updateQuery.eq(column, originalValue as any);
          }
        }

        const { data: updateData, error: updateError } = await updateQuery.select('id');

        if (updateError) {
          result.failed++;
        } else if (updateData && updateData.length === 1) {
          result.updated++;
        } else {
          result.skippedConcurrent++;
        }
      } catch (err) {
        result.failed++;
      }
    }

    if (result.failed > 0) {
      return jsonNoStore(result, { status: 500 });
    }

    return jsonNoStore(result);

  } catch (err) {
    return jsonNoStore({ error: 'Internal Server Error' }, { status: 500 });
  }
}

