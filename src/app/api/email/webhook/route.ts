import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { type, data } = req.body;

    const { error: eventError } = await supabase.from('email_events').insert([
      {
        user_id: data.user_id,
        provider_id: data.provider_id,
        type,
        meta: data.meta,
      },
    ]);

    if (eventError) return res.status(500).json({ error: eventError.message });

    if (['unsubscribe', 'bounce', 'spam'].includes(type)) {
      const { error: suppressionError } = await supabase.from('email_suppressions').insert([
        {
          user_id: data.user_id,
          reason: type,
        },
      ]);

      if (suppressionError) return res.status(500).json({ error: suppressionError.message });
    }

    res.status(200).json({ message: 'Email event recorded' });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
