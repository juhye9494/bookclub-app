import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface MemberAccess {
  isAdmin: boolean;
  hasValidSubscription: boolean;
  canAccessMemberFeatures: boolean;
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
    
    async function fetchAccess() {
      setLoading(true);
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

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { access, loading };
}
