BEGIN;
SELECT plan(3);

SELECT has_view('public', 'dealer_dashboard_summary', 'dealer_dashboard_summary view exists');
SELECT has_view('public', 'supervisor_team_summary', 'supervisor_team_summary view exists');
SELECT has_view('public', 'admin_fleet_summary', 'admin_fleet_summary view exists');

SELECT * FROM finish();
ROLLBACK;
