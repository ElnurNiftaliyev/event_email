import cron from 'node-cron';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';

const isDemo = process.env.ACCELERATE_MODE === 'true';

async function evaluateJourneys() {
  const { data: states } = await supabase.from('email_journey_state').select().eq('journey_key', 'onboarding_v1');
  for (const state of states || []) {
    const now = DateTime.now();
    const delayFactor = isDemo ? { seconds: 60 } : { days: 2 };  // Example for day2

    if (state.step_no === 0) {
      // Enqueue welcome_day0
      const variant = Math.random() < 0.5 ? 'A' : 'B';
      const sendAfter = now.plus(isDemo ? { seconds: 15 } : { minutes: 5 }).toISO();
      await supabase.from('email_queue').insert({ user_id: state.user_id, template_key: 'welcome_day0', variant, send_after: sendAfter });
      await supabase.from('email_journey_state').update({ step_no: 1, last_advanced_at: now.toISO() }).eq('user_id', state.user_id);
    } else if (state.step_no === 1 && now > DateTime.fromISO(state.last_advanced_at).plus(delayFactor)) {
      // Check no project
      const { count } = await supabase.from('app_events').select('*', { count: 'exact', head: true }).eq('user_id', state.user_id).eq('type', 'project_created');
      if ((count ?? 0) === 0) {
        const sendAfter = now.toISO();
        await supabase.from('email_queue').insert({ user_id: state.user_id, template_key: 'welcome_day2', send_after: sendAfter });
        await supabase.from('email_journey_state').update({ step_no: 2, last_advanced_at: now.toISO() }).eq('user_id', state.user_id);
      }
    } else if (state.step_no === 2 && now > DateTime.fromISO(state.last_advanced_at).plus(isDemo ? { seconds: 120 } : { days: 4 })) {  // 6 days total
      // Check no publish
      const { count } = await supabase.from('app_events').select('*', { count: 'exact', head: true }).eq('user_id', state.user_id).eq('type', 'video_published');
      if ((count ?? 0) === 0) {
        const sendAfter = now.toISO();
        await supabase.from('email_queue').insert({ user_id: state.user_id, template_key: 'welcome_day6', send_after: sendAfter });
        await supabase.from('email_journey_state').update({ step_no: 3, last_advanced_at: now.toISO() }).eq('user_id', state.user_id);
      }
    }

    // Exit condition: if publish event exists
    const { count } = await supabase.from('app_events').select('*', { count: 'exact', head: true }).eq('user_id', state.user_id).eq('type', 'video_published');
    if ((count ?? 0) > 0) {
      // Cancel pending onboarding
      await supabase.from('email_queue').update({ status: 'canceled' }).eq('user_id', state.user_id).eq('status', 'pending').in('template_key', ['welcome_day2', 'welcome_day6']);
      // Enqueue congrats
      await supabase.from('email_queue').insert({ user_id: state.user_id, template_key: 'congrats_first_publish', send_after: now.toISO() });
      // Optionally delete journey state
    }
  }
}

cron.schedule(isDemo ? '*/30 * * * * *' : '*/10 * * * *', evaluateJourneys);  // Every 10 min, faster in demo