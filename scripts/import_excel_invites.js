const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

if (!url || !key) {
  console.error('Supabase URL or service role key missing in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

const excelPath = 'C:\\Users\\minko\\Downloads\\REPONSE FORMULAIRE 2026  .xlsx';
if (!fs.existsSync(excelPath)) {
  console.error('Excel file not found at:', excelPath);
  process.exit(1);
}

const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets['APP'];
if (!ws) {
  console.error("Sheet 'APP' not found in workbook!");
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const monthsFr = {
  janvier: '01', fevrier: '02', 'février': '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', aout: '08', 'août': '08',
  septembre: '09', octobre: '10', novembre: '11', decembre: '12', 'décembre': '12'
};

function parseDate(val) {
  if (!val) return '2026-01-01';
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return '2026-01-01';
    return d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0');
  }
  let s = String(val).trim().toLowerCase();
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m1) {
    let year = m1[3];
    if (year.length === 2) year = '20' + year;
    return year + '-' + String(m1[2]).padStart(2, '0') + '-' + String(m1[1]).padStart(2, '0');
  }
  const m2 = s.match(/^(\d{1,2})\s+([a-z\u00C0-\u017F]+)\s+(\d{4})$/);
  if (m2 && monthsFr[m2[2]]) {
    return m2[3] + '-' + monthsFr[m2[2]] + '-' + String(m2[1]).padStart(2, '0');
  }
  return s;
}

function normalizePhone(p) {
  if (!p) return '';
  return String(p).replace(/[^0-9]/g, '');
}

function normalizeName(str) {
  return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function run() {
  console.log('Fetching existing invites and columns from database...');
  const { data: dbInvites, error: errDb } = await supabase.from('invites').select('*');
  if (errDb) {
    console.error('Error fetching DB invites:', errDb);
    process.exit(1);
  }
  console.log('Existing invites in DB:', dbInvites.length);

  const dbKeys = new Set();
  for (const d of dbInvites) {
    const p = normalizePhone(d.phone);
    if (p && p.length >= 8) dbKeys.add(p.slice(-8));
    const nameKey = normalizeName(d.last_name) + '|' + normalizeName(d.first_name);
    if (nameKey !== '|') dbKeys.add(nameKey);
  }

  const allowedColumns = new Set(Object.keys(dbInvites[0] || {}));

  const seenInExcel = new Set();
  const toInsert = [];
  const skipped = [];

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || (!row[3] && !row[4] && !row[9])) continue;

    const rawNom = String(row[3] || '').trim();
    const rawPrenom = String(row[4] || '').trim();
    const rawPhone = String(row[9] || '').trim();
    const cleanPhone = normalizePhone(rawPhone);
    const nameKey = normalizeName(rawNom) + '|' + normalizeName(rawPrenom);

    // Duplicate check inside Excel
    const excelKey = cleanPhone && cleanPhone.length >= 8 ? cleanPhone.slice(-8) : nameKey;
    if (seenInExcel.has(excelKey)) {
      skipped.push({ row: i, nom: rawNom, prenom: rawPrenom, reason: 'Doublon interne dans la feuille Excel' });
      continue;
    }
    seenInExcel.add(excelKey);

    // Skip if already in database (as requested by user)
    const isAlreadyInDb = (cleanPhone && cleanPhone.length >= 8 && dbKeys.has(cleanPhone.slice(-8))) ||
                          (nameKey !== '|' && dbKeys.has(nameKey));
    if (isAlreadyInDb) {
      skipped.push({ row: i, nom: rawNom, prenom: rawPrenom, phone: rawPhone, reason: 'Déjà présent dans l’application (ignoré)' });
      continue;
    }

    // Mapping fields
    let civ = String(row[2] || '').trim();
    if (civ !== 'M.' && civ !== 'Mme.' && civ !== 'Mlle.') civ = 'M.';

    const arrivalDate = parseDate(row[0]);
    const event = String(row[1] || 'Culte').trim();
    
    // Address combination
    const street = String(row[5] || '').trim();
    const cp = String(row[6] || '').trim();
    const city = String(row[7] || '').trim();
    const addrParts = [];
    if (street && street !== 'RAS' && street !== '///' && street !== '/') addrParts.push(street);
    if (cp && cp !== 'RAS' && cp !== '///' && cp !== '/' && !street.includes(cp)) addrParts.push(cp);
    if (city && city !== 'RAS' && city !== '///' && city !== '/' && !street.toLowerCase().includes(city.toLowerCase())) addrParts.push(city);
    const address = addrParts.join(', ');

    const pays = String(row[8] || 'Belgique').trim();
    const email = String(row[10] || '').trim().toLowerCase();
    const etatCivil = String(row[11] || 'Célibataire').trim();
    let age = String(row[12] || 'Sans objet').trim().replace('Moins de 18  ans', 'Moins de 18 ans');
    if (!age) age = 'Sans objet';

    const aEteInvite = Boolean(row[13] && String(row[13]).trim() !== 'Non' && String(row[13]).trim() !== 'Personne');
    const parQui = String(row[14] || (row[13] && row[13] !== 'Une connaissance' ? row[13] : '')).trim();

    const isLocalChurch = row[15] === 'Oui' || row[15] === 'Autre église ICC';
    const baptemeEau = row[16] === 'Oui';
    const souhaiteContact = row[17] === 'Oui';
    const interetFormation = row[18] === 'Oui' || Number(row[37]) === 1;
    const interetCdm = row[19] === 'Oui' || Number(row[30]) === 1;
    const interetEvent = row[20] === 'Oui' || Number(row[34]) === 1;
    const aps = Boolean(row[21] && String(row[21]).toLowerCase().includes('oui'));
    
    // Commentaire
    const rawComment = String(row[22] || '').trim();
    const commentParts = [];
    if (row[15] === 'Autre église ICC') commentParts.push("[Autre église: Autre église ICC]");
    if (rawComment) commentParts.push(rawComment);
    const commentaire = commentParts.join(' ').trim();

    // Checkpoints
    const appelAbouti = Number(row[23]) === 1;
    const groupeWhatsapp = Number(row[24]) === 1;
    const binomeCree = Number(row[25]) === 1;
    const prevuRevenir = Number(row[26]) === 1;
    const estRevenuCulte = Number(row[27]) === 1;
    const rencontreEffectuee = Number(row[28]) === 1;
    const visiteDomicile = Number(row[29]) === 1;
    const integreCdm = Number(row[31]) === 1;
    const priere = Number(row[32]) === 1;
    const prierePartage = Number(row[33]) === 1;
    const eventOk = Number(row[35]) === 1;
    const cocktailBienvenue = Number(row[36]) === 1;
    const pcnc = Number(row[38]) === 1;
    const p101 = Number(row[39]) === 1;
    const p201 = Number(row[40]) === 1;
    const terminePcnc = Number(row[41]) === 1;
    const veutServir = Number(row[42]) === 1;
    const devenuStar = Number(row[43]) === 1;

    // Status
    const rawStatut = String(row[45] || '').trim();
    let statutAffectation = 'a_affecter';
    if (rawStatut.includes('pas réussie')) {
      statutAffectation = 'sans_suite';
    } else if (rawStatut.includes('réussie') || rawStatut.includes('en cours')) {
      statutAffectation = 'conserve';
    } else if (appelAbouti) {
      statutAffectation = 'conserve';
    }

    const commMembre = String(row[48] || '').trim();
    const extraTags = [];
    if (statutAffectation === 'conserve') extraTags.push('[STATUT:conserve]');
    if (statutAffectation === 'sans_suite') extraTags.push('[STATUT:sans_suite]');
    if (binomeCree) extraTags.push('[BINOME:oui]');
    if (eventOk) extraTags.push('[EVENEMENT_OK:oui]');
    if (commMembre) extraTags.push(commMembre);
    const commentaireSuivi = extraTags.join(' ').trim();

    const attendance = {};
    if (arrivalDate && /^\d{4}-\d{2}-\d{2}$/.test(arrivalDate)) {
      attendance[arrivalDate] = true;
    }

    const candidate = {
      church_id: 'acc82880-d63d-4c99-8b32-1c45fed488e0',
      bergerie_id: null,
      responsible: 'Non assigné',
      assigned_to: null,
      civility: civ,
      last_name: rawNom || 'Invité',
      first_name: rawPrenom || '-',
      age,
      phone: rawPhone,
      email,
      address,
      pays,
      arrival_date: arrivalDate,
      event,
      etat_civil: etatCivil,
      local_church: isLocalChurch,
      bapteme_eau: baptemeEau,
      souhaite_etre_contacte: souhaiteContact,
      interet_formation: interetFormation,
      interet_cdm: interetCdm,
      interet_evenement: interetEvent,
      aps,
      a_ete_invite: aEteInvite,
      par_qui: parQui,
      commentaire,
      commentaire_suivi: commentaireSuivi,
      statut_affectation: statutAffectation,
      appel_abouti: appelAbouti,
      groupe_whatsapp: groupeWhatsapp,
      prevu_revenir: prevuRevenir,
      est_revenu_culte: estRevenuCulte,
      rencontre_effectuee: rencontreEffectuee,
      visite_domicile: visiteDomicile,
      integre_cdm: integreCdm,
      priere,
      priere_partage: prierePartage,
      cocktail_bienvenue: cocktailBienvenue,
      pcnc,
      p101,
      p201,
      termine_pcnc: terminePcnc,
      veut_servir: veutServir,
      devenu_star: devenuStar,
      attendance,
      is_in_bergerie: false,
      archived: false,
      famille_disciple: 'AUCUNE'
    };

    // Filter to only existing columns in table
    const safePayload = {};
    for (const [k, v] of Object.entries(candidate)) {
      if (allowedColumns.has(k)) {
        safePayload[k] = v;
      }
    }

    toInsert.push(safePayload);
  }

  console.log(`Prêt à insérer ${toInsert.length} nouveaux invités (${skipped.length} ignorés car déjà présents ou doublons).`);

  // Batch insert into Supabase
  const batchSize = 25;
  let insertedTotal = 0;

  for (let b = 0; b < toInsert.length; b += batchSize) {
    const chunk = toInsert.slice(b, b + batchSize);
    const { data: inserted, error: insertErr } = await supabase.from('invites').insert(chunk).select('id');
    if (insertErr) {
      console.error(`Erreur d'insertion sur le lot ${b + 1}-${b + chunk.length}:`, insertErr);
      process.exit(1);
    }
    insertedTotal += (inserted ? inserted.length : chunk.length);
    console.log(`Lot ${Math.floor(b / batchSize) + 1}/${Math.ceil(toInsert.length / batchSize)} inséré (${insertedTotal}/${toInsert.length}).`);
  }

  console.log('\n--- SUCCÈS ---');
  console.log(`Total insérés avec succès : ${insertedTotal}`);

  const { count: finalCount } = await supabase.from('invites').select('*', { count: 'exact', head: true });
  console.log(`Nombre total d'invités dans la base désormais : ${finalCount}`);
}

run().catch(err => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
