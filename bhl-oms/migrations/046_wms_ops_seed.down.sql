-- Migration 046 down: remove wms_exceptions, demo picking_orders, bin_locations seed
DROP TABLE IF EXISTS wms_exceptions;

DELETE FROM picking_orders WHERE pick_number LIKE 'PICK-%';

DELETE FROM bin_locations
WHERE bin_code ~ '^[ABC]-[0-9]{2}-[0-9]{2}$'
   OR bin_code LIKE 'STAGE-%'
   OR bin_code IN ('QC-01','QC-02','QUARANTINE');
