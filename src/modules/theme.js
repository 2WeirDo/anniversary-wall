/**
 * 暗夜模式切换
 */
export function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const saved = localStorage.getItem('love-story-theme');
  // 首次访问（无记录）默认暗色模式，用户主动切亮色后则记住
  if (!saved || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('love-story-theme', next);
  });
}
