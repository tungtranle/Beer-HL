-- Khám phá schema thực tế
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='trips' ORDER BY ordinal_position;
