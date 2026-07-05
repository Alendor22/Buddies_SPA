'use client';

import { useEffect } from 'react';

export default function LogoutClient() {
  useEffect(() => {
    const expire = 'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax';
    const keep = 'Max-Age=2592000; Path=/; SameSite=Lax';
    document.cookie = `buddies_session=; ${expire}`;
    document.cookie = `buddies_session=; ${expire}; Secure`;
    document.cookie = `buddies_signed_out=1; ${keep}`;
    document.cookie = `buddies_signed_out=1; ${keep}; Secure`;
  }, []);

  return null;
}
