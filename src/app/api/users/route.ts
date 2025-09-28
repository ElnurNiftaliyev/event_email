import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, fullName, timezone, marketingOptIn } = await req.json();
  const { data: user } = await supabase.from('profiles').insert({ email, full_name: fullName, timezone, marketing_opt_in: marketingOptIn }).select().single();
  await supabase.from('app_events').insert({ user_id: user.id, type: 'user_signed_up' });
  await supabase.from('email_journey_state').insert({ user_id: user.id, journey_key: 'onboarding_v1' });
  // Enqueue welcome_day0 here or in journey evaluator
  return NextResponse.json(user);
}