// Controlla gare.json e versione.json prima che l'app Pace Off li scarichi.
// Gira su GitHub a ogni modifica (.github/workflows/controlla.yml), anche
// sulle pull request della routine mensile: un file sbagliato si ferma qui.
// Le regole sono quelle dell'app (src/services/gare.js e
// src/aggiornamento/regole.js nel repository dell'app), un po' piu' severe:
// l'app scarta in silenzio, qui si dice cosa non va.
//
// Uso: node controlla.mjs

import { readFileSync, statSync } from 'node:fs';

const errori = [];
const sbaglia = (m) => errori.push(m);

const DISTANZE = ['5k', '10k', 'mezza', 'maratona'];
const MASSIMO_GARE = 300;
const MASSIMO_TESTO = 80;
const MASSIMO_BYTE = 200 * 1024;

const dataVera = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, g] = s.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g;
};
const testo = (x) => typeof x === 'string' && x.trim().length > 0 && x.length <= MASSIMO_TESTO && !/[<>{}\u0000-\u001f]/.test(x);

function leggi(nome) {
  try {
    return JSON.parse(readFileSync(nome, 'utf8'));
  } catch (e) {
    sbaglia(`${nome}: non e' JSON valido (${e.message})`);
    return null;
  }
}

/* ------------------------------------------------------------ gare.json */

if (statSync('gare.json').size > MASSIMO_BYTE) sbaglia(`gare.json: piu' di ${MASSIMO_BYTE} byte, l'app lo scarterebbe`);
const gare = leggi('gare.json');
const fonti = leggi('fonti.json');
if (gare) {
  const chiavi = Object.keys(gare).sort().join(',');
  if (chiavi !== 'aggiornato,gare') sbaglia(`gare.json: le chiavi devono essere solo aggiornato e gare (ci sono: ${chiavi})`);
  if (!dataVera(gare.aggiornato)) sbaglia(`gare.json: aggiornato non e' una data vera (${gare.aggiornato})`);
  const elenco = Array.isArray(gare.gare) ? gare.gare : (sbaglia('gare.json: gare non e\' un elenco'), []);
  if (elenco.length === 0) sbaglia('gare.json: nessuna gara');
  if (elenco.length > MASSIMO_GARE) sbaglia(`gare.json: ${elenco.length} gare, l'app ne legge al massimo ${MASSIMO_GARE}`);
  // Al massimo diciotto mesi da quando e' aggiornato, come nell'app.
  const limite = new Date(`${dataVera(gare.aggiornato) ? gare.aggiornato : new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  limite.setUTCMonth(limite.getUTCMonth() + 18);
  const fino = limite.toISOString().slice(0, 10);
  const confermate = new Set((Array.isArray(fonti) ? fonti : [])
    .filter((f) => f && f.data_confermata === true).map((f) => `${f.nome}|${f.data}`));
  const viste = new Set();
  let prima = '';
  elenco.forEach((g, i) => {
    const dove = `gare.json, gara ${i + 1}${g && g.nome ? ` (${g.nome})` : ''}`;
    if (!g || typeof g !== 'object') { sbaglia(`${dove}: non e' un oggetto`); return; }
    const extra = Object.keys(g).filter((k) => !['nome', 'citta', 'distanza', 'data'].includes(k));
    if (extra.length) sbaglia(`${dove}: campi che l'app non conosce (${extra.join(', ')})`);
    if (!testo(g.nome)) sbaglia(`${dove}: nome mancante, troppo lungo o con caratteri strani`);
    if (g.citta !== undefined && !testo(g.citta)) sbaglia(`${dove}: citta' troppo lunga o con caratteri strani`);
    if (!DISTANZE.includes(g.distanza)) sbaglia(`${dove}: distanza "${g.distanza}" (ammesse: ${DISTANZE.join(', ')})`);
    if (!dataVera(g.data)) sbaglia(`${dove}: data impossibile o nel formato sbagliato (${g.data})`);
    else {
      if (g.data > fino) sbaglia(`${dove}: ${g.data} e' oltre diciotto mesi, l'app la scarterebbe`);
      if (dataVera(gare.aggiornato) && g.data < gare.aggiornato) sbaglia(`${dove}: ${g.data} e' gia' passata il giorno dell'aggiornamento`);
      if (g.data < prima) sbaglia(`${dove}: non in ordine di data (${g.data} dopo ${prima})`);
      prima = g.data;
    }
    const k = `${g.nome}|${g.data}`;
    if (viste.has(k)) sbaglia(`${dove}: doppia`);
    viste.add(k);
    if (fonti && !confermate.has(k)) sbaglia(`${dove}: in fonti.json non c'e' con la stessa data e data_confermata true`);
  });
}

/* ---------------------------------------------------------- versione.json */

const v = leggi('versione.json');
if (v) {
  const ammesse = ['buildMinima', 'buildMinimaTestFlight', 'garminMinima', 'campoMinima'];
  for (const k of Object.keys(v)) if (!ammesse.includes(k)) sbaglia(`versione.json: chiave sconosciuta ${k}`);
  // Una build e' data e ora (2611091621): 0 vuol dire nessun blocco.
  const build = (n) => n === 0 || (Number.isInteger(n) && /^2[5-9]\d{8}$/.test(String(n)));
  for (const k of ['buildMinima', 'buildMinimaTestFlight']) {
    if (v[k] !== undefined && !build(v[k])) sbaglia(`versione.json: ${k} deve essere 0 o un numero di build come 2611091621 (c'e' ${v[k]})`);
  }
  if (!Number.isInteger(v.buildMinima)) sbaglia('versione.json: manca buildMinima');
  for (const k of ['garminMinima', 'campoMinima']) {
    if (v[k] !== undefined && !(Number.isInteger(v[k]) && v[k] > 0 && v[k] < 1e6)) sbaglia(`versione.json: ${k} deve essere un intero fra 1 e 999999 (c'e' ${v[k]})`);
  }
}

if (errori.length) {
  console.error(`Da correggere (${errori.length}):`);
  errori.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}
console.log(`Tutto a posto: ${gare?.gare?.length ?? 0} gare, versione.json valido.`);
