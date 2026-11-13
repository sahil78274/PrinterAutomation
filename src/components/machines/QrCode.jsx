import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '../../lib/utils.js';

/**
 * Renders a real scannable QR code containing the machine-specific print URL.
 * The URL always embeds the machine ID, so a scan can never resolve to the
 * wrong machine — this is the core contract of the platform.
 */
export default function QrCode({
  value,
  size = 180,
  className,
  dark = '#0B1D3A',
  light = '#FFFFFF',
}) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let active = true;
    if (!value) {
      setDataUrl(null);
      return () => {
        active = false;
      };
    }
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark, light },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value, size, dark, light]);

  if (!dataUrl) {
    return (
      <div
        className={cn('animate-pulse rounded-lg bg-surface-sunken', className)}
        style={{ width: size, height: size }}
        aria-label="Generating QR code"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={`QR code linking to ${value}`}
      className={cn('rounded-lg', className)}
    />
  );
}

export function buildPrintUrl(
  machineId,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
) {
  return `${origin}/print/${machineId}`;
}
