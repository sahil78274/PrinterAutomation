/**
 * Headless accessibility sanity check (jsdom).
 * Asserts each key route has exactly one h1, alt text on images, named buttons
 * and programmatically labelled form fields. Run with: node scripts/a11y-check.mjs
 */
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
for (const k of [
  'HTMLElement',
  'Element',
  'Node',
  'SVGElement',
  'HTMLCanvasElement',
  'Image',
  'Event',
  'MouseEvent',
  'CustomEvent',
  'KeyboardEvent',
  'getComputedStyle',
  'localStorage',
])
  globalThis[k] = dom.window[k];
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (i) => clearTimeout(i);
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};
globalThis.window.scrollTo = () => {};

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
const App = (await server.ssrLoadModule('/src/App.jsx')).default;
const s = (r) =>
  JSON.stringify({
    token: `mock_jwt_${r}_1`,
    user: {
      id: 'u',
      role: r,
      name: r === 'admin' ? 'Aarav Mehta' : 'Rohit Sharma',
      email: 'a@b.in',
      title: 'Owner',
      shopId: r === 'admin' ? null : 'shop_hsr_01',
      shopName: 'Sharma Digital Press',
    },
  });
const routes = [
  ['/', null],
  ['/print/SP-001', null],
  ['/login', null],
  ['/shop', 'shop'],
  ['/shop/orders', 'shop'],
  ['/shop/pricing', 'shop'],
  ['/shop/settings', 'shop'],
  ['/admin', 'admin'],
  ['/admin/machines', 'admin'],
  ['/admin/analytics', 'admin'],
];
for (const [path, role] of routes) {
  if (role) localStorage.setItem('smartprint.session.v1', s(role));
  else localStorage.removeItem('smartprint.session.v1');
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  root.render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [path] },
      React.createElement(
        ToastProvider,
        null,
        React.createElement(AuthProvider, null, React.createElement(App)),
      ),
    ),
  );
  await new Promise((r) => setTimeout(r, 900));
  const h1 = [...c.querySelectorAll('h1')].map((e) => e.textContent.trim().slice(0, 40));
  const imgNoAlt = [...c.querySelectorAll('img')].filter((i) => !i.getAttribute('alt')).length;
  const btns = [...c.querySelectorAll('button')].filter(
    (b) => !b.textContent.trim() && !b.getAttribute('aria-label'),
  );
  const inputs = [...c.querySelectorAll('input,select,textarea')].filter((i) => {
    const id = i.id;
    return (
      !i.getAttribute('aria-label') &&
      !i.getAttribute('placeholder') &&
      !(id && c.querySelector(`label[for="${id}"]`)) &&
      !i.closest('label')
    );
  });
  const bad = [];
  if (h1.length !== 1) bad.push(`h1×${h1.length}${h1.length ? ` (${h1.join(' | ')})` : ''}`);
  if (imgNoAlt) bad.push(`img without alt: ${imgNoAlt}`);
  if (btns.length) bad.push(`unnamed buttons: ${btns.length}`);
  if (inputs.length) bad.push(`unlabelled fields: ${inputs.length}`);
  console.log(`${bad.length ? '⚠' : '✓'} ${path.padEnd(18)} ${bad.join('; ') || 'ok'}`);
  root.unmount();
  c.remove();
}
await server.close();
