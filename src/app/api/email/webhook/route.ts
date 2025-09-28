import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const payload = await req.json();  // Simplify: assume { userId, type, providerId, meta }
  await supabase.from('email_events').insert({ user_id: payload.userId, type: payload.type, provider_id: payload.providerId, meta: payload.meta });
  if (['unsubscribe', 'bounce', 'spam'].includes(payload.type)) {
    await supabase.from('email_suppressions').insert({ user_id: payload.userId, reason: payload.type });
  }
  return NextResponse.json({ success: true });
}