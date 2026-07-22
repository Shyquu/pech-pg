import { MeshPhysicalMaterial, Color } from 'three';

// Singletons — every die shares one green + one white material instance.
let _green;
let _white;
export function greenResin() {
  return (_green ??= createGreenResin());
}
export function glossyWhite() {
  return (_white ??= createGlossyDiffuseWhite());
}

// Body: "translucent resin like" green, #53A34A.
// Modelled with physical transmission so light passes through the resin, with
// a green attenuation tint building up through its thickness.
export function createGreenResin() {
  return new MeshPhysicalMaterial({
    color: new Color('#53A34A'),
    metalness: 0.0,
    roughness: 0.18,
    transmission: 0.95, // let light pass through -> translucent
    thickness: 0.7, // ~ die size, drives the volumetric tint
    ior: 1.5, // typical cured-resin index of refraction
    attenuationColor: new Color('#53A34A'),
    attenuationDistance: 2.4,
    clearcoat: 0.4, // slight wet/cast-resin surface sheen
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.35,
    transparent: true
  });
}

// Pips: "a 50/50 shader mix of Glossy and Diffuse white".
// Interpreted as a white diffuse base with a half-strength glossy specular
// layer on top (clearcoat = 0.5) — i.e. half the response is sharp reflection,
// half is matte diffuse.
export function createGlossyDiffuseWhite() {
  return new MeshPhysicalMaterial({
    color: new Color('#ffffff'),
    metalness: 0.0,
    roughness: 0.5, // the diffuse half
    clearcoat: 0.5, // the glossy half — 50/50 mix
    clearcoatRoughness: 0.1,
    reflectivity: 0.5,
    envMapIntensity: 0.9
  });
}
