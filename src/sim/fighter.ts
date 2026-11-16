import { fullName } from '../model/boxer';
import type { Boxer } from '../model/types';
import type { Fighter } from './engine';

/** Instantané d'un boxeur pour le moteur (copie : le combat ne modifie pas la ligue). */
export function fighterFromBoxer(b: Boxer): Fighter {
  return {
    name: fullName(b),
    attributes: { ...b.attributes },
    style: b.style,
    stance: b.stance,
    reachCm: b.reachCm,
  };
}
