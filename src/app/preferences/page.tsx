'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function EmailPreferencesPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const [marketingOptIn, setMarketingOptIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (userId) {
      fetch(`/api/email/preferences?userId=${userId}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch preferences');
          return res.json();
        })
        .then(data => {
          setMarketingOptIn(data.marketingOptIn);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [userId]);

  const handleToggle = async () => {
    if (marketingOptIn === null || updating) return;
    setUpdating(true);
    const newOptIn = !marketingOptIn;
    try {
      const res = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, marketingOptIn: newOptIn }),
      });
      if (!res.ok) throw new Error('Failed to update preferences');
      setMarketingOptIn(newOptIn);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!userId) return <div>User ID required</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Email Preferences</h1>
      <p>Manage your email marketing preferences.</p>
      <label style={{ display: 'block', marginTop: '10px' }}>
        <input
          type="checkbox"
          checked={marketingOptIn || false}
          onChange={handleToggle}
          disabled={updating}
        />
        Opt-in to marketing emails
      </label>
      {updating && <p>Updating...</p>}
    </div>
  );
}
