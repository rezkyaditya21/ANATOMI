export type SystemId = 'skeletal'|'muscular'|'arterial'|'venous'|'nervous'|'digestive'|'respiratory'|'urinary'|'reproductive'|'lymphatic'|'endocrine'|'integumentary'|'connective'|'sensory'|'cardiac';

export const SYSTEMS: {id:SystemId;name:string;color:string;description:string;nameId:string}[] = [
 {id:'skeletal',name:'Skeleton',color:'#e2d9ba',nameId:'Sistem Rangka',description:'Bones form the supporting framework of the body, protect organs, and provide attachment points for muscles. Their internal tissue also stores minerals and produces blood cells.'},
 {id:'muscular',name:'Muscles',color:'#a85b50',nameId:'Sistem Otot',description:'Skeletal muscles generate movement by pulling on their attachments. Together with tendons, they move joints, stabilize posture, and produce heat.'},
 {id:'cardiac',name:'Heart',color:'#b96760',nameId:'Jantung',description:'The heart is a muscular pump with four chambers. Its valves direct blood forward through the pulmonary and systemic circuits.'},
 {id:'sensory',name:'Sensory organs',color:'#b0c8ce',nameId:'Organ Sensorik',description:'These structures contribute to special senses, including sight, hearing, and balance. Their specialized tissues detect stimuli and work with the nervous system to convey information.'},
 {id:'arterial',name:'Arteries',color:'#c05245',nameId:'Arteri',description:'The heart drives blood through the circulation. Arteries carry blood away from the heart to supply tissues or, in the pulmonary circuit, to the lungs.'},
 {id:'venous',name:'Veins',color:'#527c9f',nameId:'Vena',description:'Veins return blood toward the heart. Superficial and deep networks collect blood from the tissues; the pulmonary veins bring oxygenated blood back from the lungs.'},
 {id:'nervous',name:'Nervous system',color:'#d8b565',nameId:'Sistem Saraf',description:'The brain, spinal cord, and peripheral nerves carry and process signals. They support sensation, movement, coordination, and automatic regulation of body functions.'},
 {id:'respiratory',name:'Respiratory',color:'#b98991',nameId:'Sistem Pernapasan',description:'The airways conduct air to the lungs, where oxygen and carbon dioxide move between air and blood. Breathing depends on pressure changes produced by respiratory muscles.'},
 {id:'digestive',name:'Digestive',color:'#b8916b',nameId:'Sistem Pencernaan',description:'The digestive tract breaks down food, absorbs nutrients and water, and moves waste onward. Accessory organs contribute bile and digestive enzymes.'},
 {id:'urinary',name:'Urinary',color:'#b47961',nameId:'Sistem Urinaria',description:'The kidneys filter blood and regulate fluid, electrolyte, and acid–base balance. Urine travels through the ureters to the bladder and exits through the urethra.'},
 {id:'lymphatic',name:'Lymphatic',color:'#879f7c',nameId:'Sistem Limfatik',description:'Lymphatic vessels return excess tissue fluid to the circulation. Lymph nodes and other lymphoid organs support immune surveillance and responses.'},
 {id:'endocrine',name:'Endocrine',color:'#c5a09a',nameId:'Sistem Endokrin',description:'Endocrine organs release hormones into the blood to coordinate processes such as metabolism, growth, stress responses, and reproduction.'},
 {id:'reproductive',name:'Reproductive',color:'#bda098',nameId:'Sistem Reproduksi',description:'The male reproductive structures represented here contribute to sperm production, maturation, transport, and the production of sex hormones.'},
 {id:'integumentary',name:'Body surface',color:'#ba9b7d',nameId:'Sistem Integumen (Kulit)',description:'The body surface provides an outer anatomical reference. The integumentary system forms a protective barrier and contributes to sensation and temperature regulation.'},
 {id:'connective',name:'Connective tissue',color:'#aec3bb',nameId:'Jaringan Ikat & Kartilago',description:'Cartilage, ligaments, and other connective tissues support, connect, and separate structures. Their roles include stabilizing joints and distributing mechanical loads.'},
];

export interface Part {id:string;name:string;conceptId:string;system:SystemId;chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number;bounds:[number[],number[]]}
export interface Concept {id:string;name:string;elements:string[]}
export interface Atlas {version:string;sex?:'male';source?:string;scope?:string;parts:Part[];concepts:Concept[];chunks:{url:string;bytes:number;gzip?:string;gzipBytes?:number}[];triangles:number}
export type View = 'three-quarter'|'front'|'back'|'side'|'head'|'chest'|'abdomen'|'legs';
export interface SceneState {
  inspectorOpen?:boolean;
  explode:number;
  visible:SystemId[];
  selected:string[];
  isolate:boolean;
  view:View;
  rotate:boolean;
  reset:number;
  xray?:boolean;
  theme?:'dark'|'light';
  dissection?:number;
  heartbeat?:boolean;
  clipping?: {
    enabled: boolean;
    plane: 'axial' | 'coronal' | 'sagittal';
    position: number;
  };
}

export const DEFAULT_VISIBLE:SystemId[] = ['cardiac','sensory','skeletal','muscular','arterial','venous','nervous','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','connective'];

export const LATIN_NAMES:Record<string,string> = {
 'heart':'Cor',
 'liver':'Hepar',
 'brain':'Encephalon / Cerebrum',
 'cerebrum':'Cerebrum',
 'cerebellum':'Cerebellum',
 'brainstem':'Truncus encephali',
 'stomach':'Gaster / Ventriculus',
 'spleen':'Splen / Lien',
 'pancreas':'Pancreas',
 'urinary bladder':'Vesica urinaria',
 'trachea':'Trachea',
 'diaphragm':'Diaphragma',
 'femur':'Os femoris',
 'tibia':'Tibia',
 'fibula':'Fibula',
 'patella':'Patella',
 'humerus':'Humerus',
 'radius':'Radius',
 'ulna':'Ulna',
 'scapula':'Scapula',
 'clavicle':'Clavicula',
 'sternum':'Sternum',
 'skull':'Cranium',
 'mandible':'Mandibula',
 'kidney':'Ren',
 'left kidney':'Ren sinister',
 'right kidney':'Ren dexter',
 'lung':'Pulmo',
 'left lung':'Pulmo sinister',
 'right lung':'Pulmo dexter',
 'aorta':'Aorta',
 'superior vena cava':'Vena cava superior',
 'inferior vena cava':'Vena cava inferior',
 'esophagus':'Esophagus',
 'gallbladder':'Vesica biliaris / fellea',
 'small intestine':'Intestinum tenue',
 'large intestine':'Intestinum crassum / Colon',
 'appendix':'Appendix vermiformis',
 'rectum':'Rectum',
 'spinal cord':'Medulla spinalis',
 'sciatic nerve':'Nervus ischiadicus',
 'biceps brachii':'Musculus biceps brachii',
 'triceps brachii':'Musculus triceps brachii',
 'deltoid':'Musculus deltoideus',
 'pectoralis major':'Musculus pectoralis major',
 'rectus abdominis':'Musculus rectus abdominis',
 'quadriceps femoris':'Musculus quadriceps femoris',
 'gastrocnemius':'Musculus gastrocnemius',
};

export const INDONESIAN_NAMES:Record<string,string> = {
 'heart':'Jantung',
 'liver':'Hati (Hepar)',
 'brain':'Otak',
 'cerebrum':'Otak Besar (Serebrum)',
 'cerebellum':'Otak Kecil (Serebelum)',
 'brainstem':'Batang Otak',
 'stomach':'Lambung (Gaster)',
 'spleen':'Limpa (Lien)',
 'pancreas':'Pankreas',
 'urinary bladder':'Kandung Kemih',
 'trachea':'Batang Tenggorokan (Trakea)',
 'diaphragm':'Diafragma',
 'femur':'Tulang Paha (Femur)',
 'tibia':'Tulang Kering (Tibia)',
 'fibula':'Tulang Betis (Fibula)',
 'patella':'Tempurung Lutut (Patela)',
 'humerus':'Tulang Lengan Atas (Humerus)',
 'radius':'Tulang Pengumpil (Radius)',
 'ulna':'Tulang Hasta (Ulna)',
 'scapula':'Tulang Belikat (Skapula)',
 'clavicle':'Tulang Selangka (Klavikula)',
 'sternum':'Tulang Dada (Sternum)',
 'skull':'Tengkorak (Kranium)',
 'mandible':'Tulang Rahang Bawah (Mandibula)',
 'kidney':'Ginjal',
 'left kidney':'Ginjal Kiri',
 'right kidney':'Ginjal Kanan',
 'lung':'Paru-Paru',
 'left lung':'Paru-Paru Kiri',
 'right lung':'Paru-Paru Kanan',
 'aorta':'Pembuluh Darah Aorta',
 'superior vena cava':'Vena Kava Superior',
 'inferior vena cava':'Vena Kava Inferior',
 'esophagus':'Kerongkongan (Esofagus)',
 'gallbladder':'Kandung Empedu',
 'small intestine':'Usus Halus',
 'large intestine':'Usus Besar (Kolon)',
 'appendix':'Usus Buntu (Apendiks)',
 'rectum':'Rektum',
 'spinal cord':'Sumsum Tulang Belakang (Medula Spinalis)',
 'sciatic nerve':'Saraf Siatik (Nervus Iskiadikus)',
 'biceps brachii':'Otot Bisep Lengan',
 'triceps brachii':'Otot Trisep Lengan',
 'deltoid':'Otot Bahu (Deltoideus)',
 'pectoralis major':'Otot Dada Besar (Pektoralis Mayor)',
 'rectus abdominis':'Otot Perut Lurus (Rektus Abdominis)',
 'quadriceps femoris':'Otot Paha Depan (Kuadriseps)',
 'gastrocnemius':'Otot Betis (Gastroknemius)',
};

export const CLINICAL_NOTES:Record<string,string> = {
 'heart':'Penyakit Jantung Koroner (PJK) dan Infark Miokard Akut terjadi akibat oklusi arteri koronaria yang menyuplai miokardium.',
 'liver':'Sirosis hepatis akibat infeksi virus hepatitis atau alkohol menyebabkan hipertensi porta, asites, dan kegagalan sintesis albumin.',
 'brain':'Stroke iskemik maupun hemoragik dapat memicu defisit neurologis fokal seperti hemiparesis, afasia, dan disartria.',
 'stomach':'Ulkus peptikum dipicu infeksi Helicobacter pylori atau penggunaan OAINS kronis; berisiko perforasi dan perdarahan saluran cerna atas.',
 'kidney':'Gagal ginjal kronik (CKD) menyebabkan uremia, ketidakseimbangan elektrolit, dan memerlukan hemodialisis atau transplantasi ginjal.',
 'lung':'Pneumonia, asma, PPOK, dan karsinoma bronkogenik mengganggu pertukaran gas alveolar dan ventilasi perfusi.',
 'femur':'Fraktur leher femur (collum femoris) pada lansia berisiko nekrosis avaskular caput femoris akibat terputusnya suplai vaskular retinacular.',
 'spinal cord':'Transeksi medula spinalis servikal memicu tetraplegia, sedangkan transeksi torakolumbal memicu paraplegia motorik dan sensorik.',
 'appendix':'Apendisitis akut menimbulkan nyeri kuadran kanan bawah (McBurney sign positif) dan memerlukan apendektomi segera.',
 'pancreas':'Pankreatitis akut memicu autodigesti jaringan pankreas oleh enzim tripsinogen yang teraktivasi prematur.',
 'urinary bladder':'Sistitis akut menimbulkan disuria, frekuensi, dan urgensi berkemih.',
 'aorta':'Aneurisma aorta torakalis atau abdominalis berisiko diseksi akut berakibat fatal dengan mortalitas tinggi.',
 'skull':'Fraktur basis kranii berisiko rinorea/otorea likuor serebrospinalis dan cedera saraf kranial primer.',
};

export const PHYSIOLOGICAL_STATS:Record<string,{stat:string;value:string;detail:string}> = {
 'heart': { stat:'Curah Jantung (CO)', value:'~5.0 L/menit', detail:'Denyut istirahat normal ~72 bpm, volume sekuncup 70 mL' },
 'brain': { stat:'Konsumsi Metabolik', value:'20% O2 & Glukosa Tubuh', detail:'Massa ~1.4 kg, mengandung ~86 miliar neuron aktif' },
 'lung': { stat:'Kapasitas Paru Total (TLC)', value:'~6.0 Liter', detail:'Luas permukaan difusi alveolus ~70-100 m²' },
 'liver': { stat:'Perfusi Darah Porta', value:'~1.500 mL/menit', detail:'Massa ~1.5 kg, memproduksi ~800 mL empedu/hari' },
 'kidney': { stat:'Laju Filtrasi (GFR)', value:'~125 mL/menit', detail:'Menyaring ~180 Liter plasma darah per 24 jam' },
 'stomach': { stat:'Keasaman Lambung', value:'pH 1.5 - 2.0 (HCl)', detail:'Volume fungsional makan ~1.0 - 1.5 Liter' },
 'aorta': { stat:'Tekanan Hemodinamik', value:'120 / 80 mmHg', detail:'Diameter lumen pangkal ~2.5 - 3.0 cm' },
 'femur': { stat:'Kekuatan Aksial Kompresi', value:'> 1.200 kg', detail:'Tulang terpanjang dan terkuat di tubuh manusia' },
 'skull': { stat:'Tekanan Intrakranial (TIK)', value:'7 - 15 mmHg', detail:'Volume kavum kranium dewasa ~1.400 - 1.500 mL' },
};

function resolveAnatomicalKey(name: string): string {
  const n = name.toLowerCase();
  if (n in CLINICAL_NOTES) return n;
  if (n.includes('ventricle') || n.includes('atrium') || n.includes('myocardi') || n.includes('pericardi') || n.includes('cardiac') || n.includes('valve') || n.includes('coronary')) return 'heart';
  if (n.includes('cerebr') || n.includes('cortex') || n.includes('frontal') || n.includes('temporal') || n.includes('occipital') || n.includes('parietal') || n.includes('brain') || n.includes('pons') || n.includes('thalamus')) return 'brain';
  if (n.includes('gastric') || n.includes('stomach') || n.includes('pylor')) return 'stomach';
  if (n.includes('renal') || n.includes('kidney') || n.includes('nephr') || n.includes('glomerul')) return 'kidney';
  if (n.includes('pulmon') || n.includes('lung') || n.includes('bronch') || n.includes('alveol') || n.includes('pleura')) return 'lung';
  if (n.includes('hepat') || n.includes('liver') || n.includes('bili') || n.includes('gallbladder')) return 'liver';
  if (n.includes('femur') || n.includes('femoral')) return 'femur';
  if (n.includes('vertebra') || n.includes('spine') || n.includes('spinal') || n.includes('medulla')) return 'spinal cord';
  if (n.includes('cranium') || n.includes('skull') || n.includes('calvaria')) return 'skull';
  if (n.includes('aort')) return 'aorta';
  if (n.includes('pancrea')) return 'pancreas';
  if (n.includes('appendi')) return 'appendix';
  if (n.includes('bladder') || n.includes('vesica')) return 'urinary bladder';
  return n;
}

export const EXPLANATIONS:Record<string,string> = {
  'heart':'A muscular pump in the chest. Its right side sends blood to the lungs; its left side sends blood through the systemic circulation.',
  'liver':'A large organ beneath the right side of the diaphragm. It processes absorbed nutrients, produces bile, and synthesizes many proteins carried in the blood.',
  'brain':'The central organ of the nervous system. Its interconnected regions support perception, movement, memory, language, and the regulation of bodily functions.',
  'stomach':'A muscular chamber between the esophagus and small intestine. It stores and mixes food with acid and enzymes before releasing it into the duodenum.',
  'spleen':'A lymphoid organ in the upper left abdomen. It filters blood, removes aging blood cells, and participates in immune responses.',
  'pancreas':'An abdominal organ with digestive and endocrine roles. It supplies enzymes to the small intestine and releases hormones including insulin and glucagon.',
  'urinary bladder':'A muscular reservoir in the pelvis that stores urine arriving from the kidneys through the ureters.',
  'trachea':'The main airway connecting the larynx to the bronchi. Its cartilage supports keep the airway open during breathing.',
  'diaphragm':'A broad muscle separating the chest and abdomen. When it contracts, it increases chest volume and helps draw air into the lungs.',
};

export function explanation(name:string,system:SystemId){
  const n = name.toLowerCase();
  const key = resolveAnatomicalKey(name);
  return EXPLANATIONS[n] ?? EXPLANATIONS[key] ?? SYSTEMS.find(s=>s.id===system)?.description ?? '';
}

export function getLatinName(name:string){
  const n = name.toLowerCase();
  if (LATIN_NAMES[n]) return LATIN_NAMES[n];
  if (n.includes('wall of ventricle') || n.includes('ventricle')) return 'Ventriculus cordis';
  if (n.includes('atrium')) return 'Atrium cordis';
  if (n.includes('myocardium')) return 'Myocardium';
  if (n.includes('pericardium')) return 'Pericardium';
  if (n.includes('coronary')) return 'Arteria coronaria';
  if (n.includes('valve')) return 'Valva cardiaca';
  const key = resolveAnatomicalKey(name);
  return LATIN_NAMES[key] ?? '';
}

export function getIndonesianName(name:string){
  const n = name.toLowerCase();
  if (INDONESIAN_NAMES[n]) return INDONESIAN_NAMES[n];
  if (n.includes('wall of ventricle')) return 'Dinding Ventrikel (Bilik Jantung)';
  if (n.includes('ventricle')) return 'Ventrikel (Bilik Jantung)';
  if (n.includes('atrium')) return 'Atrium (Serambi Jantung)';
  if (n.includes('myocardium')) return 'Miokardium (Otot Jantung)';
  if (n.includes('pericardium')) return 'Perikardium (Selaput Jantung)';
  if (n.includes('valve')) return 'Katup Jantung';
  if (n.includes('coronary')) return 'Pembuluh Darah Koroner';
  if (n.includes('cerebrum')) return 'Otak Besar (Serebrum)';
  if (n.includes('cerebellum')) return 'Otak Kecil (Serebelum)';
  if (n.includes('cortex')) return 'Korteks Serebri';
  if (n.includes('bronchus')) return 'Bronkus Saluran Napas';
  if (n.includes('alveolus')) return 'Alveolus Paru';
  if (n.includes('gluteus')) return 'Otot Bokong (Gluteus)';
  if (n.includes('artery')) return name.replace(/artery/gi, 'Arteri');
  if (n.includes('vein')) return name.replace(/vein/gi, 'Vena');
  if (n.includes('nerve')) return name.replace(/nerve/gi, 'Saraf');
  if (n.includes('muscle')) return name.replace(/muscle/gi, 'Otot');
  if (n.includes('bone')) return name.replace(/bone/gi, 'Tulang');
  if (n.includes('cartilage')) return name.replace(/cartilage/gi, 'Tulang Rawan');
  return name;
}

export function getClinicalNote(name:string){
  const key = resolveAnatomicalKey(name);
  return CLINICAL_NOTES[name.toLowerCase()] ?? CLINICAL_NOTES[key] ?? '';
}

export function getPhysiologicalStat(name:string){
  const key = resolveAnatomicalKey(name);
  return PHYSIOLOGICAL_STATS[name.toLowerCase()] ?? PHYSIOLOGICAL_STATS[key] ?? null;
}
