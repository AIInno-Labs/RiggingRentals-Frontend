-- Feedback 2: deactivate old demo catalog and seed Category → Product list.

UPDATE rental.equipment_catalog
SET is_active = false, updated_at = now()
WHERE is_active = true;

WITH products(category, name, sku, daily_rate, weekly_rate, monthly_rate) AS (
  VALUES
    ('Hoisting', 'Air Hoists', 'HOIST-AIR', 85, 340, 1020),
    ('Hoisting', 'Builders Hoist', 'HOIST-BUILD', 120, 480, 1440),
    ('Hoisting', 'Chain Hoists', 'HOIST-CHAIN', 55, 220, 660),
    ('Hoisting', 'Chain Hoists – Electric', 'HOIST-CHAIN-E', 95, 380, 1140),
    ('Hoisting', 'Girder Clamps', 'HOIST-GIRD-C', 35, 140, 420),
    ('Hoisting', 'Girder Trolleys', 'HOIST-GIRD-T', 45, 180, 540),
    ('Hoisting', 'Lever Hoists', 'HOIST-LEVER', 50, 200, 600),
    ('Hoisting', 'Riley Clamps', 'HOIST-RILEY', 40, 160, 480),
    ('Hoisting', 'Screw Clamps', 'HOIST-SCREW', 30, 120, 360),
    ('Winching', 'Air Winch', 'WINCH-AIR', 180, 720, 2160),
    ('Winching', 'Man Rider Winch', 'WINCH-MAN', 250, 1000, 3000),
    ('Winching', 'Tirfor Winches', 'WINCH-TIRFOR', 90, 360, 1080),
    ('Lifting Equipment', 'Concrete Lifting Clutches', 'LIFT-CONC', 45, 180, 540),
    ('Lifting Equipment', 'Container Lifting Lugs', 'LIFT-CONT', 55, 220, 660),
    ('Lifting Equipment', 'Edge Lifting Clutches', 'LIFT-EDGE', 50, 200, 600),
    ('Lifting Equipment', 'Equalising Triangles', 'LIFT-EQTRI', 70, 280, 840),
    ('Lifting Equipment', 'Load Ring/VLBG', 'LIFT-VLBG', 40, 160, 480),
    ('Lifting Equipment', 'Shackles', 'LIFT-SHACK', 25, 100, 300),
    ('Lifting Equipment', 'Shackles – Sling Saver', 'LIFT-SHACK-SS', 35, 140, 420),
    ('Lifting Equipment', 'Snatch Blocks', 'LIFT-SNATCH', 60, 240, 720),
    ('Man Cages & Rescue Cages', 'Single Person Work Cage', 'CAGE-1P', 150, 600, 1800),
    ('Man Cages & Rescue Cages', 'Two Person Work Cage', 'CAGE-2P', 220, 880, 2640),
    ('Man Cages & Rescue Cages', 'Rescue Cage', 'CAGE-RESCUE', 200, 800, 2400),
    ('Slings', 'Chain Sling', 'SLING-CHAIN', 45, 180, 540),
    ('Slings', 'Flat Webbing Slings', 'SLING-WEB', 20, 80, 240),
    ('Slings', 'Round Slings', 'SLING-ROUND', 25, 100, 300),
    ('Slings', 'Wire Rope Slings', 'SLING-WIRE', 35, 140, 420),
    ('Spreader & Lifting Beams', 'End Cap Spreader Beams', 'BEAM-ENDCAP', 180, 720, 2160),
    ('Spreader & Lifting Beams', 'Modular Spreader Beams', 'BEAM-MOD', 220, 880, 2640),
    ('Spreader & Lifting Beams', 'Specialty Spreader Beams', 'BEAM-SPEC', 280, 1120, 3360),
    ('Spreader & Lifting Beams', 'Lifting Beams', 'BEAM-LIFT', 160, 640, 1920),
    ('Spreader & Lifting Beams', 'Telescopic Spreader Beams', 'BEAM-TELE', 250, 1000, 3000),
    ('Load Skates & Jacks', 'Air Skates', 'SKATE-AIR', 140, 560, 1680),
    ('Load Skates & Jacks', 'Load Skates', 'SKATE-LOAD', 90, 360, 1080),
    ('Load Skates & Jacks', 'Toe Jacks', 'JACK-TOE', 75, 300, 900),
    ('Load Skates & Jacks', 'ToughLift Jacking System', 'JACK-TOUGH', 320, 1280, 3840),
    ('Load Cells', 'Load Cells – Compression', 'CELL-COMP', 110, 440, 1320),
    ('Load Cells', 'Load Cells – Tension', 'CELL-TENS', 110, 440, 1320),
    ('Load Cells', 'Load Cells Shackles', 'CELL-SHACK', 95, 380, 1140),
    ('Load Cells', 'Water Load Bags – Seaflex', 'CELL-SEAFLEX', 200, 800, 2400),
    ('Water Bags', 'Water Load Bags', 'WATER-BAG', 150, 600, 1800),
    ('Portable Gantry Cranes', 'Gantry Cranes', 'GANTRY-PORT', 280, 1120, 3360),
    ('Stand/Stools', 'Stand/Stools', 'STAND-STOOL', 40, 160, 480),
    ('Test Weights', 'Elevator Test Weights', 'TEST-ELEV', 90, 360, 1080),
    ('Test Weights', 'Life Boat Test Kits', 'TEST-LIFEBOAT', 180, 720, 2160),
    ('Test Weights', 'Steel Test Weights', 'TEST-STEEL', 70, 280, 840),
    ('Rigging Loft', 'Rigging Loft', 'LOFT-RIG', 350, 1400, 4200)
)
INSERT INTO rental.equipment_catalog (
  sku, name, category, description, tracks_meter,
  daily_rate, weekly_rate, monthly_rate,
  overage_rate_per_hour, default_fuel_surcharge, is_active
)
SELECT
  p.sku,
  p.name,
  p.category,
  p.category || ' — ' || p.name,
  false,
  p.daily_rate,
  p.weekly_rate,
  p.monthly_rate,
  0,
  0,
  true
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM rental.equipment_catalog c WHERE c.sku = p.sku
);

-- Reactivate if SKU already existed from a prior seed.
UPDATE rental.equipment_catalog c
SET
  is_active = true,
  category = p.category,
  name = p.name,
  description = p.category || ' — ' || p.name,
  daily_rate = p.daily_rate,
  weekly_rate = p.weekly_rate,
  monthly_rate = p.monthly_rate,
  updated_at = now()
FROM (
  VALUES
    ('Hoisting', 'Air Hoists', 'HOIST-AIR', 85, 340, 1020),
    ('Hoisting', 'Builders Hoist', 'HOIST-BUILD', 120, 480, 1440),
    ('Hoisting', 'Chain Hoists', 'HOIST-CHAIN', 55, 220, 660),
    ('Hoisting', 'Chain Hoists – Electric', 'HOIST-CHAIN-E', 95, 380, 1140),
    ('Hoisting', 'Girder Clamps', 'HOIST-GIRD-C', 35, 140, 420),
    ('Hoisting', 'Girder Trolleys', 'HOIST-GIRD-T', 45, 180, 540),
    ('Hoisting', 'Lever Hoists', 'HOIST-LEVER', 50, 200, 600),
    ('Hoisting', 'Riley Clamps', 'HOIST-RILEY', 40, 160, 480),
    ('Hoisting', 'Screw Clamps', 'HOIST-SCREW', 30, 120, 360),
    ('Winching', 'Air Winch', 'WINCH-AIR', 180, 720, 2160),
    ('Winching', 'Man Rider Winch', 'WINCH-MAN', 250, 1000, 3000),
    ('Winching', 'Tirfor Winches', 'WINCH-TIRFOR', 90, 360, 1080),
    ('Lifting Equipment', 'Concrete Lifting Clutches', 'LIFT-CONC', 45, 180, 540),
    ('Lifting Equipment', 'Container Lifting Lugs', 'LIFT-CONT', 55, 220, 660),
    ('Lifting Equipment', 'Edge Lifting Clutches', 'LIFT-EDGE', 50, 200, 600),
    ('Lifting Equipment', 'Equalising Triangles', 'LIFT-EQTRI', 70, 280, 840),
    ('Lifting Equipment', 'Load Ring/VLBG', 'LIFT-VLBG', 40, 160, 480),
    ('Lifting Equipment', 'Shackles', 'LIFT-SHACK', 25, 100, 300),
    ('Lifting Equipment', 'Shackles – Sling Saver', 'LIFT-SHACK-SS', 35, 140, 420),
    ('Lifting Equipment', 'Snatch Blocks', 'LIFT-SNATCH', 60, 240, 720),
    ('Man Cages & Rescue Cages', 'Single Person Work Cage', 'CAGE-1P', 150, 600, 1800),
    ('Man Cages & Rescue Cages', 'Two Person Work Cage', 'CAGE-2P', 220, 880, 2640),
    ('Man Cages & Rescue Cages', 'Rescue Cage', 'CAGE-RESCUE', 200, 800, 2400),
    ('Slings', 'Chain Sling', 'SLING-CHAIN', 45, 180, 540),
    ('Slings', 'Flat Webbing Slings', 'SLING-WEB', 20, 80, 240),
    ('Slings', 'Round Slings', 'SLING-ROUND', 25, 100, 300),
    ('Slings', 'Wire Rope Slings', 'SLING-WIRE', 35, 140, 420),
    ('Spreader & Lifting Beams', 'End Cap Spreader Beams', 'BEAM-ENDCAP', 180, 720, 2160),
    ('Spreader & Lifting Beams', 'Modular Spreader Beams', 'BEAM-MOD', 220, 880, 2640),
    ('Spreader & Lifting Beams', 'Specialty Spreader Beams', 'BEAM-SPEC', 280, 1120, 3360),
    ('Spreader & Lifting Beams', 'Lifting Beams', 'BEAM-LIFT', 160, 640, 1920),
    ('Spreader & Lifting Beams', 'Telescopic Spreader Beams', 'BEAM-TELE', 250, 1000, 3000),
    ('Load Skates & Jacks', 'Air Skates', 'SKATE-AIR', 140, 560, 1680),
    ('Load Skates & Jacks', 'Load Skates', 'SKATE-LOAD', 90, 360, 1080),
    ('Load Skates & Jacks', 'Toe Jacks', 'JACK-TOE', 75, 300, 900),
    ('Load Skates & Jacks', 'ToughLift Jacking System', 'JACK-TOUGH', 320, 1280, 3840),
    ('Load Cells', 'Load Cells – Compression', 'CELL-COMP', 110, 440, 1320),
    ('Load Cells', 'Load Cells – Tension', 'CELL-TENS', 110, 440, 1320),
    ('Load Cells', 'Load Cells Shackles', 'CELL-SHACK', 95, 380, 1140),
    ('Load Cells', 'Water Load Bags – Seaflex', 'CELL-SEAFLEX', 200, 800, 2400),
    ('Water Bags', 'Water Load Bags', 'WATER-BAG', 150, 600, 1800),
    ('Portable Gantry Cranes', 'Gantry Cranes', 'GANTRY-PORT', 280, 1120, 3360),
    ('Stand/Stools', 'Stand/Stools', 'STAND-STOOL', 40, 160, 480),
    ('Test Weights', 'Elevator Test Weights', 'TEST-ELEV', 90, 360, 1080),
    ('Test Weights', 'Life Boat Test Kits', 'TEST-LIFEBOAT', 180, 720, 2160),
    ('Test Weights', 'Steel Test Weights', 'TEST-STEEL', 70, 280, 840),
    ('Rigging Loft', 'Rigging Loft', 'LOFT-RIG', 350, 1400, 4200)
) AS p(category, name, sku, daily_rate, weekly_rate, monthly_rate)
WHERE c.sku = p.sku;
