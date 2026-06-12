/**
 * BGM 播放控制
 * 优先加载本地 FLAC/MP3 文件，文件不存在时自动回退到 Web Audio API 合成
 * 策略：首次用户点击后播放（符合浏览器自动播放策略）
 */

const BGM_PATHS = [
  `${import.meta.env.BASE_URL}bgm/bgm.mp3`,
  `${import.meta.env.BASE_URL}bgm/bgm.flac`,
];

export class AudioPlayer {
  constructor(btnId) {
    this.btn = document.getElementById(btnId);
    this.isPlaying = false;
    this.isInitialized = false;

    // HTML Audio 元素
    this.audio = document.getElementById('bgm-audio');

    // Web Audio API (fallback)
    this.ctx = null;
    this.masterGain = null;
    this.activeNodes = [];
    this.animFrame = null;

    // 当前模式: 'file' | 'synth' | null
    this.mode = null;

    this.init();
  }

  init() {
    if (!this.btn) return;

    this.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    window.addEventListener('beforeunload', () => {
      this.stopAll();
    });
  }

  /* ======== 本地文件模式 ======== */

  /**
   * 尝试用某个路径加载音频
   * 返回 true 表示成功加载并开始播放
   */
  tryLoadFile(path) {
    return new Promise((resolve) => {
      if (!this.audio) {
        resolve(false);
        return;
      }

      const handleCanPlay = () => {
        cleanup();
        resolve(true);
      };

      const handleError = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        this.audio.removeEventListener('canplay', handleCanPlay);
        this.audio.removeEventListener('error', handleError);
      };

      this.audio.addEventListener('canplay', handleCanPlay, { once: false });
      this.audio.addEventListener('error', handleError, { once: false });

      this.audio.src = path;
      this.audio.load();
    });
  }

  async startFilePlayback() {
    // 逐个尝试路径，找到第一个能播放的
    for (const path of BGM_PATHS) {
      const ok = await this.tryLoadFile(path);
      if (ok) {
        this.mode = 'file';
        this.audio.volume = 0;
        this.audio.loop = true;
        await this.audio.play();

        // 立即标记播放状态，不等淡入
        this.isPlaying = true;
        this.btn.classList.add('playing');

        // 原生 RAF 平滑淡入（替代 GSAP，减少依赖）
        const targetVol = 0.14;
        const startVol = this.audio.volume;
        const fadeStart = performance.now();
        const fadeDuration = 2400; // ms
        const fadeStep = (now) => {
          const t = Math.min((now - fadeStart) / fadeDuration, 1);
          // ease-out (power2 近似): 1 - (1-t)²
          this.audio.volume = startVol + (targetVol - startVol) * (1 - (1 - t) * (1 - t));
          if (t < 1) requestAnimationFrame(fadeStep);
        };
        requestAnimationFrame(fadeStep);

        return true;
      }
    }
    return false;
  }

  /* ======== Web Audio API 合成（Fallback） ======== */

  createDelay(ctx, time = 0.3, feedback = 0.25, mix = 0.3) {
    const delay = ctx.createDelay(2);
    delay.delayTime.value = time;

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = feedback;

    const wetGain = ctx.createGain();
    wetGain.gain.value = mix;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1 - mix;

    delay.connect(feedbackGain);
    feedbackGain.connect(delay);
    delay.connect(wetGain);

    return { input: dryGain, delayInput: delay, wetGain, dryGain, output: wetGain };
  }

  playChord(ctx, frequencies, startTime, duration, destination, baseGain = 0.06) {
    frequencies.forEach((freq) => {
      [-4, 4].forEach((detune) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;

        const t = startTime;
        const attack = 0.15;
        const decay = 0.3;
        const sustain = 0.7;
        const release = 0.8;

        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(baseGain, t + attack);
        env.gain.linearRampToValueAtTime(baseGain * sustain, t + attack + decay);
        env.gain.setValueAtTime(baseGain * sustain, t + duration - release);
        env.gain.linearRampToValueAtTime(0, t + duration);

        osc.connect(env);
        env.connect(destination);
        osc.start(t);
        osc.stop(t + duration + 0.1);

        this.activeNodes.push(osc, env);
      });
    });
  }

  playMelodyNote(ctx, freq, startTime, duration, destination, gain = 0.04) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    const t = startTime;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.05);
    env.gain.linearRampToValueAtTime(gain * 0.6, t + duration * 0.5);
    env.gain.linearRampToValueAtTime(0, t + duration);

    osc.connect(env);
    env.connect(destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);

    this.activeNodes.push(osc, env);
  }

  startSynth() {
    if (this.ctx) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.4;
    filter.connect(this.masterGain);

    const delay = this.createDelay(ctx, 0.35, 0.2, 0.35);
    delay.dryGain.connect(filter);
    delay.wetGain.connect(filter);

    const delayInput = delay.delayInput;

    const chordProgressions = [
      { notes: [261.63, 329.63, 392.00, 493.88] },
      { notes: [196.00, 246.94, 329.63, 349.23] },
      { notes: [220.00, 261.63, 329.63, 392.00] },
      { notes: [174.61, 220.00, 261.63, 329.63] },
    ];

    const pentatonic = [
      261.63, 293.66, 329.63, 392.00, 440.00,
      523.25, 587.33, 659.25, 783.99, 880.00,
    ];

    const melodyPatterns = [
      [0, 1, 2, 4, 7, 4, 2, 0],
      [7, 6, 4, 2, 0, 2, 4],
      [4, 2, 0, 2, 4, 6, 7],
      [2, 0, 2, 4, 2, 0],
    ];

    const barDuration = 4.0;
    const totalPatternDuration = barDuration * chordProgressions.length;
    const bassFreqs = [130.81, 98.00, 110.00, 87.31];

    const scheduleLoop = () => {
      const now = ctx.currentTime;
      const lookAhead = 0.2;
      const scheduleAhead = 8.0;

      let scheduleTime = this._nextScheduleTime || now;
      if (scheduleTime < now) scheduleTime = now;

      while (scheduleTime < now + scheduleAhead) {
        const cycleTime = scheduleTime % totalPatternDuration;
        const barIndex = Math.floor(cycleTime / barDuration);
        const barStartTime = scheduleTime - (cycleTime % barDuration);

        if (Math.abs(cycleTime - barIndex * barDuration) < 0.01) {
          const chord = chordProgressions[barIndex];
          this.playChord(ctx, chord.notes, scheduleTime, barDuration, delayInput, 0.045);

          const bassOsc = ctx.createOscillator();
          const bassEnv = ctx.createGain();
          bassOsc.type = 'sine';
          bassOsc.frequency.value = bassFreqs[barIndex] / 2;
          bassEnv.gain.setValueAtTime(0, scheduleTime);
          bassEnv.gain.linearRampToValueAtTime(0.03, scheduleTime + 0.2);
          bassEnv.gain.linearRampToValueAtTime(0.02, scheduleTime + barDuration * 0.7);
          bassEnv.gain.linearRampToValueAtTime(0, scheduleTime + barDuration);
          bassOsc.connect(bassEnv);
          bassEnv.connect(filter);
          bassOsc.start(scheduleTime);
          bassOsc.stop(scheduleTime + barDuration + 0.1);
          this.activeNodes.push(bassOsc, bassEnv);

          const melody = melodyPatterns[barIndex];
          const noteDuration = barDuration / melody.length;
          melody.forEach((noteIdx, i) => {
            const noteTime = scheduleTime + i * noteDuration;
            const freq = pentatonic[noteIdx % pentatonic.length];
            this.playMelodyNote(ctx, freq, noteTime, noteDuration * 0.85, delayInput, 0.03);
          });
        }

        scheduleTime += 0.05;
      }

      this._nextScheduleTime = scheduleTime;
      this._scheduleTimer = setTimeout(() => scheduleLoop(), 2000);
    };

    const warmthOsc = ctx.createOscillator();
    const warmthGain = ctx.createGain();
    warmthOsc.type = 'triangle';
    warmthOsc.frequency.value = 55;
    warmthGain.gain.value = 0.006;
    warmthOsc.connect(warmthGain);
    warmthGain.connect(filter);
    warmthOsc.start();
    this.activeNodes.push(warmthOsc, warmthGain);

    this.masterGain.connect(ctx.destination);

    this._nextScheduleTime = ctx.currentTime + 0.1;
    scheduleLoop();

    this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 2.5);
  }

  stopSynth() {
    if (this._scheduleTimer) {
      clearTimeout(this._scheduleTimer);
      this._scheduleTimer = null;
    }

    this.activeNodes.forEach((node) => {
      try {
        if (node.stop && typeof node.stop === 'function') node.stop();
      } catch (e) { /* ignore */ }
    });
    this.activeNodes = [];

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  /* ======== 公共 API ======== */

  async play() {
    // 防止重入：文件加载期间 isPlaying 尚未置 true，第二次调用会同时启动合成器
    if (this.isPlaying || this._starting) return;
    this._starting = true;

    try {
      // 已有加载好的文件：直接恢复播放
      if (this.mode === 'file' && this.audio && this.audio.src) {
        await this.audio.play();
        this.isPlaying = true;
        this.btn.classList.add('playing');
        return;
      }

      // 首次启动：优先尝试本地文件
      if (this.audio && !this.isInitialized) {
        const fileLoaded = await this.startFilePlayback();
        if (fileLoaded) return; // startFilePlayback 已设置 playing 状态
      }

      // 回退：Web Audio API 合成
      this.mode = 'synth';
      this.startSynth();
      this.isPlaying = true;
      this.btn.classList.add('playing');
    } catch (err) {
      console.warn('Audio playback failed:', err.message);
    } finally {
      this._starting = false;
    }
  }

  pause() {
    if (!this.isPlaying) return;

    if (this.mode === 'file' && this.audio) {
      this.audio.pause();
    } else if (this.mode === 'synth') {
      this.stopSynth();
    }

    this.isPlaying = false;
    this.btn.classList.remove('playing');
  }

  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  initPlay() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.play();
  }

  stopAll() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.stopSynth();
  }
}
