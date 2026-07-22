<script>
  // Builds an in-memory studio IBL with PMREM (no external HDR file needed).
  // Feeds reflections on the glossy white pips and the environment that the
  // translucent green resin refracts/transmits.
  import { useThrelte } from '@threlte/core';
  import { PMREMGenerator } from 'three';
  import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
  import { onMount } from 'svelte';

  const { renderer, scene, invalidate } = useThrelte();

  onMount(() => {
    const pmrem = new PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    invalidate();

    return () => {
      scene.environment = null;
      envTexture.dispose();
      pmrem.dispose();
    };
  });
</script>
