import cron from 'node-cron';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';

const isDemo = process.env.ACCELERATE_MODE === 'true';

async function evaluateJourneys() {
  const { data: journeys } = await supabase.from('email_journey_state').select().eq('journey_key', 'onboarding_v1');

  for (const j of journeys || []) {
    const { data: appEvents } = await supabase.from('app_events').select('*').eq('user_id', j.user_id).order('occurred_at', { ascending: false });
    const hasPublished = appEvents?.some(e => e.type === 'video_published');
    const hasProject = appEvents?.some(e => e.type === 'project_created');

    if (hasPublished) {
      await supabase.from('email_journey_state').update({ journey_key: 'onboarding_v1_completed' }).eq('user_id', j.user_id);
      const { count: recent } = await supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('user_id', j.user_id).eq('template_key', 'congrats_first_publish');
      if (recent === 0) {
        await supabase.from('email_queue').insert({
          user_id: j.user_id,
          template_key: 'congrats_first_publish',
          send_after: DateTime.now().toISO(),
        });
      }
      continue;
    }

    switch (j.step_no) {
      case 0: { // 5m after signup
        const delay = isDemo ? 15 : 5 * 60; // seconds
        const shouldAdvance = DateTime.fromISO(j.last_advanced_at).plus({ seconds: delay }) < DateTime.now();
        if (shouldAdvance) {
          const variant = Math.random() > 0.5 ? 'A' : 'B';
          await supabase.from('email_queue').insert({ user_id: j.user_id, template_key: `welcome_day0${variant === 'B' ? '_b' : ''}`, send_after: DateTime.now().toISO(), variant });
          await supabase.from('email_journey_state').update({ step_no: 1, last_advanced_at: DateTime.now().toISO() }).eq('user_id', j.user_id);
        }
        break;
      }
      case 1: { // 2d after step 0
        const delay = isDemo ? 60 : 2 * 24 * 60 * 60;
        const shouldAdvance = DateTime.fromISO(j.last_advanced_at).plus({ seconds: delay }) < DateTime.now();
        if (shouldAdvance && !hasProject) {
          await supabase.from('email_queue').insert({ user_id: j.user_id, template_key: 'welcome_day2', send_after: DateTime.now().toISO() });
          await supabase.from('email_journey_state').update({ step_no: 2, last_advanced_at: DateTime.now().toISO() }).eq('user_id', j.user_id);
        }
        break;
      }
      case 2: { // 6d after step 1
        const delay = isDemo ? 120 : 4 * 24 * 60 * 60; // 4 days after day 2
        const shouldAdvance = DateTime.fromISO(j.last_advanced_at).plus({ seconds: delay }) < DateTime.now();
        if (shouldAdvance) {
          await supabase.from('email_queue').insert({ user_id: j.user_id, template_key: 'welcome_day6', send_after: DateTime.now().toISO() });
          await supabase.from('email_journey_state').update({ step_no: 3, last_advanced_at: DateTime.now().toISO() }).eq('user_id', j.user_id);
        }
        break;
      }
    }
  }
}

cron.schedule(isDemo ? '*/15 * * * * *' : '*/10 * * * *', evaluateJourneys);
