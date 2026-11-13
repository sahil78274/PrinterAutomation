/**
 * Interaction test: drives the customer print flow without a real browser.
 * Verifies the quote engine wiring, step navigation, test payment and tracking.
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
for (const key of [
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
]) {
  globalThis[key] = dom.window[key];
}
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
const { calculateQuote } = await server.ssrLoadModule('/src/lib/pricing.js');
const { parsePageRanges, formatPageRanges, groupPages } =
  await server.ssrLoadModule('/src/lib/utils.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

/* ---------------------------------------------------------- pricing engine --- */
console.log('\nPricing engine');
const pricing = {
  bwSingle: 2,
  bwDouble: 3,
  colorSingle: 8,
  colorDouble: 14,
  a3Surcharge: 1.6,
  minimumCharge: 0,
};
const q1 = calculateQuote({ pricing, pageCount: 24, copies: 1, color: false, sides: 'single' });
check('24 pages B&W single = ₹48', q1.total === 48, `got ${q1.total}`);
check('24 sheets for single-sided', q1.sheetsUsed === 24, `got ${q1.sheetsUsed}`);
const q2 = calculateQuote({ pricing, pageCount: 24, copies: 1, color: false, sides: 'double' });
check(
  '24 pages B&W double = ₹36 (12 sheets × ₹3/sheet)',
  q2.total === 36 && q2.sheetsUsed === 12,
  `got ${q2.total}/${q2.sheetsUsed}`,
);
check('duplex is cheaper than 2× single-sided', q2.total < q1.total, `${q2.total} vs ${q1.total}`);
const q3 = calculateQuote({ pricing, pageCount: 10, copies: 3, color: true, sides: 'double' });
check(
  '10 pages colour double ×3 copies = ₹210 (5 sheets × ₹14 × 3)',
  q3.total === 210,
  `got ${q3.total}`,
);
const q4 = calculateQuote({ pricing: { ...pricing, minimumCharge: 20 }, pageCount: 2 });
check(
  'minimum charge tops up ₹4 to ₹20',
  q4.total === 20 && q4.minimumTopUp === 16,
  `got ${q4.total}`,
);
const q5 = calculateQuote({ pricing, pageCount: 5, paper: 'a3' });
check('A3 applies 1.6× multiplier', q5.unitPrice === 3.2, `got ${q5.unitPrice}`);
const q6 = calculateQuote({ pricing, pageCount: 11, copies: 1, sides: 'double' });
check(
  'odd page count rounds sheets up (11 → 6 sheets)',
  q6.sheetsUsed === 6,
  `got ${q6.sheetsUsed}`,
);

/* ------------------------------------------------------------ page parsing --- */
console.log('\nPage selection parser');
check('"1-3, 6" → [1,2,3,6]', JSON.stringify(parsePageRanges('1-3, 6', 10)) === '[1,2,3,6]');
check(
  'clamps beyond max (1-99 on 5 pages)',
  JSON.stringify(parsePageRanges('1-99', 5)) === '[1,2,3,4,5]',
);
check('ignores garbage input', parsePageRanges('abc', 10).length === 0);
check('format round-trip [1,2,3,5] → "1-3, 5"', formatPageRanges([1, 2, 3, 5]) === '1-3, 5');
check(
  'groupPages splits ranges',
  JSON.stringify(groupPages([1, 2, 4])) ===
    '[{"start":1,"end":2,"count":2},{"start":4,"end":4,"count":1}]',
);

/* ------------------------------------------------------- portal interaction --- */
console.log('\nCustomer portal flow (JSX in jsdom)');
const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
root.render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/print/SP-001'] },
    React.createElement(
      ToastProvider,
      null,
      React.createElement(AuthProvider, null, React.createElement(App)),
    ),
  ),
);
await sleep(1200);

const text = () => container.textContent ?? '';
const byText = (tag, label) =>
  [...container.querySelectorAll(tag)].find((el) =>
    el.textContent.trim().toLowerCase().includes(label.toLowerCase()),
  );

check('shop name shown on portal', text().includes('Sharma Digital Press'));
check('machine status shown', /Online|Printing now|Ready/i.test(text()));
check('per-page rate shown (₹2 B&W)', text().includes('₹2'));
check('upload step rendered', /Drop your PDF here/.test(text()));

// Inject a fake document through the app's own state path: simulate the uploader callback
// by dispatching a drop event with a fake PDF is not possible without pdf.js, so instead we
// verify the summary + step gates behave for the empty state.
const reviewBtn = byText('button', 'Review');
check('no Review button before a document is added', !reviewBtn);

// Step gate: clicking Pay before adding documents must not advance
const payTab = byText('button', 'Payment');
check('payment step is gated when no documents', Boolean(payTab?.disabled));

root.unmount();
container.remove();

/* -------------------------------------------------- machine not found path --- */
console.log('\nInvalid machine');
const c2 = document.createElement('div');
document.body.appendChild(c2);
const r2 = createRoot(c2);
r2.render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/print/SP-777'] },
    React.createElement(
      ToastProvider,
      null,
      React.createElement(AuthProvider, null, React.createElement(App)),
    ),
  ),
);
await sleep(1200);
check(
  'unknown machine shows error state',
  (c2.textContent ?? '').includes('Machine not recognised'),
);
check('error echoes scanned ID', (c2.textContent ?? '').includes('SP-777'));
r2.unmount();
c2.remove();

/* ------------------------------------------------------ order flow via API --- */
console.log('\nOrder creation + tracking');
const { createOrder } = await server.ssrLoadModule('/src/services/api.js');
const order = await createOrder({
  machineId: 'SP-001',
  customerName: 'Walk-in customer',
  documents: [
    {
      id: 'd1',
      name: 'Test.pdf',
      pages: 10,
      selectedPages: [1, 2, 3],
      copies: 1,
      color: false,
      sides: 'single',
      paper: 'a4',
      finishing: 'none',
      amount: 6,
    },
  ],
  pageCount: 3,
  copies: 1,
  color: false,
  sides: 'single',
  paper: 'a4',
  finishing: 'none',
  amount: 6,
  platformFee: 0.21,
  paymentMethod: 'upi',
});
check('order created with queued status', order.status === 'queued', order.status);
check('order flagged simulated', order.simulated === true);
check('payment reference is test-prefixed', String(order.paymentRef).startsWith('test_pay_'));

const c3 = document.createElement('div');
document.body.appendChild(c3);
const r3 = createRoot(c3);
r3.render(
  React.createElement(
    MemoryRouter,
    { initialEntries: [`/order/${order.id}`] },
    React.createElement(
      ToastProvider,
      null,
      React.createElement(AuthProvider, null, React.createElement(App)),
    ),
  ),
);
await sleep(1300);
const t3 = c3.textContent ?? '';
check('tracking page shows order id', t3.includes(order.id));
check('tracking page labels simulated order', /Simulated order/.test(t3));
check('tracking page offers agent demo control', /Simulate next agent update/.test(t3));
r3.unmount();
c3.remove();

await server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
