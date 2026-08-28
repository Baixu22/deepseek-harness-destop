export const WINDOW_CONTROLS_CSS = `
#dsh-window-controls {
  position: fixed;
  z-index: 2147483647;
  top: 0;
  right: 0;
  display: flex;
  height: 38px;
  -webkit-app-region: no-drag;
}

#dsh-window-controls button {
  display: grid;
  width: 46px;
  height: 38px;
  margin: 0;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #81858c);
  font: 10px/1 "Segoe MDL2 Assets", "Segoe Fluent Icons", sans-serif;
  cursor: pointer;
  transition: background-color .15s ease, color .15s ease;
}

#dsh-window-controls button:hover {
  background: var(--dsw-alias-button-floating-hover, rgb(255 255 255 / 10%));
  color: var(--dsw-alias-label-primary, #f9fafb);
}

#dsh-window-controls button:active {
  background: var(--dsw-alias-button-tool-bar-hover, rgb(255 255 255 / 16%));
}

#dsh-window-controls button:focus-visible {
  outline: 2px solid #4f8cff;
  outline-offset: -2px;
}

#dsh-window-controls button[data-window-action="close"]:hover {
  background: #c42b1c;
  color: #ffffff;
}

/* The frameless shell owns the top-right corner: push the welcome-phase
   workspace composer stack down so it keeps clear of the 38px control
   strip and the panel cluster pinned beneath it. The substring attribute
   selector survives the app bundle's CSS-module hash. */
[data-phase="hero"] [class*="composerStack"] {
  margin-top: 28px;
}
`

export function createWindowControlsMarkup() {
  return `<div id="dsh-window-controls" aria-label="窗口控件">
    <button type="button" data-window-action="minimize" aria-label="最小化"><span aria-hidden="true">&#xE921;</span></button>
    <button type="button" data-window-action="toggle-maximize" aria-label="最大化"><span aria-hidden="true">&#xE922;</span></button>
    <button type="button" data-window-action="close" aria-label="关闭"><span aria-hidden="true">&#xE8BB;</span></button>
  </div>`
}

export function applyWindowControl(window, action) {
  if (action === 'minimize') window.minimize()
  else if (action === 'toggle-maximize') {
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  } else if (action === 'close') window.close()
  else if (action !== 'get-state') throw new Error(`unknown window control action: ${String(action)}`)
  return { maximized: !window.isDestroyed() && window.isMaximized() }
}
