import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/admin';
import { decryptOrderPii } from '@/lib/server/orderPiiCrypto';
import { encryptBookOrderPii } from '@/lib/server/bookOrderPiiCrypto';

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

const PHONE_REGEX = /^[0-9+\-()\s]{7,50}$/;

export async function POST(req: Request) {
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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonNoStore({ error: 'Invalid JSON' }, { status: 400 });
    }

    const mode = body?.mode;
    if (mode !== 'dry-run' && mode !== 'execute') {
      return jsonNoStore({ error: 'Invalid mode' }, { status: 400 });
    }
    if (mode === 'execute' && body?.confirm !== 'REPAIR_BOOK_ORDER_MISSING_SHIPPING') {
      return jsonNoStore({ error: 'Invalid confirm string' }, { status: 400 });
    }

    let offset = 0;
    const PAGE_SIZE = 500;
    let allRows: any[] = [];
    let fetchMore = true;
    let iterations = 0;

    while (fetchMore && iterations < 1000) {
      iterations++;
      const { data, error } = await supabaseAdmin
        .from('book_orders')
        .select(`
          id,
          subscription_order_id,
          user_id,
          shipping_name,
          shipping_phone,
          shipping_address,
          shipping_name_enc,
          shipping_phone_enc,
          shipping_address_enc,
          pii_key_version,
          updated_at
        `)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('book order missing shipping repair failed');
        return jsonNoStore({ error: 'Failed to fetch rows' }, { status: 500 });
      }

      const rows = data || [];
      allRows = allRows.concat(rows);

      if (rows.length < PAGE_SIZE) {
        fetchMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    if (fetchMore) {
      throw new Error('Migration scan limit exceeded');
    }

    let totalCandidates = 0;
    let repairableCount = 0;
    let invalidCandidateCount = 0;
    let invalidSourceCount = 0;
    
    const repairCandidates: any[] = [];
    const missingShippingRows: any[] = [];

    const isBlank = (val: any) => typeof val !== 'string' || val.trim() === '';

    for (const row of allRows) {
      const {
        shipping_name_enc,
        shipping_phone_enc,
        shipping_address_enc,
        pii_key_version,
        shipping_name,
        shipping_phone,
        shipping_address,
        subscription_order_id,
        user_id,
      } = row;

      const nameBlank = isBlank(shipping_name);
      const phoneBlank = isBlank(shipping_phone);
      const addressBlank = isBlank(shipping_address);

      if (!nameBlank && !phoneBlank && !addressBlank) {
        continue;
      }

      totalCandidates++;

      const hasAnyEnc = shipping_name_enc !== null || shipping_phone_enc !== null || shipping_address_enc !== null || pii_key_version !== null;

      if (hasAnyEnc || !nameBlank || !phoneBlank || !addressBlank || !subscription_order_id || !user_id) {
        invalidCandidateCount++;
        continue;
      }

      missingShippingRows.push(row);
    }

    const subscriptionOrderIds = missingShippingRows.map(r => r.subscription_order_id);
    const uniqueSubOrderIds = Array.from(new Set(subscriptionOrderIds));
    
    let ordersMap: Record<string, any> = {};
    if (uniqueSubOrderIds.length > 0) {
      const { data: ordersData, error: ordersErr } = await supabaseAdmin
        .from('orders')
        .select(`
          id,
          user_id,
          payment_order_id,
          user_name_enc,
          user_phone_enc,
          user_address_enc,
          pii_key_version
        `)
        .in('id', uniqueSubOrderIds);

      if (ordersErr) {
        console.error('book order missing shipping repair failed');
        return jsonNoStore({ error: 'Failed to fetch orders' }, { status: 500 });
      }

      for (const o of ordersData || []) {
        ordersMap[o.id] = o;
      }
    }

    for (const row of missingShippingRows) {
      const order = ordersMap[row.subscription_order_id];
      if (!order) {
        invalidSourceCount++;
        continue;
      }

      if (order.user_id !== row.user_id) {
        invalidSourceCount++;
        continue;
      }

      const {
        payment_order_id,
        user_name_enc,
        user_phone_enc,
        user_address_enc,
        pii_key_version
      } = order;

      if (typeof payment_order_id !== 'string' || payment_order_id.trim() === '') {
        invalidSourceCount++;
        continue;
      }

      if (
        typeof user_name_enc !== 'string' || user_name_enc.trim() === '' ||
        typeof user_phone_enc !== 'string' || user_phone_enc.trim() === '' ||
        typeof user_address_enc !== 'string' || user_address_enc.trim() === ''
      ) {
        invalidSourceCount++;
        continue;
      }

      if (!Number.isInteger(pii_key_version) || pii_key_version <= 0) {
        invalidSourceCount++;
        continue;
      }

      let recoveredName = '';
      let recoveredPhone = '';
      let recoveredAddress = '';
      let decryptSuccess = true;

      try {
        recoveredName = decryptOrderPii(user_name_enc, { field: 'user_name', paymentOrderId: payment_order_id });
        recoveredPhone = decryptOrderPii(user_phone_enc, { field: 'user_phone', paymentOrderId: payment_order_id });
        recoveredAddress = decryptOrderPii(user_address_enc, { field: 'user_address', paymentOrderId: payment_order_id });
      } catch {
        decryptSuccess = false;
      }

      if (!decryptSuccess) {
        invalidSourceCount++;
        continue;
      }

      if (
        typeof recoveredName !== 'string' ||
        recoveredName.trim().length === 0 ||
        recoveredName.length > 100
      ) {
        invalidSourceCount++;
        continue;
      }

      if (
        typeof recoveredPhone !== 'string' ||
        recoveredPhone.trim().length < 7 ||
        recoveredPhone.length > 50 ||
        !PHONE_REGEX.test(recoveredPhone)
      ) {
        invalidSourceCount++;
        continue;
      }

      if (
        typeof recoveredAddress !== 'string' ||
        recoveredAddress.trim().length === 0 ||
        recoveredAddress.length > 500
      ) {
        invalidSourceCount++;
        continue;
      }

      repairableCount++;
      repairCandidates.push({
        row,
        recoveredName,
        recoveredPhone,
        recoveredAddress
      });
    }

    if (mode === 'dry-run') {
      return jsonNoStore({
        mode: 'dry-run',
        totalCandidates,
        repairable: repairableCount,
        invalidCandidate: invalidCandidateCount,
        invalidSource: invalidSourceCount,
        canExecute: invalidCandidateCount === 0 && invalidSourceCount === 0
      });
    }

    if (invalidCandidateCount > 0 || invalidSourceCount > 0) {
      return jsonNoStore({
        error: '자동 복구할 수 없는 도서 주문 데이터가 있습니다.',
        totalCandidates,
        repairable: repairableCount,
        invalidCandidate: invalidCandidateCount,
        invalidSource: invalidSourceCount
      }, { status: 409 });
    }

    let repairedCount = 0;
    let conflictsCount = 0;

    for (const { row, recoveredName, recoveredPhone, recoveredAddress } of repairCandidates) {
      try {
        const encryptedName = encryptBookOrderPii('shipping_name', row.id, recoveredName);
        const encryptedPhone = encryptBookOrderPii('shipping_phone', row.id, recoveredPhone);
        const encryptedAddress = encryptBookOrderPii('shipping_address', row.id, recoveredAddress);

        if (
          !Number.isInteger(encryptedName.keyVersion) ||
          encryptedName.keyVersion <= 0 ||
          encryptedName.keyVersion !== encryptedPhone.keyVersion ||
          encryptedName.keyVersion !== encryptedAddress.keyVersion
        ) {
          throw new Error('version mismatch');
        }

        let query = supabaseAdmin
          .from('book_orders')
          .update({
            shipping_name: recoveredName,
            shipping_phone: recoveredPhone,
            shipping_address: recoveredAddress,
            shipping_name_enc: encryptedName.encryptedValue,
            shipping_phone_enc: encryptedPhone.encryptedValue,
            shipping_address_enc: encryptedAddress.encryptedValue,
            pii_key_version: encryptedName.keyVersion
          })
          .eq('id', row.id)
          .eq('subscription_order_id', row.subscription_order_id)
          .eq('user_id', row.user_id)
          .is('shipping_name_enc', null)
          .is('shipping_phone_enc', null)
          .is('shipping_address_enc', null)
          .is('pii_key_version', null);

        if (row.shipping_name === null) query = query.is('shipping_name', null);
        else query = query.eq('shipping_name', row.shipping_name);

        if (row.shipping_phone === null) query = query.is('shipping_phone', null);
        else query = query.eq('shipping_phone', row.shipping_phone);

        if (row.shipping_address === null) query = query.is('shipping_address', null);
        else query = query.eq('shipping_address', row.shipping_address);

        if (row.updated_at === null) {
          query = query.is('updated_at', null);
        } else {
          query = query.eq('updated_at', row.updated_at);
        }

        const { data: updateData, error: updateErr } = await query.select('id').maybeSingle();

        if (updateErr || !updateData) {
          console.error('book order missing shipping repair failed');
          conflictsCount++;
        } else {
          repairedCount++;
        }
      } catch (err) {
        console.error('book order missing shipping repair failed');
        return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
      }
    }

    const responseStatus = conflictsCount > 0 ? 409 : 200;
    return jsonNoStore({
      mode: 'execute',
      totalCandidates,
      repaired: repairedCount,
      conflicts: conflictsCount,
      invalidCandidate: invalidCandidateCount,
      invalidSource: invalidSourceCount
    }, { status: responseStatus });

  } catch (err: any) {
    console.error('book order missing shipping repair failed');
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
