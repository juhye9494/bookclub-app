import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface MemberAccess {
  isAdmin: boolean;
  hasValidSubscription: boolean;
  isWithinBookOrderPeriod: boolean;
  canAccessMemberFeatures: boolean;
  accessState: 'allowed' | 'subscriptionRequired' | 'beforeBookOrderPeriod' | 'afterBookOrderPeriod' | 'cycleScheduleMissing';
  bookOrderStartDate?: string;
  bookOrderEndDate?: string;
}

export function useMemberAccess(user: any) {
  const [access, setAccess] = useState<MemberAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccess(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    
    async function fetchAccess(showLoading = true) {
      if (showLoading) setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (isMounted) setAccess(null);
          return;
        }

        const res = await fetch('/api/me/member-access', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) setAccess(data);
        } else {
          if (isMounted) setAccess(null);
        }
      } catch (err) {
        console.error('Failed to fetch member access', err);
        if (isMounted) setAccess(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAccess();

    const handleFocus = () => {
      fetchAccess(false);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  return { access, loading };
}
