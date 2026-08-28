import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const TARGET_CYCLE_ID = 'cycle-2026-h1';
export const MEMBERSHIP_MAX_COUNT = 237;

export async function getCycleOneStatus(): Promise<'none' | 'closing' | 'closed' | 'error'> {
  try {
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('user_id')
      .eq('payment_status', 'DONE')
      .eq('cycle_id', TARGET_CYCLE_ID);

    if (orderError) {
      console.error('Failed to fetch orders for cycle status:', orderError);
      return 'error';
    }

    const validUserIds = (orderData || [])
      .map(d => d.user_id)
      .filter(id => id !== null && id !== undefined && id !== '');

    const paidUserIds = new Set(validUserIds);
    const count = paidUserIds.size;

    if (count >= MEMBERSHIP_MAX_COUNT) {
      return 'closed';
    } else if (count >= 200) {
      return 'closing';
    }
    return 'none';
  } catch (err) {
    console.error('Error in getCycleOneStatus:', err);
    return 'error';
  }
}
