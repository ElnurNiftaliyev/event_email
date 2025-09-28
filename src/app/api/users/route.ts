import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { email, fullName, timezone, marketingOptIn } = req.body;

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .insert([{ email, full_name: fullName, timezone, marketing_opt_in: marketingOptIn }])
      .select();

    if (userError) return res.status(500).json({ error: userError.message });

    const { error: eventError } = await supabase.from('app_events').insert([
      {
        user_id: user[0].id,
        type: 'user_signed_up',
      },
    ]);

    if (eventError) return res.status(500).json({ error: eventError.message });

    const { error: journeyError } = await supabase.from('email_journey_state').insert([
      {
        user_id: user[0].id,
        journey_key: 'onboarding_v1',
      },
    ]);

    if (journeyError) return res.status(500).json({ error: journeyError.message });

    res.status(200).json({ user });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
