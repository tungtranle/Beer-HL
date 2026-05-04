SELECT id, code, latitude lat, longitude lng,
  ROUND((6371*acos(cos(radians(20.9583))*cos(radians(latitude))*cos(radians(longitude)-radians(107.0756))+sin(radians(20.9583))*sin(radians(latitude))))::numeric,1) km,
  CASE
    WHEN longitude < 105.6 THEN 'TN_NW'
    WHEN latitude > 21.4 THEN 'TN_N'
    WHEN latitude < 20.5 THEN 'NB_TH_S'
    WHEN longitude < 106.0 AND latitude BETWEEN 20.9 AND 21.2 THEN 'HNI_W'
    WHEN longitude BETWEEN 106.0 AND 106.3 AND latitude < 20.7 THEN 'NDNB'
    WHEN longitude BETWEEN 106.4 AND 106.7 THEN 'HDHP'
    WHEN longitude BETWEEN 106.7 AND 106.9 THEN 'HPE'
    ELSE 'OTHER'
  END region
FROM customers
WHERE is_active AND latitude IS NOT NULL AND longitude IS NOT NULL
  AND (6371*acos(cos(radians(20.9583))*cos(radians(latitude))*cos(radians(longitude)-radians(107.0756))+sin(radians(20.9583))*sin(radians(latitude)))) > 80
ORDER BY km DESC;
