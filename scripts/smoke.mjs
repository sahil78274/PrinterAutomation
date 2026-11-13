/**
 * Headless render smoke test (jsdom).
 * Mounts every route with a mocked session and asserts that no runtime error is
 * thrown and that key content appears. Run with: node scripts/smoke.mjs
 *
 * Not part of the app bundle — a developer sanity check for this preview.
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
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
globalThis.Image = dom.window.Image;
globalThis.DOMRect = dom.window.DOMRect ?? class {};
globalThis.Event = dom.window.Event;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
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
globalThis.localStorage = dom.window.localStorage;

const errors = [];
const origError = console.error;
console.error = (...args) => {
  const text = args.map(String).join(' ');
  if (/not wrapped in act|Warning: ReactDOM|jsdom/i.test(text)) return;
  errors.push(text);
  origError(...args);
};

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

const session = (role) =>
  JSON.stringify({
    token: `mock_jwt_${role}_1`,
    user: {
      id: role === 'admin' ? 'usr_admin_01' : 'usr_shop_01',
      role,
      name: role === 'admin' ? 'Aarav Mehta' : 'Rohit Sharma',
      email: role === 'admin' ? 'admin@smartprint.in' : 'owner@smartprint.in',
      title: role === 'admin' ? 'Super Admin' : 'Owner',
      shopId: role === 'admin' ? null : 'shop_hsr_01',
      shopName: role === 'admin' ? 'SmartPrint Platform' : 'Sharma Digital Press',
    },
  });

const ROUTES = [
  { path: '/', role: null, expect: 'Scan. Upload. Print.' },
  { path: '/login', role: null, expect: 'Sign in to SmartPrint' },
  { path: '/print/SP-001', role: null, expect: 'Sharma Digital Press' },
  { path: '/print/SP-999', role: null, expect: 'Machine not recognised' },
  { path: '/order/NOPE', role: null, expect: 'Order not found' },
  { path: '/shop', role: 'shop', expect: 'Machines' },
  { path: '/shop/orders', role: 'shop', expect: 'Print job history' },
  { path: '/shop/machines', role: 'shop', expect: 'Register a new machine' },
  { path: '/shop/pricing', role: 'shop', expect: 'Pricing management' },
  { path: '/shop/payments', role: 'shop', expect: 'Payment reports' },
  { path: '/shop/subscription', role: 'shop', expect: 'Subscription' },
  { path: '/shop/settings', role: 'shop', expect: 'Operating preferences' },
  { path: '/shop/orders/SP1041', role: 'shop', expect: 'Job' },
  { path: '/admin', role: 'admin', expect: 'Network overview' },
  { path: '/admin/shops', role: 'admin', expect: 'Shop management' },
  { path: '/admin/machines', role: 'admin', expect: 'Machine registration' },
  { path: '/admin/machines/SP-002', role: 'admin', expect: 'Machine QR code' },
  { path: '/admin/jobs', role: 'admin', expect: 'Print job monitor' },
  { path: '/admin/subscriptions', role: 'admin', expect: 'Subscription management' },
  { path: '/admin/analytics', role: 'admin', expect: 'Revenue analytics' },
  { path: '/shop', role: 'admin', expect: 'Restricted area' },
  { path: '/does-not-exist', role: null, expect: 'Page not found' },
];

const App = (await server.ssrLoadModule('/src/App.jsx')).default;

let failures = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const route of ROUTES) {
  errors.length = 0;
  if (route.role) localStorage.setItem('smartprint.session.v1', session(route.role));
  else localStorage.removeItem('smartprint.session.v1');

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [route.path] },
        React.createElement(
          ToastProvider,
          null,
          React.createElement(AuthProvider, null, React.createElement(App)),
        ),
      ),
    );
    await sleep(950);
    const text = container.textContent ?? '';
    const ok = text.includes(route.expect) && errors.length === 0;
    if (!ok) {
      failures += 1;
      console.log(`✗ ${route.path} (${route.role ?? 'public'})`);
      if (!text.includes(route.expect)) console.log(`   missing text: "${route.expect}"`);
      if (errors.length) console.log(`   errors: ${errors.slice(0, 3).join(' | ').slice(0, 500)}`);
    } else {
      console.log(`✓ ${route.path} (${route.role ?? 'public'})`);
    }
  } catch (error) {
    failures += 1;
    console.log(`✗ ${route.path} threw: ${error.message}`);
  } finally {
    root.unmount();
    container.remove();
  }
}

await server.close();
console.log(failures === 0 ? '\nAll routes rendered cleanly.' : `\n${failures} route(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
