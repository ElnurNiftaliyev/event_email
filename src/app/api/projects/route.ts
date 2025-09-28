import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  await supabase.from('app_events').insert({ user_id: userId, type: 'project_created' });
  return NextResponse.json({ success: true });
}