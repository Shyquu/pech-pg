<script>
  import { T, useThrelte, useTask } from '@threlte/core';
  import { OrbitControls, ContactShadows, Grid, interactivity } from '@threlte/extras';
  import { World, RigidBody, Collider } from '@threlte/rapier';
  import { Vector3, Quaternion, Euler, Matrix4, MathUtils } from 'three';
  import Dice from './Dice.svelte';
  import StudioEnvironment from './StudioEnvironment.svelte';
  import { HALF, readTopFace } from './dice.js';
  import { dice } from './store.svelte.js';

  interactivity();
  const { camera, invalidate } = useThrelte();

  // rapier bodies of every die, indexed by die index; registered by <Dice>.
  let bodies = $state([]);
  function onbody(i, rb) {
    bodies[i] = rb;
  }
  // The bodies of the dice currently in play (all loaded).
  const activeBodies = () => {
    const out = [];
    for (let i = 0; i < dice.count; i++) if (bodies[i]) out.push(bodies[i]);
    return out;
  };
  const allReady = () => activeBodies().length === dice.count && dice.count > 0;

  const TRAY = 4.2; // half-width of the containing tray
  const REST_Y = HALF + 0.001; // die centre height when resting on the ground
  const FLOAT_Y = HALF * 2.6; // die centre height while floating in Spin mode

  // Ground layout slot (x,z) for die i of n — a centred grid, max 3 per row.
  function slotXZ(i, n) {
    const cols = Math.min(n, 3);
    const rows = Math.ceil(n / cols);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sp = 1.5;
    return [(col - (cols - 1) / 2) * sp, (row - (rows - 1) / 2) * sp];
  }

  // ---- helpers -----------------------------------------------------------
  const _q = new Quaternion();
  const _e = new Euler();
  const rand = (a, b) => a + Math.random() * (b - a);
  function randomQuat() {
    _e.set(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2));
    return _q.setFromEuler(_e);
  }
  // A random orientation snapped to 90° steps, so a resting die lands flat on a
  // face instead of balancing on a corner and jittering.
  function randomFaceQuat() {
    const h = Math.PI / 2;
    _e.set(Math.round(rand(0, 3)) * h, Math.round(rand(0, 3)) * h, Math.round(rand(0, 3)) * h);
    return _q.setFromEuler(_e);
  }

  // Snap a die's orientation to the nearest axis-aligned (face-flat) pose.
  // Used in Spin mode where there is no ground to flatten it against, so it
  // "clicks" onto a face once it slows down.
  const _m = new Matrix4();
  const _snapQ = new Quaternion();
  const _cx = new Vector3();
  const _cy = new Vector3();
  const WORLD = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
  function nearestAxis(v) {
    let best = WORLD[0];
    let bestDot = -2;
    for (const w of WORLD) {
      const d = v.dot(w);
      if (Math.abs(d) > Math.abs(bestDot)) {
        bestDot = d;
        best = w;
      }
    }
    return best.clone().multiplyScalar(Math.sign(bestDot));
  }
  function snapToFace(rb) {
    const r = rb.rotation();
    _snapQ.set(r.x, r.y, r.z, r.w);
    _m.makeRotationFromQuaternion(_snapQ);
    const e = _m.elements;
    _cx.set(e[0], e[1], e[2]);
    _cy.set(e[4], e[5], e[6]);
    const sx = nearestAxis(_cx);
    const sy = nearestAxis(_cy);
    const sz = new Vector3().crossVectors(sx, sy); // guarantee right-handed
    const syo = new Vector3().crossVectors(sz, sx); // re-orthogonalise
    _m.set(sx.x, syo.x, sz.x, 0, sx.y, syo.y, sz.y, 0, sx.z, syo.z, sz.z, 0, 0, 0, 0, 1);
    _snapQ.setFromRotationMatrix(_m);
    rb.setRotation({ x: _snapQ.x, y: _snapQ.y, z: _snapQ.z, w: _snapQ.w }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  function stop(rb) {
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  function markMoving() {
    dice.rolling = true;
    dice.settled = false;
    stillFrames = 0;
    rollFrames = 0;
  }

  // Place every die into the resting/floating pose appropriate for a mode.
  function setupMode(mode) {
    const active = activeBodies();
    if (!active.length) return;
    const n = active.length;
    active.forEach((rb, i) => {
      const [x, z] = slotXZ(i, n);
      const q = randomFaceQuat();
      if (mode === 'spin') {
        rb.setEnabledTranslations(false, false, false, true); // pin in place
        rb.setGravityScale(0, true);
        rb.setAngularDamping(1.2); // bleed the spin down onto a face
        rb.setTranslation({ x, y: FLOAT_Y, z }, true);
        rb.setRotation(q, true);
        stop(rb);
        // a gentle idle spin so it is visibly turning, then settles flat
        rb.setAngvel({ x: rand(-0.8, 0.8), y: rand(1.4, 2.2), z: rand(-0.8, 0.8) }, true);
      } else {
        rb.setEnabledTranslations(true, true, true, true);
        rb.setGravityScale(1, true);
        rb.setAngularDamping(0.35);
        rb.setTranslation({ x, y: REST_Y, z }, true);
        rb.setRotation(q, true);
        stop(rb);
      }
    });
    if (mode === 'spin') markMoving();
    else {
      dice.rolling = false;
      dice.settled = true;
      stillFrames = 999;
    }
  }

  // ---- the three roll actions -------------------------------------------
  function doRoll() {
    const active = activeBodies();
    if (!active.length) return;
    const n = active.length;

    if (dice.mode === 'throw') {
      // Toss the dice in from above so they tumble down onto the plane. Kept
      // below the tray-wall height so they can never escape the play area.
      active.forEach((rb, i) => {
        rb.wakeUp();
        const [x, z] = slotXZ(i, n);
        rb.setTranslation({ x: x + rand(-0.3, 0.3), y: 3.4, z: z + rand(-0.3, 0.3) }, true);
        rb.setRotation(randomQuat(), true);
        rb.setLinvel({ x: rand(-2, 2), y: rand(0, 1), z: rand(-2, 2) }, true);
        rb.setAngvel({ x: rand(-15, 15), y: rand(-15, 15), z: rand(-15, 15) }, true);
      });
      markMoving();
    } else if (dice.mode === 'hand') {
      // Random flick across the tray (the same thing a drag does).
      flick(new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize(), rand(5, 8));
    } else {
      // Spin mode: kick each die into a fast spin about a random axis; angular
      // damping then bleeds it down and it snaps onto a face.
      active.forEach((rb) => {
        rb.wakeUp();
        const axis = new Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
        rb.setAngvel(axis.multiplyScalar(rand(13, 17)), true);
      });
      markMoving();
    }
  }

  // Apply a horizontal impulse + a perpendicular torque so each die rolls in
  // the given ground direction. Used by both the Hand-mode button and drag.
  function flick(dir, strength) {
    const active = activeBodies();
    if (!active.length) return;
    for (const rb of active) {
      rb.wakeUp();
      const d = dir.clone().add(new Vector3(rand(-0.25, 0.25), 0, rand(-0.25, 0.25)));
      d.setY(0).normalize();
      const s = strength * rand(0.85, 1.1);
      const impulse = d.clone().multiplyScalar(s);
      impulse.y = strength * 0.35; // a little lift so it actually tumbles
      rb.applyImpulse(impulse, true);
      // torque axis = up × dir  -> rolls forward along dir
      const torque = new Vector3(0, 1, 0).cross(d).multiplyScalar(s * 1.6);
      rb.applyTorqueImpulse(torque, true);
    }
    markMoving();
  }

  // ---- Hand-mode drag to flick ------------------------------------------
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startT = 0;

  function onPointerDown(e) {
    if (dice.mode !== 'hand') return;
    e.stopPropagation();
    dragging = true;
    startX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    startY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
    startT = performance.now();
    window.addEventListener('pointerup', onPointerUp);
  }
  function onPointerUp(e) {
    window.removeEventListener('pointerup', onPointerUp);
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dt = Math.max((performance.now() - startT) / 1000, 0.016);
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      // treat as a tap: tiny nudge
      flick(new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize(), 2.5);
      return;
    }
    // Convert the screen drag into a direction on the ground plane using the
    // camera's orientation.
    const cam = camera.current;
    const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const fwd = new Vector3().setFromMatrixColumn(cam.matrixWorld, 2).negate().setY(0).normalize();
    const dir = right
      .multiplyScalar(dx)
      .add(fwd.multiplyScalar(-dy)) // screen-up (negative dy) => away from camera
      .setY(0);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    const strength = MathUtils.clamp(dist / dt / 260, 3, 11);
    flick(dir, strength);
  }

  // ---- reactive wiring ---------------------------------------------------
  let handledRoll = 0;
  let handledReset = 0;

  // Mode / count changes (and dice finishing loading) reset every die's pose.
  $effect(() => {
    dice.mode;
    dice.count;
    if (allReady()) setupMode(dice.mode);
  });

  $effect(() => {
    if (allReady() && dice.rollNonce !== handledRoll) {
      handledRoll = dice.rollNonce;
      doRoll();
    }
  });

  $effect(() => {
    if (allReady() && dice.resetNonce !== handledReset) {
      handledReset = dice.resetNonce;
      setupMode(dice.mode);
    }
  });

  // ---- per-frame read + settle detection --------------------------------
  let stillFrames = 999;
  let rollFrames = 0; // frames since the current roll began (force-settle guard)
  function finishRoll(active) {
    // A die wedged against a wall or another die can keep a tiny residual
    // velocity forever, so hard-stop everything when we settle.
    for (const rb of active) {
      if (dice.mode === 'spin') snapToFace(rb);
      else stop(rb);
    }
    dice.settled = true;
    dice.rolling = false;
  }
  useTask(() => {
    const active = activeBodies();
    if (!active.length) return;

    const vals = [];
    let anyMoving = false;
    for (const rb of active) {
      vals.push(readTopFace(rb.rotation()).value);
      const lin = rb.linvel();
      const ang = rb.angvel();
      if (Math.hypot(lin.x, lin.y, lin.z) > 0.12 || Math.hypot(ang.x, ang.y, ang.z) > 0.25) {
        anyMoving = true;
      }
    }

    // publish live values only when they actually change
    let changed = vals.length !== dice.values.length;
    if (!changed) for (let i = 0; i < vals.length; i++) if (vals[i] !== dice.values[i]) { changed = true; break; }
    if (changed) {
      dice.values = vals;
      dice.total = vals.reduce((a, b) => a + b, 0);
    }

    if (!dice.settled) {
      rollFrames++;
      invalidate(); // keep rendering while a roll is in progress
      if (anyMoving) stillFrames = 0;
      else stillFrames++;
      // Settle once things are calm, or force it after ~4s of nudging.
      if (stillFrames > 14 || rollFrames > 240) finishRoll(active);
    } else if (anyMoving) {
      // physics disturbed the die again (e.g. a fresh roll)
      dice.settled = false;
      dice.rolling = true;
      stillFrames = 0;
      rollFrames = 0;
      invalidate();
    }
  });
</script>

<T.OrthographicCamera makeDefault position={[14, 13, 14]} zoom={72} near={0.1} far={200}>
  <OrbitControls
    target={[0, 0.4, 0]}
    enablePan={false}
    enableZoom
    minZoom={40}
    maxZoom={220}
    enableRotate={dice.mode !== 'hand'}
    maxPolarAngle={1.35}
    minPolarAngle={0.2}
    enableDamping
    dampingFactor={0.08}
  />
</T.OrthographicCamera>

<StudioEnvironment />

<!-- Key + fill lighting (the studio env supplies most reflections) -->
<T.DirectionalLight
  position={[6, 12, 4]}
  intensity={2.1}
  castShadow
  shadow.mapSize.width={2048}
  shadow.mapSize.height={2048}
  shadow.camera.near={1}
  shadow.camera.far={40}
  shadow.camera.left={-8}
  shadow.camera.right={8}
  shadow.camera.top={8}
  shadow.camera.bottom={-8}
  shadow.bias={-0.0004}
/>
<T.DirectionalLight position={[-6, 5, -6]} intensity={0.5} />
<T.AmbientLight intensity={0.25} />

<!-- Ground disc (also the pointer target for Hand-mode drag) -->
<T.Mesh rotation.x={-Math.PI / 2} receiveShadow onpointerdown={onPointerDown}>
  <T.CircleGeometry args={[9, 64]} />
  <T.MeshStandardMaterial color="#1b241e" roughness={0.95} metalness={0} />
</T.Mesh>

<Grid
  position={[0, 0.002, 0]}
  cellColor="#2c3a30"
  sectionColor="#3f5745"
  cellSize={1}
  sectionSize={5}
  fadeDistance={26}
  fadeStrength={2}
  infiniteGrid
/>

<ContactShadows position={[0, 0.004, 0]} scale={16} blur={2.4} far={6} opacity={0.55} />

<!-- Physics world -->
<World gravity={[0, -20, 0]}>
  <!-- Static ground + invisible tray walls that keep the dice in view -->
  <RigidBody type="fixed">
    <T.Group position={[0, -0.5, 0]}>
      <Collider shape="cuboid" args={[14, 0.5, 14]} friction={0.9} restitution={0.15} />
    </T.Group>
    <T.Group position={[TRAY, 3, 0]}>
      <Collider shape="cuboid" args={[0.3, 3, TRAY]} restitution={0.3} />
    </T.Group>
    <T.Group position={[-TRAY, 3, 0]}>
      <Collider shape="cuboid" args={[0.3, 3, TRAY]} restitution={0.3} />
    </T.Group>
    <T.Group position={[0, 3, TRAY]}>
      <Collider shape="cuboid" args={[TRAY, 3, 0.3]} restitution={0.3} />
    </T.Group>
    <T.Group position={[0, 3, -TRAY]}>
      <Collider shape="cuboid" args={[TRAY, 3, 0.3]} restitution={0.3} />
    </T.Group>
  </RigidBody>

  {#each Array.from({ length: dice.count }) as _, i (i)}
    <Dice index={i} position={[slotXZ(i, dice.count)[0], REST_Y, slotXZ(i, dice.count)[1]]} {onbody} />
  {/each}
</World>
