BEGIN;
SELECT plan(39);

-- profiles (8)
SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT has_column('public', 'profiles', 'id', 'profiles.id exists');
SELECT has_column('public', 'profiles', 'role', 'profiles.role exists');
SELECT has_column('public', 'profiles', 'status', 'profiles.status exists');
SELECT has_column('public', 'profiles', 'supervisor_id', 'profiles.supervisor_id exists');
SELECT col_is_pk('public', 'profiles', 'id', 'profiles.id is PK');
SELECT col_is_fk('public', 'profiles', 'supervisor_id', 'profiles.supervisor_id is FK');
SELECT col_not_null('public', 'profiles', 'status', 'profiles.status NOT NULL');

-- product_models (5)
SELECT has_table('public', 'product_models', 'product_models table exists');
SELECT has_column('public', 'product_models', 'code', 'product_models.code exists');
SELECT col_is_unique('public', 'product_models', ARRAY['code'], 'product_models.code is UNIQUE');
SELECT has_column('public', 'product_models', 'active', 'product_models.active exists');
SELECT col_not_null('public', 'product_models', 'name', 'product_models.name NOT NULL');

-- dealer_commissions (5)
SELECT has_table('public', 'dealer_commissions', 'dealer_commissions exists');
SELECT has_column('public', 'dealer_commissions', 'commission_type', 'has commission_type');
SELECT has_column('public', 'dealer_commissions', 'rate_value', 'has rate_value');
SELECT has_column('public', 'dealer_commissions', 'effective_from', 'has effective_from');
SELECT col_is_fk('public', 'dealer_commissions', 'dealer_id', 'dealer_id is FK');

-- supervisor_overrides (4)
SELECT has_table('public', 'supervisor_overrides', 'supervisor_overrides exists');
SELECT has_column('public', 'supervisor_overrides', 'override_percent', 'has override_percent');
SELECT col_is_fk('public', 'supervisor_overrides', 'supervisor_id', 'supervisor_id is FK');
SELECT col_is_fk('public', 'supervisor_overrides', 'dealer_id', 'dealer_id is FK');

-- orders (7)
SELECT has_table('public', 'orders', 'orders table exists');
SELECT has_column('public', 'orders', 'serial_number', 'has serial_number');
SELECT col_is_unique('public', 'orders', ARRAY['serial_number'], 'serial_number UNIQUE');
SELECT has_column('public', 'orders', 'status', 'has status');
SELECT col_not_null('public', 'orders', 'status', 'status NOT NULL');
SELECT has_column('public', 'orders', 'sale_price', 'has sale_price');
SELECT has_column('public', 'orders', 'sale_date', 'has sale_date');

-- commission_payouts (4)
SELECT has_table('public', 'commission_payouts', 'commission_payouts exists');
SELECT has_column('public', 'commission_payouts', 'recipient_role', 'has recipient_role');
SELECT col_is_fk('public', 'commission_payouts', 'order_id', 'order_id is FK');
SELECT col_is_fk('public', 'commission_payouts', 'recipient_id', 'recipient_id is FK');

-- audit_log + sales_documents (6)
SELECT has_table('public', 'audit_log', 'audit_log exists');
SELECT has_column('public', 'audit_log', 'action', 'audit_log.action exists');
SELECT has_column('public', 'audit_log', 'before', 'audit_log.before exists');
SELECT has_column('public', 'audit_log', 'after', 'audit_log.after exists');
SELECT has_table('public', 'sales_documents', 'sales_documents exists');
SELECT has_column('public', 'sales_documents', 'visible_to', 'sales_documents.visible_to exists');

SELECT * FROM finish();
ROLLBACK;
