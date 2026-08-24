import { readFileSync } from 'node:fs'

import { createWindowControlsMarkup, WINDOW_CONTROLS_CSS } from './window-controls.mjs'

const HERO_BACKGROUND_SCRIPT = readFileSync(new URL('./hero-background.js', import.meta.url), 'utf8')
const OFFICIAL_LOGO_SVG = readFileSync(new URL('./official-logo.svg', import.meta.url), 'utf8')

function fontFaces() {
  const faces = [
    { family: '"DM Sans"', weight: '400', file: 'dm-sans-400.woff2' },
    { family: '"DM Sans"', weight: '500', file: 'dm-sans-500.woff2' },
    { family: 'Montserrat', weight: '500', file: 'montserrat-500.woff2' },
    { family: 'Montserrat', weight: '600', file: 'montserrat-600.woff2' },
    { family: '"Host Grotesk"', weight: '300 800', file: 'host-grotesk-latin.woff2', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ]
  let css = ''
  for (const face of faces) {
    try {
      const data = readFileSync(new URL(`./fonts/${face.file}`, import.meta.url)).toString('base64')
      css += `@font-face { font-family: ${face.family}; font-style: normal; font-weight: ${face.weight}; font-display: swap; src: url(data:font/woff2;base64,${data}) format("woff2");${face.range ? ` unicode-range: ${face.range};` : ''} }\n    `
    } catch {
      /* fonts are optional */
    }
  }
  return css
}

function githubPreviewDataUrl() {
  try {
    return `data:image/jpeg;base64,${readFileSync(new URL('./github-preview.jpg', import.meta.url)).toString('base64')}`
  } catch {
    return ''
  }
}

const SPARKLE_SVG = '<svg width="14" height="14" viewBox="0 0 11 10" fill="none" class="ds-sparkle" aria-hidden="true"><path d="M3.80671 9.79513C3.72888 10.0318 3.39417 10.0318 3.31634 9.79513L2.8653 8.42365C2.66042 7.80074 2.17185 7.31217 1.54894 7.1073L0.177462 6.65626C-0.0591539 6.57843 -0.0591539 6.24371 0.177462 6.16589L1.54894 5.71484C2.17185 5.50997 2.66042 5.0214 2.8653 4.39849L3.31634 3.02701C3.39417 2.79039 3.72888 2.79039 3.80671 3.02701L4.25775 4.39849C4.46262 5.0214 4.9512 5.50997 5.57411 5.71484L6.94558 6.16589C7.1822 6.24371 7.1822 6.57843 6.94558 6.65626L5.57411 7.1073C4.9512 7.31217 4.46262 7.80074 4.25775 8.42365L3.80671 9.79513Z" fill="url(#star_grad_1)"></path><path class="ds-sparkle-sm" d="M8.15819 3.90034C8.11449 4.03322 7.92653 4.03322 7.88282 3.90034L7.62954 3.13018C7.51449 2.78038 7.24013 2.50602 6.89033 2.39097L6.12016 2.13769C5.98729 2.09398 5.98729 1.90602 6.12016 1.86231L6.89033 1.60903C7.24013 1.49398 7.51449 1.21962 7.62954 0.869819L7.88282 0.0996549C7.92653 -0.0332183 8.11449 -0.0332183 8.15819 0.0996549L8.41148 0.869819C8.52653 1.21962 8.80089 1.49398 9.15069 1.60903L9.92085 1.86231C10.0537 1.90602 10.0537 2.09398 9.92085 2.13769L9.15069 2.39097C8.80089 2.50602 8.52653 2.78038 8.41148 3.13018L8.15819 3.90034Z" fill="url(#star_grad_2)"></path><defs><linearGradient id="star_grad_1" x1="0" y1="3" x2="7" y2="10" gradientUnits="userSpaceOnUse"><stop stop-color="#426EFE"></stop><stop offset="1" stop-color="#5979E1" stop-opacity="0.4"></stop></linearGradient><linearGradient id="star_grad_2" x1="6" y1="0" x2="10" y2="4" gradientUnits="userSpaceOnUse"><stop stop-color="#426EFE"></stop><stop offset="1" stop-color="#4F70DC" stop-opacity="0.4"></stop></linearGradient></defs></svg>'

const ARROW_SVG = '<svg fill="none" height="16" viewBox="0 0 16 16" width="16" aria-hidden="true"><path d="M9.12947 3.44043L11.9556 6.26758C12.2104 6.52235 12.44 6.74965 12.606 6.95605C12.7797 7.17203 12.9345 7.42403 12.9849 7.74219C13.0119 7.91292 13.0119 8.08708 12.9849 8.25781C12.9345 8.57601 12.7798 8.82795 12.606 9.04395C12.44 9.25038 12.2105 9.47761 11.9556 9.73242L9.12947 12.5596L8.66951 13.0186L7.75056 12.0996L8.20955 11.6396L11.0367 8.81348C11.093 8.75714 11.1441 8.70445 11.192 8.65625H2.23103V7.35547H11.2037C11.1527 7.30398 11.0976 7.24747 11.0367 7.18652L8.20955 4.36035L7.75056 3.90039L8.66951 2.98145L9.12947 3.44043Z" fill="currentColor"></path></svg>'

export function createWelcomePage({ cachedBackend = false, frameless, iconDataUrl, version }) {
  const startupStatus = cachedBackend ? '正在快速启动 DeepSeek Harness…' : '正在准备桌面环境…'
  const startupDetail = cachedBackend
    ? '已复用本机运行环境，无需重复初始化。'
    : '首次启动可能需要约一分钟。'
  const startupProgress = cachedBackend ? 62 : 18
  const previewSrc = githubPreviewDataUrl()
  const previewPanel = previewSrc
    ? `<div class="gh-preview" aria-hidden="true"><img src="${previewSrc}" alt=""><span>GitHub · luo-ross/dsh-desktop</span></div>`
    : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DSH</title>
  <style>
    ${fontFaces()}
    @property --border-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
    :root {
      color-scheme: light;
      --ds-font-sans: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
      --ds-font-display: "Host Grotesk", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      --ds-color-brand-deep: #3a65c2;
      --ds-color-brand: #4176e6;
      --hero-mask: linear-gradient(rgba(0, 0, 0, 0.99) 0%, rgba(0, 0, 0, 0.91) 8.98%, rgba(0, 0, 0, 0) 100%);
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body {
      position: relative;
      font-family: var(--ds-font-sans);
      font-size: 16px;
      line-height: 24px;
      background: #f9f8f8;
      color: #1e232c;
    }
    a, button { -webkit-app-region: no-drag; }

    /* ---------- official header bar ---------- */
    .ds-header-wrapper { position: fixed; top: 0; left: 0; right: 0; z-index: 50; padding-top: 8px; }
    .ds-header-bar {
      display: flex; align-items: center; justify-content: space-between;
      width: min(100% - 48px, 1140px); margin: 0 auto; padding: 4px 0;
    }
    @media (min-width: 768px) { .ds-header-bar { width: min(100% - 144px, 1140px); } }
    @media (min-width: 1560px) { .ds-header-bar { width: min(100% - 160px, 1280px); } }
    ${frameless ? '.ds-header-bar { padding-right: 138px; }' : ''}
    .ds-logo { display: flex; align-items: center; flex-shrink: 0; color: var(--ds-color-brand); text-decoration: none; }
    .ds-logo svg { width: 143px; height: 23px; display: block; }
    .header-right { display: flex; align-items: center; gap: 24px; }
    .ds-btn-ghost {
      position: relative; display: flex; align-items: center; justify-content: center; gap: 8px;
      min-width: 80px; padding: 8px 12px; border: 1px solid transparent; border-radius: 100px;
      background: transparent; color: #121c31; font-family: var(--ds-font-sans);
      font-size: 15px; font-weight: 400; line-height: 18px; text-decoration: none;
      cursor: pointer; overflow: hidden; isolation: isolate; transition: border-color .2s;
    }
    .ds-btn-ghost::after {
      content: ""; position: absolute; top: 50%; left: 50%; width: 150%; aspect-ratio: 1 / 1;
      border-radius: 50%; opacity: 0; z-index: -1; background: rgba(0, 0, 0, .04);
      transform: translate(-50%, -50%) scale(0); transition: transform .36s ease-out, opacity .1s;
    }
    .ds-btn-ghost:hover::after { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    .gh-wrap { position: relative; }
    .gh-preview {
      position: absolute; top: calc(100% + 12px); right: 0; z-index: 60;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      width: 344px; padding: 12px; border: 1px solid rgba(0, 0, 0, .06); border-radius: 16px;
      background: #ffffff; backdrop-filter: blur(12px); box-shadow: 0 18px 50px rgba(25, 74, 143, .16);
      opacity: 0; transform: translateY(-4px); pointer-events: none;
      transition: opacity .2s ease-out, transform .2s ease-out;
    }
    .gh-wrap:hover .gh-preview { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .gh-preview img { width: 100%; border-radius: 8px; display: block; }
    .gh-preview span { font-size: 12px; line-height: 16px; color: rgba(0, 0, 0, .7); text-align: center; }
    .ver-pill { font-size: 14px; line-height: 18px; color: rgba(18, 28, 49, .72); white-space: nowrap; }

    /* ---------- hero section (official metrics) ---------- */
    .hero-section {
      position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 100%; min-height: 100vh; overflow: hidden; padding-bottom: 24px;
      background: linear-gradient(180deg, #9cc1e7 0%, rgba(250, 250, 250, 0) 100%);
    }
    .ink-wrap, .grid-wrap { position: absolute; inset: 0; pointer-events: none; }
    .ink-wrap {
      z-index: 0; overflow: hidden;
      -webkit-mask-image: var(--hero-mask); mask-image: var(--hero-mask);
    }
    .grid-wrap {
      z-index: 5;
      -webkit-mask-image: var(--hero-mask); mask-image: var(--hero-mask);
    }
    .ink-wrap canvas, .grid-wrap canvas { width: 100%; height: 100%; display: block; }
    .hero-container {
      position: relative; z-index: 10; width: min(100% - 144px, 1140px); margin: 0 auto;
      padding-top: 48px; display: flex; align-items: stretch; gap: 32px;
    }
    @media (min-width: 1560px) { .hero-container { width: min(100% - 160px, 1280px); } }
    @media (min-width: 1024px) { .hero-container { gap: 72px; } }
    @media (min-width: 1280px) { .hero-container { gap: 120px; } }
    .hero-left {
      flex: 0 1 55%; min-width: 0; display: flex; flex-direction: column;
      justify-content: flex-end; gap: 68px; padding-left: 8px;
    }
    .hero-block { display: flex; flex-direction: column; gap: 24px; }

    /* announce line above the slogan (official hover behaviour) */
    .announce {
      margin-left: 4px; font-size: 15px; line-height: 24px; color: #1e232c;
      text-decoration: none; transition: color .2s;
    }
    .announce:hover { color: #152443; }
    .announce .sparkle-wrap { display: inline-flex; align-items: center; height: 1lh; vertical-align: bottom; margin-right: 6px; }
    .announce .txt { opacity: .55; transition: opacity .2s; }
    .announce:hover .txt { opacity: 1; }
    .announce .arrow {
      display: inline-flex; align-items: center; height: 1lh; vertical-align: bottom; margin-left: 2px;
      opacity: .55; transition: opacity .2s, transform .2s;
    }
    .announce:hover .arrow { opacity: 1; transform: translateX(2px); }
    .ds-sparkle { animation: ds-sparkle-pulse 2.4s ease-in-out infinite; }
    .ds-sparkle .ds-sparkle-sm { transform-box: fill-box; transform-origin: center; animation: ds-sparkle-twinkle 2.4s ease-in-out .4s infinite; }
    @keyframes ds-sparkle-pulse { 0%, 100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.15); opacity: 1; } }
    @keyframes ds-sparkle-twinkle { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(.6); opacity: .4; } }

    /* slogan */
    h1 {
      margin: 0; width: fit-content; white-space: pre-line;
      font-family: var(--ds-font-display); font-size: 46px; font-weight: 400;
      line-height: 155%; letter-spacing: .4em; color: #152443; opacity: .92;
    }
    @media (max-width: 1023px) { h1 { font-size: 42px; letter-spacing: .2em; } }

    /* CTA cards */
    .cta-group { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; width: 100%; }
    .cta-card {
      position: relative; display: flex; flex-direction: column; gap: 6px;
      padding: 22px 24px; border: 2px solid rgba(255, 255, 255, .2); border-radius: 24px;
      background: rgba(255, 255, 255, .38); backdrop-filter: blur(12px);
      text-decoration: none; cursor: pointer; transition: background-color .2s, border-color .2s;
    }
    .cta-card::before {
      content: ""; position: absolute; inset: -2px; border-radius: inherit; padding: 2px;
      background: conic-gradient(from var(--border-angle), rgba(58, 101, 194, .15) 0, rgba(120, 170, 255, .7) 25%, rgba(58, 101, 194, .15) 50%, rgba(120, 170, 255, .7) 75%, rgba(58, 101, 194, .15) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      opacity: 0; transition: opacity .3s; animation: rotating-border 6s linear infinite; pointer-events: none;
    }
    @keyframes rotating-border { 0% { --border-angle: 0deg; } 100% { --border-angle: 360deg; } }
    @media (hover: hover) {
      .cta-card:hover { background: rgba(255, 255, 255, .5); border-color: transparent; }
      .cta-card:hover::before { opacity: 1; }
    }
    .cta-title {
      font-family: "Montserrat", var(--ds-font-sans); font-size: 18px; font-weight: 600;
      line-height: 150%; letter-spacing: -0.01em; color: var(--ds-color-brand-deep);
    }
    .cta-desc { font-size: 15px; line-height: 24px; color: rgba(0, 0, 0, .65); white-space: pre-line; }

    /* join / product card */
    .join-wrap { flex: 0 1 45%; min-width: 340px; min-height: 360px; display: flex; }
    @media (min-width: 1560px) { .join-wrap { flex-basis: 40%; } }
    .join-card {
      position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 16px;
      width: 100%; min-height: 360px; padding: 40px; border: 0; border-radius: 16px; overflow: hidden;
      background: rgba(255, 255, 255, .2); text-decoration: none; cursor: pointer;
      will-change: transform; transform: translateZ(0);
      transition: background-color .2s, border-color .2s, transform .5s ease-out;
    }
    @media (hover: hover) {
      .join-card:hover { transform: translateY(-4px) translateZ(0); }
      .join-card:hover .product-card-ink { transform: scale(1.08) translateZ(0); }
    }
    .product-card-ink {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: inherit;
      pointer-events: none; transform: translateZ(0); transition: transform .6s ease-out;
    }
    .join-mark {
      position: relative; z-index: 10; display: flex; align-items: center; gap: 8px;
      color: rgba(255, 255, 255, .78); font-size: 13px; letter-spacing: .08em;
    }
    .join-mark img { width: 22px; height: 22px; filter: invert(1); opacity: .92; }
    .join-content {
      position: relative; z-index: 10; display: flex; flex-direction: column; align-items: flex-start;
      gap: 12px; margin-top: auto; width: 100%;
    }
    .join-title {
      font-family: "Montserrat", var(--ds-font-sans); font-size: 24px; font-weight: 500;
      line-height: 170%; letter-spacing: -0.01em; color: #ffffff; margin: 0;
    }
    .status { width: 100%; }
    #startup-status { margin: 0; color: #ffffff; font-size: 14px; font-weight: 560; line-height: 1.45; }
    #startup-detail { margin: 4px 0 0; color: rgba(255, 255, 255, .62); font-size: 12.5px; line-height: 1.5; }
    .progress-wrap {
      position: relative; height: 4px; margin-top: 12px; overflow: hidden;
      border-radius: 999px; background: rgba(255, 255, 255, .18);
    }
    .progress {
      display: block; width: 100%; height: 4px; overflow: hidden; border: 0;
      border-radius: 999px; appearance: none; background: transparent;
    }
    .progress::-webkit-progress-bar { border-radius: inherit; background: transparent; }
    .progress::-webkit-progress-value { border-radius: inherit; background: #ffffff; transition: width 280ms ease-out; }
    .progress-effects {
      position: absolute; top: 0; bottom: 0; left: 0; overflow: hidden; border-radius: inherit;
      transition: width 280ms ease-out; pointer-events: none;
    }
    .progress-pulse {
      position: absolute; top: 0; bottom: 0; left: -28%; width: 28%; border-radius: inherit;
      background: linear-gradient(90deg, transparent 0%, rgba(100, 169, 255, .18) 18%, #64a9ff 42%, #ffffff 58%, rgba(142, 197, 255, .42) 76%, transparent 100%);
      box-shadow: 0 0 10px rgba(112, 181, 255, .62);
      animation: progress-sweep 1.25s linear infinite;
    }
    @keyframes progress-sweep { from { left: -28%; } to { left: 100%; } }
    .next-step { margin-top: 14px; color: rgba(255, 255, 255, .45); }
    .next-step strong { display: block; font-size: 13px; font-weight: 560; line-height: 1.45; }
    .next-step span { display: block; margin-top: 3px; font-size: 12px; line-height: 1.5; }

    /* cursor blend ring (official) */
    .cursor-ring {
      position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9999;
      will-change: transform, opacity; border-radius: 50%; opacity: 0; width: 0; height: 0;
      mix-blend-mode: difference;
      transition: width .3s cubic-bezier(.16, 1, .3, 1), height .3s cubic-bezier(.16, 1, .3, 1), margin .3s cubic-bezier(.16, 1, .3, 1), background-color .3s, border-color .3s, opacity .3s;
    }
    .cursor-ring.is-blend {
      width: 64px; height: 64px; margin-left: -32px; margin-top: -32px;
      border-color: transparent; background: #ffffff; mix-blend-mode: difference;
    }

    .ds-footer {
      position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); z-index: 10;
      display: flex; justify-content: space-between; width: min(100% - 144px, 1140px);
      padding-bottom: 14px; font-size: 12px; color: rgba(18, 28, 49, .5);
    }

    /* entry animations (official rise) */
    @keyframes hero-rise { from { opacity: 0; transform: translateY(34px); } to { opacity: 1; transform: none; } }
    .hero-block { animation: hero-rise .7s cubic-bezier(.16, 1, .3, 1) both; }
    .cta-group { animation: hero-rise .7s cubic-bezier(.16, 1, .3, 1) .12s both; }
    .join-wrap { animation: hero-rise .7s cubic-bezier(.16, 1, .3, 1) .18s both; }
    @media (prefers-reduced-motion: reduce) {
      .hero-block, .cta-group, .join-wrap { animation: none; }
      .ds-sparkle, .ds-sparkle .ds-sparkle-sm, .progress-pulse { animation: none; }
      .progress::-webkit-progress-value { transition: none; }
      .progress-effects { transition: none; }
    }

    @media (max-width: 980px) {
      .hero-container { width: calc(100% - 48px); padding-top: 24px; flex-direction: column; gap: 28px; }
      .hero-left { flex-basis: auto; gap: 32px; padding-left: 0; }
      .cta-group { grid-template-columns: 1fr; }
      .join-wrap { flex-basis: auto; min-width: 0; }
    }
    ${frameless ? `body::before {
      content: '';
      position: fixed;
      z-index: 40;
      inset: 0 320px auto 0;
      height: 32px;
      -webkit-app-region: drag;
    }
    ${WINDOW_CONTROLS_CSS}` : ''}
  </style>
</head>
<body>
  ${frameless ? createWindowControlsMarkup() : ''}
  <header class="ds-header-wrapper">
    <div class="ds-header-bar">
      <a class="ds-logo" href="https://github.com/luo-ross/dsh-desktop" target="_blank" rel="noopener noreferrer" aria-label="DSH 桌面版">${OFFICIAL_LOGO_SVG}</a>
      <div class="header-right">
        <div class="gh-wrap">
          <a class="ds-btn-ghost" href="https://github.com/luo-ross/dsh-desktop" target="_blank" rel="noopener noreferrer">GitHub</a>
          ${previewPanel}
        </div>
        <span class="ver-pill">DSH v${version}</span>
      </div>
    </div>
  </header>
  <section class="hero-section">
    <div class="ink-wrap"><canvas class="hero-fluid-canvas" aria-hidden="true"></canvas></div>
    <div class="grid-wrap"><canvas class="hero-grid-canvas" aria-hidden="true"></canvas></div>
    <div class="hero-container">
      <div class="hero-left">
        <div class="hero-block">
          <a class="announce" href="https://github.com/luo-ross/dsh-desktop" target="_blank" rel="noopener noreferrer">
            <span class="sparkle-wrap">${SPARKLE_SVG}</span><span class="txt">在原生 Windows 窗口中使用 DeepSeek Harness。应用正在准备本地运行环境，完成后将直接进入主窗口。</span><span class="arrow">${ARROW_SVG}</span>
          </a>
          <h1><span data-cursor="blend">探索未至之境</span></h1>
        </div>
        <div class="cta-group">
          <a class="cta-card" href="https://github.com/luo-ross/dsh-desktop" target="_blank" rel="noopener noreferrer">
            <span class="cta-title">本地桌面体验</span>
            <span class="cta-desc">内置 DeepSeek Harness 服务
无需手动启动网页版</span>
          </a>
          <a class="cta-card" href="https://github.com/luo-ross/dsh-desktop/releases" target="_blank" rel="noopener noreferrer">
            <span class="cta-title">即开即用</span>
            <span class="cta-desc">工作区、模型与会话能力
准备完成后自动进入</span>
          </a>
        </div>
      </div>
      <div class="join-wrap">
        <div class="join-card" aria-live="polite">
          <canvas class="product-card-ink" aria-hidden="true"></canvas>
          <div class="join-mark"><img src="${iconDataUrl}" alt=""><span>DEEPSEEK HARNESS</span></div>
          <div class="join-content">
            <h2 class="join-title">DSH<br>共赴智能新境</h2>
            <div class="status">
              <p id="startup-status">${startupStatus}</p>
              <p id="startup-detail">${startupDetail}</p>
              <div class="progress-wrap">
                <progress id="startup-progress" class="progress" max="100" value="${startupProgress}" aria-label="启动进度"></progress>
                <span id="startup-progress-effects" class="progress-effects" style="width: ${startupProgress}%" aria-hidden="true">
                  <span class="progress-pulse"></span>
                </span>
              </div>
              <div class="next-step"><strong>初始化应用运行环境</strong><span>正在加载服务与资源</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <footer class="ds-footer"><span>社区维护的非官方桌面版本</span><span>v${version}</span></footer>
  </section>
  <div class="cursor-ring" aria-hidden="true"></div>
  <script>${HERO_BACKGROUND_SCRIPT}</script>
</body>
</html>`
}
