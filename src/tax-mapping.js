/**
 * GnuCash Web — Tax Line Mapping Configuration
 *
 * Maps GnuCash account codes to CRA T2125 line numbers.
 * This is the single source of truth for the tax report view.
 *
 * Structure:
 *   - t2125Lines:    Reference data for all T2125 expense/revenue lines
 *   - accountMap:    Maps GnuCash account codes → T2125 line(s)
 *   - specialRules:  Business-specific rules (meal deduction %, home office %, etc.)
 */

/** ──────────────────────────────────────────────────────────────
 *  T2125 LINE DEFINITIONS
 *  Complete reference of lines used on the T2125 form.
 *  ────────────────────────────────────────────────────────────── */
export const t2125Lines = {
  // ── Part 3: Revenue ──
  8000: { label: 'Ventes brutes / Honoraires', labelEn: 'Gross sales / Professional fees', section: 'revenue', part: '3A' },
  8230: { label: 'Autres revenus', labelEn: 'Other income', section: 'revenue', part: '3C' },
  8299: { label: 'Revenu brut total', labelEn: 'Gross business income', section: 'revenue', part: '3C', computed: true },

  // ── Part 4: Expenses ──
  8521: { label: 'Publicité', labelEn: 'Advertising', section: 'expense', part: '4' },
  8523: { label: 'Repas et représentation', labelEn: 'Meals and entertainment', section: 'expense', part: '4', deductionRate: 0.50 },
  8590: { label: 'Créances irrécouvrables', labelEn: 'Bad debts', section: 'expense', part: '4' },
  8690: { label: 'Assurances', labelEn: 'Insurance', section: 'expense', part: '4' },
  8710: { label: 'Intérêts et frais bancaires', labelEn: 'Interest and bank charges', section: 'expense', part: '4' },
  8760: { label: 'Taxes, licences et permis', labelEn: 'Business taxes, licences, memberships', section: 'expense', part: '4' },
  8810: { label: 'Frais de bureau', labelEn: 'Office expenses', section: 'expense', part: '4' },
  8811: { label: 'Fournitures', labelEn: 'Supplies', section: 'expense', part: '4' },
  8860: { label: 'Honoraires professionnels', labelEn: 'Professional fees', section: 'expense', part: '4' },
  8871: { label: 'Frais de gestion et admin.', labelEn: 'Management and administration fees', section: 'expense', part: '4' },
  8910: { label: 'Loyer', labelEn: 'Rent', section: 'expense', part: '4' },
  8960: { label: 'Entretien et réparations', labelEn: 'Repairs and maintenance', section: 'expense', part: '4' },
  9060: { label: 'Salaires et avantages', labelEn: 'Salaries, wages, and benefits', section: 'expense', part: '4' },
  9180: { label: 'Impôts fonciers', labelEn: 'Property taxes', section: 'expense', part: '4' },
  9200: { label: 'Frais de déplacement', labelEn: 'Travel', section: 'expense', part: '4' },
  9220: { label: 'Services publics', labelEn: 'Utilities', section: 'expense', part: '4' },
  9224: { label: 'Carburant (équipement)', labelEn: 'Fuel costs (equipment)', section: 'expense', part: '4' },
  9275: { label: 'Livraison, messagerie', labelEn: 'Delivery, freight, and express', section: 'expense', part: '4' },
  9281: { label: 'Frais de véhicule moteur', labelEn: 'Motor vehicle expenses', section: 'expense', part: '4' },
  9270: { label: 'Autres dépenses', labelEn: 'Other expenses', section: 'expense', part: '4' },
  9369: { label: 'Revenu net avant ajustements', labelEn: 'Net income before adjustments', section: 'result', part: '5', computed: true },

  // ── Part 6: CCA ──
  9936: { label: 'Déduction pour amortissement (DPA)', labelEn: 'Capital cost allowance (CCA)', section: 'cca', part: '6' },

  // ── Part 7: Home office ──
  9945: { label: 'Bureau à domicile', labelEn: 'Business use of home', section: 'home_office', part: '7' },
};


/** ──────────────────────────────────────────────────────────────
 *  ACCOUNT → T2125 LINE MAPPING
 *
 *  Keys are GnuCash account codes (string).
 *  Values are T2125 line numbers (integer).
 *
 *  Accounts without a code here will appear as "Non classé"
 *  in the tax report and can be mapped interactively.
 *  ────────────────────────────────────────────────────────────── */
export const accountMap = {
  // ── REVENUS ──
  '4100': 8000,   // Consultation → Ventes brutes
  '4200': 8000,   // SplitboardQC.ca → Ventes brutes
  '4210': 8000,   // Location d'ensembles → Ventes brutes
  '4220': 8000,   // Réparations / dommages facturés → Ventes brutes
  '4230': 8000,   // Vente splitboards usagés → Ventes brutes
  '4300': 8230,   // Autres revenus → Autres revenus

  // ── CHARGES COMMUNES (5010–5020) ──
  '5011': 9220,   // Internet et téléphone → Services publics
  '5012': 8810,   // Licence logiciel / abonnements → Frais de bureau
  '5013': 8810,   // Fournitures de bureau → Frais de bureau
  '5014': 9270,   // Formation → Autres dépenses
  '5015': 8710,   // Frais bancaires et services → Intérêts et frais bancaires
  '5016': 9275,   // Livraison et expédition → Livraison, messagerie
  '5017': 8521,   // Publicité / marketing → Publicité
  '5018': 8690,   // Assurances → Assurances
  '5019': 8860,   // Honoraires professionnels → Honoraires professionnels
  '5020': 8811,   // Multimédia / équipement léger → Fournitures

  // ── CHARGES CONSULTATION (5100–5118) ──
  '5111': 9281,   // Essence → Frais de véhicule moteur
  '5112': 9281,   // Véhicule (entretien, immatriculation) → Frais de véhicule moteur
  '5113': 8523,   // Repas et représentation → Repas et représentation (50%)
  '5114': 9200,   // Congrès et événements → Frais de déplacement
  '5115': 9270,   // Droit d'accès et activités → Autres dépenses
  '5116': 9200,   // Déplacements / transport → Frais de déplacement
  '5117': 8811,   // Fournitures et matériel → Fournitures
  '5118': 8710,   // Frais de paiement – Stripe → Intérêts et frais bancaires

  // ── CHARGES SPLITBOARDQC (5200–5219) ──
  '5211': 8811,   // Achats d'équipement et pièces → Fournitures
  '5212': 8811,   // Fournitures et pièces → Fournitures
  '5213': 8871,   // Frais de service (atelier) → Frais de gestion et admin.
  '5214': 9275,   // Livraison et expédition → Livraison, messagerie
  '5215': 9200,   // Déplacements (récupération/livraison) → Frais de déplacement
  '5216': 8521,   // Marketing / site web → Publicité
  '5217': 8710,   // Frais de paiement - Stripe → Intérêts et frais bancaires
  '5218': 8960,   // Nettoyage / remise en état → Entretien et réparations
  '5219': 8871,   // Frais de service - Sherbrooke → Frais de gestion et admin.

  // ── AMORTISSEMENT (5300) ──
  '5311': 9936,   // Dotation – SplitboardQC.ca → DPA
  '5312': 9936,   // Dotation – Consultation → DPA

  // ── NON CLASSÉ ──
  '5900': 9270,   // Dépenses diverses non classées → Autres dépenses
};


/** ──────────────────────────────────────────────────────────────
 *  SPECIAL RULES
 *  Business-specific deduction rules and parameters.
 *  ────────────────────────────────────────────────────────────── */
export const specialRules = {
  /** Meal & entertainment deduction rate (CRA standard = 50%) */
  mealDeductionRate: 0.50,

  /**
   * Business use of home percentage.
   * Set to 0 to disable the home office deduction.
   * Adjust to the actual % of the residence used for business.
   */
  homeOfficePercent: 0,

  /**
   * Motor vehicle business use percentage.
   * Applied to total vehicle expenses to get the deductible portion.
   * Set to 1.0 if the vehicle is 100% business use.
   */
  vehicleBusinessPercent: 1.0,

  /** NAICS industry code (for T2125 Part 1) */
  naicsCode: '541510',

  /** Fiscal year */
  fiscalYearEnd: '12-31',
};


/** ──────────────────────────────────────────────────────────────
 *  HELPER: Resolve a GnuCash account code to its T2125 line.
 *  Returns null if unmapped.
 *  ────────────────────────────────────────────────────────────── */
export function resolveT2125Line(accountCode) {
  if (!accountCode) return null;
  const code = String(accountCode);

  // Direct match
  if (accountMap[code] !== undefined) {
    return accountMap[code];
  }

  // Try parent code (first 4 chars → first 3 → first 2)
  for (let len = code.length - 1; len >= 2; len--) {
    const prefix = code.substring(0, len) + '0'.repeat(code.length - len);
    if (accountMap[prefix] !== undefined) {
      return accountMap[prefix];
    }
  }

  return null;
}


/** ──────────────────────────────────────────────────────────────
 *  HELPER: Get the T2125 line definition object.
 *  ────────────────────────────────────────────────────────────── */
export function getT2125LineDef(lineNumber) {
  return t2125Lines[lineNumber] || null;
}


/** ──────────────────────────────────────────────────────────────
 *  HELPER: Get all T2125 lines for a given section.
 *  ────────────────────────────────────────────────────────────── */
export function getLinesBySection(section) {
  return Object.entries(t2125Lines)
    .filter(([, def]) => def.section === section && !def.computed)
    .map(([line, def]) => ({ line: Number(line), ...def }));
}
