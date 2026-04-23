-- Batch 4: cities notably on the Pan-American route, not yet in database
INSERT INTO route_cities (name, country, lat, lng, wiki_slug) VALUES
-- ── MEXICO ───────────────────────────────────────────────────────────────────
('Ciudad Juárez',         'Mexico',         31.6904,  -106.4245, 'Ciudad_Juárez'),
('Chihuahua',             'Mexico',         28.6353,  -106.0889, 'Chihuahua_City'),
('Torreón',               'Mexico',         25.5428,  -103.4068, 'Torreón'),
('Durango',               'Mexico',         24.0277,  -104.6532, 'Durango,_Durango'),
('Zacatecas',             'Mexico',         22.7709,  -102.5832, 'Zacatecas_City'),
('Aguascalientes',        'Mexico',         21.8853,  -102.2916, 'Aguascalientes'),
('Querétaro',             'Mexico',         20.5888,   -100.3899,'Querétaro_City'),
('Irapuato',              'Mexico',         20.6736,  -101.3547, 'Irapuato'),
('Celaya',                'Mexico',         20.5236,  -100.8157, 'Celaya'),
('Cuernavaca',            'Mexico',         18.9242,   -99.2216, 'Cuernavaca'),
('Acapulco',              'Mexico',         16.8531,   -99.8237, 'Acapulco'),
('Pinotepa Nacional',     'Mexico',         16.3418,   -98.0553, 'Santiago_Pinotepa_Nacional'),
-- ── GUATEMALA ────────────────────────────────────────────────────────────────
('Cobán',                 'Guatemala',      15.4697,   -90.3700, 'Cobán'),
('Chiquimula',            'Guatemala',      14.7958,   -89.5447, 'Chiquimula'),
('Puerto Barrios',        'Guatemala',      15.7161,   -88.5972, 'Puerto_Barrios'),
('Flores',                'Guatemala',      16.9333,   -89.8833, 'Flores,_Petén'),
-- ── HONDURAS ─────────────────────────────────────────────────────────────────
('Tegucigalpa',           'Honduras',       14.0818,   -87.2068, 'Tegucigalpa'),
('San Pedro Sula',        'Honduras',       15.5000,   -88.0333, 'San_Pedro_Sula'),
('Comayagua',             'Honduras',       14.4500,   -87.6333, 'Comayagua'),
('Danlí',                 'Honduras',       14.0333,   -86.5833, 'Danlí'),
-- ── NICARAGUA ────────────────────────────────────────────────────────────────
('Estelí',                'Nicaragua',      13.0867,   -86.3614, 'Estelí'),
('Jinotepe',              'Nicaragua',      11.8500,   -86.2000, 'Jinotepe'),
-- ── COSTA RICA ───────────────────────────────────────────────────────────────
('San Isidro de El General','Costa Rica',    9.3667,   -83.7000, 'San_Isidro_de_El_General'),
('Palmares',              'Costa Rica',     10.0578,   -84.4289, 'Palmares,_Alajuela'),
-- ── COLOMBIA ─────────────────────────────────────────────────────────────────
('Popayán',               'Colombia',        2.4448,   -76.6147, 'Popayán'),
('Armenia',               'Colombia',        4.5339,   -75.6811, 'Armenia,_Colombia'),
-- ── ECUADOR ──────────────────────────────────────────────────────────────────
('Otavalo',               'Ecuador',         0.2333,   -78.2667, 'Otavalo'),
('Santo Domingo',         'Ecuador',        -0.2542,   -79.1719, 'Santo_Domingo,_Ecuador'),
('Guaranda',              'Ecuador',        -1.5933,   -79.0022, 'Guaranda'),
('Machala',               'Ecuador',        -3.2667,   -79.9667, 'Machala'),
-- ── PERU ─────────────────────────────────────────────────────────────────────
('Cajamarca',             'Peru',            -7.1667,  -78.5000, 'Cajamarca'),
('Huánuco',               'Peru',            -9.9306,  -76.2422, 'Huánuco'),
('Cerro de Pasco',        'Peru',           -10.6850,  -76.2622, 'Cerro_de_Pasco'),
('Huancayo',              'Peru',           -12.0667,  -75.2167, 'Huancayo'),
('Moquegua',              'Peru',           -17.1939,  -70.9344, 'Moquegua'),
('Tacna',                 'Peru',           -18.0146,  -70.2536, 'Tacna'),
-- ── BOLIVIA ──────────────────────────────────────────────────────────────────
('Cochabamba',            'Bolivia',        -17.3895,  -66.1568, 'Cochabamba'),
('Sucre',                 'Bolivia',        -19.0478,  -65.2597, 'Sucre'),
('Uyuni',                 'Bolivia',        -20.4603,  -66.8253, 'Uyuni'),
-- ── CHILE ────────────────────────────────────────────────────────────────────
('Arica',                 'Chile',          -18.4783,  -70.3126, 'Arica'),
('Iquique',               'Chile',          -20.2208,  -70.1431, 'Iquique'),
('Antofagasta',           'Chile',          -23.6509,  -70.3975, 'Antofagasta'),
('Calama',                'Chile',          -22.4558,  -68.9183, 'Calama'),
('Copiapó',               'Chile',          -27.3669,  -70.3317, 'Copiapó'),
('La Serena',             'Chile',          -29.9027,  -71.2519, 'La_Serena,_Chile'),
('Valparaíso',            'Chile',          -33.0472,  -71.6127, 'Valparaíso'),
('Los Ángeles',           'Chile',          -37.4694,  -72.3528, 'Los_Ángeles,_Chile'),
('Victoria',              'Chile',          -38.2333,  -72.3333, 'Victoria,_Chile'),
('Angol',                 'Chile',          -37.7961,  -72.7089, 'Angol'),
('Loncoche',              'Chile',          -39.3667,  -72.6333, 'Loncoche'),
('Río Bueno',             'Chile',          -40.3333,  -72.9667, 'Río_Bueno,_Chile'),
('Castro',                'Chile',          -42.4800,  -73.7600, 'Castro,_Chile'),
-- ── ARGENTINA ────────────────────────────────────────────────────────────────
('Neuquén',               'Argentina',      -38.9516,  -68.0591, 'Neuquén'),
('Bariloche',             'Argentina',      -41.1335,  -71.3103, 'Bariloche'),
('El Bolsón',             'Argentina',      -41.9667,  -71.5333, 'El_Bolsón'),
('Esquel',                'Argentina',      -42.9069,  -71.3147, 'Esquel'),
('Comodoro Rivadavia',    'Argentina',      -45.8650,  -67.4961, 'Comodoro_Rivadavia'),
('Río Gallegos',          'Argentina',      -51.6230,  -69.2168, 'Río_Gallegos'),
('Bahía Blanca',          'Argentina',      -38.7183,  -62.2663, 'Bahía_Blanca'),
('Puerto Madryn',         'Argentina',      -42.7692,  -65.0385, 'Puerto_Madryn'),
('Trelew',                'Argentina',      -43.2489,  -65.3050, 'Trelew'),
('Viedma',                'Argentina',      -40.8135,  -62.9967, 'Viedma,_Río_Negro')
ON CONFLICT (name, country) DO NOTHING;
