import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/utils/admin';
import { NextResponse } from 'next/server';

export interface MemberAccessInfo {
  isAdmin: boolean;
  hasValidSubscription: boolean;
  isWithinBookOrderPeriod: boolean;
  canAccessMemberFeatures: boolean;
  accessState: 'allowed' | 'subscriptionRequired' | 'beforeBookOrderPeriod' | 'afterBookOrderPeriod' | 'cycleScheduleMissing';
  bookOrderStartDate?: string;
  bookOrderEndDate?: string;
}

export async function checkMemberAccess(userId: string, email: string): Promise<MemberAccessInfo> {
  const isUserAdmin = isAdmin(email);
  if (isUserAdmin) {
    return {
      isAdmin: true,
      hasValidSubscription: false,
      isWithinBookOrderPeriod: false,
      canAccessMemberFeatures: true,
      accessState: 'allowed'
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

  if (!doneOrders || doneOrders.length === 0) {
    return {
      isAdmin: false,
      hasValidSubscription: false,
      isWithinBookOrderPeriod: false,
      canAccessMemberFeatures: false,
      accessState: 'subscriptionRequired'
    };
  }

  const cycleIds = Array.from(new Set(doneOrders.map(o => o.cycle_id).filter(Boolean)));

  if (cycleIds.length === 0) {
    return {
      isAdmin: false,
      hasValidSubscription: false,
      isWithinBookOrderPeriod: false,
      canAccessMemberFeatures: false,
      accessState: 'subscriptionRequired'
    };
  }

  const { data: cyclesData, error: cycleError } = await supabaseAdmin
    .from('cycles')
    .select('id, status, book_order_start_date, book_order_end_date')
    .in('id', cycleIds);

  if (cycleError) {
    throw new Error('DB_ERROR');
  }

  const hasValidSubscription = Array.isArray(cyclesData) && cyclesData.length > 0;

  if (!cyclesData || cyclesData.length === 0) {
    return {
      isAdmin: false,
      hasValidSubscription: false,
      isWithinBookOrderPeriod: false,
      canAccessMemberFeatures: false,
      accessState: 'subscriptionRequired'
    };
  }

  const now = new Date();

  let hasAllowed = false;
  let closestFutureCycle: any = null;
  let hasMissingSchedule = false;
  const validPastCycles: any[] = [];

  for (const cycle of cyclesData) {
    if (!cycle.book_order_start_date || !cycle.book_order_end_date) {
      if (cycle.status !== 'closed') {
        hasMissingSchedule = true;
      }
      continue;
    }

    const startDate = new Date(cycle.book_order_start_date);
    const endDate = new Date(cycle.book_order_end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      if (cycle.status !== 'closed') {
        hasMissingSchedule = true;
      }
      continue;
    }

    if (endDate < startDate) {
      if (cycle.status !== 'closed') {
        hasMissingSchedule = true;
      }
      continue;
    }

    if (cycle.status === 'closed' || now > endDate) {
      validPastCycles.push(cycle);
      continue;
    }

    if (now >= startDate && now <= endDate) {
      hasAllowed = true;
      break;
    } else if (now < startDate) {
      if (!closestFutureCycle || startDate < new Date(closestFutureCycle.book_order_start_date)) {
        closestFutureCycle = cycle;
      }
    }
  }

  const mostRecentPastCycle = validPastCycles.length > 0
    ? validPastCycles.reduce((prev, current) =>
        (new Date(prev.book_order_end_date) > new Date(current.book_order_end_date)) ? prev : current
      )
    : null;

  if (hasAllowed) {
    return {
      isAdmin: false,
      hasValidSubscription,
      isWithinBookOrderPeriod: true,
      canAccessMemberFeatures: true,
      accessState: 'allowed'
    };
  }

  if (closestFutureCycle) {
    return {
      isAdmin: false,
      hasValidSubscription,
      isWithinBookOrderPeriod: false,
      canAccessMemberFeatures: false,
      accessState: 'beforeBookOrderPeriod',
      bookOrderStartDate: closestFutureCycle.book_order_start_date,
      bookOrderEndDate: closestFutureCycle.book_order_end_date
    };
  }

  if (hasMissingSchedule) {
    return {
      isAdmin: false,
      hasValidSubscription,
      isWithinBookOrderPeriod: false,
      canAccessMemberFeatures: false,
      accessState: 'cycleScheduleMissing'
    };
  }

  return {
    isAdmin: false,
    hasValidSubscription,
    isWithinBookOrderPeriod: false,
    canAccessMemberFeatures: false,
    accessState: 'afterBookOrderPeriod',
    bookOrderStartDate: mostRecentPastCycle?.book_order_start_date,
    bookOrderEndDate: mostRecentPastCycle?.book_order_end_date
  };
}

export function getMemberAccessErrorResponse(accessInfo: MemberAccessInfo) {
  if (accessInfo.accessState === 'subscriptionRequired') {
    return NextResponse.json({
      error: 'Subscription required',
      code: 'SUBSCRIPTION_REQUIRED'
    }, { status: 403 });
  }

  if (accessInfo.accessState === 'beforeBookOrderPeriod') {
    return NextResponse.json({
      error: 'Book order period has not started',
      code: 'BOOK_ORDER_PERIOD_NOT_STARTED',
      bookOrderStartDate: accessInfo.bookOrderStartDate,
      bookOrderEndDate: accessInfo.bookOrderEndDate
    }, { status: 403 });
  }

  if (accessInfo.accessState === 'afterBookOrderPeriod') {
    return NextResponse.json({
      error: 'Book order period has ended',
      code: 'BOOK_ORDER_PERIOD_ENDED',
      bookOrderStartDate: accessInfo.bookOrderStartDate,
      bookOrderEndDate: accessInfo.bookOrderEndDate
    }, { status: 403 });
  }

  if (accessInfo.accessState === 'cycleScheduleMissing') {
    return NextResponse.json({
      error: 'Book order schedule is not configured',
      code: 'BOOK_ORDER_SCHEDULE_MISSING'
    }, { status: 403 });
  }

  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
