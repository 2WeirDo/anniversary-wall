/**
 * Music Player — 在线音乐搜索与播放
 * 基于 GDStudio 免费音乐 API，支持网易云/酷我曲库搜索与流媒体播放
 */

import content from '../data/content.json';

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
    this._searchAbort = null;
    this._autoPlayDone = false;
    this.favorites = this._loadFavorites();
    this._defaultFavoritesResolved = [];
    this._defaultFavoritesResolving = false;
    this.audio = null;

    this.init();
  }

  /* ======== 初始化 ======== */
  init() {
    if (!this.container) return;

    // 创建 audio 元素
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => {
      if (this.currentSong && this.audio) {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      }
    });
    this.audio.addEventListener('error', () => {
      this.isLoading = false;
    });
    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.duration) {
        const pct = this.audio.currentTime / this.audio.duration;
        this.btn.style.setProperty('--music-progress', pct.toFixed(4));
      }
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

    // 搜索输入（800ms 防抖 + 取消飞行中请求）
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        clearTimeout(this.searchTimer);
        const q = this.searchInput.value.trim();
        if (!q) {
          // 取消进行中的搜索，显示收藏列表
          if (this._searchAbort) { this._searchAbort.abort(); this._searchAbort = null; }
          this._renderFavorites();
          return;
        }
        this.searchTimer = setTimeout(() => this.doSearch(q), 800);
      });
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.searchInput.value = '';
          this._renderFavorites();
          this.searchInput.blur();
        }
      });
    }

    // 结果列表点击
    if (this.resultsEl) {
      this.resultsEl.addEventListener('click', (e) => {
        // 复制按钮
        const copyBtn = e.target.closest('.music-copy-btn');
        if (copyBtn) {
          e.stopPropagation();
          const text = copyBtn.dataset.copy;
          if (text) {
            navigator.clipboard.writeText(text).catch(() => {});
            // 复制成功反馈：图标短暂变色
            copyBtn.classList.add('copied');
            setTimeout(() => copyBtn.classList.remove('copied'), 1200);
          }
          return;
        }
        // 收藏按钮
        const favBtn = e.target.closest('.music-result-fav');
        if (favBtn) {
          e.stopPropagation();
          const favId = favBtn.dataset.songId;
          const favSource = favBtn.dataset.songSource;
          const song = this._lastSearchResults.find(s =>
            String(s.id) === favId && (s.source || SEARCH_SOURCE) === favSource
          );
          if (song) this._toggleFavorite(song);
          return;
        }
        // 歌曲播放
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

    // 页面加载后随机播放收藏列表歌曲
    this._tryAutoPlay();
  }

  /* ======== 自动播放 ======== */

  /** 页面加载后尝试自动播放（延迟 + 首次交互兜底） */
  _tryAutoPlay() {
    // 后台解析默认收藏（不阻塞）
    this._resolveDefaultFavorites();

    // 方案1：延迟 3s 尝试（等待默认收藏解析完成 + 部分浏览器允许）
    setTimeout(() => this._autoPlayRandom(), 3000);

    // 方案2：首次用户交互时兜底
    const handler = () => {
      if (!this._autoPlayDone && !this.currentSong) {
        this._autoPlayRandom();
      }
    };
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('touchstart', handler, { once: true });
    document.addEventListener('scroll', handler, { once: true });
  }

  /** 从收藏列表中随机选一首播放（默认收藏 + 用户收藏） */
  async _autoPlayRandom() {
    if (this._autoPlayDone || this.currentSong) return;
    this._autoPlayDone = true;

    // 合并可用歌曲列表
    const pool = [...this._defaultFavoritesResolved, ...this.favorites];
    if (pool.length === 0) return;

    try {
      const song = pool[Math.floor(Math.random() * pool.length)];
      await this.playSong(song);
    } catch (e) {
      // 自动播放被浏览器阻止或搜索失败，用户可手动播放
    }
  }

  /* ======== API 调用 ======== */

  /** 构建 API URL */
  _apiUrl(params) {
    if (import.meta.env.DEV) return `/api/music/api.php?${params}`;
    // 生产环境直接访问 music-api（走 JSONP，无需代理）
    return `https://music-api.gdstudio.xyz/api.php?${params}`;
  }

  /**
   * API 请求（开发用 fetch，生产用 JSONP 绕过 CORS）
   * - 重试：最多 2 次，指数退避（1s → 2s）
   * - 超时：12s
   */
  async _fetchAPI(params, signal, _retry = 0) {
    if (import.meta.env.DEV) {
      return this._devFetch(params, signal, _retry);
    }
    return this._jsonpFetch(params, _retry);
  }

  /** 开发环境：Vite proxy fetch（支持 AbortController） */
  async _devFetch(params, signal, _retry = 0) {
    const MAX_RETRIES = 2;
    const url = this._apiUrl(params);
    const timeoutAbort = new AbortController();
    const timeoutId = setTimeout(() => timeoutAbort.abort(), 12000);
    const mergedSignal = signal
      ? anySignal([signal, timeoutAbort.signal])
      : timeoutAbort.signal;
    try {
      const res = await fetch(url, { signal: mergedSignal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        if (res.status >= 500 && _retry < MAX_RETRIES) {
          await sleep(1000 * (_retry + 1));
          return this._devFetch(params, signal, _retry + 1);
        }
        throw new Error(`请求失败: ${res.status}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError' && !timeoutAbort.signal.aborted) throw err;
      if (_retry < MAX_RETRIES) {
        await sleep(1000 * (_retry + 1));
        return this._devFetch(params, signal, _retry + 1);
      }
      throw err;
    }
  }

  /** 生产环境：JSONP 请求（绕过 CORS，无需代理） */
  async _jsonpFetch(params, _retry = 0) {
    const MAX_RETRIES = 2;
    try {
      const data = await this._doJsonp(this._apiUrl(params));
      // 返回类 Response 对象，兼容现有调用方（res.json()）
      return { ok: true, status: 200, json: async () => data };
    } catch (err) {
      if (_retry < MAX_RETRIES) {
        await sleep(1000 * (_retry + 1));
        return this._jsonpFetch(params, _retry + 1);
      }
      throw err;
    }
  }

  /** JSONP 底层：动态插入 <script> 加载数据 */
  _doJsonp(url) {
    return new Promise((resolve, reject) => {
      const cbName = '_mp_' + Math.random().toString(36).slice(2, 10);
      const script = document.createElement('script');
      let done = false;

      const cleanup = () => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('请求超时，请检查网络'));
      }, 12000);

      window[cbName] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('网络请求失败，请稍后重试'));
      };

      script.src = url + '&callback=' + cbName;
      document.head.appendChild(script);
    });
  }

  async apiSearch(query, source = SEARCH_SOURCE, signal) {
    const params = new URLSearchParams({
      types: 'search',
      source,
      name: query,
      pages: '1',
      count: String(SEARCH_COUNT),
    });
    const res = await this._fetchAPI(params, signal);
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

    // 取消上一次未完成的搜索
    if (this._searchAbort) { this._searchAbort.abort(); }
    this._searchAbort = new AbortController();
    const signal = this._searchAbort.signal;

    this.showStatus('搜索中...');
    try {
      // 拆分关键词：完整查询 + 每个独立关键词分别搜索
      const keywords = query.trim().split(/\s+/).filter(k => k.length >= 2);
      const uniqueKw = [...new Set([query.trim(), ...keywords])];

      // 只用 netease 源（kuwo 音频直链经常为空，搜到不能播不如不展示）
      const sources = ['netease'];
      const tasks = [];
      for (const kw of uniqueKw) {
        for (const src of sources) {
          tasks.push(this.apiSearch(kw, src, signal));
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
      if (err.name === 'AbortError') return; // 被新搜索取消，静默忽略
      console.warn('搜索出错:', err);
      this.showStatus('搜索失败，请稍后重试');
    }
  }

  /* ======== 播放控制 ======== */

  async playSong(song) {
    if (this.isLoading) return;

    // 切歌时重置进度
    this.btn.style.setProperty('--music-progress', '0');

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
    const title = this.currentSong.title;
    const maxLen = 8;
    const truncated = title.length > maxLen ? title.slice(0, maxLen) + '…' : title;
    this.labelEl.textContent = truncated;
    // 超长标题启用 hover 滚动
    this.labelEl.classList.toggle('marquee', title.length > maxLen);
  }

  /* ======== 面板 ======== */

  togglePanel() {
    this.panelOpen ? this.closePanel() : this.openPanel();
  }

  openPanel() {
    this.panelOpen = true;
    this.panel.classList.add('open');
    this.btn.classList.add('open-arrow');
    // 清空搜索框，显示收藏列表
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    this._renderFavorites();
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
    const favorited = this._isFavorite(song);
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
          <span class="music-result-title">
            <button class="music-copy-btn"
                    data-copy="${escapeHtml(song.title)}"
                    aria-label="复制歌名"
                    title="复制歌名">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>${escapeHtml(song.title)}
          </span>
          <span class="music-result-artist">${escapeHtml(song.artist)}</span>
        </div>
        <div class="music-result-spinner"></div>
        <div class="music-result-playing-indicator">
          <span class="music-bar"></span>
          <span class="music-bar"></span>
          <span class="music-bar"></span>
        </div>
        <button class="music-result-fav${favorited ? ' favorited' : ''}"
                data-song-id="${song.id}"
                data-song-source="${song.source || SEARCH_SOURCE}"
                aria-label="${favorited ? '取消收藏' : '收藏歌曲'}"
                title="${favorited ? '取消收藏' : '收藏歌曲'}">
          <svg class="fav-icon-outline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <svg class="fav-icon-filled" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
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

  /* ======== 收藏管理 ======== */

  _getFavoriteKey(song) {
    return `${song.id}|${song.source || SEARCH_SOURCE}`;
  }

  _loadFavorites() {
    try {
      const raw = localStorage.getItem('music-favorites');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  /** 从 content.json 读取默认收藏关键词，逐个搜索并缓存结果 */
  async _resolveDefaultFavorites() {
    if (this._defaultFavoritesResolving) return;
    this._defaultFavoritesResolving = true;
    const defaults = content?.music?.defaultFavorites;
    if (!defaults || defaults.length === 0) {
      this._defaultFavoritesResolving = false;
      return;
    }
    try {
      const resolved = [];
      for (const item of defaults) {
        try {
          const results = await this.apiSearch(item.keyword);
          if (results.length > 0) {
            resolved.push(results[0]);
          }
        } catch {
          // 某首搜索失败，跳过
        }
      }
      this._defaultFavoritesResolved = resolved;
    } catch {
      // 整体解析失败，使用空数组
    }
    this._defaultFavoritesResolving = false;
  }

  _saveFavorites() {
    try {
      localStorage.setItem('music-favorites', JSON.stringify(this.favorites));
    } catch { /* 存储满时静默忽略 */ }
  }

  _isFavorite(song) {
    const key = this._getFavoriteKey(song);
    return this.favorites.some(f => this._getFavoriteKey(f) === key);
  }

  _toggleFavorite(song) {
    const key = this._getFavoriteKey(song);
    const idx = this.favorites.findIndex(f => this._getFavoriteKey(f) === key);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
    } else {
      this.favorites.push(song);
    }
    this._saveFavorites();

    // 刷新当前列表中的收藏按钮状态
    this._refreshFavButtons();

    // 如果搜索框为空且面板打开，刷新收藏列表
    if (this.panelOpen && !this.searchInput.value.trim()) {
      this._renderFavorites();
    }
  }

  /** 刷新列表中所有收藏按钮的视觉状态 */
  _refreshFavButtons() {
    if (!this.resultsEl) return;
    const btns = this.resultsEl.querySelectorAll('.music-result-fav');
    btns.forEach(btn => {
      const id = btn.dataset.songId;
      const source = btn.dataset.songSource;
      const fav = this.favorites.some(f =>
        String(f.id) === id && (f.source || SEARCH_SOURCE) === source
      );
      btn.classList.toggle('favorited', fav);
    });
  }

  /** 渲染收藏列表（当前播放歌曲 + 默认收藏 + 用户收藏，去重） */
  _renderFavorites() {
    if (!this.resultsEl) return;
    if (this.statusEl) this.statusEl.style.display = 'none';

    // 合并：当前播放歌曲置顶 → 默认收藏 → 用户收藏，按 id+source 去重
    const seen = new Set();
    const merged = [];

    // 当前播放歌曲始终在最上面
    if (this.currentSong) {
      const key = this._getFavoriteKey(this.currentSong);
      seen.add(key);
      merged.push(this.currentSong);
    }

    for (const song of this._defaultFavoritesResolved) {
      const key = this._getFavoriteKey(song);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(song);
      }
    }
    for (const song of this.favorites) {
      const key = this._getFavoriteKey(song);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(song);
      }
    }

    if (merged.length === 0) {
      this.resultsEl.innerHTML = '';
      return;
    }

    this._lastSearchResults = merged;
    this.resultsEl.innerHTML = merged.map((song, i) =>
      this._songRow(song, i)
    ).join('');
    this._staggerIn();
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

/** Promise 版 setTimeout */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 合并多个 AbortSignal — 任意一个触发即 abort
 * 兼容不支持 AbortSignal.any() 的浏览器
 */
function anySignal(signals) {
  if (AbortSignal.any) return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(); return controller.signal; }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
