-- Migration 048 rollback: reactivate QA test vehicles
BEGIN;
UPDATE vehicles
   SET status     = 'active',
       updated_at = NOW()
 WHERE plate_number LIKE 'QA8T-VRP-%';
COMMIT;
