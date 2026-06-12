/**
 * GSAP ScrollTrigger 滚动入场动画
 */
import gsap from 'gsap';

export function initScrollReveals() {
  // ---- 板块标题统一淡入 ----
  const sectionTitles = document.querySelectorAll('.section-title, .section-sub, .gallery-header');
  sectionTitles.forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0, y: 50 },
      {
        opacity: 1, y: 0,
        duration: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  // ---- 时间线卡片：交错侧边滑入 ----
  const timelineCards = document.querySelectorAll('.timeline-card-inner');
  timelineCards.forEach((card) => {
    const isLeft = card.classList.contains('left');
    const fromX = isLeft ? -60 : 60;
    gsap.fromTo(card,
      { opacity: 0, x: fromX },
      {
        opacity: 1, x: 0,
        duration: 0.4,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  // ---- 星愿卡片：staggered 弹入 ----
  const wishCards = document.querySelectorAll('.wish-card');
  wishCards.forEach((card, i) => {
    gsap.fromTo(card,
      { opacity: 0, y: 40, scale: 0.92 },
      {
        opacity: 1, y: 0, scale: 1,
        duration: 0.6,
        delay: i * 0.04,
        ease: 'back.out(1.4)',
        scrollTrigger: {
          trigger: card.closest('.wish-group'),
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  // ---- 时间线中轴线随滚动亮起 ----
  const timelineLine = document.querySelector('.timeline-line-glow');
  if (timelineLine) {
    gsap.fromTo(timelineLine,
      { height: '0%' },
      {
        height: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: '#timeline-container',
          start: 'top 70%',
          end: 'bottom 60%',
          scrub: 0.4,
        },
      }
    );
  }

  // ---- 时间线钻石连接器逐个亮起 ----
  const gems = document.querySelectorAll('.timeline-connector');
  gems.forEach((gem) => {
    gsap.to(gem, {
      scrollTrigger: {
        trigger: gem,
        start: 'top 85%',
        toggleActions: 'play none none none',
        onEnter: () => gem.classList.add('gem-revealed'),
      },
    });
  });

  // ---- Hero 蝴蝶结滚动视差 ----
  const heroBow = document.querySelector('.hero-bow-large');
  if (heroBow) {
    gsap.to(heroBow, {
      y: -60,
      scale: 0.85,
      opacity: 0.3,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6,
      },
    });
  }

  // ---- Hero 标题滚动微移 ----
  const heroTitle = document.getElementById('hero-title');
  if (heroTitle) {
    gsap.to(heroTitle, {
      y: -30,
      opacity: 0.5,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
      },
    });
  }
}
