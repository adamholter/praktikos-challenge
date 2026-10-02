const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const expSafe = (value) => Math.max(0.0001, value);

const EVENT_ALIASES = {
  cardHover: "hover",
  "card-hover": "hover",
  cardPick: "pick",
  "card-pick": "pick",
  cardPlace: "place",
  "card-place": "place",
  error: "invalid",
  "invalid-low-clunk": "invalid",
  scoring: "score",
  "chain-score": "score",
  "scoring-spark": "score",
  "attack-hit": "attack",
  explosion: "boom",
  "large-boom": "boom",
  mapChoice: "map",
  "map-choice": "map",
};

/** Small Web Audio sound layer for the Culpo clone. Create once, then reuse. */
export class AudioEngine {
  constructor({ musicUrl = "/audio/culpo-loop.ogg", musicVolume = 0.36, sfxVolume = 0.78 } = {}) {
    this.musicUrl = musicUrl;
    this.musicVolume = clamp(musicVolume, 0, 1);
    this.sfxVolume = clamp(sfxVolume, 0, 1);
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.musicBuffer = null;
    this.musicSource = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.musicEnabled = true;
    this._loadingMusic = null;
    this._hoverAt = -Infinity;
    this._pendingPlays = [];
    this._resumePromise = null;
    this._unlocking = false;
    this._lastBoomAt = -Infinity;
    this._scoreBatch = null;
    this._scoreTimer = null;
  }

  /** Call from the first pointer/key gesture. Safe to call more than once. */
  async unlock() {
    if (typeof window === "undefined") return false;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.musicBus = this.context.createGain();
      this.sfxBus = this.context.createGain();
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 5;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.16;
      this.master.gain.value = this.muted ? 0 : 0.88;
      this.musicBus.gain.value = this.musicEnabled ? this.musicVolume : 0;
      this.sfxBus.gain.value = this.sfxVolume;
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(limiter);
      limiter.connect(this.context.destination);
      this._makeNoiseBuffer();
    }
    if (this.context.state !== "running") {
      const context = this.context;
      this._unlocking = true;
      if (!this._resumePromise) {
        this._resumePromise = context.resume()
          .catch(() => false)
          .finally(() => {
            if (this.context === context) {
              this._unlocking = false;
              this._resumePromise = null;
              this._flushPendingPlays();
            }
          });
      }
      await this._resumePromise;
    }
    this._flushPendingPlays();
    if (this.musicEnabled) void this.startMusic();
    return this.context.state === "running";
  }

  /** Start the music after unlock. Repeated calls do not layer another copy. */
  async startMusic() {
    this.musicEnabled = true;
    if (!this.context || this.context.state === "closed") return false;
    if (this.musicSource) return true;
    if (!this.musicBuffer) {
      if (!this._loadingMusic) {
        this._loadingMusic = fetch(this.musicUrl)
          .then((response) => {
            if (!response.ok) throw new Error(`Music request failed (${response.status})`);
            return response.arrayBuffer();
          })
          .then((bytes) => this.context.decodeAudioData(bytes))
          .then((buffer) => {
            this.musicBuffer = buffer;
            return buffer;
          })
          .catch((error) => {
            console.warn("Culpo music could not be loaded:", error);
            return null;
          })
          .finally(() => { this._loadingMusic = null; });
      }
      await this._loadingMusic;
    }
    if (this.musicSource) return true;
    if (!this.musicEnabled || !this.musicBuffer || !this.context || this.context.state === "closed") return false;
    const source = this.context.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;
    source.connect(this.musicBus);
    this.musicSource = source;
    source.onended = () => {
      if (this.musicSource === source) this.musicSource = null;
    };
    const now = this.context.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(this.musicVolume, now, 0.45);
    source.start(now + 0.025);
    return true;
  }

  setMusic(enabled) {
    this.musicEnabled = Boolean(enabled);
    if (!this.context) return;
    const now = this.context.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(this.musicEnabled ? this.musicVolume : 0, now, 0.16);
    if (this.musicEnabled) void this.startMusic();
    else this._fadeAndStopMusic(0.24);
  }

  stopMusic() {
    this.musicEnabled = false;
    if (!this.context) return;
    this.musicBus.gain.cancelScheduledValues(this.context.currentTime);
    this.musicBus.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
    this._fadeAndStopMusic(0.2);
  }

  stop() {
    this.stopMusic();
  }

  _fadeAndStopMusic(seconds) {
    const source = this.musicSource;
    if (!source || !this.context) return;
    this.musicSource = null;
    try { source.stop(this.context.currentTime + seconds); } catch (_) { /* already stopped */ }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.context) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.88, now, 0.025);
  }

  /** Play a named effect. `power` scales attack weight, `chain` grows scoring chimes. */
  play(name, options = {}) {
    const event = this._eventName(name);
    if (this.muted || !event) return false;
    if (typeof window === "undefined" || !(window.AudioContext || window.webkitAudioContext)) return false;
    if (!this.context || this.context.state !== "running") {
      // Hover is disposable. Other first-click/keyboard sounds survive resume's
      // async boundary, then play only if the unlock completes promptly.
      if (event === "hover") return false;
      this._pendingPlays.push({ name, options: { ...options }, expires: Date.now() + 450 });
      if (this._pendingPlays.length > 8) this._pendingPlays.shift();
      void this.unlock();
      return true;
    }
    if (event === "score") {
      this._queueScore(options);
      return true;
    }
    return this._playNow(event, options);
  }

  _eventName(name) {
    const normalizedName = typeof name === "string" ? name.toLowerCase().replace(/[ _]+/g, "-") : "";
    return EVENT_ALIASES[name] || EVENT_ALIASES[normalizedName] || normalizedName || "";
  }

  _flushPendingPlays() {
    if (!this.context || this.context.state !== "running") return;
    const pending = this._pendingPlays.splice(0);
    const now = Date.now();
    for (const item of pending) {
      const event = this._eventName(item.name);
      if (!this.muted && item.expires >= now && event) {
        if (event === "score") this._queueScore(item.options);
        else this._playNow(event, item.options);
      }
    }
  }

  _queueScore(options) {
    const next = { ...options };
    const existing = this._scoreBatch?.options;
    if (existing) {
      const power = Math.max(Number(existing.power ?? 1) || 1, Number(next.power ?? 1) || 1);
      const chain = Math.max(Number(existing.chain ?? 1) || 1, Number(next.chain ?? 1) || 1);
      const volume = Math.max(Number(existing.volume ?? 1) || 1, Number(next.volume ?? 1) || 1);
      this._scoreBatch.options = { ...existing, ...next, power, chain, volume };
      return;
    }
    const batch = { options: next };
    this._scoreBatch = batch;
    this._scoreTimer = setTimeout(() => {
      if (this._scoreBatch !== batch) return;
      this._scoreBatch = null;
      this._scoreTimer = null;
      if (this.context?.state === "running" && !this.muted) this._playNow("score", batch.options);
    }, 20);
  }

  _playNow(event, options) {
    if (!this.context || this.context.state !== "running" || this.muted) return false;
    const now = this.context.currentTime + 0.003;
    if (event === "boom") {
      if (now - this._lastBoomAt < 0.085) return false;
      this._lastBoomAt = now;
    }
    const power = this._power(options.power ?? options.intensity ?? 1);
    const chain = clamp(Number(options.chain) || 1, 1, 12);
    const volume = clamp(Number(options.volume ?? 1), 0, 1.5);
    const out = (value) => value * volume;
    switch (event) {
      case "hover": {
        if (now - this._hoverAt < 0.075) return false;
        this._hoverAt = now;
        this._tone(1046.5, now, 0.105, out(0.105), { type: "sine", attack: 0.006, endHz: 1396.9, pan: -0.12 });
        this._tone(1568, now + 0.008, 0.075, out(0.035), { type: "sine", attack: 0.004, pan: 0.12 });
        this._noise(now, 0.035, out(0.018), { low: 2800, high: 7500, attack: 0.002, pan: 0.18 });
        return true;
      }
      case "pick": {
        this._noise(now, 0.13, out(0.11), { low: 420, high: 3600, attack: 0.008, pan: -0.18, sweep: 1100 });
        this._tone(176, now, 0.12, out(0.12), { type: "triangle", attack: 0.003, endHz: 262, pan: -0.05 });
        this._tone(784, now + 0.012, 0.11, out(0.07), { type: "sine", attack: 0.002, endHz: 988, pan: 0.16 });
        return true;
      }
      case "place": {
        this._noise(now, 0.18, out(0.2), { low: 180, high: 1900, attack: 0.002, pan: 0, sweep: 520 });
        this._tone(118 * (1.15 - 0.18 * power), now, 0.2, out(0.26 * power), { type: "sine", attack: 0.002, endHz: 63, q: 0.7 });
        this._tone(620, now, 0.055, out(0.09), { type: "triangle", attack: 0.001, endHz: 330, pan: 0.08 });
        return true;
      }
      case "invalid": {
        this._noise(now, 0.105, out(0.07), { low: 150, high: 750, attack: 0.002, pan: 0 });
        this._tone(142, now, 0.2, out(0.22), { type: "triangle", attack: 0.002, endHz: 94 });
        this._tone(119, now + 0.105, 0.19, out(0.18), { type: "sawtooth", attack: 0.002, endHz: 78, lowpass: 510 });
        return true;
      }
      case "score": {
        const notes = [659.25, 783.99, 987.77, 1174.66, 1318.51];
        const count = Math.min(2 + Math.floor(chain / 2), notes.length);
        const interval = clamp(0.115 - chain * 0.0025, 0.07, 0.112);
        for (let i = 0; i < count; i++) {
          const freq = notes[i] * (1 + (chain - 1) * 0.018) * (1 + (power - 1) * 0.035);
          this._tone(freq, now + i * interval, 0.34, out(0.13 * (1 + 0.07 * chain)), { type: "sine", attack: 0.004, pan: (i % 2 ? 1 : -1) * 0.24 });
          this._tone(freq * 2.003, now + i * interval, 0.18, out(0.026), { type: "sine", attack: 0.002, pan: (i % 2 ? -1 : 1) * 0.32 });
        }
        this._tone(196 * Math.pow(0.94, power - 1), now, 0.32, out(0.075 * power), { type: "triangle", attack: 0.003, endHz: 146.8 });
        return true;
      }
      case "attack": {
        const pitch = 175 * Math.pow(0.91, power - 1);
        this._noise(now, 0.27, out(0.21 * power), { low: 250, high: 5200, attack: 0.002, pan: -0.12, sweep: 480 });
        this._tone(pitch, now, 0.32, out(0.34 * power), { type: "sine", attack: 0.002, endHz: pitch * 0.42, q: 0.7 });
        this._tone(pitch * 2.01, now, 0.12, out(0.12 * power), { type: "triangle", attack: 0.001, endHz: pitch * 0.76, pan: 0.08 });
        this._tone(790, now, 0.1, out(0.05), { type: "sawtooth", attack: 0.001, endHz: 180, lowpass: 1800, pan: 0.2 });
        return true;
      }
      case "boom": {
        const base = 64 * Math.pow(0.88, power - 1);
        this._noise(now, 0.72, out(0.36 * power), { low: 48, high: 1800, attack: 0.003, pan: 0, sweep: 115 });
        this._tone(base, now, 0.92, out(0.48 * power), { type: "sine", attack: 0.003, endHz: base * 0.48, q: 0.8 });
        this._tone(base * 2.01, now, 0.38, out(0.18 * power), { type: "triangle", attack: 0.002, endHz: base * 0.72 });
        this._tone(41, now + 0.015, 0.52, out(0.13 * power), { type: "sine", attack: 0.012, endHz: 34, pan: 0.08 });
        return true;
      }
      case "victory": {
        const chord = [293.66, 369.99, 440, 587.33];
        chord.forEach((freq, i) => {
          this._tone(freq, now + i * 0.035, 1.15, out(0.105), { type: "triangle", attack: 0.045, endHz: freq * 1.003, lowpass: 2800, pan: (i - 1.5) * 0.13 });
          this._tone(freq * 2, now + i * 0.035, 0.76, out(0.026), { type: "sine", attack: 0.018, pan: (1.5 - i) * 0.12 });
        });
        this._noise(now, 0.72, out(0.035), { low: 1700, high: 7800, attack: 0.04, pan: 0.1 });
        return true;
      }
      case "defeat": {
        const chord = [146.83, 174.61, 220, 293.66];
        chord.forEach((freq, i) => {
          this._tone(freq, now + i * 0.08, 1.45, out(0.105), { type: "triangle", attack: 0.08, endHz: freq * 0.985, lowpass: 1000, pan: (i - 1.5) * 0.15 });
        });
        this._noise(now, 0.9, out(0.06), { low: 200, high: 1700, attack: 0.03, pan: -0.08, sweep: 310 });
        return true;
      }
      case "map": {
        this._tone(440, now, 0.38, out(0.11), { type: "sine", attack: 0.012, endHz: 659.25, pan: -0.18 });
        this._tone(659.25, now + 0.11, 0.46, out(0.12), { type: "sine", attack: 0.01, endHz: 880, pan: 0.12 });
        this._tone(880, now + 0.22, 0.58, out(0.1), { type: "sine", attack: 0.009, endHz: 987.77, pan: 0.22 });
        this._tone(220, now, 0.26, out(0.07), { type: "triangle", attack: 0.006, endHz: 293.66, lowpass: 1300 });
        return true;
      }
      case "forge": {
        this._noise(now, 0.12, out(0.2), { low: 1400, high: 8200, attack: 0.001, pan: -0.08, sweep: 2800 });
        this._tone(164.81, now, 0.82, out(0.22), { type: "triangle", attack: 0.001, endHz: 164.81, lowpass: 3200, q: 4 });
        this._tone(277.18, now, 0.62, out(0.15), { type: "sine", attack: 0.001, endHz: 275, pan: -0.16 });
        this._tone(421, now + 0.004, 0.48, out(0.08), { type: "sine", attack: 0.001, endHz: 425, pan: 0.14 });
        this._tone(1027, now + 0.006, 0.32, out(0.05), { type: "sine", attack: 0.001, endHz: 1019, pan: 0.2 });
        this._noise(now + 0.025, 0.23, out(0.045), { low: 2500, high: 9000, attack: 0.004, pan: 0.15 });
        return true;
      }
      default:
        return false;
    }
  }

  _power(value) {
    const number = Math.max(0, Number(value) || 1);
    const normalized = number <= 2 ? number : 1 + Math.log2(number) * 0.24;
    return clamp(normalized, 0.65, 1.65);
  }

  _makeNoiseBuffer() {
    if (!this.context || this.noiseBuffer) return;
    const length = Math.ceil(this.context.sampleRate * 1.2);
    this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let state = 0x6d2b79f5;
    for (let i = 0; i < length; i++) {
      state = Math.imul(state ^ (state >>> 15), state | 1);
      state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
      data[i] = (((state ^ (state >>> 14)) >>> 0) / 2147483648) - 1;
    }
  }

  _tone(frequency, time, duration, peak, { type = "sine", attack = 0.004, endHz, lowpass, q = 0.7, pan = 0 } = {}) {
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), time);
    if (endHz) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), time + duration);
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(lowpass, time);
      filter.Q.value = q;
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    const a = Math.min(attack, duration * 0.45);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(expSafe(peak), time + Math.max(0.001, a));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    panner.pan.setValueAtTime(clamp(pan, -1, 1), time);
    gain.connect(panner);
    panner.connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + duration + 0.015);
  }

  _noise(time, duration, peak, { low = 300, high = 4000, attack = 0.003, pan = 0, sweep } = {}) {
    if (!this.noiseBuffer) this._makeNoiseBuffer();
    const ctx = this.context;
    const source = ctx.createBufferSource();
    const highPass = ctx.createBiquadFilter();
    const lowPass = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    source.buffer = this.noiseBuffer;
    highPass.type = "highpass";
    highPass.frequency.setValueAtTime(Math.max(20, low), time);
    highPass.Q.value = 0.55;
    lowPass.type = "lowpass";
    lowPass.frequency.setValueAtTime(Math.max(low + 20, high), time);
    lowPass.Q.value = 0.55;
    if (sweep) lowPass.frequency.exponentialRampToValueAtTime(Math.max(low + 20, sweep), time + duration * 0.65);
    const a = Math.min(attack, duration * 0.4);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(expSafe(peak), time + Math.max(0.001, a));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    panner.pan.setValueAtTime(clamp(pan, -1, 1), time);
    source.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(gain);
    gain.connect(panner);
    panner.connect(this.sfxBus);
    source.start(time);
    source.stop(time + duration + 0.01);
  }

  async destroy() {
    this.stopMusic();
    clearTimeout(this._scoreTimer);
    this._scoreTimer = null;
    this._scoreBatch = null;
    this._pendingPlays.length = 0;
    if (this.context && this.context.state !== "closed") await this.context.close();
    this.context = null;
    this.musicSource = null;
    this.musicBuffer = null;
    this.noiseBuffer = null;
  }
}
