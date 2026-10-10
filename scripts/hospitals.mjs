// Canonical hospital list. `conv` is a rough 1-5 "convenience" estimate
// (5 = close to Colombo / major city / expressway, 1 = remote). These are
// the author's estimates, editable in the UI -- adjust to your own judgement.
// cat: T = Teaching, D = DGH, A = Base A, B = Base B
export const HOSPITALS = [
  // id, name, cat, district, conv, [alias place names...]
  ['colombo', 'Colombo Group', 'T', 'Colombo', 5, ['COLOMBO GROUP']],
  ['ragama', 'TH Ragama (CNTH)', 'T', 'Gampaha', 5, ['RAGAMA', 'RAGAMA COLOMBO NORTH']],
  ['kalubowila', 'TH Kalubowila (CSTH)', 'T', 'Colombo', 5, ['KALUBOWILA', 'KALUBOWILA COLOMBO SOUTH']],
  ['sjp', 'TH Sri Jayewardenepura', 'T', 'Colombo', 5, ['SRI JAYAWARDANEPURA', 'SRI JAYAWARDENAPURA', 'SRI JAYAWARDENEPURA', 'SJGH']],
  ['kdu', 'University Hospital KDU', 'T', 'Colombo', 5, ['UNIVERSITY HOSPITAL KDU', 'UNIVERSITY HOSPITAL', 'WERAHERA GENERAL SIR JOHN KOTHALAWELA DEFENCE UNIVERSITY HOSPITAL', 'KDU']],
  ['peradeniya', 'Peradeniya Group', 'T', 'Kandy', 4, ['PERADENIYA GROUP', 'PERADENIYA']],
  ['kandy', 'TH Kandy', 'T', 'Kandy', 4, ['KANDY']],
  ['galle', 'TH Karapitiya (Galle Group)', 'T', 'Galle', 4, ['GALLE GROUP', 'KARAPITIYA (GALLE GROUP)', 'KARAPITIYA', 'GALLE']],
  ['kurunegala', 'TH Kurunegala', 'T', 'Kurunegala', 4, ['KURUNEGALA']],
  ['kalutara', 'TH Kalutara', 'T', 'Kalutara', 4, ['KALUTARA', 'KALUTHARA']],
  ['kuliyapitiya', 'TH Kuliyapitiya', 'T', 'Kurunegala', 3, ['KULIYAPITIYA']],
  ['ratnapura', 'TH Ratnapura', 'T', 'Ratnapura', 3, ['RATNAPURA', 'RATHNAPURA']],
  ['badulla', 'TH Badulla', 'T', 'Badulla', 2, ['BADULLA']],
  ['anuradhapura', 'TH Anuradhapura', 'T', 'Anuradhapura', 2, ['ANURADHAPURA']],
  ['batticaloa', 'TH Batticaloa', 'T', 'Batticaloa', 1, ['BATTICALOA', 'BATTICOLOA']],
  ['jaffna', 'TH Jaffna', 'T', 'Jaffna', 1, ['JAFFNA']],

  ['gampaha', 'DGH Gampaha', 'D', 'Gampaha', 5, ['GAMPAHA']],
  ['negombo', 'DGH Negombo', 'D', 'Gampaha', 5, ['NEGOMBO', 'NEGAMBO']],
  ['avissawella', 'DGH Avissawella', 'D', 'Colombo', 4, ['AVISSAWELLA', 'AWISSAWELLA']],
  ['chilaw', 'DGH Chilaw', 'D', 'Puttalam', 3, ['CHILAW', 'CHILLAW']],
  ['matara', 'DGH Matara', 'D', 'Matara', 3, ['MATARA']],
  ['hambantota', 'DGH Hambantota', 'D', 'Hambantota', 2, ['HAMBANTOTA']],
  ['embilipitiya', 'DGH Embilipitiya', 'D', 'Ratnapura', 2, ['EMBILIPITIYA']],
  ['kegalle', 'DGH Kegalle', 'D', 'Kegalle', 3, ['KEGALLE']],
  ['nawalapitiya', 'DGH Nawalapitiya', 'D', 'Kandy', 2, ['NAWALAPITIYA']],
  ['nuwaraeliya', 'DGH Nuwara Eliya', 'D', 'Nuwara Eliya', 2, ['NUWARA ELIYA', 'NUWARAELIYA']],
  ['matale', 'DGH Matale', 'D', 'Matale', 3, ['MATALE']],
  ['polonnaruwa', 'DGH Polonnaruwa', 'D', 'Polonnaruwa', 2, ['POLONNARUWA', 'POLONARUWA']],
  ['trincomalee', 'DGH Trincomalee', 'D', 'Trincomalee', 2, ['TRINCOMALEE']],
  ['ampara', 'DGH Ampara', 'D', 'Ampara', 1, ['AMPARA']],
  ['kilinochchi', 'DGH Kilinochchi', 'D', 'Kilinochchi', 1, ['KILINOCHCHI', 'KILLINOCHCHI']],
  ['vavuniya', 'DGH Vavuniya', 'D', 'Vavuniya', 1, ['VAVUNIYA', 'VAUNIYA']],
  ['mannar', 'DGH Mannar', 'D', 'Mannar', 1, ['MANNAR']],
  ['monaragala', 'DGH Monaragala', 'D', 'Monaragala', 1, ['MONARAGALA', 'MONERAGALA']],

  ['balapitiya', 'BH(A) Balapitiya', 'A', 'Galle', 3, ['BALAPITIYA']],
  ['dambulla', 'BH(A) Dambulla', 'A', 'Matale', 3, ['DAMBULLA', 'DHMBULLA']],
  ['diyatalawa', 'BH(A) Diyatalawa', 'A', 'Badulla', 2, ['DIYATALAWA', 'DIYATHALAWA']],
  ['elpitiya', 'BH(A) Elpitiya', 'A', 'Galle', 3, ['ELPITIYA']],
  ['gampola', 'BH(A) Gampola', 'A', 'Kandy', 3, ['GAMPOLA']],
  ['homagama', 'BH(A) Homagama', 'A', 'Colombo', 5, ['HOMAGAMA']],
  ['horana', 'DGH Horana', 'D', 'Kalutara', 4, ['HORANA', 'HORANNA']],
  ['kalmunai_n', 'BH(A) Kalmunai North', 'A', 'Ampara', 1, ['KALMUNAI (NORTH)', 'KALMUNAI NORTH']],
  ['kalmunai_s', 'BH(A) Kalmunai South (AMH)', 'A', 'Ampara', 1, ['AMH KALMUNAI (KALMUNAI SOUTH)', 'AMH KALMUNAI SOUTH', 'KALMUNAI SOUTH', 'KALMUNAI (SOUTH)', 'KALMUNAI SOUTH ASHROFF MEMORIAL HOSPITAL']],
  ['kamburupitiya', 'BH(A) Kamburupitiya', 'A', 'Matara', 2, ['KAMBURUPITIYA']],
  ['mahiyanganaya', 'BH(A) Mahiyanganaya', 'A', 'Badulla', 1, ['MAHIYANGANAYA']],
  ['marawila', 'BH(A) Marawila', 'A', 'Puttalam', 3, ['MARAWILA', 'MARAWILLA']],
  ['panadura', 'BH(A) Panadura', 'A', 'Kalutara', 5, ['PANADURA']],
  ['puttalam', 'BH(A) Puttalam', 'A', 'Puttalam', 2, ['PUTTALAM', 'PUTTIAM', 'PUTTLAM']],
  ['tangalle', 'BH(A) Tangalle', 'A', 'Hambantota', 2, ['TANGALLE']],
  ['thelippalai', 'BH(A) Thellippalai', 'A', 'Jaffna', 1, ['THELIPPALAI', 'THELIPALAI', 'TELLIPPALAI']],
  ['watupitiwela', 'BH(A) Wathupitiwala', 'A', 'Gampaha', 4, ['WATUPITIWELA', 'WATHUPITIWALA']],
  // First appear in Aug 2026 as plain "BH"; Base A / B is an assumption.
  ['mullerriyawa', 'BH Mullerriyawa (Colombo East)', 'A', 'Colombo', 5, ['MULLERIYAWA COLOMBO EAST', 'MULLERIYAWA', 'COLOMBO EAST']],
  ['theldeniya', 'BH(B) Theldeniya', 'B', 'Kandy', 3, ['THELDENIYA']],
  ['warakapola', 'BH(B) Warakapola', 'B', 'Kegalle', 3, ['WARAKAPOLA']],
  ['dambadeniya', 'BH(B) Dambadeniya', 'B', 'Kurunegala', 3, ['DAMBADENIYA']],
  // Only ever appears as plain "BH" in the data, so Base A is an assumption.
  ['pointpedro', 'BH Point Pedro', 'A', 'Jaffna', 1, ['POINT PEDRO', 'POINT PADRO']],

  ['akkaraipattu', 'BH(B) Akkaraipattu', 'B', 'Ampara', 1, ['AKKARAIPATTU', 'AKKRAIPATTU', 'AKKARAPATTU']],
  ['balangoda', 'BH(B) Balangoda', 'B', 'Ratnapura', 2, ['BALANGODA']],
  ['dickoya', 'BH(B) Dickoya', 'B', 'Nuwara Eliya', 1, ['DICKOYA', 'DIKKOYA']],
  ['kahawatta', 'BH(B) Kahawatta', 'B', 'Ratnapura', 2, ['KAHAWATTA']],
  ['karawanella', 'BH(B) Karawanella', 'B', 'Kegalle', 3, ['KARAWANELLA']],
  ['mawanella', 'BH(B) Mawanella', 'B', 'Kegalle', 3, ['MAWANELLA']],
  ['nikaweratiya', 'BH(B) Nikaweratiya', 'B', 'Kurunegala', 2, ['NIKAWERATIYA', 'NIKAWARATIYA']],
  ['thambuththegama', 'BH(B) Thambuththegama', 'B', 'Anuradhapura', 2, ['THAMBUTHTHEGAMA', 'THAMBUTTEGAMA']],
];

// Exact full-string overrides (checked before prefix stripping).
export const OVERRIDES = {
  'DGH GAMPOLA': 'gampaha', // single 2026 row; Gampola is a Base hospital, so this is a Gampaha typo
};

// Garbled rows that cannot be resolved; they are dropped (and counted in the build report).
export const IGNORED = new Set(['F', 'BHAGYA KAH', 'BHASURA EML']);

export const CATEGORY_NAMES = { T: 'Teaching', D: 'DGH', A: 'Base A', B: 'Base B' };
