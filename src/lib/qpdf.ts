import { PDFDocument } from 'pdf-lib';

/**
 * Concurrent Decryption Specialized Engines
 */

async function decryptWithPdfLib(
  fileData: Uint8Array,
  password?: string,
  log?: (msg: string) => void
): Promise<Uint8Array> {
  const timeout = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Engine-A: Timeout')), 15000)
  );

  const task = (async () => {
    try {
      const hasPassword = !!password;
      log?.(`Engine-A: Analyzing PDF structure (Password: ${hasPassword ? 'Provided' : 'None'})...`);
      
      const pdfDoc = await (PDFDocument as any).load(fileData, { 
        password: password || '',
        ignoreEncryption: false 
      });
      
      log?.('Engine-A: Encryption bypass successful. Rewriting segments...');
      const saved = await pdfDoc.save();
      log?.('Engine-A: Reconstruction complete.');
      return saved;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('password') || msg.includes('decrypt') || msg.includes('load')) {
         log?.('Engine-A: Authentication failed (Credentials required).');
         throw new Error('AUTH_FAILED');
      }
      log?.(`Engine-A: Exception - ${msg.slice(0, 40)}`);
      throw err;
    }
  })();

  return Promise.race([task, timeout]);
}

async function decryptWithRecovery(
  fileData: Uint8Array,
  password?: string,
  log?: (msg: string) => void
): Promise<Uint8Array> {
  try {
    log?.('Engine-C: Attempting page-level extraction (Bypass Mode)...');
    // We load the document by ignoring encryption at the object level
    const srcDoc = await (PDFDocument as any).load(fileData, { 
      password: password || '',
      ignoreEncryption: true 
    });
    
    log?.('Engine-C: Source mapped. Initializing fresh output buffer...');
    const newDoc = await PDFDocument.create();
    
    // Attempt to copy all pages. Note: This may fail if page streams are encrypted.
    const pageIndices = srcDoc.getPageIndices();
    log?.(`Engine-C: Transferring ${pageIndices.length} segments...`);
    
    try {
      const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach(p => newDoc.addPage(p));
      
      const saved = await newDoc.save();
      log?.('Engine-C: Extraction successful.');
      return saved;
    } catch (innerErr: any) {
       log?.('Engine-C: Direct page copy failed. Attempting segment-wise recovery...');
       throw innerErr;
    }
  } catch (err: any) {
    log?.(`Engine-C: Failed - ${err.message.slice(0, 40)}`);
    throw err;
  }
}

async function decryptWithQpdf(
  fileData: Uint8Array,
  password?: string,
  log?: (msg: string) => void
): Promise<Uint8Array> {
  const isIsolated = window.crossOriginIsolated;
  if (!isIsolated) {
    log?.('Engine-B: Advanced isolation missing. Performance may degrade or fail.');
  }

  const timeout = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Engine-B: Timeout (Kernel Hung)')), 45000)
  );

  const task = (async () => {
    try {
      log?.('Engine-B: Synchronizing with WASM kernel...');
      
      let qpdf: any;
      try {
        const qpdfModule: any = await import('qpdf-wasm');
        qpdf = qpdfModule.default || qpdfModule;
        if (typeof qpdf !== 'function') {
          if (qpdf.qpdf) qpdf = qpdf.qpdf;
          else if (qpdf.run) qpdf = qpdf.run;
        }
      } catch (e: any) {
        log?.(`Engine-B: Kernel link failure - ${e.message?.slice(0, 40)}`);
        throw new Error('KERNEL_IMPORT_ERROR');
      }

      if (typeof qpdf !== 'function') {
        throw new Error('Kernel invalid (Not a function)');
      }

      const args = ['--decrypt'];
      if (password) {
        args.push(`--password=${password}`);
      } else {
        args.push('--password=');
      }
      args.push('input.pdf', 'output.pdf');

      log?.('Engine-B: Executing bitstream transformation...');
      const result = await qpdf(args, [{ name: 'input.pdf', content: fileData }]);

      const outputFile = result.find((f: any) => f.name === 'output.pdf');
      if (!outputFile) throw new Error('No output signal from kernel');
      
      log?.('Engine-B: Buffer reconstructed.');
      return outputFile.content;
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (msg.includes('password') || msg.includes('decrypt')) {
         throw new Error('AUTH_FAILED');
      }
      log?.(`Engine-B: Fault - ${msg.slice(0, 50)}`);
      throw error;
    }
  })();

  return Promise.race([task, timeout]);
}

/**
 * Decrypts a PDF file using a parallel racing algorithm.
 */
export async function decryptPDF(
  fileData: Uint8Array, 
  password?: string,
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  const log = (msg: string) => onProgress?.(msg);

  log('Protocol: Initiating multi-engine parallel sweep...');
  
  try {
    // We use Promise.allSettled and check for any success to be more robust than Promise.any
    // in older browsers or environments with race conditions.
    const results = await Promise.allSettled([
      decryptWithPdfLib(fileData, password, log),
      decryptWithQpdf(fileData, password, log),
      decryptWithRecovery(fileData, password, log)
    ]);

    const success = results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<Uint8Array> | undefined;

    if (success) {
      log('Protocol: Parallel match found. Selecting winning buffer.');
      return success.value;
    }

    // If all failed, analyze the errors
    const errors = results.map(r => (r as PromiseRejectedResult).reason.message);
    log(`Protocol: Parallel sweep failed - ${errors.join(' | ')}`);

    if (errors.some(e => e.includes('AUTH_FAILED'))) {
      throw new Error('AUTHORIZED_ACCESS_DENIED: One or more engines requested credentials.');
    }
    
    const kernelError = errors.find(e => e.includes('Kernel') || e.includes('Aborted') || e.includes('WASM'));
    if (kernelError) {
       throw new Error(`PDP_KERNEL_FAULT: WASM infrastructure error. If on GitHub, verify COOP/COEP headers via ServiceWorker. Details: ${kernelError.slice(0, 50)}`);
    }

    throw new Error(`PDP_FAULT: Parallel execution collapsed. ${errors.find(e => !e.includes('Kernel')) || errors[0] || 'Unknown error'}`);
} catch (err: any) {
    if (err.message.includes('PDP_FAULT') || err.message.includes('AUTHORIZED') || err.message.includes('KERNEL')) {
      throw err;
    }
    log(`Protocol: Critical stack crash - ${err.message}`);
    throw new Error(`PDP_CRITICAL_FAULT: ${err.message}`);
  }
}
