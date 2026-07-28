'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CrmIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/portal/crm/accounts');
  }, [router]);
  return null;
}
