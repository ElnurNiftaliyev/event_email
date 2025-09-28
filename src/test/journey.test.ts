import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '@/lib/supabase';
import request from 'supertest';
import { DateTime } from 'luxon';

const app = 'http://localhost:3000'; // Adjust if your dev server port differs

beforeAll(async () => {
  // Seed a test user
  const { data: user } = await supabase.from('profiles').insert({
    email: 'test@example.com',
    full_name: 'Test User',
    timezone: 'America/New_York',
    marketing_opt_in: true,
  }).select().single();
  process.env.TEST_USER_ID = user.id;
});

afterAll(async () => {
  await supabase.from('profiles').delete().eq('id', process.env.TEST_USER_ID);
  await supabase.from('app_events').delete().eq('user_id', process.env.TEST_USER_ID);
  await supabase.from('email_queue').delete().eq('user_id', process.env.TEST_USER_ID);
  await supabase.from('email_journey_state').delete().eq('user_id', process.env.TEST_USER_ID);
});

describe('Journey Flow', () => {
  test('should start onboarding journey on user creation', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'test@example.com',
        fullName: 'Test User',
        timezone: 'America/New_York',
        marketingOptIn: true,
      });
    expect(response.status).toBe(200);

    const { data: queue } = await supabase
      .from('email_queue')
      .select()
      .eq('user_id', process.env.TEST_USER_ID)
      .eq('template_key', 'welcome_day0')
      .limit(1);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('pending');
  });

  test('should advance to day2 if no project after 60s in Demo Mode', async () => {
    process.env.ACCELERATE_MODE = 'true';
    // Simulate time passing (in Demo Mode, 60s = 2 days)
    await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay for job to run
    const { data: queue } = await supabase
      .from('email_queue')
      .select()
      .eq('user_id', process.env.TEST_USER_ID)
      .eq('template_key', 'welcome_day2')
      .limit(1);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('pending');
  }, 5000); // Increase timeout for async operation

  test('should exit journey and send congrats on publish', async () => {
    await request(app).post('/api/publish').send({ userId: process.env.TEST_USER_ID });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for job
    const { data: queue } = await supabase
      .from('email_queue')
      .select()
      .eq('user_id', process.env.TEST_USER_ID)
      .eq('template_key', 'congrats_first_publish')
      .limit(1);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('pending');

    const { data: journey } = await supabase
      .from('email_journey_state')
      .select('step_no')
      .eq('user_id', process.env.TEST_USER_ID)
      .single();
    expect(journey.step_no).toBe(0); // Should reset or be handled
  }, 5000);
});