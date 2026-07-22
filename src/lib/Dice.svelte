<script>
  import { T } from '@threlte/core';
  import { useGltf, useDraco } from '@threlte/extras';
  import { RigidBody, Collider } from '@threlte/rapier';
  import { HALF, SCALE } from './dice.js';
  import { greenResin, glossyWhite } from './materials.js';
  import { dice } from './store.svelte.js';

  let {
    index = 0,
    position = [0, HALF, 0],
    onbody
  } = $props();

  // Local Draco decoder (served from /public/draco) so the model loads offline.
  const dracoLoader = useDraco('/draco/');
  const gltf = useGltf('/dice_v01.glb', { dracoLoader });

  let scene = $state(null);
  let rigidBody = $state(undefined);

  gltf
    .then((data) => {
      // Clone the cached scene so each die is an independent object, then swap
      // in the shared authored materials. The two primitives keep their glTF
      // material names: "Green" (resin body) and "White" (pips).
      const s = data.scene.clone(true);
      s.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material?.name === 'White' ? glossyWhite() : greenResin();
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
      });
      scene = s;
      dice.loaded = true;
    })
    .catch((e) => console.error('Failed to load dice_v01.glb:', e));

  // Report this die's rapier body up to <Scene> as it appears / disappears.
  $effect(() => {
    onbody?.(index, rigidBody);
    return () => onbody?.(index, undefined);
  });
</script>

{#if scene}
  <T.Group {position}>
    <RigidBody
      bind:rigidBody
      type="dynamic"
      ccd
      canSleep
      angularDamping={0.35}
      linearDamping={0.15}
    >
      <!-- Explicit box collider (kept outside the scaled visual group so its
           half-extents stay in world units). -->
      <Collider shape="cuboid" args={[HALF, HALF, HALF]} restitution={0.2} friction={0.85} />
      <T is={scene} scale={SCALE} />
    </RigidBody>
  </T.Group>
{/if}
