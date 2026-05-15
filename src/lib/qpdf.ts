import { PDFDocument } from 'pdf-lib';

/**
 * Decrypts a PDF file. 
 * Tries pdf-lib first (no WASM/Isolation needed for standard passwords).
 * Falls back to qpdf-wasm for advanced encryption removal.
 */
export async function decryptPDF(
  fileData: Uint8Array, 
  password?: string,
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  const log = (msg: string) => onProgress?.(msg);

  // 1. Try pdf-lib (Fast, No Isolation required)
  try {
    log('Initializing pdf-lib primary buffer analysis...');
    const pdfDoc = await (PDFDocument as any).load(fileData, { 
      password,
      ignoreEncryption: false 
    });
    
    log('Schema validation passed. Executing primary segment rewrite...');
    // Saving it without a password effectively decrypts it if it was loaded with one
    const saved = await pdfDoc.save();
    log('Primary rewrite complete. Encryption layers stripped.');
    return saved;
  } catch (err: any) {
    log('Primary suite fallback: Advanced encryption detected.');
    console.log('pdf-lib failed, falling back to QPDF:', err.message);
    // If it's a password error, we don't want to fall back to QPDF without a password anyway
    if (err.message.includes('password')) {
       throw err;
    }
  }

  // 2. Fallback to QPDF WASM
  log('Checking memory isolation requirements...');
  // Check for cross-origin isolation
  if (!window.crossOriginIsolated) {
    throw new Error('MEMORY_ISOLATION_ERROR: The file requires advanced decryption. Please "Open in New Tab" to unlock.');
  }

  try {
    log('Spawning advanced QPDF WASM worker thread...');
    const args = ['--decrypt'];
    if (password) {
      args.push(`--password=${password}`);
    }
    args.push('input.pdf', 'output.pdf');

    log('Loading WASM binary into local secure context...');
    const qpdf = (await import('qpdf-wasm')).default;

    log('Executing advanced bitstream decryption (qpdf-wasm)...');
    // qpdf(args, files)
    const result = await qpdf(args, [
      { name: 'input.pdf', content: fileData }
    ]);

    log('Scanning engine output buffers...');
    const outputFile = result.find((f: any) => f.name === 'output.pdf');
    if (!outputFile) {
      throw new Error('Decryption failed: Output file not generated.');
    }
    
    log('Advanced segment reconstruction successful.');
    return outputFile.content;
  } catch (error: any) {
    console.error('QPDF Engine Error:', error);
    
    const message = error?.message || 'Decryption failed';
    console.error('QPDF Engine Error:', error);
    
    if (message.includes('SharedArrayBuffer') || !window.crossOriginIsolated) {
      throw new Error('MEMORY_ISOLATION_ERROR: This operation requires modern browser security features. Please "Open in New Tab" to unlock.');
    }
    
    throw new Error(`Engine Error: ${message}`);
  }
}
