import { seededRandom } from '../lib/utils.js';

/**
 * Seed data for the frontend preview.
 * Everything here is MOCK DATA. It mirrors the shapes the future Express/MongoDB
 * API will return so screens can be wired up without rewrites.
 */

const rand = seededRandom(20240517);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const BASE_PRICING = {
  bwSingle: 2,
  bwDouble: 3,
  colorSingle: 8,
  colorDouble: 14,
  a3Surcharge: 1.6,
  minimumCharge: 5,
};

export const SHOPS = [
  {
    id: 'shop_hsr_01',
    name: 'Sharma Digital Press',
    ownerName: 'Rohit Sharma',
    email: 'owner@smartprint.in',
    phone: '+91 98110 45231',
    address: 'Shop 12, Sector 29 Market, Gurugram, Haryana 122002',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    gstin: '06AABCS1429P1ZQ',
    planId: 'growth',
    planStatus: 'active',
    planRenewsOn: '2026-12-01',
    joinedOn: '2024-03-11',
    rating: 4.8,
    reviews: 412,
    openHours: '09:00 – 21:00',
    timezone: 'Asia/Kolkata',
    payout: { method: 'UPI', handle: 'sharmadigital@okhdfcbank', cycle: 'T+2' },
    settings: {
      acceptOrders: true,
      requirePaymentBeforePrint: true,
      maxUploadMb: 25,
      autoCancelMinutes: 20,
      notifyOnJobComplete: true,
    },
  },
  {
    id: 'shop_hsr_02',
    name: 'Campus Copy Centre',
    ownerName: 'Neha Verma',
    email: 'campus@smartprint.in',
    phone: '+91 98765 33120',
    address: 'Gate 2, University Road, Hisar, Haryana 125001',
    city: 'Hisar',
    state: 'Haryana',
    pincode: '125001',
    gstin: '06AAECV8821K1Z7',
    planId: 'starter',
    planStatus: 'active',
    planRenewsOn: '2026-11-28',
    joinedOn: '2025-01-19',
    rating: 4.6,
    reviews: 188,
    openHours: '08:00 – 22:00',
    timezone: 'Asia/Kolkata',
    payout: { method: 'Bank', handle: 'HDFC ****4021', cycle: 'T+3' },
    settings: {
      acceptOrders: true,
      requirePaymentBeforePrint: true,
      maxUploadMb: 20,
      autoCancelMinutes: 15,
      notifyOnJobComplete: false,
    },
  },
  {
    id: 'shop_hsr_03',
    name: 'Pixel Point Prints',
    ownerName: 'Imran Qureshi',
    email: 'pixelpoint@smartprint.in',
    phone: '+91 90045 78112',
    address: 'Ground Floor, DLF Cyber Hub, Gurugram, Haryana 122002',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    gstin: '06AAJCP7712M1Z4',
    planId: 'scale',
    planStatus: 'active',
    planRenewsOn: '2026-12-14',
    joinedOn: '2023-08-02',
    rating: 4.9,
    reviews: 967,
    openHours: '24 × 7',
    timezone: 'Asia/Kolkata',
    payout: { method: 'UPI', handle: 'pixelpoint@okicici', cycle: 'T+1' },
    settings: {
      acceptOrders: true,
      requirePaymentBeforePrint: true,
      maxUploadMb: 40,
      autoCancelMinutes: 30,
      notifyOnJobComplete: true,
    },
  },
  {
    id: 'shop_hsr_04',
    name: 'Verma Xerox & Stationery',
    ownerName: 'Sandeep Verma',
    email: 'vermaxerox@smartprint.in',
    phone: '+91 94160 22319',
    address: 'Near Bus Stand, Circular Road, Rohtak, Haryana 124001',
    city: 'Rohtak',
    state: 'Haryana',
    pincode: '124001',
    gstin: '06AADCV2298L1ZR',
    planId: 'starter',
    planStatus: 'past_due',
    planRenewsOn: '2026-09-30',
    joinedOn: '2025-06-24',
    rating: 4.2,
    reviews: 74,
    openHours: '09:30 – 20:30',
    timezone: 'Asia/Kolkata',
    payout: { method: 'UPI', handle: 'vermaxerox@okaxis', cycle: 'T+3' },
    settings: {
      acceptOrders: false,
      requirePaymentBeforePrint: true,
      maxUploadMb: 15,
      autoCancelMinutes: 15,
      notifyOnJobComplete: false,
    },
  },
  {
    id: 'shop_hsr_05',
    name: 'Blue Dot Reprographics',
    ownerName: 'Ananya Iyer',
    email: 'bluedot@smartprint.in',
    phone: '+91 88264 90123',
    address: 'Plot 44, Udyog Vihar Phase IV, Gurugram, Haryana 122015',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122015',
    gstin: '06AAFCB9021R1Z8',
    planId: 'growth',
    planStatus: 'active',
    planRenewsOn: '2026-11-20',
    joinedOn: '2024-11-05',
    rating: 4.7,
    reviews: 311,
    openHours: '10:00 – 20:00',
    timezone: 'Asia/Kolkata',
    payout: { method: 'Bank', handle: 'ICICI ****8790', cycle: 'T+2' },
    settings: {
      acceptOrders: true,
      requirePaymentBeforePrint: true,
      maxUploadMb: 30,
      autoCancelMinutes: 20,
      notifyOnJobComplete: true,
    },
  },
  {
    id: 'shop_hsr_06',
    name: 'A1 Print Studio',
    ownerName: 'Kabir Malhotra',
    email: 'a1print@smartprint.in',
    phone: '+91 99711 45670',
    address: 'Unit 6, Sector 18 Market, Noida, Uttar Pradesh 201301',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201301',
    gstin: '09AAGCA3388N1Z2',
    planId: 'growth',
    planStatus: 'active',
    planRenewsOn: '2026-12-08',
    joinedOn: '2024-07-16',
    rating: 4.5,
    reviews: 253,
    openHours: '09:00 – 21:30',
    timezone: 'Asia/Kolkata',
    payout: { method: 'UPI', handle: 'a1print@ybl', cycle: 'T+2' },
    settings: {
      acceptOrders: true,
      requirePaymentBeforePrint: true,
      maxUploadMb: 25,
      autoCancelMinutes: 20,
      notifyOnJobComplete: false,
    },
  },
  {
    id: 'shop_hsr_07',
    name: 'The Drafting Room',
    ownerName: 'Meera Nair',
    email: 'drafting@smartprint.in',
    phone: '+91 97177 88204',
    address: '2nd Floor, Connaught Place, New Delhi 110001',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    gstin: '07AAHCT5510Q1Z9',
    planId: 'scale',
    planStatus: 'active',
    planRenewsOn: '2026-12-31',
    joinedOn: '2023-02-08',
    rating: 4.8,
    reviews: 1284,
    openHours: '08:30 – 22:00',
    timezone: 'Asia/Kolkata',
    payout: { method: 'Bank', handle: 'Axis ****1187', cycle: 'T+1' },
    settings: {
      acceptOrders: true,
      requirePaymentBeforePrint: true,
      maxUploadMb: 60,
      autoCancelMinutes: 30,
      notifyOnJobComplete: true,
    },
  },
  {
    id: 'shop_hsr_08',
    name: 'Sai Document Solutions',
    ownerName: 'Vikram Rao',
    email: 'saidocs@smartprint.in',
    phone: '+91 96320 77418',
    address: '12-4-88, Tilak Road, Hyderabad, Telangana 500001',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001',
    gstin: '36AAKCS7723B1ZT',
    planId: 'starter',
    planStatus: 'trial',
    planRenewsOn: '2026-11-27',
    joinedOn: '2026-10-28',
    rating: 4.1,
    reviews: 21,
    openHours: '09:00 – 20:00',
    timezone: 'Asia/Kolkata',
    payout: { method: 'UPI', handle: 'saidocs@okhdfcbank', cycle: 'T+3' },
    settings: {
      acceptOrders: true,
      requirePaymentBeforePrint: true,
      maxUploadMb: 15,
      autoCancelMinutes: 15,
      notifyOnJobComplete: false,
    },
  },
];

const MACHINE_SEEDS = [
  {
    id: 'SP-001',
    shopId: 'shop_hsr_01',
    name: 'Counter A',
    model: 'HP LaserJet Pro M404dn',
    status: 'online',
    color: false,
    duplex: true,
    agent: 'press-01-agent',
  },
  {
    id: 'SP-002',
    shopId: 'shop_hsr_01',
    name: 'Counter B',
    model: 'Canon imageRUNNER 2630i',
    status: 'busy',
    color: true,
    duplex: true,
    agent: 'press-01-agent',
  },
  {
    id: 'SP-003',
    shopId: 'shop_hsr_01',
    name: 'Back Office',
    model: 'Epson EcoTank L3252',
    status: 'maintenance',
    color: true,
    duplex: false,
    agent: 'press-01-agent',
  },
  {
    id: 'SP-004',
    shopId: 'shop_hsr_02',
    name: 'Library Desk',
    model: 'Brother HL-L2351DW',
    status: 'online',
    color: false,
    duplex: true,
    agent: 'campus-agent-1',
  },
  {
    id: 'SP-005',
    shopId: 'shop_hsr_02',
    name: 'Xerox Point',
    model: 'Xerox VersaLink C405',
    status: 'offline',
    color: true,
    duplex: true,
    agent: 'campus-agent-1',
  },
  {
    id: 'SP-006',
    shopId: 'shop_hsr_03',
    name: 'Self-Service Bay 1',
    model: 'Ricoh IM C3010',
    status: 'online',
    color: true,
    duplex: true,
    agent: 'pixel-hub-agent',
  },
  {
    id: 'SP-007',
    shopId: 'shop_hsr_03',
    name: 'Self-Service Bay 2',
    model: 'Ricoh IM C3010',
    status: 'busy',
    color: true,
    duplex: true,
    agent: 'pixel-hub-agent',
  },
  {
    id: 'SP-008',
    shopId: 'shop_hsr_03',
    name: 'Bulk Room',
    model: 'Canon imagePRESS C265',
    status: 'online',
    color: true,
    duplex: true,
    agent: 'pixel-bulk-agent',
  },
  {
    id: 'SP-009',
    shopId: 'shop_hsr_04',
    name: 'Main Counter',
    model: 'HP LaserJet MFP M438n',
    status: 'offline',
    color: false,
    duplex: true,
    agent: 'verma-agent-1',
  },
  {
    id: 'SP-010',
    shopId: 'shop_hsr_05',
    name: 'Design Bay',
    model: 'Konica Minolta bizhub C300i',
    status: 'online',
    color: true,
    duplex: true,
    agent: 'bluedot-agent',
  },
  {
    id: 'SP-011',
    shopId: 'shop_hsr_05',
    name: 'Proofing Desk',
    model: 'Epson SureColor P700',
    status: 'maintenance',
    color: true,
    duplex: false,
    agent: 'bluedot-agent',
  },
  {
    id: 'SP-012',
    shopId: 'shop_hsr_06',
    name: 'Front Desk',
    model: 'Canon iR-ADV DX C3830i',
    status: 'online',
    color: true,
    duplex: true,
    agent: 'a1-agent-noida',
  },
  {
    id: 'SP-013',
    shopId: 'shop_hsr_07',
    name: 'Plotter Station',
    model: 'HP DesignJet T650',
    status: 'online',
    color: true,
    duplex: false,
    agent: 'drafting-agent-cp',
  },
  {
    id: 'SP-014',
    shopId: 'shop_hsr_07',
    name: 'Express Counter',
    model: 'Xerox AltaLink B8045',
    status: 'busy',
    color: false,
    duplex: true,
    agent: 'drafting-agent-cp',
  },
  {
    id: 'SP-015',
    shopId: 'shop_hsr_08',
    name: 'Main Machine',
    model: 'Brother DCP-L2541DW',
    status: 'online',
    color: false,
    duplex: true,
    agent: 'sai-agent-hyd',
  },
];

export const MACHINES = MACHINE_SEEDS.map((seed, index) => {
  const shop = SHOPS.find((s) => s.id === seed.shopId);
  const heartbeatMinutes = seed.status === 'offline' ? between(180, 900) : between(0, 4);
  return {
    id: seed.id,
    shopId: seed.shopId,
    shopName: shop.name,
    name: seed.name,
    model: seed.model,
    status: seed.status,
    serial: `SN${(482100 + index * 137).toString()}${String.fromCharCode(65 + (index % 26))}`,
    qrSlug: seed.id,
    qrUrl: `/print/${seed.id}`,
    registeredOn: shop.joinedOn,
    lastHeartbeat: new Date(Date.now() - heartbeatMinutes * 60 * 1000).toISOString(),
    paperLevel: Math.max(8, between(22, 100)),
    tonerLevel: Math.max(5, between(14, 100)),
    totalJobs: between(320, 9200),
    jobsToday: seed.status === 'offline' ? 0 : between(0, 46),
    lifetimeRevenue: between(48000, 940000),
    pricing: {
      ...BASE_PRICING,
      ...(seed.color ? {} : { colorSingle: 0, colorDouble: 0 }),
      minimumCharge: shop.planId === 'starter' ? 5 : 8,
    },
    printer: {
      brand: seed.model.split(' ')[0],
      model: seed.model,
      supportsColor: seed.color,
      supportsDuplex: seed.duplex,
      paperTrays: seed.color ? ['A4', 'A3', 'Letter'] : ['A4', 'Letter'],
      maxPaperSize: seed.color ? 'A3' : 'A4',
      connection: pick(['USB', 'Network (LAN)', 'Wi-Fi Direct']),
    },
    agent: {
      name: seed.agent,
      version: `1.${between(2, 9)}.${between(0, 4)}`,
      os: pick(['Windows 11 Pro', 'Windows 10 Pro', 'Ubuntu 22.04 LTS']),
      status: seed.status === 'offline' ? 'disconnected' : 'connected',
      lastSeen: new Date(Date.now() - heartbeatMinutes * 60 * 1000).toISOString(),
      autoStart: true,
      queuedJobs: seed.status === 'busy' ? between(1, 3) : 0,
    },
  };
});

const CUSTOMER_NAMES = [
  'Aditya Kulkarni',
  'Priya Menon',
  'Rahul Bhatt',
  'Sneha Deshpande',
  'Arjun Reddy',
  'Ishita Joshi',
  'Farhan Ali',
  'Kavya Pillai',
  'Nikhil Chauhan',
  'Ritika Singhal',
  'Devansh Gupta',
  'Anjali Rane',
  'Sameer Khan',
  'Tanvi Shah',
  'Harsh Vardhan',
  'Pooja Nambiar',
  'Manav Sethi',
  'Lakshmi Raman',
  'Yash Thakur',
  'Zoya Ansari',
  'Chirag Patel',
  'Nandini Bose',
  'Vivek Saxena',
  'Rhea Kapoor',
  'Om Prakash',
];

const DOCUMENT_NAMES = [
  'Semester-4-Notes.pdf',
  'Internship-Report-Final.pdf',
  'Rent-Agreement.pdf',
  'Aadhaar-Copy.pdf',
  'Tax-Return-2025.pdf',
  'Resume-Aditya-K.pdf',
  'Lab-Manual-DSA.pdf',
  'Question-Bank-Unit-3.pdf',
  'Project-Synopsis.pdf',
  'Offer-Letter.pdf',
  'Passport-Form.pdf',
  'Course-Registration.pdf',
  'Thesis-Draft-v6.pdf',
  'Invoice-Batch-Oct.pdf',
  'Hall-Ticket.pdf',
  'Bonafide-Certificate.pdf',
  'Company-Deck.pdf',
  'Lease-Deed.pdf',
  'Admit-Card.pdf',
  'Class-Timetable.pdf',
];

const PAYMENT_METHODS = ['UPI', 'Card', 'Wallet'];

const STATUS_POOL = [
  'completed',
  'completed',
  'completed',
  'completed',
  'completed',
  'completed',
  'completed',
  'printing',
  'queued',
  'paid',
  'failed',
  'refunded',
];

function buildOrders() {
  const orders = [];
  const now = Date.now();
  let counter = 1041;

  for (let dayOffset = 27; dayOffset >= 0; dayOffset -= 1) {
    const perDay = dayOffset === 0 ? between(9, 16) : between(5, 18);
    for (let i = 0; i < perDay; i += 1) {
      const machine = pick(MACHINES);
      const shop = SHOPS.find((s) => s.id === machine.shopId);
      if (shop.planStatus === 'past_due' && rand() > 0.15) continue;

      const createdAt = new Date(
        now - dayOffset * 86400000 - between(0, 10) * 3600000 - between(0, 59) * 60000,
      );
      if (createdAt.getTime() > now) continue;

      const status = dayOffset === 0 ? pick(STATUS_POOL) : pick(STATUS_POOL.slice(0, 7));
      const pages = between(1, 42);
      const copies = rand() > 0.78 ? between(2, 6) : 1;
      const color = machine.printer.supportsColor && rand() > 0.62;
      const sides = machine.printer.supportsDuplex && rand() > 0.45 ? 'double' : 'single';
      const paper = machine.printer.maxPaperSize === 'A3' && rand() > 0.9 ? 'a3' : 'a4';
      const finishing = rand() > 0.92 ? pick(['staple', 'spiral']) : 'none';

      const unit = color
        ? sides === 'double'
          ? machine.pricing.colorDouble
          : machine.pricing.colorSingle
        : sides === 'double'
          ? machine.pricing.bwDouble
          : machine.pricing.bwSingle;
      const unitPrice =
        Math.round(unit * (paper === 'a3' ? machine.pricing.a3Surcharge : 1) * 100) / 100;
      const finishingPrice = finishing === 'staple' ? 5 : finishing === 'spiral' ? 40 : 0;
      // Duplex is billed per sheet, single-sided per printed side.
      const billableUnits = sides === 'double' ? Math.ceil(pages / 2) : pages;
      const amount =
        Math.round((billableUnits * copies * unitPrice + finishingPrice * copies) * 100) / 100;
      const commissionRate =
        shop.planId === 'scale' ? 0.02 : shop.planId === 'growth' ? 0.035 : 0.06;
      const platformFee = Math.round(amount * commissionRate * 100) / 100;

      const paymentSucceeded = !['awaiting_payment'].includes(status);

      orders.push({
        id: `SP${counter}`,
        machineId: machine.id,
        machineName: machine.name,
        shopId: shop.id,
        shopName: shop.name,
        customerName: pick(CUSTOMER_NAMES),
        customerPhone: `+91 ${between(70, 99)}${between(100, 999)} ${between(10000, 99999)}`,
        customerEmail: null,
        documents: [
          {
            id: `doc_${counter}_1`,
            name: pick(DOCUMENT_NAMES),
            pages,
            sizeKb: between(120, 8400),
            selectedPages: pages,
            copies,
            color,
            sides,
            paper,
            finishing,
          },
        ],
        pageCount: pages,
        copies,
        color,
        sides,
        paper,
        finishing,
        amount,
        platformFee,
        shopEarning: Math.round((amount - platformFee) * 100) / 100,
        paymentMethod: paymentSucceeded ? pick(PAYMENT_METHODS) : null,
        paymentStatus: paymentSucceeded ? 'success' : 'pending',
        paymentRef: paymentSucceeded ? `pay_${Math.random().toString(36).slice(2, 12)}` : null,
        status,
        createdAt: createdAt.toISOString(),
        completedAt:
          status === 'completed'
            ? new Date(createdAt.getTime() + between(2, 11) * 60000).toISOString()
            : null,
        timeline: [],
      });
      counter += 1;
    }
  }
  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export const ORDERS = buildOrders();

export const NOTIFICATIONS = [
  {
    id: 'ntf_1',
    type: 'machine',
    title: 'SP-005 went offline',
    body: 'Print agent campus-agent-1 stopped sending heartbeats 2 hours ago.',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    read: false,
  },
  {
    id: 'ntf_2',
    type: 'payment',
    title: 'Settlement released',
    body: '₹18,420 settled to HDFC ****4021 for the week ending 09 Nov.',
    createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
    read: false,
  },
  {
    id: 'ntf_3',
    type: 'machine',
    title: 'Toner low on SP-011',
    body: 'Magenta toner at 12%. Replace before the next colour job.',
    createdAt: new Date(Date.now() - 30 * 3600000).toISOString(),
    read: true,
  },
  {
    id: 'ntf_4',
    type: 'plan',
    title: 'Subscription renews in 18 days',
    body: 'Growth plan auto-renews on 01 Dec 2026. Card ending 4421.',
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    read: true,
  },
];

export const PAYOUTS = [
  {
    id: 'po_9012',
    shopId: 'shop_hsr_01',
    period: '02 Nov – 08 Nov 2026',
    orders: 214,
    gross: 22480,
    fee: 786,
    net: 21694,
    status: 'settled',
    releasedOn: '2026-11-10',
    ref: 'NEFT-HDFC-882014',
  },
  {
    id: 'po_9011',
    shopId: 'shop_hsr_01',
    period: '26 Oct – 01 Nov 2026',
    orders: 189,
    gross: 19860,
    fee: 695,
    net: 19165,
    status: 'settled',
    releasedOn: '2026-11-03',
    ref: 'NEFT-HDFC-879112',
  },
  {
    id: 'po_9010',
    shopId: 'shop_hsr_01',
    period: '19 Oct – 25 Oct 2026',
    orders: 231,
    gross: 24310,
    fee: 850,
    net: 23460,
    status: 'settled',
    releasedOn: '2026-10-27',
    ref: 'NEFT-HDFC-875401',
  },
  {
    id: 'po_9009',
    shopId: 'shop_hsr_01',
    period: '09 Nov – 12 Nov 2026',
    orders: 74,
    gross: 7810,
    fee: 273,
    net: 7537,
    status: 'processing',
    releasedOn: null,
    ref: '—',
  },
  {
    id: 'po_9021',
    shopId: 'shop_hsr_02',
    period: '02 Nov – 08 Nov 2026',
    orders: 96,
    gross: 8940,
    fee: 536,
    net: 8404,
    status: 'settled',
    releasedOn: '2026-11-11',
    ref: 'NEFT-HDFC-882077',
  },
  {
    id: 'po_9022',
    shopId: 'shop_hsr_02',
    period: '09 Nov – 12 Nov 2026',
    orders: 31,
    gross: 2890,
    fee: 173,
    net: 2717,
    status: 'processing',
    releasedOn: null,
    ref: '—',
  },
];

export const SUBSCRIPTION_INVOICES = [
  {
    id: 'INV-2026-1108',
    plan: 'Growth',
    amount: 1499,
    period: 'Nov 2026',
    status: 'paid',
    date: '2026-11-01',
    method: 'HDFC Card ****4421',
  },
  {
    id: 'INV-2026-1008',
    plan: 'Growth',
    amount: 1499,
    period: 'Oct 2026',
    status: 'paid',
    date: '2026-10-01',
    method: 'HDFC Card ****4421',
  },
  {
    id: 'INV-2026-0908',
    plan: 'Growth',
    amount: 1499,
    period: 'Sep 2026',
    status: 'paid',
    date: '2026-09-01',
    method: 'HDFC Card ****4421',
  },
  {
    id: 'INV-2026-0808',
    plan: 'Growth',
    amount: 1499,
    period: 'Aug 2026',
    status: 'paid',
    date: '2026-08-01',
    method: 'HDFC Card ****4421',
  },
];

/** Revenue series for admin charts — last 14 days, deterministic. */
export const PLATFORM_REVENUE_SERIES = Array.from({ length: 14 }).map((_, i) => {
  const day = new Date(Date.now() - (13 - i) * 86400000);
  const base = 38000 + Math.round(Math.sin(i / 2.2) * 7200) + between(-2600, 4200);
  return {
    date: day.toISOString().slice(0, 10),
    label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: Math.max(18000, base),
    jobs: Math.round(Math.max(180, base / 42)),
  };
});

export const FUNNEL_DATA = [
  { stage: 'QR scans', value: 12480 },
  { stage: 'Uploads', value: 9310 },
  { stage: 'Paid orders', value: 6824 },
  { stage: 'Jobs printed', value: 6612 },
];
