-- Create route_cities table
CREATE TABLE IF NOT EXISTS route_cities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  wiki_slug text NOT NULL
);

-- Enable RLS with public read
ALTER TABLE route_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON route_cities FOR SELECT USING (true);

-- Seed ~100 cities along the Pan-American Highway (Alaska → Ushuaia)
INSERT INTO route_cities (name, country, lat, lng, wiki_slug) VALUES
-- Alaska
('Prudhoe Bay',          'United States',  70.2002, -148.4597, 'Prudhoe_Bay,_Alaska'),
('Fairbanks',            'United States',  64.8378, -147.7164, 'Fairbanks,_Alaska'),
('Tok',                  'United States',  63.3358, -142.9861, 'Tok,_Alaska'),
-- Canada (Yukon / BC)
('Whitehorse',           'Canada',         60.7212, -135.0568, 'Whitehorse,_Yukon'),
('Watson Lake',          'Canada',         60.0627, -128.7075, 'Watson_Lake,_Yukon'),
('Fort Nelson',          'Canada',         58.8053, -122.7001, 'Fort_Nelson,_British_Columbia'),
('Prince George',        'Canada',         53.9171, -122.7497, 'Prince_George,_British_Columbia'),
('Kamloops',             'Canada',         50.6745, -120.3273, 'Kamloops'),
('Vancouver',            'Canada',         49.2827, -123.1207, 'Vancouver'),
-- Pacific Coast USA
('Seattle',              'United States',  47.6062, -122.3321, 'Seattle'),
('Portland',             'United States',  45.5051, -122.6750, 'Portland,_Oregon'),
('Eureka',               'United States',  40.8021, -124.1637, 'Eureka,_California'),
('San Francisco',        'United States',  37.7749, -122.4194, 'San_Francisco'),
('Monterey',             'United States',  36.6002, -121.8947, 'Monterey,_California'),
('Los Angeles',          'United States',  34.0522, -118.2437, 'Los_Angeles'),
('San Diego',            'United States',  32.7157, -117.1611, 'San_Diego'),
-- Mexico (Baja)
('Tijuana',              'Mexico',         32.5149, -117.0382, 'Tijuana'),
('Ensenada',             'Mexico',         31.8676, -116.5960, 'Ensenada,_Baja_California'),
('Guerrero Negro',       'Mexico',         27.9756, -114.0339, 'Guerrero_Negro'),
('La Paz',               'Mexico',         24.1426, -110.3128, 'La_Paz,_Baja_California_Sur'),
-- Mexico (mainland)
('Hermosillo',           'Mexico',         29.0730, -110.9559, 'Hermosillo'),
('Guaymas',              'Mexico',         27.9219, -110.8990, 'Guaymas'),
('Los Mochis',           'Mexico',         25.7859, -108.9863, 'Los_Mochis'),
('Culiacán',             'Mexico',         24.7994, -107.3879, 'Culiacán'),
('Mazatlán',             'Mexico',         23.2494, -106.4111, 'Mazatlán'),
('Tepic',                'Mexico',         21.5044, -104.8945, 'Tepic'),
('Guadalajara',          'Mexico',         20.6597, -103.3496, 'Guadalajara'),
('Mexico City',          'Mexico',         19.4326,  -99.1332, 'Mexico_City'),
('Puebla',               'Mexico',         19.0414,  -98.2063, 'Puebla_City'),
('Oaxaca',               'Mexico',         17.0732,  -96.7266, 'Oaxaca_City'),
('Tehuantepec',          'Mexico',         16.3226,  -95.2420, 'Tehuantepec'),
('Tapachula',            'Mexico',         14.9000,  -92.2624, 'Tapachula'),
-- Guatemala
('Quetzaltenango',       'Guatemala',      14.8444,  -91.5155, 'Quetzaltenango'),
('Antigua Guatemala',    'Guatemala',      14.5586,  -90.7295, 'Antigua_Guatemala'),
('Guatemala City',       'Guatemala',      14.6349,  -90.5069, 'Guatemala_City'),
-- El Salvador
('Santa Ana',            'El Salvador',    13.9944,  -89.5594, 'Santa_Ana,_El_Salvador'),
('San Salvador',         'El Salvador',    13.6929,  -89.2182, 'San_Salvador'),
('San Miguel',           'El Salvador',    13.4833,  -88.1833, 'San_Miguel,_El_Salvador'),
-- Honduras
('Tegucigalpa',          'Honduras',       14.0723,  -87.2025, 'Tegucigalpa'),
('Choluteca',            'Honduras',       13.3000,  -87.2000, 'Choluteca'),
-- Nicaragua
('Managua',              'Nicaragua',      12.1364,  -86.2514, 'Managua'),
('Granada',              'Nicaragua',      11.9344,  -85.9560, 'Granada,_Nicaragua'),
('Rivas',                'Nicaragua',      11.4378,  -85.8375, 'Rivas,_Nicaragua'),
-- Costa Rica
('Liberia',              'Costa Rica',     10.6329,  -85.4374, 'Liberia,_Costa_Rica'),
('San José',             'Costa Rica',      9.9281,  -84.0907, 'San_José,_Costa_Rica'),
('Cartago',              'Costa Rica',      9.8643,  -83.9200, 'Cartago,_Costa_Rica'),
-- Panama
('David',                'Panama',          8.4270,  -82.4307, 'David,_Panama'),
('Santiago',             'Panama',          8.0983,  -80.9878, 'Santiago,_Veraguas'),
('Panama City',          'Panama',          8.9936,  -79.5197, 'Panama_City'),
-- Colombia
('Medellín',             'Colombia',        6.2518,  -75.5636, 'Medellín'),
('Bogotá',               'Colombia',        4.7110,  -74.0721, 'Bogotá'),
('Cali',                 'Colombia',        3.4516,  -76.5320, 'Cali,_Colombia'),
('Popayán',              'Colombia',        2.4448,  -76.6147, 'Popayán'),
('Pasto',                'Colombia',        1.2136,  -77.2811, 'Pasto,_Colombia'),
-- Ecuador
('Tulcán',               'Ecuador',         0.8117,  -77.7189, 'Tulcán'),
('Ibarra',               'Ecuador',         0.3517,  -78.1228, 'Ibarra,_Ecuador'),
('Quito',                'Ecuador',        -0.1807,  -78.4678, 'Quito'),
('Latacunga',            'Ecuador',        -0.9330,  -78.6154, 'Latacunga'),
('Riobamba',             'Ecuador',        -1.6635,  -78.6543, 'Riobamba'),
('Cuenca',               'Ecuador',        -2.9001,  -79.0059, 'Cuenca,_Ecuador'),
('Loja',                 'Ecuador',        -3.9931,  -79.2042, 'Loja,_Ecuador'),
-- Peru
('Piura',                'Peru',           -5.1945,  -80.6328, 'Piura'),
('Chiclayo',             'Peru',           -6.7764,  -79.8409, 'Chiclayo'),
('Trujillo',             'Peru',           -8.1091,  -79.0215, 'Trujillo,_Peru'),
('Lima',                 'Peru',          -12.0464,  -77.0428, 'Lima'),
('Ica',                  'Peru',          -14.0678,  -75.7286, 'Ica,_Peru'),
('Nazca',                'Peru',          -14.8292,  -74.9422, 'Nazca,_Peru'),
('Arequipa',             'Peru',          -16.4090,  -71.5375, 'Arequipa'),
('Cusco',                'Peru',          -13.5319,  -71.9675, 'Cusco'),
('Puno',                 'Peru',          -15.8402,  -70.0219, 'Puno'),
('Juliaca',              'Peru',          -15.5001,  -70.1333, 'Juliaca'),
-- Bolivia
('Copacabana',           'Bolivia',       -16.1653,  -69.0849, 'Copacabana,_Bolivia'),
('La Paz',               'Bolivia',       -16.4897,  -68.1193, 'La_Paz'),
('Oruro',                'Bolivia',       -17.9833,  -67.1500, 'Oruro'),
('Potosí',               'Bolivia',       -19.5836,  -65.7531, 'Potosí'),
('Tupiza',               'Bolivia',       -21.4333,  -65.7167, 'Tupiza'),
('Villazón',             'Bolivia',       -22.0833,  -65.5833, 'Villazón'),
-- Chile
('Arica',                'Chile',         -18.4783,  -70.3126, 'Arica'),
('Iquique',              'Chile',         -20.2135,  -70.1522, 'Iquique'),
('Antofagasta',          'Chile',         -23.6524,  -70.3954, 'Antofagasta'),
('Copiapó',              'Chile',         -27.3668,  -70.3321, 'Copiapó'),
('La Serena',            'Chile',         -29.9027,  -71.2520, 'La_Serena,_Chile'),
('Valparaíso',           'Chile',         -33.0472,  -71.6127, 'Valparaíso'),
('Santiago',             'Chile',         -33.4569,  -70.6483, 'Santiago'),
('Rancagua',             'Chile',         -34.1708,  -70.7444, 'Rancagua'),
('Talca',                'Chile',         -35.4264,  -71.6554, 'Talca'),
('Concepción',           'Chile',         -36.8270,  -73.0503, 'Concepción,_Chile'),
('Temuco',               'Chile',         -38.7359,  -72.5904, 'Temuco'),
('Valdivia',             'Chile',         -39.8196,  -73.2452, 'Valdivia,_Chile'),
('Osorno',               'Chile',         -40.5736,  -73.1343, 'Osorno,_Chile'),
('Puerto Montt',         'Chile',         -41.4693,  -72.9424, 'Puerto_Montt'),
('Coyhaique',            'Chile',         -45.5712,  -72.0682, 'Coyhaique'),
('Puerto Natales',       'Chile',         -51.7333,  -72.5000, 'Puerto_Natales'),
('Punta Arenas',         'Chile',         -53.1638,  -70.9171, 'Punta_Arenas'),
-- Argentina
('Río Gallegos',         'Argentina',     -51.6230,  -69.2168, 'Río_Gallegos'),
('Ushuaia',              'Argentina',     -54.8019,  -68.3030, 'Ushuaia');
