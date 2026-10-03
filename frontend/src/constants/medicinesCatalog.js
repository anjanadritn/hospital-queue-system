/**
 * Comprehensive Hospital Pharmacy Formulary & Medicine Catalog
 * Formatted for instant autocomplete with 1-3 letter search support.
 * Covers Indian Pharmacopoeia, WHO Essential Medicines, and SIMSRH OPD formulary.
 */

export const MEDICINES_CATALOG = [
  // Analgesics, Antipyretics & NSAIDs
  {
    name: 'Paracetamol 650mg Oral Tablet',
    prescribable_name: 'Paracetamol 650mg Oral Tablet',
    brand_names: ['Dolo 650', 'Calpol 650', 'Pacimol 650', 'Crocin 650'],
    synonym: 'Dolo 650, Calpol 650, Acetaminophen 650mg',
    category: 'Analgesic / Antipyretic',
    default_dosage: '650mg',
    default_frequency: '1-0-1 (or SOS)',
    default_duration: '3 days',
    default_instructions: 'After food',
    term_type: 'SCD',
    rxcui: '209459'
  },
  {
    name: 'Paracetamol 500mg Oral Tablet',
    prescribable_name: 'Paracetamol 500mg Oral Tablet',
    brand_names: ['Crocin 500', 'Calpol 500', 'Pyrigesic'],
    synonym: 'Crocin 500, Calpol 500, Acetaminophen 500mg',
    category: 'Analgesic / Antipyretic',
    default_dosage: '500mg',
    default_frequency: '1-0-1 (or SOS)',
    default_duration: '3 days',
    default_instructions: 'After food',
    term_type: 'SCD',
    rxcui: '209387'
  },
  {
    name: 'Paracetamol 120mg/5ml Pediatric Suspension',
    prescribable_name: 'Paracetamol 120mg/5ml Pediatric Suspension',
    brand_names: ['Calpol Pead Drops', 'Crocin 120'],
    synonym: 'Calpol Suspension, Crocin Pediatric',
    category: 'Pediatric Antipyretic',
    default_dosage: '5ml',
    default_frequency: 'TDS (or SOS)',
    default_duration: '3 days',
    default_instructions: 'Shake well before use',
    term_type: 'SCD',
    rxcui: '243350'
  },
  {
    name: 'Paracetamol 1000mg/100ml IV Infusion',
    prescribable_name: 'Paracetamol 1000mg/100ml IV Infusion',
    brand_names: ['Paracip IV', 'Neomol IV'],
    synonym: 'IV Paracetamol',
    category: 'Analgesic / Antipyretic (IV)',
    default_dosage: '100ml IV',
    default_frequency: 'TDS (or SOS)',
    default_duration: '1 day',
    default_instructions: 'Slow IV infusion over 15 mins',
    term_type: 'SCD',
    rxcui: '313797'
  },
  {
    name: 'Ibuprofen 400mg Oral Tablet',
    prescribable_name: 'Ibuprofen 400mg Oral Tablet',
    brand_names: ['Brufen 400', 'Ibugesic'],
    synonym: 'Brufen 400',
    category: 'NSAID / Anti-inflammatory',
    default_dosage: '400mg',
    default_frequency: '1-0-1',
    default_duration: '5 days',
    default_instructions: 'Strictly after food with water',
    term_type: 'SCD',
    rxcui: '197806'
  },
  {
    name: 'Ibuprofen 400mg + Paracetamol 325mg Tablet',
    prescribable_name: 'Ibuprofen 400mg + Paracetamol 325mg Tablet',
    brand_names: ['Combiflam', 'Flexon', 'Ibugesic Plus'],
    synonym: 'Combiflam Tablet',
    category: 'NSAID + Antipyretic',
    default_dosage: '1 Tablet',
    default_frequency: '1-0-1',
    default_duration: '3 days',
    default_instructions: 'After food',
    term_type: 'SBD',
    rxcui: '1092398'
  },
  {
    name: 'Aceclofenac 100mg + Paracetamol 325mg Tablet',
    prescribable_name: 'Aceclofenac 100mg + Paracetamol 325mg Tablet',
    brand_names: ['Zerodol-P', 'Hifenac-P', 'Dolokind-P'],
    synonym: 'Zerodol-P',
    category: 'NSAID / Joint & Muscle Pain',
    default_dosage: '1 Tablet',
    default_frequency: '1-0-1',
    default_duration: '5 days',
    default_instructions: 'After food',
    term_type: 'SBD',
    rxcui: '856711'
  },
  {
    name: 'Diclofenac Sodium 50mg Gastro-Resistant Tablet',
    prescribable_name: 'Diclofenac Sodium 50mg Gastro-Resistant Tablet',
    brand_names: ['Voveran 50', 'Diclogesic'],
    synonym: 'Voveran 50',
    category: 'NSAID / Pain Relief',
    default_dosage: '50mg',
    default_frequency: '1-0-1',
    default_duration: '3 days',
    default_instructions: 'After food',
    term_type: 'SCD',
    rxcui: '197587'
  },
  {
    name: 'Tramadol 50mg Oral Capsule',
    prescribable_name: 'Tramadol 50mg Oral Capsule',
    brand_names: ['Tramazac', 'Ultram'],
    synonym: 'Tramadol 50mg',
    category: 'Opioid Analgesic',
    default_dosage: '50mg',
    default_frequency: '1-0-1 (SOS)',
    default_duration: '3 days',
    default_instructions: 'As directed by physician',
    term_type: 'SCD',
    rxcui: '833036'
  },
  {
    name: 'Aspirin 75mg Gastro-Resistant Tablet',
    prescribable_name: 'Aspirin 75mg Gastro-Resistant Tablet',
    brand_names: ['Ecosprin 75', 'Delisprin'],
    synonym: 'Ecosprin 75, Acetylsalicylic Acid',
    category: 'Antiplatelet / Cardioprotective',
    default_dosage: '75mg',
    default_frequency: '0-1-0',
    default_duration: '30 days',
    default_instructions: 'After lunch with water',
    term_type: 'SCD',
    rxcui: '212033'
  },
  {
    name: 'Aspirin 150mg Gastro-Resistant Tablet',
    prescribable_name: 'Aspirin 150mg Gastro-Resistant Tablet',
    brand_names: ['Ecosprin 150'],
    synonym: 'Ecosprin 150',
    category: 'Antiplatelet',
    default_dosage: '150mg',
    default_frequency: '0-1-0',
    default_duration: '30 days',
    default_instructions: 'After meals',
    term_type: 'SCD',
    rxcui: '212035'
  },

  // Antibiotics & Antimicrobials
  {
    name: 'Amoxicillin 500mg Oral Capsule',
    prescribable_name: 'Amoxicillin 500mg Oral Capsule',
    brand_names: ['Mox 500', 'Novamox 500', 'Amoxil'],
    synonym: 'Mox 500, Novamox',
    category: 'Broad-Spectrum Penicillin Antibiotic',
    default_dosage: '500mg',
    default_frequency: '1-1-1 (TDS)',
    default_duration: '5 days',
    default_instructions: 'Complete full course. With or without food.',
    term_type: 'SCD',
    rxcui: '213169'
  },
  {
    name: 'Amoxicillin 500mg + Clavulanic Acid 125mg Tablet',
    prescribable_name: 'Amoxicillin 500mg + Clavulanic Acid 125mg Tablet',
    brand_names: ['Augmentin 625 Duo', 'Moxikind-CV 625', 'Clavam 625'],
    synonym: 'Augmentin 625, Clavam 625',
    category: 'Penicillin + Beta-Lactamase Inhibitor',
    default_dosage: '625mg',
    default_frequency: '1-0-1 (BD)',
    default_duration: '5 days',
    default_instructions: 'Start of a meal to reduce GI discomfort',
    term_type: 'SBD',
    rxcui: '308182'
  },
  {
    name: 'Azithromycin 500mg Oral Tablet',
    prescribable_name: 'Azithromycin 500mg Oral Tablet',
    brand_names: ['Azee 500', 'Azithral 500', 'Zithromax'],
    synonym: 'Azee 500, Azithral 500',
    category: 'Macrolide Antibiotic',
    default_dosage: '500mg',
    default_frequency: '1-0-0 (OD)',
    default_duration: '3 days',
    default_instructions: '1 hour before or 2 hours after meals',
    term_type: 'SCD',
    rxcui: '248656'
  },
  {
    name: 'Azithromycin 250mg Oral Tablet',
    prescribable_name: 'Azithromycin 250mg Oral Tablet',
    brand_names: ['Azee 250', 'Azithral 250'],
    synonym: 'Azee 250',
    category: 'Macrolide Antibiotic',
    default_dosage: '250mg',
    default_frequency: '1-0-0 (OD)',
    default_duration: '5 days',
    default_instructions: '1 hour before food',
    term_type: 'SCD',
    rxcui: '248655'
  },
  {
    name: 'Cefixime 200mg Oral Tablet',
    prescribable_name: 'Cefixime 200mg Oral Tablet',
    brand_names: ['Taxim-O 200', 'Zifi 200', 'Cefspan'],
    synonym: 'Taxim-O 200, Zifi 200',
    category: '3rd Generation Cephalosporin Antibiotic',
    default_dosage: '200mg',
    default_frequency: '1-0-1 (BD)',
    default_duration: '5 days',
    default_instructions: 'With or without food',
    term_type: 'SCD',
    rxcui: '309095'
  },
  {
    name: 'Cefuroxime Axetil 500mg Oral Tablet',
    prescribable_name: 'Cefuroxime Axetil 500mg Oral Tablet',
    brand_names: ['Ceftum 500', 'Cetil 500', 'Zinacef'],
    synonym: 'Ceftum 500',
    category: '2nd Generation Cephalosporin Antibiotic',
    default_dosage: '500mg',
    default_frequency: '1-0-1 (BD)',
    default_duration: '5 days',
    default_instructions: 'Immediately after food',
    term_type: 'SCD',
    rxcui: '309100'
  },
  {
    name: 'Ciprofloxacin 500mg Film-Coated Tablet',
    prescribable_name: 'Ciprofloxacin 500mg Film-Coated Tablet',
    brand_names: ['Ciplox 500', 'Cifran 500'],
    synonym: 'Ciplox 500, Cifran 500',
    category: 'Fluoroquinolone Antibiotic',
    default_dosage: '500mg',
    default_frequency: '1-0-1 (BD)',
    default_duration: '5 days',
    default_instructions: 'Drink plenty of fluids. Avoid antacids within 2 hours.',
    term_type: 'SCD',
    rxcui: '197530'
  },
  {
    name: 'Ofloxacin 200mg Oral Tablet',
    prescribable_name: 'Ofloxacin 200mg Oral Tablet',
    brand_names: ['Zenflox 200', 'Oflomac 200'],
    synonym: 'Zenflox 200',
    category: 'Fluoroquinolone Antibiotic',
    default_dosage: '200mg',
    default_frequency: '1-0-1 (BD)',
    default_duration: '5 days',
    default_instructions: 'With water',
    term_type: 'SCD',
    rxcui: '198038'
  },
  {
    name: 'Metronidazole 400mg Oral Tablet',
    prescribable_name: 'Metronidazole 400mg Oral Tablet',
    brand_names: ['Flagyl 400', 'Metrogyl 400'],
    synonym: 'Flagyl 400, Metrogyl 400',
    category: 'Antiprotozoal / Antibacterial',
    default_dosage: '400mg',
    default_frequency: '1-1-1 (TDS)',
    default_duration: '5 days',
    default_instructions: 'After food. Strictly avoid alcohol.',
    term_type: 'SCD',
    rxcui: '197967'
  },
  {
    name: 'Doxycycline 100mg Oral Capsule',
    prescribable_name: 'Doxycycline 100mg Oral Capsule',
    brand_names: ['Dox-100', 'Doxt-SL', 'Vibramycin'],
    synonym: 'Dox-100',
    category: 'Tetracycline Antibiotic',
    default_dosage: '100mg',
    default_frequency: '1-0-1',
    default_duration: '7 days',
    default_instructions: 'With a full glass of water, do not lie down for 30 mins',
    term_type: 'SCD',
    rxcui: '197637'
  },

  // Gastrointestinal & Antacids
  {
    name: 'Pantoprazole 40mg Gastro-Resistant Tablet',
    prescribable_name: 'Pantoprazole 40mg Gastro-Resistant Tablet',
    brand_names: ['Pan 40', 'Pantocid 40', 'Pantodac'],
    synonym: 'Pan 40, Pantocid 40',
    category: 'Proton Pump Inhibitor (PPI)',
    default_dosage: '40mg',
    default_frequency: '1-0-0 (OD)',
    default_duration: '7 days',
    default_instructions: 'Take 30 minutes before breakfast',
    term_type: 'SCD',
    rxcui: '284635'
  },
  {
    name: 'Pantoprazole 40mg + Domperidone 30mg Capsule',
    prescribable_name: 'Pantoprazole 40mg + Domperidone 30mg SR Capsule',
    brand_names: ['Pan-D', 'Pantocid-D SR', 'Dompan'],
    synonym: 'Pan-D, Pantocid-D',
    category: 'PPI + Antiemetic / Prokinetic',
    default_dosage: '1 Capsule',
    default_frequency: '1-0-0 (OD)',
    default_duration: '7 days',
    default_instructions: 'Empty stomach in morning',
    term_type: 'SBD',
    rxcui: '1092400'
  },
  {
    name: 'Omeprazole 20mg Delayed-Release Capsule',
    prescribable_name: 'Omeprazole 20mg Delayed-Release Capsule',
    brand_names: ['Omez 20', 'Prilosec'],
    synonym: 'Omez 20',
    category: 'Proton Pump Inhibitor (PPI)',
    default_dosage: '20mg',
    default_frequency: '1-0-0 (OD)',
    default_duration: '7 days',
    default_instructions: 'Before breakfast',
    term_type: 'SCD',
    rxcui: '213164'
  },
  {
    name: 'Rabeprazole 20mg Enteric-Coated Tablet',
    prescribable_name: 'Rabeprazole 20mg Enteric-Coated Tablet',
    brand_names: ['Razo 20', 'Rablet 20', 'Aciphex'],
    synonym: 'Razo 20, Rablet 20',
    category: 'Proton Pump Inhibitor (PPI)',
    default_dosage: '20mg',
    default_frequency: '1-0-0 (OD)',
    default_duration: '14 days',
    default_instructions: 'Morning empty stomach',
    term_type: 'SCD',
    rxcui: '284640'
  },
  {
    name: 'Domperidone 10mg Oral Tablet',
    prescribable_name: 'Domperidone 10mg Oral Tablet',
    brand_names: ['Domstal 10', 'Motilium'],
    synonym: 'Domstal 10',
    category: 'Antiemetic / Prokinetic',
    default_dosage: '10mg',
    default_frequency: '1-1-1',
    default_duration: '3 days',
    default_instructions: '15-30 minutes before meals',
    term_type: 'SCD',
    rxcui: '197629'
  },
  {
    name: 'Ondansetron 4mg Fast-Dissolving Tablet',
    prescribable_name: 'Ondansetron 4mg Fast-Dissolving Tablet',
    brand_names: ['Emeset 4 MD', 'Zofran', 'Vomikind 4'],
    synonym: 'Emeset 4, Vomikind',
    category: 'Antiemetic / Nausea & Vomiting',
    default_dosage: '4mg',
    default_frequency: '1-0-1 (or SOS)',
    default_duration: '2 days',
    default_instructions: 'Disperse on tongue or take with sip of water',
    term_type: 'SCD',
    rxcui: '228224'
  },
  {
    name: 'Antacid Suspension (Aluminum + Magnesium + Simethicone)',
    prescribable_name: 'Antacid Oral Suspension 200ml',
    brand_names: ['Gelusil MPS', 'Digene', 'Mucaine Gel'],
    synonym: 'Gelusil, Digene',
    category: 'Antacid / Heartburn Relief',
    default_dosage: '10ml',
    default_frequency: 'TDS (after meals)',
    default_duration: '5 days',
    default_instructions: 'Shake bottle well. Take after food.',
    term_type: 'SBD',
    rxcui: '313801'
  },
  {
    name: 'ORS (Oral Rehydration Salts) Electrolyte Powder',
    prescribable_name: 'Oral Rehydration Salts (WHO Formula) Powder',
    brand_names: ['Electral', 'Walyte', 'Prolyte'],
    synonym: 'Electral ORS, Electrolyte',
    category: 'Rehydration / Fluid Balance',
    default_dosage: '1 Sachet in 1 Liter water',
    default_frequency: 'Throughout day',
    default_duration: '2 days',
    default_instructions: 'Dissolve entire pack in 1 liter clean drinking water',
    term_type: 'GPCK',
    rxcui: '313802'
  },

  // Antiallergic, Respiratory & Cough
  {
    name: 'Cetirizine Hydrochloride 10mg Oral Tablet',
    prescribable_name: 'Cetirizine Hydrochloride 10mg Oral Tablet',
    brand_names: ['Cetzine', 'Alerid', 'Zyrtec', 'Okacet'],
    synonym: 'Cetzine, Alerid, Okacet',
    category: 'Antihistamine / Antiallergic',
    default_dosage: '10mg',
    default_frequency: '0-0-1 (Night)',
    default_duration: '5 days',
    default_instructions: 'At bedtime (may cause mild drowsiness)',
    term_type: 'SCD',
    rxcui: '310965'
  },
  {
    name: 'Levocetirizine 5mg Oral Tablet',
    prescribable_name: 'Levocetirizine 5mg Oral Tablet',
    brand_names: ['Levocet', 'Xyzal', 'Teczine'],
    synonym: 'Levocet 5, Xyzal',
    category: '2nd Generation Antihistamine',
    default_dosage: '5mg',
    default_frequency: '0-0-1 (Night)',
    default_duration: '5 days',
    default_instructions: 'Night at bedtime',
    term_type: 'SCD',
    rxcui: '352385'
  },
  {
    name: 'Montelukast 10mg + Levocetirizine 5mg Tablet',
    prescribable_name: 'Montelukast 10mg + Levocetirizine 5mg Tablet',
    brand_names: ['Montair-LC', 'Montek-LC', 'Telekast-L'],
    synonym: 'Montair-LC, Montek-LC',
    category: 'Leukotriene Receptor Antagonist + Antihistamine',
    default_dosage: '1 Tablet',
    default_frequency: '0-0-1 (Night)',
    default_duration: '10 days',
    default_instructions: 'Take at night after food',
    term_type: 'SBD',
    rxcui: '1092401'
  },
  {
    name: 'Dextromethorphan + Chlorpheniramine Cough Syrup',
    prescribable_name: 'Cough Syrup 100ml (Dry Cough Formulation)',
    brand_names: ['Ascoril-D', 'Benadryl DR', 'Alex Syrup'],
    synonym: 'Ascoril-D, Benadryl DR',
    category: 'Antitussive / Dry Cough',
    default_dosage: '10ml',
    default_frequency: '1-0-1',
    default_duration: '5 days',
    default_instructions: 'After meals with warm water',
    term_type: 'SBD',
    rxcui: '313803'
  },
  {
    name: 'Ambroxol + Levosalbutamol + Guaiphenesin Expectorant',
    prescribable_name: 'Expectorant Syrup 100ml (Wet / Productive Cough)',
    brand_names: ['Ascoril LS', 'Bro-Zedex LS'],
    synonym: 'Ascoril LS, Wet Cough Syrup',
    category: 'Mucolytic Expectorant',
    default_dosage: '10ml',
    default_frequency: '1-1-1 (TDS)',
    default_duration: '5 days',
    default_instructions: 'After food',
    term_type: 'SBD',
    rxcui: '313804'
  },
  {
    name: 'Salbutamol 100mcg Inhaler (Albuterol)',
    prescribable_name: 'Salbutamol 100mcg CFC-Free Inhaler (200 MDI doses)',
    brand_names: ['Asthalin Inhaler', 'Ventolin'],
    synonym: 'Asthalin Inhaler, Albuterol',
    category: 'Short-Acting Beta-2 Agonist (Bronchodilator)',
    default_dosage: '1-2 Puffs',
    default_frequency: 'SOS (as needed for breathlessness)',
    default_duration: '30 days',
    default_instructions: 'Inhale through mouth. Rinse mouth after use.',
    term_type: 'SCD',
    rxcui: '746763'
  },
  {
    name: 'Budesonide 200mcg Inhaler',
    prescribable_name: 'Budesonide 200mcg Metered Dose Inhaler',
    brand_names: ['Budecort 200 Inhaler', 'Pulmicort'],
    synonym: 'Budecort 200',
    category: 'Inhaled Corticosteroid / Asthma Controller',
    default_dosage: '1 Puff',
    default_frequency: '1-0-1 (BD)',
    default_duration: '30 days',
    default_instructions: 'Rinse mouth thoroughly with water after inhalation',
    term_type: 'SCD',
    rxcui: '308885'
  },

  // Cardiovascular & Hypertension
  {
    name: 'Amlodipine 5mg Oral Tablet',
    prescribable_name: 'Amlodipine 5mg Oral Tablet',
    brand_names: ['Amlong 5', 'Norvasc', 'Amlovas 5'],
    synonym: 'Amlong 5, Norvasc',
    category: 'Calcium Channel Blocker / Antihypertensive',
    default_dosage: '5mg',
    default_frequency: '1-0-0 (Morning)',
    default_duration: '30 days',
    default_instructions: 'Regular daily timing with or without food',
    term_type: 'SCD',
    rxcui: '197361'
  },
  {
    name: 'Telmisartan 40mg Oral Tablet',
    prescribable_name: 'Telmisartan 40mg Oral Tablet',
    brand_names: ['Telma 40', 'Micardis', 'Telvas 40'],
    synonym: 'Telma 40, Telvas',
    category: 'Angiotensin Receptor Blocker (ARB)',
    default_dosage: '40mg',
    default_frequency: '1-0-0 (Morning)',
    default_duration: '30 days',
    default_instructions: 'Every morning at fixed time',
    term_type: 'SCD',
    rxcui: '313170'
  },
  {
    name: 'Telmisartan 40mg + Amlodipine 5mg Tablet',
    prescribable_name: 'Telmisartan 40mg + Amlodipine 5mg Tablet',
    brand_names: ['Telma-AM', 'Twynsta', 'Telvas-AM'],
    synonym: 'Telma-AM',
    category: 'ARB + CCB Combination Antihypertensive',
    default_dosage: '1 Tablet',
    default_frequency: '1-0-0',
    default_duration: '30 days',
    default_instructions: 'Take once daily in the morning',
    term_type: 'SBD',
    rxcui: '1092402'
  },
  {
    name: 'Atorvastatin 10mg Film-Coated Tablet',
    prescribable_name: 'Atorvastatin 10mg Film-Coated Tablet',
    brand_names: ['Atorva 10', 'Lipitor', 'Storvas 10'],
    synonym: 'Atorva 10, Lipitor',
    category: 'HMG-CoA Reductase Inhibitor (Statin)',
    default_dosage: '10mg',
    default_frequency: '0-0-1 (Night)',
    default_duration: '30 days',
    default_instructions: 'Night at bedtime',
    term_type: 'SCD',
    rxcui: '259255'
  },
  {
    name: 'Atorvastatin 20mg Film-Coated Tablet',
    prescribable_name: 'Atorvastatin 20mg Film-Coated Tablet',
    brand_names: ['Atorva 20', 'Lipitor 20'],
    synonym: 'Atorva 20',
    category: 'Lipid-Lowering Statin',
    default_dosage: '20mg',
    default_frequency: '0-0-1 (Night)',
    default_duration: '30 days',
    default_instructions: 'Take at night',
    term_type: 'SCD',
    rxcui: '259256'
  },
  {
    name: 'Clopidogrel 75mg Oral Tablet',
    prescribable_name: 'Clopidogrel 75mg Oral Tablet',
    brand_names: ['Deplatt 75', 'Plavix', 'Clopilet 75'],
    synonym: 'Deplatt 75, Plavix',
    category: 'Antiplatelet Agent',
    default_dosage: '75mg',
    default_frequency: '1-0-0',
    default_duration: '30 days',
    default_instructions: 'Once daily with food',
    term_type: 'SCD',
    rxcui: '309362'
  },
  {
    name: 'Metoprolol Succinate 25mg Extended-Release Tablet',
    prescribable_name: 'Metoprolol Succinate 25mg Extended-Release Tablet',
    brand_names: ['Metolar-XR 25', 'Betaloc 25', 'Toprol-XL'],
    synonym: 'Metolar 25, Betaloc',
    category: 'Beta-1 Blocker / Cardiac',
    default_dosage: '25mg',
    default_frequency: '1-0-0',
    default_duration: '30 days',
    default_instructions: 'Swallow whole with food',
    term_type: 'SCD',
    rxcui: '866514'
  },

  // Diabetes & Endocrine
  {
    name: 'Metformin Hydrochloride 500mg Prolonged-Release Tablet',
    prescribable_name: 'Metformin Hydrochloride 500mg Prolonged-Release Tablet',
    brand_names: ['Glycomet 500 SR', 'Glucophage XR'],
    synonym: 'Glycomet 500, Glucophage',
    category: 'Oral Hypoglycemic / Biguanide',
    default_dosage: '500mg',
    default_frequency: '1-0-1 (BD)',
    default_duration: '30 days',
    default_instructions: 'With or immediately after meals to avoid GI upset',
    term_type: 'SCD',
    rxcui: '861004'
  },
  {
    name: 'Metformin Hydrochloride 850mg Tablet',
    prescribable_name: 'Metformin Hydrochloride 850mg Tablet',
    brand_names: ['Glycomet 850', 'Glucophage 850'],
    synonym: 'Glycomet 850',
    category: 'Antidiabetic Biguanide',
    default_dosage: '850mg',
    default_frequency: '1-0-1',
    default_duration: '30 days',
    default_instructions: 'With meals',
    term_type: 'SCD',
    rxcui: '861007'
  },
  {
    name: 'Glimepiride 1mg Oral Tablet',
    prescribable_name: 'Glimepiride 1mg Oral Tablet',
    brand_names: ['Amaryl 1mg', 'Glimestar 1'],
    synonym: 'Amaryl 1mg',
    category: 'Sulfonylurea Antidiabetic',
    default_dosage: '1mg',
    default_frequency: '1-0-0 (Morning)',
    default_duration: '30 days',
    default_instructions: 'Just before or with breakfast',
    term_type: 'SCD',
    rxcui: '252559'
  },
  {
    name: 'Glimepiride 2mg Oral Tablet',
    prescribable_name: 'Glimepiride 2mg Oral Tablet',
    brand_names: ['Amaryl 2mg', 'Glimestar 2'],
    synonym: 'Amaryl 2mg',
    category: 'Sulfonylurea Antidiabetic',
    default_dosage: '2mg',
    default_frequency: '1-0-0',
    default_duration: '30 days',
    default_instructions: 'With first meal of day',
    term_type: 'SCD',
    rxcui: '252560'
  },
  {
    name: 'Thyroxine Sodium 50mcg Oral Tablet',
    prescribable_name: 'Thyroxine Sodium 50mcg Oral Tablet',
    brand_names: ['Thyronorm 50', 'Eltroxin 50', 'Synthroid'],
    synonym: 'Thyronorm 50, Levothyroxine',
    category: 'Thyroid Hormone Replacement',
    default_dosage: '50mcg',
    default_frequency: '1-0-0 (Empty stomach)',
    default_duration: '30 days',
    default_instructions: 'First thing in morning with plain water, 45 mins before tea/breakfast',
    term_type: 'SCD',
    rxcui: '311354'
  },

  // Vitamins, Minerals & Supplements
  {
    name: 'Multivitamin + Zinc + Vitamin C Capsule',
    prescribable_name: 'Multivitamin and Mineral Nutritional Supplement',
    brand_names: ['Zincovit', 'Becosules Z', 'Supradyn'],
    synonym: 'Zincovit, Becosules',
    category: 'Dietary Supplement / Immunity',
    default_dosage: '1 Capsule',
    default_frequency: '0-1-0 (After lunch)',
    default_duration: '30 days',
    default_instructions: 'After lunch with water',
    term_type: 'GPCK',
    rxcui: '313805'
  },
  {
    name: 'B-Complex + Vitamin C Capsule',
    prescribable_name: 'Vitamin B-Complex with Vitamin C Capsule',
    brand_names: ['Becosules Capsule', 'Neurobion Forte'],
    synonym: 'Becosules, Neurobion',
    category: 'Vitamin Supplement / Mouth Ulcers / Nerve Health',
    default_dosage: '1 Capsule',
    default_frequency: '1-0-0',
    default_duration: '15 days',
    default_instructions: 'After food',
    term_type: 'GPCK',
    rxcui: '313806'
  },
  {
    name: 'Calcium 500mg + Vitamin D3 250 IU Tablet',
    prescribable_name: 'Calcium Carbonate 500mg + Vitamin D3 Tablet',
    brand_names: ['Shelcal 500', 'Cipcal 500'],
    synonym: 'Shelcal 500, Cipcal',
    category: 'Bone Mineral Supplement',
    default_dosage: '1 Tablet',
    default_frequency: '0-0-1',
    default_duration: '30 days',
    default_instructions: 'After dinner with milk or water',
    term_type: 'SBD',
    rxcui: '313807'
  },
  {
    name: 'Cholecalciferol 60000 IU Capsule (Vitamin D3)',
    prescribable_name: 'Cholecalciferol 60000 IU Oral Capsule / Sachet',
    brand_names: ['D3 Must 60K', 'Calcirol 60K', 'Uprise-D3 60K'],
    synonym: 'Vitamin D3 60K, Calcirol',
    category: 'High-Dose Vitamin D3',
    default_dosage: '1 Capsule',
    default_frequency: 'Once weekly (e.g. Every Sunday)',
    default_duration: '8 weeks',
    default_instructions: 'Take with warm milk or after main meal',
    term_type: 'SCD',
    rxcui: '313808'
  },

  // Topical & Eye/Ear Formulations
  {
    name: 'Povidone Iodine 5% Antiseptic Ointment',
    prescribable_name: 'Povidone Iodine 5% Top Ointment 20g',
    brand_names: ['Betadine Ointment', 'Cipladine'],
    synonym: 'Betadine, Cipladine',
    category: 'Topical Antiseptic / Wound Dressing',
    default_dosage: 'Apply thin layer',
    default_frequency: 'BD (twice daily)',
    default_duration: '7 days',
    default_instructions: 'Clean wound before applying. Cover with sterile dressing.',
    term_type: 'SCD',
    rxcui: '313809'
  },
  {
    name: 'Ciprofloxacin 0.3% Eye/Ear Drops 10ml',
    prescribable_name: 'Ciprofloxacin 0.3% Ophthalmic/Otic Drops',
    brand_names: ['Ciplox Eye Drops', 'Cifran Drops'],
    synonym: 'Ciplox Drops',
    category: 'Antibiotic Eye/Ear Drops',
    default_dosage: '1-2 Drops',
    default_frequency: 'TDS (3 times daily)',
    default_duration: '5 days',
    default_instructions: 'Instill into affected eye/ear. Do not touch dropper tip.',
    term_type: 'SCD',
    rxcui: '313810'
  },
  {
    name: 'Carboxymethylcellulose 0.5% Lubricant Eye Drops',
    prescribable_name: 'Carboxymethylcellulose 0.5% Eye Drops 10ml',
    brand_names: ['Refresh Tears', 'Tears Plus', 'Eco Tears'],
    synonym: 'Refresh Tears, Artificial Tears',
    category: 'Lubricant / Dry Eyes',
    default_dosage: '1-2 Drops',
    default_frequency: '4 times daily (QDS)',
    default_duration: '30 days',
    default_instructions: 'Instill when eyes feel dry or strained',
    term_type: 'SCD',
    rxcui: '313811'
  }
];

/**
 * Filter the local catalog with smart multi-token and prefix ranking.
 * Supports typing 1 to 3 letters (e.g. 'p', 'pa', 'par', 'am', 'ce', 'me', 'do').
 */
export function searchLocalMedicines(query, limit = 20) {
  if (!query) return [];
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  const startsWithMatches = [];
  const brandStartsWithMatches = [];
  const wordBoundaryMatches = [];
  const containsMatches = [];

  for (const med of MEDICINES_CATALOG) {
    const nameLower = med.name.toLowerCase();
    const prescribableLower = med.prescribable_name.toLowerCase();
    const synonymLower = (med.synonym || '').toLowerCase();
    const brandLower = (med.brand_names || []).join(' ').toLowerCase();

    // 1. Direct name startsWith query (e.g. 'par' -> 'Paracetamol...')
    if (nameLower.startsWith(cleanQ) || prescribableLower.startsWith(cleanQ)) {
      startsWithMatches.push(med);
      continue;
    }

    // 2. Direct brand startsWith query (e.g. 'dol' -> 'Dolo 650...', 'cro' -> 'Crocin...')
    if ((med.brand_names || []).some(b => b.toLowerCase().startsWith(cleanQ))) {
      brandStartsWithMatches.push(med);
      continue;
    }

    // 3. Word boundary match in name or synonym (e.g. 'para' in 'Tablet Paracetamol')
    const words = `${nameLower} ${synonymLower} ${brandLower}`.split(/[\s,()/-]+/);
    if (words.some(w => w.startsWith(cleanQ))) {
      wordBoundaryMatches.push(med);
      continue;
    }

    // 4. Substring contains
    if (nameLower.includes(cleanQ) || brandLower.includes(cleanQ) || synonymLower.includes(cleanQ)) {
      containsMatches.push(med);
    }
  }

  const combined = [
    ...startsWithMatches,
    ...brandStartsWithMatches,
    ...wordBoundaryMatches,
    ...containsMatches
  ];

  return combined.slice(0, limit);
}
