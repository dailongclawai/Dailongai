BEGIN;
SELECT plan(4);

SELECT has_table('public', 'commission_tiers', 'commission_tiers table exists');
SELECT has_column('public', 'commission_tiers', 'min_units', 'has min_units');
SELECT has_column('public', 'commission_tiers', 'percent', 'has percent');
SELECT results_eq(
    'SELECT count(*)::int FROM public.commission_tiers WHERE active = true',
    ARRAY[3],
    'Tier A seeded with 3 active tiers (15/20/25)'
);

SELECT * FROM finish();
ROLLBACK;
