import { Vector3, Quaternion } from 'three';

// ---------------------------------------------------------------------------
// dice_v01.glb facts (decoded from the Draco geometry)
// ---------------------------------------------------------------------------
// The model is a real-world-scale die: a near perfect cube centred on the
// origin with a half-extent of ~0.008309 units (≈16.6 mm edge).
export const MODEL_HALF = 0.008309;

// Scale we blow the model up by so it is a comfortable ~1.16 unit cube on
// screen and easy for the physics solver to deal with.
export const SCALE = 70;

// Collider / visual half-extent in world units after scaling.
export const HALF = MODEL_HALF * SCALE; // ≈ 0.5816

// ---------------------------------------------------------------------------
// Face -> pip-count mapping.
// Determined by decoding the white-pip primitive and counting pip clusters on
// each face of the local mesh axes (opposite faces correctly sum to 7):
//   +X = 2   -X = 5   +Y = 3   -Y = 4   +Z = 1   -Z = 6
// The number that is *shown* is the value on the face pointing up (+world Y).
// ---------------------------------------------------------------------------
export const FACES = [
  { normal: new Vector3(1, 0, 0), value: 2 },
  { normal: new Vector3(-1, 0, 0), value: 5 },
  { normal: new Vector3(0, 1, 0), value: 3 },
  { normal: new Vector3(0, -1, 0), value: 4 },
  { normal: new Vector3(0, 0, 1), value: 1 },
  { normal: new Vector3(0, 0, -1), value: 6 }
];

const _q = new Quaternion();
const _v = new Vector3();

/**
 * Given a die orientation (a rapier rotation {x,y,z,w}), return the pip value
 * on the face currently pointing up, plus how "settled" that face is
 * (dot of the up-face normal with world-up; 1 = perfectly flat).
 */
export function readTopFace(rotation) {
  _q.set(rotation.x, rotation.y, rotation.z, rotation.w);
  let best = null;
  let bestY = -Infinity;
  for (const face of FACES) {
    _v.copy(face.normal).applyQuaternion(_q);
    if (_v.y > bestY) {
      bestY = _v.y;
      best = face;
    }
  }
  return { value: best.value, alignment: bestY };
}
