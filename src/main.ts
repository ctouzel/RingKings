import './ui/style.css';
import type { Boxer } from './model/types';
import { ATTRIBUTE_KEYS } from './model/types';
import { ageOn, displayName, emptyCareerStats, overallRating, recordString } from './model/boxer';
import { ATTRIBUTE_LABEL, NATIONALITY_INFO, STANCE_LABEL, STYLE_INFO, WEIGHT_CLASS_INFO } from './model/labels';

// Étape 1 : deux boxeurs créés à la main pour visualiser le modèle.
// À l'étape 2, le générateur produira les 50 boxeurs de la ligue.
const TODAY = '2026-01-01';

const sample: Boxer[] = [
  {
    id: 'bx_0001', firstName: 'Marcel', lastName: 'Tremblay', nickname: 'Le Bulldozer',
    nationality: 'CA', hometown: 'Québec', birthDate: '1997-05-12',
    heightCm: 178, reachCm: 183, weightClass: 'middleweight', stance: 'orthodox', style: 'slugger',
    attributes: { power: 88, handSpeed: 62, accuracy: 66, defense: 55, footwork: 52, chin: 84, stamina: 74, recovery: 78, ringIQ: 60 },
    development: { potential: 82, peakAge: 29, wear: 12 },
    appearance: { skinTone: 0, hairStyle: 1, hairColor: 2, trunksColor: '#c0392b', glovesColor: '#e74c3c', build: 'bulky', facialHair: 2 },
    popularity: 64, status: 'active',
    stats: { ...emptyCareerStats(), fights: 23, wins: 21, losses: 2, koWins: 17, koLosses: 1 },
    fightIds: [],
  },
  {
    id: 'bx_0002', firstName: 'Yusuf', lastName: 'Adeyemi',
    nationality: 'NG', hometown: 'Lagos', birthDate: '2000-09-03',
    heightCm: 185, reachCm: 196, weightClass: 'middleweight', stance: 'southpaw', style: 'outBoxer',
    attributes: { power: 64, handSpeed: 86, accuracy: 80, defense: 82, footwork: 88, chin: 66, stamina: 80, recovery: 70, ringIQ: 77 },
    development: { potential: 90, peakAge: 28, wear: 3 },
    appearance: { skinTone: 4, hairStyle: 0, hairColor: 0, trunksColor: '#2e86de', glovesColor: '#f5f6fa', build: 'slim', facialHair: 0 },
    popularity: 41, status: 'active',
    stats: { ...emptyCareerStats(), fights: 16, wins: 16, koWins: 7 },
    fightIds: [],
  },
];

function boxerCard(b: Boxer, corner: 'red' | 'blue'): string {
  const nat = NATIONALITY_INFO[b.nationality];
  const attrs = ATTRIBUTE_KEYS.map((k) => `
    <div class="attr"><span>${ATTRIBUTE_LABEL[k]}</span>
      <div class="bar"><span style="width:${b.attributes[k]}%"></span></div>
      <span>${b.attributes[k]}</span></div>`).join('');
  return `
    <article class="card ${corner}">
      <span class="ovr">${overallRating(b)}</span>
      <h2>${displayName(b)}</h2>
      <div class="sub">${nat.flag} ${b.hometown}, ${nat.country} · ${ageOn(b.birthDate, TODAY)} ans</div>
      <div class="tags">
        <span class="tag">${WEIGHT_CLASS_INFO[b.weightClass].label}</span>
        <span class="tag">${STYLE_INFO[b.style].label}</span>
        <span class="tag">${STANCE_LABEL[b.stance]}</span>
        <span class="tag">${b.heightCm} cm · allonge ${b.reachCm} cm</span>
      </div>
      <div class="record">${recordString(b.stats)}</div>
      ${attrs}
    </article>`;
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><h1>RINGKINGS</h1></header>
  <main>${boxerCard(sample[0]!, 'red')}${boxerCard(sample[1]!, 'blue')}</main>
`;
