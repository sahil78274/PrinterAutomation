import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const CURRENCY = 'INR';

export function formatCurrency(value, { compact = false, decimals = 0 } = {}) {
  const amount = Number(value || 0);
  if (compact) {
    if (amount >= 10000000)
      return `₹${(amount / 10000000).toFixed(amount % 10000000 === 0 ? 0 : 2)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount % 100000 === 0 ? 0 : 1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(amount);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0));
}

export function formatDate(value, opts = {}) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

export function formatTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return `${formatDate(value)}, ${formatTime(value)}`;
}

export function timeAgo(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return '—';
  if (seconds < 45) return 'just now';
  if (seconds < 90) return '1 min ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(date);
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function slugify(value = '') {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((Number(part) / Number(total)) * 100);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Parse a page-selection expression like "1-3, 6, 9-10" against a page count. */
export function parsePageRanges(expression, maxPages) {
  if (!expression?.trim()) return [];
  const pages = new Set();
  const chunks = expression
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const range = chunk.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const start = clamp(Number(range[1]), 1, maxPages);
      const end = clamp(Number(range[2]), 1, maxPages);
      for (let i = Math.min(start, end); i <= Math.max(start, end); i += 1) pages.add(i);
    } else if (/^\d+$/.test(chunk)) {
      const page = Number(chunk);
      if (page >= 1 && page <= maxPages) pages.add(page);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

/** Turn a sorted page array into a compact expression, e.g. [1,2,3,5] -> "1-3, 5". */
export function formatPageRanges(pages = []) {
  if (!pages.length) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const groups = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i += 1) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    groups.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = current;
    prev = current;
  }
  return groups.join(', ');
}

export function groupPages(pages = []) {
  if (!pages.length) return [];
  const sorted = [...pages].sort((a, b) => a - b);
  const groups = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i += 1) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    groups.push({ start, end: prev, count: prev - start + 1 });
    start = current;
    prev = current;
  }
  return groups;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function makeId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

/** Deterministic pseudo-random generator so mock data is stable across renders. */
export function seededRandom(seed = 1) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function downloadBlob(content, filename, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
