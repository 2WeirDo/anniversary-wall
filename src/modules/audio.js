/**
 * BGM — 纯 Web Audio API 合成，零文件加载，秒开
 * 4 套曲风预设，可视化切换面板
 */

/* ======== 曲风预设 ======== */
const PRESETS = {
  moonlight: {
    name: '温柔月光',
    chordProgression: [
      { notes: [261.63, 329.63, 392.00, 493.88] },
      { notes: [196.00, 246.94, 329.63, 349.23] },
      { notes: [220.00, 261.63, 329.63, 392.00] },
      { notes: [174.61, 220.00, 261.63, 329.63] },
    ],
    pentatonic: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00],
    melodyPatterns: [
      [0, 1, 2, 4, 7, 4, 2, 0],
      [7, 6, 4, 2, 0, 2, 4],
      [4, 2, 0, 2, 4, 6, 7],
      [2, 0, 2, 4, 2, 0],
    ],
    barDuration: 4.0,
    bassFreqs: [130.81, 98.00, 110.00, 87.31],
    chordGain: 0.045, melodyGain: 0.03, bassGain: 0.03,
    oscType: 'sine', melodyType: 'triangle',
    filterFreq: 1200, filterQ: 0.4,
    warmthFreq: 55, warmthGain: 0.006,
    masterVol: 0.14,
    delayTime: 0.35, delayFeedback: 0.2, delayMix: 0.35,
  },
  sweet: {
    name: '甜蜜时光',
    chordProgression: [
      { notes: [329.63, 392.00, 493.88, 587.33] },
      { notes: [261.63, 329.63, 392.00, 440.00] },
      { notes: [293.66, 369.99, 440.00, 523.25] },
      { notes: [246.94, 329.63, 392.00, 493.88] },
    ],
    pentatonic: [392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51],
    melodyPatterns: [
      [0, 2, 4, 7, 8, 7, 4, 2],
      [8, 7, 5, 3, 1, 3, 5],
      [6, 5, 3, 1, 0, 1, 3],
      [2, 4, 6, 8, 6, 4],
    ],
    barDuration: 3.5,
    bassFreqs: [164.81, 130.81, 146.83, 123.47],
    chordGain: 0.04, melodyGain: 0.04, bassGain: 0.025,
    oscType: 'triangle', melodyType: 'sine',
    filterFreq: 1800, filterQ: 0.3,
    warmthFreq: 65, warmthGain: 0.004,
    masterVol: 0.16,
    delayTime: 0.25, delayFeedback: 0.15, delayMix: 0.25,
  },
  starry: {
    name: '静谧星空',
    chordProgression: [
      { notes: [174.61, 220.00, 261.63, 329.63] },
      { notes: [130.81, 164.81, 196.00, 246.94] },
      { notes: [196.00, 246.94, 293.66, 349.23] },
      { notes: [146.83, 174.61, 220.00, 261.63] },
    ],
    pentatonic: [130.81, 164.81, 196.00, 246.94, 293.66, 349.23, 392.00, 440.00, 523.25, 587.33],
    melodyPatterns: [
      [0, 0, 0, 2, 0, 0, 0],
      [4, 4, 2, 0, 2, 0],
      [0, 0, 4, 4, 2, 0],
      [0, 2, 0, 0, 0],
    ],
    barDuration: 5.0,
    bassFreqs: [87.31, 65.41, 98.00, 73.42],
    chordGain: 0.035, melodyGain: 0.02, bassGain: 0.04,
    oscType: 'sine', melodyType: 'sine',
    filterFreq: 600, filterQ: 0.6,
    warmthFreq: 43, warmthGain: 0.008,
    masterVol: 0.12,
    delayTime: 0.5, delayFeedback: 0.35, delayMix: 0.45,
  },
  breeze: {
    name: '春日微风',
    chordProgression: [
      { notes: [261.63, 329.63, 392.00, 440.00] },
      { notes: [220.00, 293.66, 349.23, 440.00] },
      { notes: [246.94, 329.63, 392.00, 493.88] },
      { notes: [196.00, 261.63, 329.63, 392.00] },
    ],
    pentatonic: [293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50],
    melodyPatterns: [
      [0, 1, 3, 5, 6, 5, 3, 1, 0],
      [4, 3, 1, 0, 1, 3, 4, 5],
      [2, 4, 5, 6, 5, 4, 2],
      [6, 5, 3, 1, 0, 1, 3, 5],
    ],
    barDuration: 3.0,
    bassFreqs: [130.81, 110.00, 123.47, 98.00],
    chordGain: 0.05, melodyGain: 0.035, bassGain: 0.02,
    oscType: 'triangle', melodyType: 'triangle',
    filterFreq: 2000, filterQ: 0.25,
    warmthFreq: 50, warmthGain: 0.005,
    masterVol: 0.15,
    delayTime: 0.3, delayFeedback: 0.2, delayMix: 0.3,
  },
};

export class AudioPlayer {
  constructor(btnId) {
    this.btn = document.getElementById(btnId);
    this.isPlaying = false;

    this.currentPreset = 'moonlight';

    this.ctx = null;
    this.masterGain = null;
    this.activeNodes = [];
    this._scheduleTimer = null;
    this._nextScheduleTime = 0;

    // 面板
    this.panel = document.getElementById('music-panel');
    this.panelOpen = false;
    this.labelEl = document.getElementById('music-btn-label');
    this.arrowEl = document.getElementById('music-btn-arrow');
    this.presetsEl = document.getElementById('music-presets');

    this.init();
  }

  init() {
    if (!this.btn) return;

    // 主按钮：播放/暂停
    this.btn.addEventListener('click', (e) => {
      if (e.target.closest('#music-btn-arrow')) return;
      e.stopPropagation();
      this.toggle();
    });

    // 展开箭头
    if (this.arrowEl) {
      this.arrowEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePanel();
      });
    }

    // 预设按钮
    if (this.presetsEl) {
      this.presetsEl.addEventListener('click', (e) => {
        const presetBtn = e.target.closest('.music-preset');
        if (!presetBtn) return;
        const key = presetBtn.dataset.preset;
        if (key && key !== this.currentPreset) {
          this.switchPreset(key);
          this.closePanel();
        }
      });
    }

    // 点击面板外关闭
    document.addEventListener('click', (e) => {
      if (this.panelOpen && !e.target.closest('.music-player')) {
        this.closePanel();
      }
    });

    window.addEventListener('beforeunload', () => this.stopAll());
  }

  /* ======== 面板 ======== */

  togglePanel() { this.panelOpen ? this.closePanel() : this.openPanel(); }

  openPanel() {
    this.panelOpen = true;
    this.panel.classList.add('open');
    this.btn.classList.add('open-arrow');
  }

  closePanel() {
    this.panelOpen = false;
    this.panel.classList.remove('open');
    this.btn.classList.remove('open-arrow');
  }

  /* ======== 切换预设 ======== */

  switchPreset(key) {
    if (!PRESETS[key]) return;
    this.currentPreset = key;
    const preset = PRESETS[key];

    if (this.labelEl) this.labelEl.textContent = preset.name;
    const activeBtn = this.presetsEl?.querySelector('.music-preset.active');
    const nextBtn = this.presetsEl?.querySelector(`[data-preset="${key}"]`);
    if (activeBtn) activeBtn.classList.remove('active');
    if (nextBtn) nextBtn.classList.add('active');

    // 播放中：重启合成器
    if (this.isPlaying) {
      this.stopSynth();
      this.startSynth();
    }
  }

  /* ======== Web Audio 合成 ======== */

  _createDelay(ctx, time, feedback, mix) {
    const delay = ctx.createDelay(2);
    delay.delayTime.value = time;
    const fbGain = ctx.createGain();
    fbGain.gain.value = feedback;
    const wetGain = ctx.createGain();
    wetGain.gain.value = mix;
    const dryGain = ctx.createGain();
    dryGain.gain.value = 1 - mix;
    delay.connect(fbGain);
    fbGain.connect(delay);
    delay.connect(wetGain);
    return { input: dryGain, delayInput: delay, wetGain, dryGain, output: wetGain };
  }

  _playChord(ctx, freqs, t, dur, dest, gain, oscType) {
    freqs.forEach((freq) => {
      [-4, 4].forEach((detune) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = oscType;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.15);
        env.gain.linearRampToValueAtTime(gain * 0.7, t + 0.45);
        env.gain.setValueAtTime(gain * 0.7, t + dur - 0.8);
        env.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(env);
        env.connect(dest);
        osc.start(t);
        osc.stop(t + dur + 0.1);
        this.activeNodes.push(osc, env);
      });
    });
  }

  _playNote(ctx, freq, t, dur, dest, gain, oscType) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = oscType;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.05);
    env.gain.linearRampToValueAtTime(gain * 0.6, t + dur * 0.5);
    env.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    this.activeNodes.push(osc, env);
  }

  startSynth() {
    if (this.ctx) return;

    const preset = PRESETS[this.currentPreset] || PRESETS.moonlight;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    // 现代浏览器 AudioContext 创建后可能处于 suspended，需显式 resume
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = preset.filterFreq;
    filter.Q.value = preset.filterQ;
    filter.connect(this.masterGain);

    const delay = this._createDelay(ctx, preset.delayTime, preset.delayFeedback, preset.delayMix);
    delay.dryGain.connect(filter);
    delay.wetGain.connect(filter);
    const delayInput = delay.delayInput;

    const { chordProgression, pentatonic, melodyPatterns, barDuration, bassFreqs } = preset;
    const totalDur = barDuration * chordProgression.length;

    const scheduleLoop = () => {
      const now = ctx.currentTime;
      let st = this._nextScheduleTime || now;
      if (st < now) st = now;

      while (st < now + 8.0) {
        const cycleTime = st % totalDur;
        const barIdx = Math.floor(cycleTime / barDuration);

        if (Math.abs(cycleTime - barIdx * barDuration) < 0.01) {
          const chord = chordProgression[barIdx];
          this._playChord(ctx, chord.notes, st, barDuration, delayInput, preset.chordGain, preset.oscType);

          const bassOsc = ctx.createOscillator();
          const bassEnv = ctx.createGain();
          bassOsc.type = 'sine';
          bassOsc.frequency.value = bassFreqs[barIdx] / 2;
          bassEnv.gain.setValueAtTime(0, st);
          bassEnv.gain.linearRampToValueAtTime(preset.bassGain, st + 0.2);
          bassEnv.gain.linearRampToValueAtTime(preset.bassGain * 0.7, st + barDuration * 0.7);
          bassEnv.gain.linearRampToValueAtTime(0, st + barDuration);
          bassOsc.connect(bassEnv);
          bassEnv.connect(filter);
          bassOsc.start(st);
          bassOsc.stop(st + barDuration + 0.1);
          this.activeNodes.push(bassOsc, bassEnv);

          const melody = melodyPatterns[barIdx];
          const noteDur = barDuration / melody.length;
          melody.forEach((noteIdx, i) => {
            const freq = pentatonic[noteIdx % pentatonic.length];
            this._playNote(ctx, freq, st + i * noteDur, noteDur * 0.85, delayInput, preset.melodyGain, preset.melodyType);
          });
        }

        st += 0.05;
      }

      this._nextScheduleTime = st;
      this._scheduleTimer = setTimeout(() => scheduleLoop(), 2000);
    };

    const warmthOsc = ctx.createOscillator();
    const warmthGain = ctx.createGain();
    warmthOsc.type = 'triangle';
    warmthOsc.frequency.value = preset.warmthFreq;
    warmthGain.gain.value = preset.warmthGain;
    warmthOsc.connect(warmthGain);
    warmthGain.connect(filter);
    warmthOsc.start();
    this.activeNodes.push(warmthOsc, warmthGain);

    this.masterGain.connect(ctx.destination);
    this._nextScheduleTime = ctx.currentTime + 0.1;
    scheduleLoop();

    // 快速淡入，避免听起来像延迟
    this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(preset.masterVol, ctx.currentTime + 0.5);
  }

  stopSynth() {
    if (this._scheduleTimer) {
      clearTimeout(this._scheduleTimer);
      this._scheduleTimer = null;
    }
    this.activeNodes.forEach((node) => {
      try { if (node.stop && typeof node.stop === 'function') node.stop(); } catch (e) { /* */ }
    });
    this.activeNodes = [];
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  /* ======== 公共 API ======== */

  play() {
    if (this.isPlaying) return;  // 合成器秒启，无需 _starting 锁

    // 用户手势内同步解锁 AudioContext
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.startSynth();
    this.isPlaying = true;
    this.btn.classList.add('playing');
  }

  pause() {
    if (!this.isPlaying) return;
    this.stopSynth();
    this.isPlaying = false;
    this.btn.classList.remove('playing');
  }

  toggle() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  stopAll() {
    this.stopSynth();
  }
}
