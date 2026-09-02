'use strict';

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'video.config.json');

let CONFIG;
try {
  CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  console.error('Could not read video.config.json:', e.message);
  process.exit(1);
}

const COMFY = (process.env[CONFIG.comfyUrlEnv] || CONFIG.comfyUrl || '').replace(/\/+$/, '');
// ngrok free tunnels serve an interstitial/403 to programmatic callers unless this header is set.
const NGROK_HEADERS = { 'ngrok-skip-browser-warning': 'true' };
const MODELS = CONFIG.models || {};
const OUTPUT_DIR = path.join(ROOT, CONFIG.outputDir || 'jobs');
const FFMPEG = CONFIG.ffmpeg || 'ffmpeg';
const PER_CLIP_TIMEOUT = CONFIG.perClipTimeoutMs || 2400000;

const sessionDisabled = new Set();
const jobs = new Map();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[server]', ...a);

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function uploadImage(buf, filename) {
  const boundary = '----donbossing' + crypto.randomUUID();
  const head = Buffer.from(
    '--' + boundary + '\r\nContent-Disposition: form-data; name="image"; filename="' + filename + '"\r\nContent-Type: application/octet-stream\r\n\r\n'
  );
  const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
  const body = Buffer.concat([head, buf, tail]);
  const r = await fetch(COMFY + '/upload/image', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, ...NGROK_HEADERS },
    body
  });
  if (!r.ok) throw new Error('image upload failed: ' + r.status);
  const j = await r.json();
  return j.name;
}

function injectGraph(graph, opts) {
  let imageNode, promptNode, framesNode, wNode, hNode, fpsNode;
  for (const n of Object.values(graph)) {
    const ins = n.inputs || {};
    if (imageNode === undefined && typeof ins.image === 'string') imageNode = n;
    if (promptNode === undefined && ((typeof ins.text === 'string') || (typeof ins.prompt === 'string')) && !/neg/i.test(n.class_type || '')) promptNode = n;
    if (framesNode === undefined && (ins.num_frames !== undefined || ins.length !== undefined || ins.frames !== undefined)) framesNode = n;
    if (wNode === undefined && typeof ins.width === 'number') wNode = n;
    if (hNode === undefined && typeof ins.height === 'number') hNode = n;
    if (fpsNode === undefined && (ins.frame_rate !== undefined || ins.fps !== undefined)) fpsNode = n;
  }
  // Wan 2.2: detect Wan22ImageToVideoLatent by type (width/height/length in widgets_values, not inputs)
  for (const n of Object.values(graph)) {
    if (n.type === 'Wan22ImageToVideoLatent') {
      if (wNode === undefined) wNode = n;
      if (hNode === undefined) hNode = n;
      if (framesNode === undefined) framesNode = n;
    }
    // CreateVideo: also detect by type (fps in widgets_values)
    if (n.type === 'CreateVideo' && fpsNode === undefined) fpsNode = n;
  }
  if (imageNode) imageNode.inputs.image = opts.imageName;
  if (promptNode) {
    if ('text' in promptNode.inputs) promptNode.inputs.text = opts.prompt;
    else if ('prompt' in promptNode.inputs) promptNode.inputs.prompt = opts.prompt;
  }
  if (framesNode) {
    if ('num_frames' in framesNode.inputs) framesNode.inputs.num_frames = opts.frames;
    else if ('length' in framesNode.inputs) framesNode.inputs.length = opts.frames;
    else if ('frames' in framesNode.inputs) framesNode.inputs.frames = opts.frames;
    else if (framesNode.widgets_values && framesNode.widgets_values.length >= 3) framesNode.widgets_values[2] = opts.frames;
  }
  if (wNode && opts.width) {
    wNode.inputs.width = opts.width;
    if (wNode.widgets_values && wNode.widgets_values.length >= 1) wNode.widgets_values[0] = opts.width;
  }
  if (hNode && opts.height) {
    hNode.inputs.height = opts.height;
    if (hNode.widgets_values && hNode.widgets_values.length >= 2) hNode.widgets_values[1] = opts.height;
  }
  if (fpsNode) {
    if ('frame_rate' in fpsNode.inputs) fpsNode.inputs.frame_rate = opts.fps;
    else if ('fps' in fpsNode.inputs) fpsNode.inputs.fps = opts.fps;
    else if (fpsNode.widgets_values && fpsNode.widgets_values.length >= 1) fpsNode.widgets_values[0] = opts.fps;
  }
  return { image: !!imageNode, prompt: !!promptNode, frames: !!framesNode, width: !!wNode, height: !!hNode, fps: !!fpsNode };
}

async function queuePrompt(graph, clientId) {
  const r = await fetch(COMFY + '/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS },
    body: JSON.stringify({ prompt: graph, client_id: clientId })
  });
  const j = await r.json();
  if (j.error) {
    const ne = j.error.node_errors ? ' ' + JSON.stringify(j.error.node_errors) : '';
    throw new Error('queue error: ' + (j.error.message || JSON.stringify(j.error)) + ne);
  }
  if (!j.prompt_id) throw new Error('no prompt_id returned');
  return j.prompt_id;
}

async function waitHistory(promptId) {
  const deadline = Date.now() + PER_CLIP_TIMEOUT;
  while (Date.now() < deadline) {
    const r = await fetch(COMFY + '/history/' + encodeURIComponent(promptId), { headers: NGROK_HEADERS });
    const j = await r.json();
    if (j[promptId]) {
      const entry = j[promptId];
      const msgs = (entry.status && entry.status.messages) || [];
      for (const m of msgs) {
        if (m && m[0] === 'execution_error') {
          const msg = (m[1] && m[1].message) ? m[1].message : JSON.stringify(m[1]);
          throw new Error('ComfyUI execution_error: ' + msg);
        }
      }
      if (entry.outputs) return entry;
    }
    await sleep(3000);
  }
  throw new Error('timed out waiting for clip (>' + (PER_CLIP_TIMEOUT / 60000) + ' min)');
}

async function downloadOutput(entry) {
  let fileMeta = null;
  const findVideo = (nodeOut) => {
    for (const key of ['videos', 'gifs', 'Filenames']) {
      const arr = nodeOut[key];
      if (Array.isArray(arr) && arr.length && arr[0] && arr[0].filename) return arr[0];
    }
    for (const v of Object.values(nodeOut)) {
      if (Array.isArray(v) && v.length && v[0] && v[0].filename &&
          /\.(mp4|webm|gif)$/i.test(v[0].filename)) return v[0];
    }
    return null;
  };
  for (const nodeOut of Object.values(entry.outputs || {})) {
    const m = findVideo(nodeOut);
    if (m) { fileMeta = m; break; }
  }
  if (!fileMeta) throw new Error('no video output in ComfyUI response');
  const qs = new URLSearchParams({
    filename: fileMeta.filename,
    subfolder: fileMeta.subfolder || '',
    type: fileMeta.type || 'output'
  }).toString();
  const r = await fetch(COMFY + '/view?' + qs, { headers: NGROK_HEADERS });
  if (!r.ok) throw new Error('view download failed: ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

function emit(job, event) {
  job.log.push(event);
  for (const res of job.listeners) {
    try { res.write('data: ' + JSON.stringify(event) + '\n\n'); } catch (_) {}
  }
}

function loadWorkflow(modelKey) {
  const m = MODELS[modelKey];
  if (!m) throw new Error('unknown model: ' + modelKey);
  const p = path.join(ROOT, m.workflow);
  const raw = fs.readFileSync(p, 'utf8');
  return { graph: JSON.parse(raw), meta: m };
}

function dataUrlToBuffer(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) throw new Error('invalid image data url');
  return Buffer.from(m[2], 'base64');
}

async function processJob(job) {
  const { model, seconds, fps, width, height, images, prompts } = job.params;
  const total = images.length;
  const isWan22 = model === 'wan22';
  const frames = isWan22 ? Math.max(1, Math.min(81, Math.round(seconds * fps))) : (() => { const k = Math.max(1, Math.round((seconds * fps - 1) / 4)); return 1 + 4 * k; })();
// Feed the model a native-resolution frame matching the target aspect so the
// final ffmpeg upscale (in concat) preserves aspect without distortion.
// Native resolutions must be divisible by 16 (VAE factor 8 x patch 2).
  const interW = portrait ? 480 : 720;
  const interH = portrait ? 720 : 480;
  job.status = 'processing';
  emit(job, { type: 'start', total: total, model: model });

  const clipsDir = path.join(OUTPUT_DIR, job.id);
  await fsp.mkdir(clipsDir, { recursive: true });

  let okCount = 0;
  for (let i = 0; i < total; i++) {
    if (sessionDisabled.has(model)) {
      emit(job, { type: 'clip', index: i, status: 'skipped', reason: 'model disabled' });
      job.clips[i] = { status: 'skipped' };
      continue;
    }
    emit(job, { type: 'clip', index: i, status: 'uploading' });
    const clip = { status: 'processing' };
    job.clips[i] = clip;
    try {
      const buf = dataUrlToBuffer(images[i]);
      const imgName = await uploadImage(buf, 'db_' + job.id + '_' + i + '.png');
      const { graph } = loadWorkflow(model);
      const filled = injectGraph(graph, {
        imageName: imgName,
        prompt: (prompts[i] || '').slice(0, 400) || 'gentle cinematic motion, slight camera drift',
        frames: frames,
        seconds: seconds,
        fps: fps,
        width: interW,
        height: interH
      });
      log('clip ' + i + ': injected', filled);
      emit(job, { type: 'clip', index: i, status: 'generating' });
      const promptId = await queuePrompt(graph, job.id + '-' + i);
      const entry = await waitHistory(promptId);
      const vid = await downloadOutput(entry);
      const firstOut = Object.values(entry.outputs)[0] || {};
      const firstVid = (firstOut.videos || [])[0] || {};
      const ext = /\.webm$/i.test(firstVid.filename || '') ? 'webm' : 'mp4';
      const clipPath = path.join(clipsDir, 'clip_' + String(i).padStart(3, '0') + '.' + ext);
      await fsp.writeFile(clipPath, vid);
      clip.status = 'done';
      clip.path = clipPath;
      okCount++;
      emit(job, { type: 'clip', index: i, status: 'done', progress: okCount / total });
    } catch (e) {
      clip.status = 'failed';
      clip.error = e.message;
      const disabling = /out of memory|oor|cuda|xformers|alloc|load model|missing|not enough/i.test(e.message);
      if (disabling) {
        sessionDisabled.add(model);
        log('model ' + model + ' disabled for session:', e.message);
      }
      emit(job, { type: 'clip', index: i, status: 'failed', error: e.message, modelDisabled: disabling });
    }
  }

  const doneClips = job.clips.filter(c => c.status === 'done' && c.path);
  if (!doneClips.length) {
    job.status = 'failed';
    emit(job, { type: 'done', status: 'failed', error: 'no clips generated' });
    return;
  }

  emit(job, { type: 'concat', status: 'running' });
  const listPath = path.join(clipsDir, 'list.txt');
  const listText = doneClips.map(c => "file '" + path.resolve(c.path).replace(/\\/g, '/') + "'").join('\n') + '\n';
  await fsp.writeFile(listPath, listText);

  const finalPath = path.join(clipsDir, 'final.mp4');
  const ffmpegArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath];
  if (width && height) {
    // Upscale the native ~480p clip to the chosen output resolution without distorting aspect.
    ffmpegArgs.push('-vf', `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`);
  }
  ffmpegArgs.push('-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', finalPath);
  await new Promise((resolve) => {
    execFile(FFMPEG, ffmpegArgs, (err) => {
      if (err) {
        job.status = 'failed';
        emit(job, { type: 'concat', status: 'failed', error: err.message });
      } else {
        job.status = 'done';
        job.result = '/api/video/result/' + job.id;
        emit(job, { type: 'done', status: 'done', result: job.result, clips: doneClips.length, total: total });
      }
      resolve();
    });
  });
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown' };

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const full = path.join(ROOT, rel);
  if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, { 'Content-Type': (MIME[ext] || 'application/octet-stream') });
  fs.createReadStream(full).pipe(res);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 50 * 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function comfyReachable() {
  if (!COMFY || COMFY.indexOf('REPLACE') !== -1) return false;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(COMFY + '/system_stats', { signal: ctrl.signal, headers: NGROK_HEADERS });
    clearTimeout(to);
    return r.ok;
  } catch (e) {
    return false;
  }
}

async function capabilities() {
  const ok = await comfyReachable();
  return {
    comfy: ok,
    models: Object.keys(MODELS).filter(k => MODELS[k].enabled).map(k => ({
      key: k,
      label: MODELS[k].label,
      enabled: ok && !sessionDisabled.has(k)
    }))
  };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;

  if (p === '/api/video/capabilities') {
    const caps = await capabilities();
    return sendJson(res, 200, Object.assign({ ok: true }, caps));
  }

  if (p === '/api/video/queue' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); } catch (e) { return sendJson(res, 400, { error: 'invalid json' }); }
    const model = body.model;
    if (!model || !MODELS[model] || !MODELS[model].enabled) return sendJson(res, 400, { error: 'unknown model' });
    if (sessionDisabled.has(model)) return sendJson(res, 400, { error: 'model disabled this session' });
    const images = Array.isArray(body.images) ? body.images : [];
    if (!images.length) return sendJson(res, 400, { error: 'no images' });
    if (images.length > 400) return sendJson(res, 400, { error: 'too many images (max 400)' });
    const job = {
      id: crypto.randomUUID(),
      status: 'queued',
      params: {
        model: model,
        seconds: Math.min(30, Math.max(1, Number(body.seconds) || 4)),
        fps: Math.min(30, Math.max(1, Number(body.fps) || 8)),
        width: Number(body.width) || 0,
        height: Number(body.height) || 0,
        images: images,
        prompts: Array.isArray(body.prompts) ? body.prompts : []
      },
      clips: new Array(images.length),
      listeners: [],
      log: []
    };
    jobs.set(job.id, job);
    processJob(job).catch(e => { job.status = 'failed'; emit(job, { type: 'done', status: 'failed', error: e.message }); });
    return sendJson(res, 200, { ok: true, jobId: job.id });
  }

  if (p.startsWith('/api/video/progress/') && req.method === 'GET') {
    const id = p.split('/').pop();
    const job = jobs.get(id);
    if (!job) { res.writeHead(404); res.end('no job'); return; }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: ' + JSON.stringify({ type: 'state', status: job.status, clips: job.clips.length }) + '\n\n');
    job.listeners.push(res);
    req.on('close', () => {
      const i = job.listeners.indexOf(res);
      if (i >= 0) job.listeners.splice(i, 1);
    });
    return;
  }

  if (p.startsWith('/api/video/result/') && req.method === 'GET') {
    const id = p.split('/').pop();
    const job = jobs.get(id);
    if (!job || job.status !== 'done' || !job.result) { res.writeHead(404); res.end('not ready'); return; }
    const fp = path.join(OUTPUT_DIR, id, 'final.mp4');
    if (!fs.existsSync(fp)) { res.writeHead(404); res.end('missing'); return; }
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': fs.statSync(fp).size });
    fs.createReadStream(fp).pipe(res);
    return;
  }

  if (p.startsWith('/api/video/')) {
    return sendJson(res, 404, { error: 'unknown video endpoint' });
  }

  if (req.method === 'GET') return serveStatic(req, res, p);
  res.writeHead(405); res.end('method not allowed');
});

const PORT = CONFIG.port || 3000;
server.listen(PORT, () => {
  log('listening on http://localhost:' + PORT);
  log('ComfyUI target: ' + (COMFY || '(not set)'));
  if (!COMFY || COMFY.indexOf('REPLACE') !== -1) {
    log('WARNING: set comfyUrl in video.config.json (or VIDEO_COMFY_URL env) to your stable tunnel URL.');
    return;
  }
  comfyReachable().then(ok => {
    log('ComfyUI reachable: ' + (ok ? 'YES' : 'NO — start the Kaggle notebook or check the tunnel URL'));
  });
});
