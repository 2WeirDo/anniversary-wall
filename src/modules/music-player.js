/**
 * Music Player — 在线音乐搜索与播放
 * 基于 GDStudio 免费音乐 API，支持网易云/酷我曲库搜索与流媒体播放
 */

/* ======== API 配置 ======== */
const SEARCH_SOURCE = 'netease';  // 网易云（音频直链可用）
const AUDIO_QUALITY = '320';
const SEARCH_COUNT = 15;

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
    this.statusEl = this.container.querySelector('.music-status');

    // 状态
    this.panelOpen = false;
    this.isPlaying = false;
    this.isLoading = false;
    this.currentSong = null;
    this.queue = [];
    this.queueIndex = -1;
    this._lastSearchResults = [];
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
          this.clearResults();
          return;
        }
        this.searchTimer = setTimeout(() => this.doSearch(q), 350);
      });
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.searchInput.value = '';
          this.clearResults();
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
        if (this._lastSearchResults && this._lastSearchResults[idx]) {
          this.playSong(this._lastSearchResults[idx]);
        }
      });
    }

    // 点击面板外关闭
    document.addEventListener('click', (e) => {
      if (this.panelOpen && !e.target.closest('.music-player')) {
        this.closePanel();
      }
    });
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

  /* ======== 搜索（模糊匹配 + 歌手搜索 + 双源） ======== */

  async doSearch(query) {
    if (!query.trim()) return;
    this.showStatus('搜索中...');
    try {
      // 拆分关键词：完整查询 + 每个独立关键词分别搜索
      const keywords = query.trim().split(/\s+/).filter(k => k.length >= 2);
      const uniqueKw = [...new Set([query.trim(), ...keywords])];

      // 每个关键词 × 两个源（netease 歌手匹配好，kuwo 歌名匹配好）
      const sources = ['netease', 'kuwo'];
      const tasks = [];
      for (const kw of uniqueKw) {
        for (const src of sources) {
          tasks.push(this.apiSearch(kw, src));
        }
      }

      const results = await Promise.allSettled(tasks);

      // 合并去重（按 id+source 唯一键），netease 优先（音频可用）
      const seen = new Set();
      const merged = [];
      for (const r of results) {
        if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
        for (const song of r.value) {
          const key = `${song.id}|${song.source}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(song);
          }
        }
      }

      this._lastSearchResults = merged;
      if (merged.length === 0) {
        this.showStatus('未找到歌曲，换个关键词试试');
      } else {
        this.renderResults(merged);
      }
    } catch (err) {
      console.warn('搜索出错:', err);
      this.showStatus('搜索失败，请稍后重试');
    }
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

    // 标记当前加载中的行
    this._setItemLoading(song, true);
    this.isLoading = true;
    this.currentSong = song;

    try {
      const url = await this.getAudioUrl(song);
      if (!url) throw new Error('未获取到播放地址');

      this.audio.src = url;
      await this.audio.play();
      this.isPlaying = true;
      this.isLoading = false;
      this.btn.classList.add('playing', 'has-song');
      this.updateLabel();
      this._setItemLoading(song, false);
      this._highlightPlaying();
      this.closePanel();
    } catch (err) {
      console.warn('播放失败:', err);
      this.isLoading = false;
      this._setItemLoading(song, false);
      this.showStatus('播放失败，试试其他歌曲');
    }
  }

  play() {
    if (!this.audio || !this.currentSong) return;
    this.audio.play().then(() => {
      this.isPlaying = true;
      this.btn.classList.add('playing', 'has-song');
      this._highlightPlaying();
    }).catch(() => {});
  }

  pause() {
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying = false;
    this.btn.classList.remove('playing');
    // 保持 has-song：暂停时有待播图标
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

  /* ======== 面板 ======== */

  togglePanel() {
    this.panelOpen ? this.closePanel() : this.openPanel();
  }

  openPanel() {
    this.panelOpen = true;
    this.panel.classList.add('open');
    this.btn.classList.add('open-arrow');
    // 清空搜索框和结果，等待用户输入
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    this.clearResults();
    // 聚焦搜索框
    setTimeout(() => this.searchInput?.focus(), 150);
  }

  closePanel() {
    this.panelOpen = false;
    this.panel.classList.remove('open');
    this.btn.classList.remove('open-arrow');
  }

  /* ======== UI 渲染 ======== */

  /** 歌曲行模板 — 纯排版，无图片 */
  _songRow(song, index) {
    const isCurrent = this.currentSong
      && this.currentSong.id === song.id
      && this.currentSong.source === song.source;
    return `
      <div class="music-result-item${isCurrent && this.isPlaying ? ' playing' : ''}"
           data-index="${index}"
           data-song-id="${song.id}"
           data-song-source="${song.source || SEARCH_SOURCE}">
        <div class="music-result-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div class="music-result-info">
          <span class="music-result-title">${escapeHtml(song.title)}</span>
          <span class="music-result-artist">${escapeHtml(song.artist)}</span>
        </div>
        <div class="music-result-spinner"></div>
        <div class="music-result-playing-indicator">
          <span class="music-bar"></span>
          <span class="music-bar"></span>
          <span class="music-bar"></span>
        </div>
      </div>`;
  }

  /** 渲染搜索结果 */
  renderResults(songs) {
    if (!this.resultsEl) return;
    if (this.statusEl) this.statusEl.style.display = 'none';
    this.resultsEl.innerHTML = songs.map((song, i) =>
      this._songRow(song, i)
    ).join('');
    this._staggerIn();
  }

  /** 清空结果区 */
  clearResults() {
    this._lastSearchResults = [];
    if (!this.resultsEl) return;
    this.resultsEl.innerHTML = '';
    if (this.statusEl) this.statusEl.style.display = 'none';
  }

  /** 列表项入场 stagger 动画 */
  _staggerIn() {
    const items = this.resultsEl.querySelectorAll('.music-result-item');
    items.forEach((item, i) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(8px)';
      item.style.transition = `all 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) ${i * 0.04}s`;
      requestAnimationFrame(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      });
    });
  }

  /** 高亮当前播放歌曲行 */
  _highlightPlaying() {
    if (!this.resultsEl) return;
    // 清除所有 playing 状态
    this.resultsEl.querySelectorAll('.music-result-item.playing').forEach(el => {
      el.classList.remove('playing');
    });
    if (!this.currentSong || !this.isPlaying) return;
    // 高亮当前歌曲
    const item = this.resultsEl.querySelector(
      `[data-song-id="${this.currentSong.id}"][data-song-source="${this.currentSong.source}"]`
    );
    if (item) item.classList.add('playing');
  }

  /** 行内 loading 状态 */
  _setItemLoading(song, loading) {
    if (!this.resultsEl || !song) return;
    const item = this.resultsEl.querySelector(
      `[data-song-id="${song.id}"][data-song-source="${song.source || SEARCH_SOURCE}"]`
    );
    if (!item) return;
    if (loading) {
      item.classList.add('loading');
    } else {
      item.classList.remove('loading');
    }
  }

  showStatus(msg) {
    if (!this.statusEl || !this.resultsEl) return;
    this.resultsEl.innerHTML = '';
    this.statusEl.style.display = 'flex';
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
    this.btn.classList.remove('playing', 'has-song');
  }
}

/* ======== 工具函数 ======== */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
