/**
 * 托盘图标生成器。
 *
 * 为什么手写：Electron 的 nativeImage 不支持 SVG，引入 sharp/canvas 又要背原生依赖，
 * 而我们要画的只是一个带进度的圆环。用 zlib + 手写 PNG 编码，纯 JS、零依赖、每帧可控。
 */

const zlib = require('zlib');

// ---------------- PNG 编码 ----------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** RGBA 像素数组 → PNG Buffer */
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // 每行前置 filter byte 0
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------------- 圆环绘制 ----------------

const COLORS = {
  behind: { r: 157, g: 87, b: 5 },
  mid: { r: 24, g: 119, b: 67 },
  done: { r: 16, g: 110, b: 62 },
  track: { r: 179, g: 190, b: 183 }
};
const DARK_COLORS = {
  behind: { r: 255, g: 197, b: 99 },
  mid: { r: 209, g: 247, b: 101 },
  done: { r: 144, g: 235, b: 161 },
  track: { r: 85, g: 103, b: 94 }
};

const TWO_PI = Math.PI * 2;

/**
 * @param {number} size      像素边长，建议 16 / 32
 * @param {number} progress  0..1
 * @param {object} opts
 *   state : 'behind' | 'ontrack' | 'done'  —— 由 waterStatus 判定，不要用绝对进度猜
 *   dim   : 脉动提醒的低亮度帧
 */
function drawRing(size, progress, opts = {}) {
  const p = Math.max(0, Math.min(1, progress || 0));
  const dim = !!opts.dim;
  const rgba = Buffer.alloc(size * size * 4);

  const SS = 4; // 每像素 4x4 超采样做抗锯齿
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.46;
  // At a Windows tray's actual 16px, progress is ~3.4px and the empty track ~1.2px.
  // Thickness communicates the filled portion even without distinguishing colors.
  const thickness = Math.max(2, size * 0.21);
  const rMid = rOuter - thickness / 2;
  const half = thickness / 2;

  const state = opts.state || (p >= 0.999 ? 'done' : 'ontrack');
  const palette=opts.theme==='dark'?DARK_COLORS:COLORS;
  const progColor = state === 'done' ? palette.done : state === 'behind' ? palette.behind : palette.mid;
  const trackColor = palette.track;
  const trackHalf=size*.038;
  const endX=cx+Math.sin(p*TWO_PI)*rMid,endY=cy-Math.cos(p*TWO_PI)*rMid;
  const globalAlpha = dim ? 0.32 : 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0;
      let ar = 0;
      let ag = 0;
      let ab = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if(opts.alert && dist<=size*.14){ar+=244;ag+=67;ab+=73;cov++;continue;}

          // 从 12 点方向顺时针的角度占比
          let a = Math.atan2(dy, dx) + Math.PI / 2;
          if (a < 0) a += TWO_PI;
          const frac = a / TWO_PI;

          const arc=p>0&&frac<p&&Math.abs(dist-rMid)<=half;
          const cap=p>0&&p<1&&(Math.hypot(px-cx,py-(cy-rMid))<=half||Math.hypot(px-endX,py-endY)<=half);
          const filled=arc||cap;
          if(!filled&&Math.abs(dist-rMid)>trackHalf)continue;
          const c = filled ? progColor : trackColor;
          ar += c.r;
          ag += c.g;
          ab += c.b;
          cov++;
        }
      }

      if (cov === 0) continue;

      const total = SS * SS;
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(ar / cov);
      rgba[idx + 1] = Math.round(ag / cov);
      rgba[idx + 2] = Math.round(ab / cov);
      rgba[idx + 3] = Math.round((cov / total) * 255 * globalAlpha);
    }
  }

  return rgba;
}

function makeRingPng(size, progress, opts = {}) {
  return encodePng(size, size, drawRing(size, progress, opts));
}

function trayTooltip(status,message=''){
 const progress=Math.round(Math.max(0,Math.min(1,status.progress||0))*100);
 const first=status.paused?`今日已喝 ${status.drunk} ml · 目标待确认`:`今日饮水 ${progress}% · ${status.drunk} / ${status.target} ml`;
 return first+(message?'\n'+message:'');
}
module.exports = { makeRingPng, drawRing, encodePng, COLORS, DARK_COLORS, trayTooltip };
