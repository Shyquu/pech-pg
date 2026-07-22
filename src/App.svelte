<script>
  import { Canvas } from '@threlte/core';
  import { ACESFilmicToneMapping } from 'three';
  import Scene from './lib/Scene.svelte';
  import {
    dice,
    MODES,
    MAX_DICE,
    requestRoll,
    requestReset,
    setMode,
    setCount
  } from './lib/store.svelte.js';

  const currentMode = $derived(MODES.find((m) => m.id === dice.mode) ?? MODES[0]);
  const rollLabel = $derived(dice.mode === 'spin' ? 'Spin' : 'Roll');
  const headline = $derived(dice.total ?? '–');
</script>

<div class="stage">
  <Canvas renderMode="always" shadows toneMapping={ACESFilmicToneMapping}>
    <Scene />
  </Canvas>
</div>

<!-- ================= UI overlay ================= -->
<header class="topbar">
  <div class="brand">
    <span class="pip" aria-hidden="true"></span>
    <div>
      <h1>Pech · Dice</h1>
      <p>Threlte + Rapier physics playground</p>
    </div>
  </div>

  <nav class="modes" aria-label="Mode">
    {#each MODES as m (m.id)}
      <button class="mode" class:active={dice.mode === m.id} onclick={() => setMode(m.id)}>
        {m.label}
      </button>
    {/each}
  </nav>
</header>

<!-- dice count stepper -->
<div class="counter">
  <span class="counter-label">Dice</span>
  <div class="stepper">
    <button
      class="step"
      onclick={() => setCount(dice.count - 1)}
      disabled={dice.count <= 1}
      aria-label="Fewer dice">−</button
    >
    <span class="count">{dice.count}</span>
    <button
      class="step"
      onclick={() => setCount(dice.count + 1)}
      disabled={dice.count >= MAX_DICE}
      aria-label="More dice">+</button
    >
  </div>
</div>

<div class="readout" aria-live="polite">
  <div class="value" class:rolling={dice.rolling} class:settled={dice.settled && dice.total != null}>
    {#if !dice.loaded}
      <span class="dots">·</span>
    {:else}
      {headline}
    {/if}
  </div>
  {#if dice.count > 1 && dice.values.length}
    <div class="chips">
      {#each dice.values as v}
        <span class="chip">{v}</span>
      {/each}
    </div>
  {/if}
  <div class="status">
    {#if !dice.loaded}
      loading dice…
    {:else if dice.rolling}
      {dice.mode === 'spin' ? 'spinning…' : 'rolling…'}
    {:else}
      {dice.count > 1 ? 'total' : dice.mode === 'spin' ? 'showing' : 'landed on'}
      <b>{dice.total}</b>
    {/if}
  </div>
</div>

<footer class="controls">
  <p class="hint">{currentMode.hint}</p>
  <div class="buttons">
    <button class="btn ghost" onclick={requestReset} disabled={!dice.loaded}>Reset</button>
    <button class="btn primary" onclick={requestRoll} disabled={!dice.loaded}>
      {rollLabel}
    </button>
  </div>
</footer>

<style>
  .stage {
    position: absolute;
    inset: 0;
  }

  /* ---- top bar ---- */
  .topbar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 22px;
    pointer-events: none;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand .pip {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: linear-gradient(150deg, var(--green-soft), var(--green));
    box-shadow: 0 0 18px rgba(126, 203, 116, 0.5), inset 0 0 6px rgba(255, 255, 255, 0.4);
  }
  .brand h1 {
    margin: 0;
    font-size: 17px;
    letter-spacing: 0.2px;
  }
  .brand p {
    margin: 2px 0 0;
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .modes {
    display: flex;
    gap: 6px;
    padding: 5px;
    background: var(--panel);
    border: 1px solid var(--panel-brd);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }
  .mode {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.16s ease;
  }
  .mode:hover {
    color: var(--text);
  }
  .mode.active {
    color: #08130c;
    background: linear-gradient(150deg, var(--green-soft), var(--green));
    box-shadow: 0 4px 14px rgba(83, 163, 74, 0.35);
  }

  /* ---- dice counter ---- */
  .counter {
    position: absolute;
    top: 82px;
    right: 22px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 14px;
    background: var(--panel);
    border: 1px solid var(--panel-brd);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }
  .counter-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
    letter-spacing: 0.3px;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .step {
    appearance: none;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    background: rgba(126, 203, 116, 0.12);
    color: var(--green-soft);
    font: inherit;
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
  }
  .step:not(:disabled):hover {
    background: rgba(126, 203, 116, 0.24);
  }
  .step:not(:disabled):active {
    transform: scale(0.92);
  }
  .step:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .count {
    min-width: 22px;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  /* ---- centre readout ---- */
  .readout {
    position: absolute;
    top: 50%;
    left: 34px;
    transform: translateY(-50%);
    pointer-events: none;
    user-select: none;
  }
  .value {
    font-size: 128px;
    line-height: 1;
    font-weight: 800;
    color: rgba(232, 240, 234, 0.16);
    transition: color 0.25s ease, text-shadow 0.25s ease;
    font-variant-numeric: tabular-nums;
  }
  .value.rolling {
    color: rgba(232, 240, 234, 0.32);
    animation: pulse 0.7s ease-in-out infinite;
  }
  .value.settled {
    color: var(--green-soft);
    text-shadow: 0 0 34px rgba(126, 203, 116, 0.45);
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.85;
    }
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    max-width: 220px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    border-radius: 8px;
    background: var(--panel);
    border: 1px solid var(--panel-brd);
    color: var(--text);
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .status {
    margin-top: 8px;
    font-size: 13px;
    color: var(--text-dim);
    letter-spacing: 0.3px;
  }
  .status b {
    color: var(--green-soft);
  }

  /* ---- bottom controls ---- */
  .controls {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 20px 22px 24px;
    pointer-events: none;
  }
  .hint {
    margin: 0;
    max-width: 46ch;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-dim);
  }
  .buttons {
    display: flex;
    gap: 10px;
    pointer-events: auto;
  }
  .btn {
    appearance: none;
    font: inherit;
    font-weight: 700;
    font-size: 14px;
    padding: 12px 24px;
    border-radius: 12px;
    cursor: pointer;
    transition: transform 0.12s ease, box-shadow 0.16s ease, background 0.16s ease;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .btn.primary {
    border: 0;
    color: #08130c;
    background: linear-gradient(150deg, var(--green-soft), var(--green));
    box-shadow: 0 6px 20px rgba(83, 163, 74, 0.4);
  }
  .btn.primary:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 9px 26px rgba(83, 163, 74, 0.5);
  }
  .btn.primary:not(:disabled):active {
    transform: translateY(1px);
  }
  .btn.ghost {
    border: 1px solid var(--panel-brd);
    background: var(--panel);
    color: var(--text);
    backdrop-filter: blur(12px);
  }
  .btn.ghost:not(:disabled):hover {
    border-color: rgba(126, 203, 116, 0.4);
  }

  @media (max-width: 720px) {
    .topbar {
      flex-direction: column;
      align-items: flex-start;
    }
    .counter {
      top: auto;
      bottom: 84px;
      right: 22px;
    }
    .value {
      font-size: 88px;
    }
    .hint {
      display: none;
    }
    .controls {
      justify-content: flex-end;
    }
  }
</style>
