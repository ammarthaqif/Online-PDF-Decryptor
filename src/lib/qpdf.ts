import { PDFDocument } from 'pdf-lib';

/**
 * Concurrent Decryption Specialized Engines
 */

async function decryptWithPdfLib(
  fileData: Uint8Array,
  password?: string,
  log?: (msg: string) => void
): Promise<Uint8Array> {
  try {
    log?.('Initializing Primary Buffer (pdf-lib)...');
    const pdfDoc = await (PDFDocument as any).load(fileData, { 
      password,
      ignoreEncryption: false 
    });
    log?.('Schema validation passed.');
    const saved = await pdfDoc.save();
    log?.('Reconstruction complete.');
    return saved;
  } catch (err: any) {
    log?.(`Rejected: ${err.message.slice(0, 30)}...`);
    throw err;
  }
}

async function decryptWithQpdf(
  fileData: Uint8Array,
  password?: string,
  log?: (msg: string) => void
): Promise<Uint8Array> {
  // Check for cross-origin isolation
  if (!window.crossOriginIsolated) {
    log?.('Memory isolation restricted. Engine-B idle.');
    throw new Error('ISOLATION_REQUIRED');
  }

  try {
    log?.('Spawning WASM worker thread...');
    const args = ['--decrypt'];
    if (password) {
      args.push(`--password=${password}`);
    }
    args.push('input.pdf', 'output.pdf');

    log?.('Context loading...');
    const qpdf = (await import('qpdf-wasm')).default;

    log?.('Executing bitstream decryption...');
    const result = await qpdf(args, [{ name: 'input.pdf', content: fileData }]);

    const outputFile = result.find((f: any) => f.name === 'output.pdf');
    if (!outputFile) throw new Error('No output signal.');
    
    log?.('Engine-B handshake successful.');
    return outputFile.content;
  } catch (error: any) {
    log?.(`Halted: ${error?.message?.slice(0, 30)}...`);
    throw error;
  }
}

/**
 * Decrypts a PDF file using a parallel racing algorithm.
 * Spawns multiple decryption methodologies concurrently to find the fastest valid exit.
 */
export async function decryptPDF(
  fileData: Uint8Array, 
  password?: string,
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  const log = (msg: string) => onProgress?.(msg);

  log('Initiating Parallel Decryption Protocol (PDP)...');
  
  try {
    // Race between different decryption methodologies
    const winner = await Promise.any([
      decryptWithPdfLib(fileData, password, log),
      decryptWithQpdf(fileData, password, log)
    ]);

    log('Parallel match resolved. Propagating winner to output buffer.');
    return winner;
  } catch (aggErr: any) {
    const errorPrefix = ' PDP Critical Fault: ';
    if (aggErr instanceof AggregateError) {
      const messages = aggErr.errors.map(e => e.message).join(' | ');
      if (messages.includes('password')) {
        throw new Error('VAULT_LOCKED: Authentication failed on all parallel engines.');
      }
      if (messages.includes('ISOLATION_REQUIRED')) {
         throw new Error('MEMORY_ISOLATION_ERROR: Advanced decryption engines are locked. Please "Open in New Tab".');
      }
      throw new Error(`${errorPrefix} All engines reported non-zero exit status.`);
    }
    throw new Error(`${errorPrefix} ${aggErr.message}`);
  }
}
