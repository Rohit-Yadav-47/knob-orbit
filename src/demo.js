// Browser-only stand-in for the Electron main process.
// Enter = knob click, ← / → = rotate, Esc = close.
import config from '../orbit.config.json';

export function installDemo() {
  document.body.classList.add('demo');
  let listener = () => {};
  let state = 'idle';
  let sel = 0;
  let pos = 0;
  let mode = null;
  let tick = 0;

  const send = (s) => listener({ accent: config.accent, ...s });
  const menu = () => send({ view: 'menu', items: config.items, sel, pos });

  window.orbit = { onState: (cb) => (listener = cb) };
  window.orbitDemo = (action) => {
    if (action === 'escape') { state = 'idle'; return send({ view: null }); }
    if (state === 'idle') {
      if (action === 'click' || action === 'right' || action === 'left') {
        state = 'menu';
        if (action !== 'click') {
          const d = action === 'right' ? 1 : -1;
          sel = (sel + d + config.items.length) % config.items.length;
          pos += d;
        }
        menu();
      }
    } else if (state === 'menu') {
      if (action === 'click') {
        const item = config.items[sel];
        if (item.type === 'mode') { state = 'mode'; mode = item; tick = 0; send({ view: 'hud', item, tick }); }
        else { state = 'idle'; send({ view: null }); }
        return;
      }
      const d = action === 'right' ? 1 : -1;
      sel = (sel + d + config.items.length) % config.items.length;
      pos += d;
      menu();
    } else {
      if (action === 'click') { state = 'idle'; return send({ view: null }); }
      tick += action === 'right' ? 1 : -1;
      send({ view: 'hud', item: mode, tick });
    }
  };

  window.addEventListener('keydown', (e) => {
    const action = { ArrowRight: 'right', ArrowLeft: 'left', Enter: 'click', Escape: 'escape' }[e.key];
    if (action) { e.preventDefault(); window.orbitDemo(action); }
  });
}
