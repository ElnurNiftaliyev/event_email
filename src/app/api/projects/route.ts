import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { userId } = req.body;

    const { error } = await supabase.from('app_events').insert([
      {
        user_id: userId,
        type: 'project_created',
      },
    ]);

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ message: 'Project created event recorded' });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
