function injectEffectsButton() {
  if (document.getElementById("sclient-effects-btn")) return;

  const target = document.querySelector(".playbackSoundBadge__showQueue");
  if (!target || !target.parentNode) return;

  const btnContainer = document.createElement("div");
  btnContainer.className = "sclient-effects-container";
  btnContainer.style.position = "relative";
  btnContainer.style.display = "inline-flex";
  btnContainer.style.alignItems = "center";
  btnContainer.style.marginRight = "8px";

  const btn = document.createElement("button");
  btn.id = "sclient-effects-btn";
  btn.className =
    "sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive";
  btn.title = "Audio Effects (Speed, Pitch, Reverb)";
  btn.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gauge-icon lucide-gauge"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg></div>';

  const popup = document.createElement("div");
  popup.id = "sclient-effects-popup";
  popup.className = "sc-background-darkgrey";
  popup.style.cssText = `
    position: absolute;
    bottom: 45px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    padding: 16px;
    border-radius: 8px;
    display: none;
    flex-direction: column;
    gap: 12px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    border: 1px solid var(--sc-border);
    background-color: var(--sc-bg-surface);
  `;

  popup.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12px; font-weight:bold; color: var(--sc-text-base);">Speed</span>
        <span id="sclient-effects-speed-val" style="font-size:12px; color: var(--sc-text-base);">1.00x</span>
    </div>
    <input type="range" id="sclient-effects-speed" min="0.25" max="2" step="0.05" value="1" style="width:100%; accent-color: var(--sc-accent);" />
    
    <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; color: var(--sc-text-base);">
        <input type="checkbox" id="sclient-effects-pitch" /> Preserve Pitch
    </label>
    
    <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; color: var(--sc-text-base);">
        <input type="checkbox" id="sclient-effects-reverb" checked /> Reverb
    </label>
  `;

  btnContainer.appendChild(btn);
  btnContainer.appendChild(popup);

  target.parentNode.insertBefore(btnContainer, target);

  window.sclient_effects = window.sclient_effects || {
    speed: 1,
    preservePitch: false,
    reverb: true,
  };

  const speedSlider = popup.querySelector("#sclient-effects-speed");
  const speedVal = popup.querySelector("#sclient-effects-speed-val");
  const pitchCheck = popup.querySelector("#sclient-effects-pitch");
  const reverbCheck = popup.querySelector("#sclient-effects-reverb");

  speedSlider.value = window.sclient_effects.speed;
  speedVal.textContent = window.sclient_effects.speed.toFixed(2) + "x";
  pitchCheck.checked = window.sclient_effects.preservePitch;
  reverbCheck.checked = window.sclient_effects.reverb;

  btn.addEventListener("click", () => {
    popup.style.display = popup.style.display === "none" ? "flex" : "none";
  });

  document.addEventListener("click", (e) => {
    if (!btnContainer.contains(e.target)) popup.style.display = "none";
  });

  const updateEffects = () => {
    window.sclient_effects.speed = parseFloat(speedSlider.value);
    window.sclient_effects.preservePitch = pitchCheck.checked;
    window.sclient_effects.reverb = reverbCheck.checked;
    speedVal.textContent = window.sclient_effects.speed.toFixed(2) + "x";

    window.__scMedia = window.__scMedia || [];
    window.__scMedia.forEach((el) => applyEffectsToMedia(el));
  };

  speedSlider.addEventListener("input", updateEffects);
  pitchCheck.addEventListener("change", updateEffects);
  reverbCheck.addEventListener("change", updateEffects);
}

let sclientAudioCtx;
const sclientSourceNodes = new WeakMap();

async function setupAudioNodes(ctx) {
  if (!ctx.sclientConvolver) {
    ctx.sclientConvolver = ctx.createConvolver();
    ctx.sclientAnalyser = ctx.createAnalyser();
    ctx.sclientAnalyser.fftSize = 256;
    window.sclientAnalyser = ctx.sclientAnalyser;

    const length = ctx.sampleRate * 2.5;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 3);
      }
    }
    ctx.sclientConvolver.buffer = impulse;

    setInterval(() => {
      if (!window.sclientAnalyser) return;
      const dataArray = new Uint8Array(window.sclientAnalyser.frequencyBinCount);
      window.sclientAnalyser.getByteFrequencyData(dataArray);

      const ipcArray = Array.from(dataArray);
      window.postMessage(
        {
          source: "sclient-mini-visualizer",
          data: ipcArray,
        },
        "*"
      );
    }, 33);
  }
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

async function applyEffectsToMedia(el) {
  const wantsEffects = !!window.sclient_effects;
  const wantsVisualizer = window.__SCLIENT_CONFIG__ && window.__SCLIENT_CONFIG__.show_visualizer;

  if (!wantsEffects && !wantsVisualizer) return;

  if (wantsEffects) {
    el.playbackRate = window.sclient_effects.speed;
    el.preservesPitch = window.sclient_effects.preservePitch;
    el.webkitPreservesPitch = window.sclient_effects.preservePitch;
    el.mozPreservesPitch = window.sclient_effects.preservePitch;
  }

  let ctxToUse;
  if (sclientSourceNodes.has(el)) {
    const data = sclientSourceNodes.get(el);
    ctxToUse = data.externalCtx || sclientAudioCtx;
  } else {
    if (!sclientAudioCtx)
      sclientAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ctxToUse = sclientAudioCtx;
  }

  try {
    await setupAudioNodes(ctxToUse);
  } catch (e) {
    console.error("[SClient] Audio nodes setup failed:", e);
  }

  if (!sclientSourceNodes.has(el)) {
    try {
      const source = ctxToUse.createMediaElementSource(el);
      source.connect(ctxToUse.sclientAnalyser);
      ctxToUse.sclientAnalyser.connect(ctxToUse.destination);
      sclientSourceNodes.set(el, { source, connectedReverb: false, externalCtx: null });
    } catch (e) {
      if (e.name === "InvalidStateError") {
        sclientSourceNodes.set(el, { source: null, connectedReverb: false, externalCtx: null });
      } else {
        throw e;
      }
    }
  }

  const nodeData = sclientSourceNodes.get(el);
  if (!nodeData || !nodeData.source) return;

  const ctx = nodeData.externalCtx || sclientAudioCtx;

  if (nodeData.externalCtx) {
    try {
      nodeData.source.connect(ctx.sclientAnalyser);
    } catch (e) {}
  }

  if (wantsEffects && window.sclient_effects.reverb) {
    if (!nodeData.connectedReverb) {
      if (nodeData.externalCtx) {
        nodeData.source.connect(ctx.sclientConvolver);
        ctx.sclientConvolver.connect(ctx.destination);
      } else {
        ctx.sclientAnalyser.disconnect();
        ctx.sclientAnalyser.connect(ctx.sclientConvolver);
        ctx.sclientConvolver.connect(ctx.destination);
      }
      nodeData.connectedReverb = true;
    }
  } else {
    if (nodeData.connectedReverb) {
      if (nodeData.externalCtx) {
        nodeData.source.disconnect(ctx.sclientConvolver);
        ctx.sclientConvolver.disconnect();
      } else {
        ctx.sclientAnalyser.disconnect();
        ctx.sclientConvolver.disconnect();
        ctx.sclientAnalyser.connect(ctx.destination);
      }
      nodeData.connectedReverb = false;
    }
  }
}

if (!window.__sclient_effects_hooked) {
  window.__sclient_effects_hooked = true;
  window.__scMedia = window.__scMedia || [];

  const originalCreateSource =
    window.AudioContext.prototype.createMediaElementSource ||
    window.webkitAudioContext.prototype.createMediaElementSource;
  if (originalCreateSource) {
    window.AudioContext.prototype.createMediaElementSource = function (el) {
      const sourceNode = originalCreateSource.apply(this, arguments);
      sclientSourceNodes.set(el, { source: sourceNode, connectedReverb: false, externalCtx: this });
      return sourceNode;
    };
  }

  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (!window.__scMedia.includes(this)) {
      window.__scMedia.push(this);
    }
    if (this.tagName === "AUDIO" || this.tagName === "VIDEO") {
      applyEffectsToMedia(this).catch(console.error);
    }
    return originalPlay.apply(this, arguments);
  };

  setInterval(() => {
    if (window.sclient_effects) {
      window.__scMedia.forEach((el) => {
        if (el.playbackRate !== window.sclient_effects.speed) {
          applyEffectsToMedia(el);
        }
      });
    }
  }, 250);
}
