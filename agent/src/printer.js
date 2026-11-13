import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Printer back ends.
 *
 * Two implementations behind one interface:
 *
 *   realPrinter    — sends the PDF to the Windows spooler via pdf-to-printer.
 *   virtualPrinter — writes a receipt file and reports the job as simulated.
 *
 * The real back end is the only one that can move paper, and it refuses to run
 * anywhere but Windows rather than failing obscurely at the last moment.
 *
 * ## What has not been verified
 *
 * The spooler call has not been executed in this build environment (no Windows,
 * no printer). The server-side pipeline around it has been. `doctor` exists to
 * make that gap checkable on the shop's own machine.
 */

const isWindows = process.platform === 'win32';

/**
 * Load pdf-to-printer lazily.
 *
 * It is an optional dependency: on Linux/macOS the agent must still install and
 * run in virtual mode for development, and a hard import would break that.
 */
async function loadSpooler() {
  if (!isWindows) {
    throw new Error(
      'Real printing requires Windows. Use SMARTPRINT_PRINT_MODE=virtual to run without a printer.',
    );
  }
  try {
    const module = await import('pdf-to-printer');
    return module.default ?? module;
  } catch (error) {
    throw new Error(
      `pdf-to-printer is not installed (${error.message}). Run "npm install" in the agent directory.`,
    );
  }
}

/** Default Windows printer, or null. */
async function getDefaultPrinterName() {
  const spooler = await loadSpooler();
  try {
    return await spooler.getDefaultPrinter();
  } catch {
    return null;
  }
}

/**
 * Real printing.
 *
 * `print()` resolves only after the spooler accepts the document. It does not
 * wait for paper: a jam is reported later, by the operator, as a failed job.
 */
export function createRealPrinter({ printerName = null } = {}) {
  return {
    mode: 'real',
    simulated: false,

    async describe() {
      const defaultPrinter = await getDefaultPrinterName();
      return {
        mode: 'real',
        platform: process.platform,
        printerName: printerName ?? defaultPrinter ?? null,
        // Without an installed printer there is nothing to print to.
        available: Boolean(printerName ?? defaultPrinter),
        simulated: false,
      };
    },

    async print(filePath, { copies = 1 } = {}) {
      const spooler = await loadSpooler();
      const target = printerName ?? (await getDefaultPrinterName());

      if (!target) {
        throw new Error(
          'No printer found. Install a printer in Windows, or set SMARTPRINT_PRINTER to its exact name.',
        );
      }
      if (!fs.existsSync(filePath)) {
        throw new Error(`Document is missing from disk: ${filePath}`);
      }

      await spooler.print(filePath, {
        printer: target,
        // copies is applied by the spooler so a 3-copy job is one spool entry.
        copies: Math.max(1, Number(copies) || 1),
      });

      return {
        printerName: target,
        simulated: false,
        // The spooler accepted it; we cannot claim the paper emerged.
        acceptedBySpooler: true,
      };
    },
  };
}

/**
 * Virtual printing. **Simulated.**
 *
 * Deliberately writes a receipt containing the real job details, so it is
 * obvious in the file system that nothing was printed, and the server is told
 * `simulated: true` so no dashboard can present it as a real print.
 */
export function createVirtualPrinter({ outputDir } = {}) {
  const dir = outputDir ?? path.join(process.cwd(), 'virtual-prints');

  return {
    mode: 'virtual',
    simulated: true,

    async describe() {
      return {
        mode: 'virtual',
        platform: process.platform,
        printerName: 'Virtual Printer (simulated)',
        available: true,
        simulated: true,
      };
    },

    async print(filePath, { copies = 1, job = null } = {}) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Document is missing from disk: ${filePath}`);
      }

      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const receiptPath = path.join(dir, `${job?.jobCode ?? 'job'}-${stamp}.txt`);

      const lines = [
        'SmartPrint — VIRTUAL PRINT RECEIPT',
        '',
        'NOTHING WAS PRINTED. This file is a record of a simulated job.',
        '',
        `Job:        ${job?.jobCode ?? 'unknown'}`,
        `Order:      ${job?.orderId ?? 'unknown'}`,
        `Document:   ${job?.documentName ?? path.basename(filePath)}`,
        `Copies:     ${Math.max(1, Number(copies) || 1)}`,
        `Source:     ${filePath}`,
        `At:         ${new Date().toISOString()}`,
        `Host:       ${os.hostname()}`,
        '',
      ];
      fs.writeFileSync(receiptPath, lines.join('\n'), 'utf8');

      return {
        printerName: 'Virtual Printer (simulated)',
        simulated: true,
        receiptPath,
        acceptedBySpooler: false,
      };
    },
  };
}

/**
 * Build the printer for a configuration.
 *
 * An unknown mode is a hard error rather than a silent fall back to virtual:
 * a misconfiguration must never turn a paid print into a no-op.
 */
export function createPrinter(config) {
  if (config.printMode === 'virtual') {
    return createVirtualPrinter({ outputDir: path.join(config.dataDir, 'virtual-prints') });
  }
  if (config.printMode === 'real') {
    return createRealPrinter({ printerName: config.printerName });
  }
  throw new Error(`Unknown print mode: ${config.printMode}. Use "real" or "virtual".`);
}

export { isWindows };
export default { createPrinter, createRealPrinter, createVirtualPrinter, isWindows };
