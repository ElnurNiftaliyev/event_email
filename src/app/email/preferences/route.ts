import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { u } = req.query;

    // In a real application, you would verify the signed user ID.
    const { data, error } = await supabase
      .from('profiles')
      .select('marketing_opt_in')
      .eq('id', u)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ marketing_opt_in: data.marketing_opt_in });
  } else if (req.method === 'POST') {
    const { userId, marketingOptIn } = req.body;

    const { error } = await supabase
      .from('profiles')
      .update({ marketing_opt_in: marketingOptIn })
      .eq('id', userId);

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ message: 'Email preferences updated' });
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
