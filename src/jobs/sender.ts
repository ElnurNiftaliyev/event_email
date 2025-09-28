import cron from 'node-cron';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';
import { DateTime } from 'luxon';

const resend = new Resend(process.env.RESEND_API_KEY);
const isDemo = process.env.ACCELERATE_MODE === 'true';

async function sendEmails() {
  const { data: batch } = await supabase.rpc('claim_email_batch', { batch_size: 200 });
  for (const email of batch || []) {
    const { data: user } = await supabase.from('profiles').select().eq('id', email.user_id).single();
    if (!user.marketing_opt_in) continue;  // For marketing
    const { data: suppressed } = await supabase.from('email_suppressions').select().eq('user_id', email.user_id);
    if (suppressed?.length) continue;

    // Quiet hours check
    const now = DateTime.now().setZone(user.timezone);
    if (!isDemo && (now.hour < 8 || now.hour >= 20)) {
      // Defer: update send_after to next 08:00
      const nextSend = now.plus({ days: 1 }).set({ hour: 8, minute: 0 });
      await supabase.from('email_queue').update({ send_after: nextSend.toISO() }).eq('id', email.id);
      continue;
    }

    // Rate limit: check last marketing email in 24h
    const { count: last24hCount } = await supabase.from('email_events').select('*', { count: 'exact', head: true }).eq('user_id', email.user_id).gte('created_at', DateTime.now().minus({ hours: 24 }).toISO());
    if (last24hCount ?? 0 > 0) continue;

    // Idempotency: same template in 48h
    const { count: last48hCount } = await supabase.from('email_events').select('*', { count: 'exact', head: true }).eq('user_id', email.user_id).eq('meta->>template', email.template_key).gte('created_at', DateTime.now().minus({ hours: 48 }).toISO());
    if (last48hCount ?? 0 > 0) continue;

    // Render template
    const { data: template } = await supabase.from('email_templates').select().eq('key', email.template_key).single();
    const html = template.html.replace('{{name}}', user.full_name || 'there');
    const subject = email.variant ? 'Variant B subject' : template.subject;  // Handle A/B

    // Send
    try {
      const { data: sendData, error: sendError } = await resend.emails.send({ from: 'no-reply@creatorx.ai', to: user.email, subject, html, headers: { 'List-Unsubscribe': '<unsub-url>' } });
      if (sendError) throw sendError;
      await supabase.from('email_queue').update({ status: 'sent' }).eq('id', email.id);
      await supabase.from('email_events').insert({ user_id: email.user_id, type: 'sent', provider_id: sendData?.id });
    } catch (err) {
      const attempts = email.attempts + 1;
      if (attempts >= 5) {
        await supabase.from('email_queue').update({ status: 'failed' }).eq('id', email.id);
      } else {
        const backoff = isDemo ? 5 : Math.pow(2, attempts) * 60;  // seconds
        const newSend = DateTime.now().plus({ seconds: backoff }).toISO();
        await supabase.from('email_queue').update({ send_after: newSend, attempts }).eq('id', email.id);
      }
    }
  }
}

cron.schedule(isDemo ? '*/10 * * * * *' : '*/1 * * * *', sendEmails);  // Every 1 min, or faster in demo