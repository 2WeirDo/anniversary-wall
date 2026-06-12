/**
 * Music Player — 在线音乐搜索与播放
 * 基于 GDStudio 免费音乐 API，支持网易云/酷我曲库搜索与流媒体播放
 */

/* ======== API 配置 ======== */
const SEARCH_SOURCE = 'netease';  // 网易云（音频直链可用）
const AUDIO_QUALITY = '320';
const SEARCH_COUNT = 15;

/* ======== 推荐情歌预设 ======== */
const PRESET_QUERIES = [
  { q: '周杰伦 简单爱 原唱', label: '简单爱', artist: '周杰伦' },
  { q: '告白气球 周杰伦', label: '告白气球', artist: '周杰伦' },
  { q: '林俊杰 修炼爱情', label: '修炼爱情', artist: '林俊杰' },
  { q: '光年之外 G.E.M.', label: '光年之外', artist: 'G.E.M. 邓紫棋' },
  { q: '依然爱你 王力宏', label: '依然爱你', artist: '王力宏' },
  { q: '陶喆 爱很简单', label: '爱很简单', artist: '陶喆' },
];

export class MusicPlayer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // DOM 引用
    this.panel = this.container.querySelector('.music-panel');
    this.btn = this.container.querySelector('.music-btn');
    this.labelEl = this.container.querySelector('.music-btn-label');
    this.arrowEl = this.container.querySelector('.music-btn-arrow');
    this.searchInput = this.container.querySelector('.music-search-input');
    this.resultsEl = this.container.querySelector('.music-results');
    this.presetsEl = this.container.querySelector('.music-presets');
    this.statusEl = this.container.querySelector('.music-status');

    // 状态
    this.panelOpen = false;
    this.isPlaying = false;
    this.isLoading = false;
    this.currentSong = null;
    this.queue = [];
    this.queueIndex = -1;
    this.presetCache = [];     // 预设搜索结果缓存
    this.searchTimer = null;
    this.audio = null;

    this.init();
  }

  /* ======== 初始化 ======== */
  init() {
    if (!this.container) return;

    // 创建 audio 元素
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('error', () => {
      this.isLoading = false;
      this.updatePlayButton();
    });

    // 主按钮：播放/暂停
    this.btn.addEventListener('click', (e) => {
      if (e.target.closest('.music-btn-arrow') || e.target.closest('.music-search-wrap')) return;
      e.stopPropagation();
      if (this.currentSong) this.toggle();
    });

    // 展开箭头
    if (this.arrowEl) {
      this.arrowEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePanel();
      });
    }

    // 搜索输入
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        clearTimeout(this.searchTimer);
        const q = this.searchInput.value.trim();
        if (!q) {
          this.showPresets();
          return;
        }
        this.searchTimer = setTimeout(() => this.doSearch(q), 350);
      });
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.searchInput.value = '';
          this.showPresets();
          this.searchInput.blur();
        }
      });
    }

    // 结果列表点击
    if (this.resultsEl) {
      this.resultsEl.addEventListener('click', (e) => {
        const item = e.target.closest('.music-result-item');
        if (!item) return;
        const idx = Number(item.dataset.index);
        const songList = this.panelOpen && this.searchInput.value.trim()
          ? this._lastSearchResults
          : this.presetCache;
        if (songList && songList[idx]) {
          this.playSong(songList[idx]);
        }
      });
    }

    // 点击面板外关闭
    document.addEventListener('click', (e) => {
      if (this.panelOpen && !e.target.closest('.music-player')) {
        this.closePanel();
      }
    });

    // 预设加载
    this.loadPresets();
  }

  /* ======== API 调用 ======== */

  /** 构建 API URL（生产环境走 CORS 代理） */
  _apiUrl(params) {
    const target = `https://music-api.gdstudio.xyz/api.php?${params}`;
    if (import.meta.env.DEV) return `/api/music/api.php?${params}`;
    return `https://corsproxy.io/?${encodeURIComponent(target)}`;
  }

  async _fetchAPI(params) {
    const url = this._apiUrl(params);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    return res;
  }

  async apiSearch(query, source = SEARCH_SOURCE) {
    const params = new URLSearchParams({
      types: 'search',
      source,
      name: query,
      pages: '1',
      count: String(SEARCH_COUNT),
    });
    const res = await this._fetchAPI(params);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(song => ({
      id: song.id || song.url_id,
      title: song.name || song.title || '未知歌曲',
      artist: Array.isArray(song.artist) ? song.artist.join(' / ') : (song.artist || '未知歌手'),
      album: song.album || '',
      picId: song.pic_id || '',
      urlId: song.url_id || song.id,
      lyricId: song.lyric_id || song.id,
      source: song.source || source,
    }));
  }

  async getAudioUrl(song) {
    const params = new URLSearchParams({
      types: 'url',
      id: song.urlId || song.id,
      source: song.source || SEARCH_SOURCE,
      br: AUDIO_QUALITY,
    });
    const res = await this._fetchAPI(params);
    const data = await res.json();
    return data.url || '';
  }

  /** 封面图 URL（统一走代理） */
  _coverUrl(song) {
    if (!song.picId) return '';
    const params = new URLSearchParams({
      types: 'pic',
      id: song.picId,
      source: song.source || SEARCH_SOURCE,
      size: '120',
    });
    return this._apiUrl(params);
  }

  /* ======== 搜索 ======== */

  async doSearch(query) {
    if (!query.trim()) return;
    this.showStatus('搜索中...');
    try {
      const songs = await this.apiSearch(query);
      this._lastSearchResults = songs;
      if (songs.length === 0) {
        this.showStatus('未找到歌曲，换个关键词试试');
      } else {
        this.renderResults(songs);
      }
    } catch (err) {
      console.warn('搜索出错:', err);
      this.showStatus('搜索失败，请稍后重试');
    }
  }

  /* ======== 预设加载 ======== */

  async loadPresets() {
    // 搜索第一首预设，其他在面板打开时懒加载
    try {
      const songs = await this.apiSearch(PRESET_QUERIES[0].q);
      if (songs.length > 0) this.presetCache.push(songs[0]);
    } catch (e) { /* 静默 */ }
  }

  async loadAllPresets() {
    if (this.presetCache.length >= PRESET_QUERIES.length) return;
    // 并行搜索所有未缓存的预设
    const startIdx = this.presetCache.length;
    const missing = PRESET_QUERIES.slice(startIdx);
    const results = await Promise.allSettled(
      missing.map(p => this.apiSearch(p.q))
    );
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.length > 0) {
        const target = PRESET_QUERIES[startIdx + i];
        const song = r.value.find(s => s.title.includes(target.label)) || r.value[0];
        this.presetCache.push(song);
      }
    });
    this.renderPresets();
  }

  /* ======== 播放控制 ======== */

  async playSong(song) {
    if (this.isLoading) return;

    // 如果已经在播放同一首歌，只切换暂停
    if (this.currentSong && this.currentSong.id === song.id && this.currentSong.source === song.source) {
      if (this.isPlaying) this.pause();
      else this.resume();
      return;
    }

    this.isLoading = true;
    this.currentSong = song;
    this.updatePlayButton();
    this.showStatus(`加载中 — ${song.title}`);

    try {
      const url = await this.getAudioUrl(song);
      if (!url) throw new Error('未获取到播放地址');

      this.audio.src = url;
      await this.audio.play();
      this.isPlaying = true;
      this.isLoading = false;
      this.btn.classList.add('playing');
      this.updateLabel();
      this.hideStatus();
      this.closePanel();
    } catch (err) {
      console.warn('播放失败:', err);
      this.isLoading = false;
      this.showStatus('播放失败，试试其他歌曲');
      this.updatePlayButton();
    }
  }

  play() {
    if (!this.audio || !this.currentSong) return;
    this.audio.play().then(() => {
      this.isPlaying = true;
      this.btn.classList.add('playing');
    }).catch(() => {});
  }

  pause() {
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying = false;
    this.btn.classList.remove('playing');
  }

  resume() { this.play(); }

  toggle() {
    if (this.isPlaying) this.pause();
    else this.resume();
  }

  next() {
    if (this.queue.length === 0) return;
    this.queueIndex = (this.queueIndex + 1) % this.queue.length;
    this.playSong(this.queue[this.queueIndex]);
  }

  prev() {
    if (this.queue.length === 0) return;
    this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
    this.playSong(this.queue[this.queueIndex]);
  }

  updateLabel() {
    if (!this.labelEl || !this.currentSong) return;
    const maxLen = 8;
    let title = this.currentSong.title;
    if (title.length > maxLen) title = title.slice(0, maxLen) + '…';
    this.labelEl.textContent = title;
  }

  updatePlayButton() {
    if (this.isLoading) {
      this.btn.classList.add('loading');
    } else {
      this.btn.classList.remove('loading');
    }
  }

  /* ======== 面板 ======== */

  togglePanel() {
    this.panelOpen ? this.closePanel() : this.openPanel();
  }

  openPanel() {
    this.panelOpen = true;
    this.panel.classList.add('open');
    this.btn.classList.add('open-arrow');
    this.showPresets();
    // 懒加载所有预设
    this.loadAllPresets();
    // 聚焦搜索框
    setTimeout(() => this.searchInput?.focus(), 150);
  }

  closePanel() {
    this.panelOpen = false;
    this.panel.classList.remove('open');
    this.btn.classList.remove('open-arrow');
  }

  /* ======== UI 渲染 ======== */

  renderPresets() {
    if (!this.presetsEl) return;
    if (this.presetCache.length === 0) {
      this.presetsEl.innerHTML = '<div class="music-status-text">加载推荐歌曲中...</div>';
      return;
    }
    this.presetsEl.innerHTML = this.presetCache.map((song, i) => `
      <div class="music-result-item" data-index="${i}" data-preset="true">
        <div class="music-result-cover">
          ${song.picId
            ? `<img src="${this._coverUrl(song)}" alt="" loading="lazy" />`
            : '<span class="music-result-nopic">🎵</span>'}
        </div>
        <div class="music-result-info">
          <span class="music-result-title">${escapeHtml(song.title)}</span>
          <span class="music-result-artist">${escapeHtml(song.artist)}</span>
        </div>
        <div class="music-result-badge">推荐</div>
      </div>
    `).join('');
  }

  showPresets() {
    this._lastSearchResults = null;
    if (this.statusEl) this.statusEl.style.display = 'none';
    if (this.resultsEl) {
      this.resultsEl.classList.add('presets-mode');
      this.renderPresets();
    }
  }

  renderResults(songs) {
    if (!this.resultsEl) return;
    this.resultsEl.classList.remove('presets-mode');
    if (this.statusEl) this.statusEl.style.display = 'none';
    this.resultsEl.innerHTML = songs.map((song, i) => `
      <div class="music-result-item" data-index="${i}">
        <div class="music-result-cover">
          ${song.picId
            ? `<img src="${this._coverUrl(song)}" alt="" loading="lazy" />`
            : '<span class="music-result-nopic">🎵</span>'}
        </div>
        <div class="music-result-info">
          <span class="music-result-title">${escapeHtml(song.title)}</span>
          <span class="music-result-artist">${escapeHtml(song.artist)}</span>
        </div>
        ${song.album ? `<span class="music-result-album">${escapeHtml(song.album)}</span>` : ''}
      </div>
    `).join('');
  }

  showStatus(msg) {
    if (!this.statusEl) return;
    this.statusEl.style.display = 'block';
    this.statusEl.textContent = msg;
  }

  hideStatus() {
    if (!this.statusEl) return;
    this.statusEl.style.display = 'none';
  }

  stopAll() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.isPlaying = false;
  }
}

/* ======== 工具函数 ======== */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
