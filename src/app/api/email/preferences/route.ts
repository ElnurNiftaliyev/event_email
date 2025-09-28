import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  const { data } = await supabase.from('profiles').select('marketing_opt_in').eq('id', userId).single();
  return NextResponse.json({ marketingOptIn: data?.marketing_opt_in });
}

export async function POST(req: NextRequest) {
  const { userId, marketingOptIn } = await req.json();
  await supabase.from('profiles').update({ marketing_opt_in: marketingOptIn }).eq('id', userId);
  return NextResponse.json({ success: true });
}
