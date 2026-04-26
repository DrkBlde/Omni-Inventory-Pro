// AES-256 encryption using Web Crypto API (browser-compatible)
const ENCRYPTION_KEY = 'omni-inventory-pro-v2-encrypt32!'; // Exactly 32 bytes for AES-256

const stringToArrayBuffer = (str: string): ArrayBuffer =>
  new TextEncoder().encode(str);

const arrayBufferToHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

const hexToArrayBuffer = (hex: string): ArrayBuffer => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
};

const getKey = async (usage: KeyUsage[]) =>
  crypto.subtle.importKey(
    'raw',
    stringToArrayBuffer(ENCRYPTION_KEY),
    { name: 'AES-GCM' },
    false,
    usage
  );

/**
 * Encrypts text using AES-256-GCM.
 * Returns hex: [12-byte IV][ciphertext + 16-byte GCM auth tag]
 */
export const encryptAES256 = async (text: string): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(['encrypt']);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    stringToArrayBuffer(text)
  );

  // Web Crypto appends the auth tag to the ciphertext automatically
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv, 0);
  combined.set(encryptedArray, iv.length);

  return arrayBufferToHex(combined.buffer);
};

/**
 * Decrypts AES-256-GCM hex string produced by encryptAES256.
 */
export const decryptAES256 = async (encryptedText: string): Promise<string> => {
  const combinedArray = new Uint8Array(hexToArrayBuffer(encryptedText));

  const iv = combinedArray.slice(0, 12);
  // Web Crypto expects ciphertext + auth-tag together (it was stored that way)
  const ciphertextWithTag = combinedArray.slice(12);

  const key = await getKey(['decrypt']);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertextWithTag
  );

  return new TextDecoder().decode(decryptedBuffer);
};

// ---------------------------------------------------------------------------
// Minimal QR Code encoder — pure TypeScript, no npm packages, works offline.
// Supports alphanumeric + byte mode, error correction level M.
// ---------------------------------------------------------------------------

// Reed-Solomon GF(256) arithmetic over the QR polynomial x^8+x^4+x^3+x^2+1
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

const rsGeneratorPoly = (n: number): Uint8Array => {
  let p = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    const q = new Uint8Array(p.length + 1);
    const alpha = GF_EXP[i];
    for (let j = 0; j < p.length; j++) {
      q[j] ^= gfMul(p[j], alpha);
      q[j + 1] ^= p[j];
    }
    p = q;
  }
  return p;
};

const rsEncode = (data: Uint8Array, nEcc: number): Uint8Array => {
  const gen = rsGeneratorPoly(nEcc);
  const msg = new Uint8Array(data.length + nEcc);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0)
      for (let j = 0; j < gen.length; j++)
        msg[i + j] ^= gfMul(gen[j], coef);
  }
  return msg.slice(data.length);
};

// QR version 5-M capacity table (we always use version 5 which handles ~106 bytes)
// For larger payloads we fall back to multi-block interleaving at version 10.
// Simple approach: use version 10-M which handles up to 213 bytes byte-mode.

// Bit buffer helper
class BitBuffer {
  data: number[] = [];
  len = 0;
  put(val: number, bits: number) {
    for (let i = bits - 1; i >= 0; i--) {
      this.data.push((val >> i) & 1);
      this.len++;
    }
  }
  getByte(i: number) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | (this.data[i * 8 + b] ?? 0);
    return v;
  }
}

// QR version 10, error correction M
// 4 blocks: 2×(27 data + 18 ec), 4×(28 data + 18 ec) but let's hardcode version 5-M for short payloads
// and version 10-M for longer ones.
interface QRVersion {
  v: number; size: number; dataBytes: number; eccBytes: number;
  blocks: { count: number; dataBytes: number; eccBytes: number }[];
  alignments: number[];
}

const QR_VERSIONS: QRVersion[] = [
  // version 1-M: 16 data bytes
  { v:1, size:21, dataBytes:16, eccBytes:10, blocks:[{count:1,dataBytes:16,eccBytes:10}], alignments:[] },
  // version 2-M: 28 data bytes
  { v:2, size:25, dataBytes:28, eccBytes:16, blocks:[{count:1,dataBytes:28,eccBytes:16}], alignments:[6,18] },
  // version 5-M: 86 data bytes
  { v:5, size:37, dataBytes:86, eccBytes:56, blocks:[{count:2,dataBytes:43,eccBytes:28}], alignments:[6,30] },
  // version 10-M: 213 data bytes (for long encrypted payloads)
  { v:10, size:57, dataBytes:213, eccBytes:104,
    blocks:[{count:2,dataBytes:27,eccBytes:26},{count:4,dataBytes:28,eccBytes:26}],
    alignments:[6,28,50] },
  // version 15-M: ~317 bytes
  { v:15, size:77, dataBytes:317, eccBytes:204,
    blocks:[{count:3,dataBytes:54,eccBytes:30},{count:5,dataBytes:55,eccBytes:30}],
    alignments:[6,26,48,70] },
  // version 20-M: ~461 bytes
  { v:20, size:97, dataBytes:461, eccBytes:312,
    blocks:[{count:3,dataBytes:54,eccBytes:36},{count:11,dataBytes:55,eccBytes:36}],
    alignments:[6,34,62,90] },
];

function pickVersion(byteLen: number): QRVersion {
  for (const ver of QR_VERSIONS) if (ver.dataBytes >= byteLen + 3) return ver;
  return QR_VERSIONS[QR_VERSIONS.length - 1];
}

function makeQRMatrix(text: string): { matrix: (0|1|null)[][]; size: number } {
  const enc = new TextEncoder().encode(text);
  const ver = pickVersion(enc.length);
  const size = ver.size;

  // Initialise matrix with null = unset
  const m: (0|1|null)[][] = Array.from({length:size}, () => Array(size).fill(null));

  const set = (r:number,c:number,v:0|1) => { if(r>=0&&r<size&&c>=0&&c<size) m[r][c]=v; };

  // Finder pattern
  const finder = (tr:number,tc:number) => {
    for(let i=0;i<7;i++) for(let j=0;j<7;j++) {
      const v = (i===0||i===6||j===0||j===6||((i>=2&&i<=4)&&(j>=2&&j<=4))) ? 1 : 0;
      set(tr+i,tc+j,v as 0|1);
    }
    // Separator
    for(let k=-1;k<=7;k++) { set(tr-1,tc+k,0); set(tr+7,tc+k,0); set(tr+k,tc-1,0); set(tr+k,tc+7,0); }
  };
  finder(0,0); finder(0,size-7); finder(size-7,0);

  // Timing patterns
  for(let i=8;i<size-8;i++) set(6,i,(i%2===0)?1:0), set(i,6,(i%2===0)?1:0);

  // Dark module
  set(size-8,8,1);

  // Alignment patterns
  for(const pos of ver.alignments) {
    for(const r of ver.alignments) {
      if((r===6&&pos===6)||(r===6&&pos===ver.alignments[ver.alignments.length-1])||
         (pos===6&&r===ver.alignments[ver.alignments.length-1])) continue;
      for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++) {
        set(r+dr,pos+dc,((Math.abs(dr)===2||Math.abs(dc)===2||dr===0&&dc===0)?1:0));
      }
    }
  }

  // Reserve format info areas
  for(let i=0;i<9;i++) { if(m[8][i]===null)set(8,i,0); if(m[i][8]===null)set(i,8,0); }
  for(let i=0;i<8;i++) { if(m[8][size-1-i]===null)set(8,size-1-i,0); if(m[size-1-i][8]===null)set(size-1-i,8,0); }

  // Build data codewords: byte mode
  const bb = new BitBuffer();
  bb.put(0b0100, 4); // byte mode indicator
  bb.put(enc.length, 8); // character count
  for(const byte of enc) bb.put(byte, 8);
  // Terminator
  const totalDataBits = ver.dataBytes * 8;
  for(let i=0;i<4&&bb.len<totalDataBits;i++) bb.put(0,1);
  while(bb.len%8!==0) bb.put(0,1);
  // Padding
  let pad=0; while(bb.len<totalDataBits) { bb.put(pad%2===0?0xEC:0x11,8); pad++; }

  // Build byte array
  const rawBytes = new Uint8Array(ver.dataBytes);
  for(let i=0;i<ver.dataBytes;i++) rawBytes[i] = bb.getByte(i);

  // RS encode per block and interleave
  const blocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let offset = 0;
  for(const blk of ver.blocks) {
    for(let b=0;b<blk.count;b++) {
      const d = rawBytes.slice(offset, offset+blk.dataBytes); offset+=blk.dataBytes;
      blocks.push(d);
      eccBlocks.push(rsEncode(d, blk.eccBytes));
    }
  }
  const interleaved: number[] = [];
  const maxData = Math.max(...blocks.map(b=>b.length));
  for(let i=0;i<maxData;i++) for(const b of blocks) if(i<b.length) interleaved.push(b[i]);
  const maxEcc = Math.max(...eccBlocks.map(b=>b.length));
  for(let i=0;i<maxEcc;i++) for(const b of eccBlocks) if(i<b.length) interleaved.push(b[i]);

  // Place data into matrix (zigzag)
  let bitIdx=0;
  const dataBits: (0|1)[] = [];
  for(const byte of interleaved) for(let i=7;i>=0;i--) dataBits.push(((byte>>i)&1) as 0|1);

  for(let col=size-1;col>=1;col-=2) {
    if(col===6) col=5; // skip timing col
    const upward = ((size-1-col)>>1)%2===0;
    for(let row=0;row<size;row++) {
      const r = upward ? size-1-row : row;
      for(let c=0;c<2;c++) {
        const cc = col-c;
        if(m[r][cc]===null && bitIdx<dataBits.length) {
          m[r][cc] = dataBits[bitIdx++];
        }
      }
    }
  }
  // Fill remaining nulls with 0
  for(let r=0;r<size;r++) for(let c=0;c<size;c++) if(m[r][c]===null) m[r][c]=0;

  // Apply mask pattern 0: (row+col)%2===0 → flip (only data/format areas)
  // Use mask 0 (simplest, good enough for scanner)
  const isFixed = (r:number,c:number):boolean => {
    // finder+separator
    if(r<9&&c<9) return true;
    if(r<9&&c>size-9) return true;
    if(r>size-9&&c<9) return true;
    // timing
    if(r===6||c===6) return true;
    // dark module
    if(r===size-8&&c===8) return true;
    return false;
  };
  for(let r=0;r<size;r++) for(let c=0;c<size;c++) {
    if(!isFixed(r,c) && (r+c)%2===0) m[r][c] = (m[r][c]===1?0:1) as 0|1;
  }

  // Write format information (ECL=M=01, mask=000, BCH)
  const formatInfo = [1,1,0,1,0,1,1,1,0,0,1,0,0,0,0]; // ECL M + mask 0, precomputed
  const fi = formatInfo;
  // Around top-left finder
  const fPos = [0,1,2,3,4,5,7,8,8,8,8,8,8,8,8];
  const fCol = [8,8,8,8,8,8,8,8,7,5,4,3,2,1,0];
  for(let i=0;i<15;i++) { set(fPos[i],fCol[i],fi[i]); set(fCol[i],fPos[i],fi[i]); }
  // Around top-right and bottom-left finders
  for(let i=0;i<7;i++) set(8,size-1-i,fi[i]);
  for(let i=7;i<15;i++) set(size-7+(i-7),8,fi[i]);

  return { matrix: m as (0|1)[][], size };
}

/**
 * Generates a QR code as a PNG data URL — pure TypeScript, no npm packages, works fully offline.
 */
export const generateQRCode = async (text: string): Promise<string> => {
  const { matrix, size } = makeQRMatrix(text);
  const scale = 4;
  const quiet = 4;
  const imgSize = (size + quiet * 2) * scale;

  const canvas = document.createElement('canvas');
  canvas.width = imgSize;
  canvas.height = imgSize;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, imgSize, imgSize);
  ctx.fillStyle = '#000000';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
  }

  return canvas.toDataURL('image/png');
};

/**
 * Generates an AES-256 encrypted QR code for bill cancellation.
 * Payload: { billId, billNumber, timestamp, action: 'CANCEL_BILL' }
 */
export const generateBillCancellationQRCode = async (
  billId: string,
  billNumber: number
): Promise<string> => {
  const payload = JSON.stringify({
    billId,
    billNumber,
    timestamp: Date.now(),
    action: 'CANCEL_BILL',
  });

  const encryptedPayload = await encryptAES256(payload);
  return generateQRCode(encryptedPayload);
};