/**
 * Decrypts a PDF file using qpdf-wasm.
 * This version uses the WASM binary which requires SharedArrayBuffer support.
 */
export async function decryptPDF(fileData: Uint8Array, password?: string): Promise<Uint8Array> {
  // Check for cross-origin isolation
  if (!window.crossOriginIsolated) {
    throw new Error('SECURITY_RESTRICTION: This operation requires Cross-Origin Isolation. Please ensure the app is opened directly (new tab) and not inside the AI Studio iframe.');
  }

  try {
    const qpdf = (await import('qpdf-wasm')).default;
    const args = ['--decrypt'];
    if (password) {
      args.push(`--password=${password}`);
    }
    args.push('input.pdf', 'output.pdf');

    // qpdf(args, files)
    const result = await qpdf(args, [
      { name: 'input.pdf', content: fileData }
    ]);

    const outputFile = result.find((f: any) => f.name === 'output.pdf');
    if (!outputFile) {
      throw new Error('Decryption failed: Output file not generated.');
    }
    
    return outputFile.content;
  } catch (error: any) {
    console.error('QPDF Engine Error:', error);
    
    const message = error?.message || 'Decryption failed';
    if (message.includes('SharedArrayBuffer')) {
      throw new Error('Security Error: SharedArrayBuffer is restricted. Please try opening the app in a new tab.');
    }
    
    throw new Error(message);
  }
}
