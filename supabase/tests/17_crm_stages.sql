BEGIN;
SELECT plan(4);

SELECT has_table('public', 'crm_stages', 'crm_stages table exists');

SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_stages WHERE pipeline='b2c_device'$$,
    ARRAY[6],
    'pipeline b2c_device seeded with 6 stages'
);

SELECT results_eq(
    $$SELECT count(*)::int FROM public.crm_stages WHERE pipeline='b2b_dealer'$$,
    ARRAY[6],
    'pipeline b2b_dealer seeded with 6 stages'
);

SELECT results_eq(
    $$SELECT name FROM public.crm_stages
      WHERE pipeline='b2c_device' AND forecast='won'$$,
    ARRAY['Chốt đơn'],
    'b2c_device has exactly one won stage named Chốt đơn'
);

SELECT * FROM finish();
ROLLBACK;
