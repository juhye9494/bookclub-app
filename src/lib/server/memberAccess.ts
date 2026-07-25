import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/utils/admin';

export async function checkMemberAccess(userId: string, email: string) {
  const isUserAdmin = isAdmin(email);
  if (isUserAdmin) {
    return { 
      isAdmin: true, 
      hasValidSubscription: false, 
      canAccessMemberFeatures: true 
    };
  }

  const { data: doneOrders, error } = await supabaseAdmin
    .from('orders')
    .select('cycle_id')
    .eq('user_id', userId)
    .eq('payment_status', 'DONE');

  if (error) {
    throw new Error('DB_ERROR');
  }

  let hasValidSubscription = false;
  if (doneOrders && doneOrders.length > 0) {
    const cycleIds = Array.from(new Set(doneOrders.map(o => o.cycle_id).filter(Boolean)));
    if (cycleIds.length > 0) {
      const { data: cyclesData, error: cycleError } = await supabaseAdmin
        .from('cycles')
        .select('id, status')
        .in('id', cycleIds)
        .neq('status', 'closed');
      
      if (cycleError) {
        throw new Error('DB_ERROR');
      }
      
      if (cyclesData && cyclesData.length > 0) {
        hasValidSubscription = true;
      }
    }
  }

  return { 
    isAdmin: false, 
    hasValidSubscription, 
    canAccessMemberFeatures: hasValidSubscription 
  };
}
