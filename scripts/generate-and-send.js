// ============================================================
//  AUTOMATED VIDEO GENERATOR + TELEGRAM SENDER
//  Captures p5.js animation frame-by-frame → FFmpeg → Telegram
// ============================================================

const puppeteer = require('puppeteer');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ======================== CONFIG ========================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const VIDEO_WIDTH = parseInt(process.env.VIDEO_WIDTH) || 1080;
const VIDEO_HEIGHT = parseInt(process.env.VIDEO_HEIGHT) || 1920;
const VIDEO_FPS = parseInt(process.env.VIDEO_FPS) || 30;
const VIDEO_DURATION = parseInt(process.env.VIDEO_DURATION) || 45; // seconds
const SERVER_PORT = 9222;

const SCENE_NAMES = [
  'Color Sorting Balls',
  'Spiral Satisfaction',
  'Liquid Fill',
  'Particle Vortex',
  'Pendulum Wave',
  'Gravity Balls'
];

const SCENE_EMOJIS = ['🔴', '🌀', '💧', '⚡', '🎯', '🟢'];

const HASHTAGS = '#satisfying #oddlysatisfying #asmr #animation #viral #mesmerizing #relaxing';

const CAPTIONS_POOL = [
  'Watch till the end! So satisfying! 😍',
  'Can you look away? 👀',
  'This is pure satisfaction! 🤤',
  'Perfectly smooth! ✨',
  'I could watch this forever! 🔁',
  'Tag someone who needs this! 🏷️',
  'Rate this 1-10! 🔢',
  'Which is your favorite? Comment below! 💬',
  'SO SATISFYING! Turn on sound! 🔊',
  'This will calm your mind! 🧘'
];

// ======================== STATIC FILE SERVER ========================
function startServer(rootDir) {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.mp4': 'video/mp4'
    };

    const server = http.createServer((req, res) => {
      // Parse the URL path, remove query string
      let urlPath = req.url.split('?')[0];
      if (urlPath === '/') urlPath = '/index.html';

      const filePath = path.join(rootDir, urlPath);
      const ext = path.extname(filePath);

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found: ' + urlPath);
          return;
        }
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.listen(SERVER_PORT, () => {
      console.log(`📡 Server running on http://localhost:${SERVER_PORT}`);
      resolve(server);
    });
  });
}

// ======================== VIDEO CAPTURE ========================
async function captureVideo(scene, seed, outputPath) {
  console.log(`\n🎬 Generating video...`);
  console.log(`   Scene: ${SCENE_EMOJIS[scene]} ${SCENE_NAMES[scene]}`);
  console.log(`   Seed:  ${seed}`);
  console.log(`   Size:  ${VIDEO_WIDTH}x${VIDEO_HEIGHT} @ ${VIDEO_FPS}fps`);
  console.log(`   Duration: ${VIDEO_DURATION}s\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      `--window-size=${VIDEO_WIDTH},${VIDEO_HEIGHT}`
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT });

  const url = `http://localhost:${SERVER_PORT}/?auto=true&scene=${scene}&seed=${seed}`;
  console.log(`🌐 Loading: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for p5.js to initialize
  await page.waitForFunction('window.isReady === true', { timeout: 30000 });
  console.log('✅ Page ready\n');

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const totalFrames = VIDEO_FPS * VIDEO_DURATION;
  // Sketch runs at 60fps, capture at VIDEO_FPS → advance 2 frames per capture at 30fps
  const framesPerCapture = Math.round(60 / VIDEO_FPS);

  // Start FFmpeg — accepts JPEG frames via stdin, outputs MP4
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'image2pipe',
    '-framerate', String(VIDEO_FPS),
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '22',
    '-movflags', '+faststart',
    '-vf', `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`,
    '-y',
    outputPath
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  let ffmpegError = '';
  ffmpeg.stderr.on('data', (data) => {
    ffmpegError = data.toString(); // Keep last error message
  });

  const startTime = Date.now();
  let lastLogTime = startTime;

  for (let i = 0; i < totalFrames; i++) {
    // Advance the animation by framesPerCapture steps
    await page.evaluate((n) => {
      for (let j = 0; j < n; j++) {
        window.renderFrame();
      }
    }, framesPerCapture);

    // Capture screenshot as JPEG
    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 92,
      clip: { x: 0, y: 0, width: VIDEO_WIDTH, height: VIDEO_HEIGHT }
    });

    // Write to FFmpeg stdin
    const canWrite = ffmpeg.stdin.write(screenshot);
    if (!canWrite) {
      await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
    }

    // Progress logging (every 5 seconds)
    const now = Date.now();
    if (now - lastLogTime > 5000 || i === totalFrames - 1) {
      const pct = Math.floor((i + 1) / totalFrames * 100);
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      const eta = (((now - startTime) / (i + 1)) * (totalFrames - i - 1) / 1000).toFixed(0);
      console.log(`   📸 Frame ${i + 1}/${totalFrames} (${pct}%) — ${elapsed}s elapsed, ~${eta}s remaining`);
      lastLogTime = now;
    }
  }

  // Finalize video
  ffmpeg.stdin.end();
  await new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const fileSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
        console.log(`\n✅ Video saved: ${outputPath} (${fileSize} MB)`);
        resolve();
      } else {
        console.error('FFmpeg error:', ffmpegError);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });

  // Extract interactive sound events recorded during frame execution
  const soundEvents = await page.evaluate(() => window.soundEvents || []);
  console.log(`🎵 Collected ${soundEvents.length} interactive sound events from animation!`);

  await browser.close();
  return soundEvents;
}

// ======================== TELEGRAM ========================
async function sendToTelegram(videoPath, caption) {
  console.log('\n📤 Sending to Telegram...');

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set!');
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now() + Math.random().toString(36).slice(2);
    const videoData = fs.readFileSync(videoPath);
    const filename = path.basename(videoPath);

    // Build multipart form data manually (no external packages needed)
    const fields = [
      { name: 'chat_id', value: TELEGRAM_CHAT_ID },
      { name: 'caption', value: caption },
      { name: 'parse_mode', value: 'HTML' },
      { name: 'supports_streaming', value: 'true' }
    ];

    let preVideo = '';
    for (const field of fields) {
      preVideo += `--${boundary}\r\n`;
      preVideo += `Content-Disposition: form-data; name="${field.name}"\r\n\r\n`;
      preVideo += `${field.value}\r\n`;
    }

    // Video file part header
    preVideo += `--${boundary}\r\n`;
    preVideo += `Content-Disposition: form-data; name="video"; filename="${filename}"\r\n`;
    preVideo += `Content-Type: video/mp4\r\n\r\n`;

    const preVideoBuffer = Buffer.from(preVideo, 'utf-8');
    const postVideoBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');

    const totalLength = preVideoBuffer.length + videoData.length + postVideoBuffer.length;

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendVideo`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            console.log('✅ Video sent to Telegram successfully!');
            console.log(`   Message ID: ${result.result.message_id}`);
            resolve(result);
          } else {
            console.error('❌ Telegram API error:', result.description);
            reject(new Error(result.description));
          }
        } catch (e) {
          console.error('❌ Failed to parse Telegram response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request error:', err.message);
      reject(err);
    });

    req.write(preVideoBuffer);
    req.write(videoData);
    req.write(postVideoBuffer);
    req.end();
  });
}

// ======================== INTERACTIVE AUDIO ========================
// Synthesizes crystal-clear, loud, frame-perfect sound effects
// matched with visual animation events (pops, clicks, drops, swooshes, chimes)
async function addInteractiveAudio(silentVideoPath, finalVideoPath, soundEvents, duration) {
  console.log(`\n🔊 Synthesizing interactive audio (${soundEvents.length} events)...`);
  const { generateWavFromEvents } = require('./audio-synth');

  const outputDir = path.dirname(finalVideoPath);
  const tempWavPath = path.join(outputDir, `audio_${Date.now()}.wav`);

  // Generate 44.1kHz 16-bit stereo WAV buffer from sound events
  // Video runs at VIDEO_FPS (30), animation steps at 60fps
  const wavBuffer = generateWavFromEvents(soundEvents, duration, 60);
  fs.writeFileSync(tempWavPath, wavBuffer);
  console.log(`✅ Audio synthesized: ${(wavBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  return new Promise((resolve, reject) => {
    // Mux silent MP4 + synthesized audio WAV (AAC 192k)
    const ffmpeg = spawn('ffmpeg', [
      '-i', silentVideoPath,
      '-i', tempWavPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      '-y',
      finalVideoPath
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderrOutput = '';
    ffmpeg.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);

      if (code === 0) {
        const fileSize = (fs.statSync(finalVideoPath).size / 1024 / 1024).toFixed(2);
        console.log(`✅ Final video with interactive audio saved: ${finalVideoPath} (${fileSize} MB)`);
        resolve();
      } else {
        console.error('FFmpeg audio merge error:', stderrOutput);
        reject(new Error(`FFmpeg audio merge failed with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
      console.error('FFmpeg spawn error:', err.message);
      reject(err);
    });
  });
}

// ======================== MAIN ========================
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  🎬 SATISFYING ANIMATION VIDEO GENERATOR');
  console.log('═══════════════════════════════════════════\n');

  // Pick random scene and unique seed
  const scene = Math.floor(Math.random() * SCENE_NAMES.length);
  const seed = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(__dirname, '..', 'output');
  const silentPath = path.join(outputDir, `silent_${timestamp}.mp4`);
  const finalPath = path.join(outputDir, `satisfying_${SCENE_NAMES[scene].replace(/\s+/g, '_').toLowerCase()}_${timestamp}.mp4`);

  // Build engaging caption
  const randomCaption = CAPTIONS_POOL[Math.floor(Math.random() * CAPTIONS_POOL.length)];
  const caption = `${SCENE_EMOJIS[scene]} <b>${SCENE_NAMES[scene]}</b>\n\n${randomCaption}\n\n${HASHTAGS}`;

  // 1. Start local server
  const projectRoot = path.join(__dirname, '..');
  const server = await startServer(projectRoot);

  try {
    // 2. Capture silent video + collect interactive sound events
    const soundEvents = await captureVideo(scene, seed, silentPath);

    // 3. Add interactive audio matched to video
    await addInteractiveAudio(silentPath, finalPath, soundEvents, VIDEO_DURATION);

    // 4. Send to Telegram
    await sendToTelegram(finalPath, caption);

    console.log('\n🎉 Done! Video generated and sent successfully.\n');
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    process.exit(1);
  } finally {
    // 5. Cleanup
    server.close();
    if (fs.existsSync(silentPath)) fs.unlinkSync(silentPath);
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    console.log('🧹 Cleaned up video files.');
  }
}

main();
