// services/pollinationsBalancer.js
// API docs: https://enter.pollinations.ai/api/docs
// Base URL: https://gen.pollinations.ai
// Auth: Authorization: Bearer sk_xxx

const POLLINATIONS_URL = 'https://gen.pollinations.ai/v1/chat/completions';

// Primary: claude-fast (Claude, vision) — preferred
// Secondary: openai (GPT-5.4, vision, 400k context) — free tier
// Tertiary: gemini (Gemini Flash, vision, 1M context) — free tier
const MODELS = ['claude-fast', 'openai', 'gemini'];

const modelFailCounts = {};
const MODEL_FAIL_THRESHOLD = 2; // ✅ Giảm từ 3 → 2 (chuyển model nhanh hơn)
const MODEL_COOLDOWN_MS = 5 * 60 * 1000; // ✅ Giảm từ 10 → 5 phút

function initModelState(model) {
  if (!modelFailCounts[model]) {
    modelFailCounts[model] = { consecutiveFails: 0, disabledAt: null };
  }
  return modelFailCounts[model];
}

function isModelAvailable(model) {
  const state = modelFailCounts[model];
  if (!state || !state.disabledAt) return true;
  if (Date.now() - state.disabledAt >= MODEL_COOLDOWN_MS) {
    state.disabledAt = null;
    state.consecutiveFails = 0;
    console.log(`[Balancer] 🔄 Model ${model} cooldown hết, thử lại`);
    return true;
  }
  return false;
}

function markModelFail(model) {
  const state = initModelState(model);
  state.consecutiveFails++;
  if (state.consecutiveFails >= MODEL_FAIL_THRESHOLD) {
    state.disabledAt = Date.now();
    console.warn(`[Balancer] ❌ Model ${model} fail ${state.consecutiveFails} lần, disable ${MODEL_COOLDOWN_MS / 60000} phút`);
  }
}

function markModelSuccess(model) {
  const state = initModelState(model);
  state.consecutiveFails = 0;
  state.disabledAt = null;
}

function getAvailableModel() {
  for (const model of MODELS) {
    if (isModelAvailable(model)) return model;
  }
  // Tất cả disabled → reset model đầu tiên
  console.warn('[Balancer] ⚠️ Tất cả model disabled, reset model đầu');
  const first = MODELS[0];
  modelFailCounts[first] = { consecutiveFails: 0, disabledAt: null };
  return first;
}

// ─── Key Management ─────────────────────────────────────────
let _cachedKeys = null;

function loadKeys() {
  if (_cachedKeys) return _cachedKeys;
  const keys = [];
  for (let i = 1; i <= 60; i++) {
    const key = process.env[`POLLINATIONS_SK_${i}`];
    if (key && key.trim()) keys.push(key.trim());
  }
  if (keys.length === 0 && process.env.POLLINATIONS_SK) {
    keys.push(process.env.POLLINATIONS_SK);
  }
  _cachedKeys = keys;
  console.log(`[Balancer] 🔑 Loaded ${keys.length} keys`);
  return keys;
}

// Trạng thái từng key
const keyStates = {};

function initKeyState(key) {
  if (!keyStates[key]) {
    keyStates[key] = { exhausted: false, exhaustedAt: null, successCount: 0, failCount: 0 };
  }
  return keyStates[key];
}

// Key hết pollen → cooldown 1 giờ (chờ refill)
function isKeyCoolingDown(key) {
  const state = keyStates[key];
  if (!state || !state.exhausted) return false;
  if (Date.now() - state.exhaustedAt >= 60 * 60 * 1000) {
    // Reset sau 1 giờ
    state.exhausted = false;
    state.exhaustedAt = null;
    console.log(`[Balancer] 🔄 Key ...${key.slice(-6)} recovered`);
    return false;
  }
  return true;
}

function markKeyExhausted(key) {
  const state = initKeyState(key);
  state.exhausted = true;
  state.exhaustedAt = Date.now();
  state.failCount++;
  console.warn(`[Balancer] ⚠️ Key ...${key.slice(-6)} hết Pollen`);
}

function markKeySuccess(key) {
  const state = initKeyState(key);
  state.successCount++;
}

// Round-robin index
let currentIndex = 0;

function getNextAvailableKey(keys) {
  const total = keys.length;
  for (let i = 0; i < total; i++) {
    const key = keys[(currentIndex + i) % total];
    if (!isKeyCoolingDown(key)) {
      currentIndex = (currentIndex + i + 1) % total;
      return key;
    }
  }
  return null; // Tất cả key đều hết pollen
}

// ─── Request Queue ──────────────────────────────────────────
class RequestQueue {
  constructor(concurrency = 10) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._run();
    });
  }

  _run() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._run();
        });
    }
  }

  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
    };
  }
}

const requestQueue = new RequestQueue(10); // max 10 concurrent

// ─── Core API Call ──────────────────────────────────────────
async function callPollinationsWithKey(key, messages, systemPrompt, options = {}) {
  const {
    maxTokens = 8000,
    stream = true,
    temperature = 0.7,
    model = null,
    timeoutMs = 30000,
  } = options;

  const useModel = model || getAvailableModel();

  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: useModel,
        messages: fullMessages,
        max_tokens: maxTokens,
        stream,
        temperature,
      }),
      signal: controller.signal,
    });

    if (response.status === 402) {
      markKeyExhausted(key);
      throw new Error('POLLEN_EXHAUSTED');
    }

    // 401 = invalid/missing key, 403 = key lacks permission → mark key bad, skip it
    if (response.status === 401 || response.status === 403) {
      markKeyExhausted(key); // reuse exhaustion mechanism to skip this key
      console.warn(`[Balancer] ⚠️ Key ...${key.slice(-6)} rejected (HTTP ${response.status}), skipping`);
      throw new Error('KEY_REJECTED');
    }

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    markKeySuccess(key);
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[Balancer] ⏱️ Key ...${key.slice(-6)} timeout sau 30s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Main Export ────────────────────────────────────────────
export async function callWithBalancer(messages, systemPrompt = "", options = {}) {
  return requestQueue.add(async () => {
    const keys = loadKeys();
    const forcedModel = options.model || null;
    const skipEmptyCheck = options.skipEmptyCheck || false;

    if (keys.length === 0) {
      throw new Error('Không có Pollinations key nào được cấu hình');
    }

    if (forcedModel) {
      let lastError = null;

      for (let attempt = 0; attempt < keys.length; attempt++) {
        const key = getNextAvailableKey(keys);
        if (!key) throw new Error('TẤT_CẢ_KEY_HẾT_POLLEN');

        try {
          console.log(`[Balancer] 🔑 Forced: ${forcedModel} | Key: ...${key.slice(-6)}`);
          const response = await callPollinationsWithKey(key, messages, systemPrompt, {
            ...options,
            model: forcedModel,
          });

          // ✅ FIX: Nếu caller tự xử lý JSON (vision.js), KHÔNG clone+json ở đây
          if (!options.stream && !skipEmptyCheck) {
            const cloned = response.clone();
            try {
              const json = await cloned.json();
              const content = json?.choices?.[0]?.message?.content;
              if (!content || content.trim() === '') {
                console.warn(`[Balancer] ⚠️ ${forcedModel} key ...${key.slice(-6)} trả về rỗng`);
                lastError = new Error('EMPTY_RESPONSE');
                continue;
              }
            } catch (parseErr) {
              console.warn(`[Balancer] ⚠️ Parse check failed: ${parseErr.message}`);
              // Không block — trả response để caller tự xử lý
            }
          }

          return response;
        } catch (err) {
          lastError = err;
          if (err.message === 'POLLEN_EXHAUSTED' || err.message === 'KEY_REJECTED') {
            console.warn('[Balancer] Thử key tiếp...');
            continue;
          }
          throw err;
        }
      }

      throw lastError || new Error('Tất cả key đều thất bại cho model ' + forcedModel);
    }

    // Non-forced: thử từng model
    for (let modelAttempt = 0; modelAttempt < MODELS.length; modelAttempt++) {
      const model = getAvailableModel();
      for (let attempt = 0; attempt < keys.length; attempt++) {
        const key = getNextAvailableKey(keys);
        if (!key) break;

        try {
          console.log(`[Balancer] 🔑 Model: ${model} | Key: ...${key.slice(-6)}`);
          const response = await callPollinationsWithKey(key, messages, systemPrompt, {
            ...options,
            model,
          });

          if (!options.stream && !skipEmptyCheck) {
            const cloned = response.clone();
            try {
              const json = await cloned.json();
              const content = json?.choices?.[0]?.message?.content;
              if (!content || content.trim() === '') {
                console.warn(`[Balancer] ⚠️ Model ${model} trả về rỗng`);
                markModelFail(model);
                break;
              }
            } catch { /* noop */ }
          }

          markModelSuccess(model);
          return response;
        } catch (err) {
          if (err.message === 'POLLEN_EXHAUSTED' || err.message === 'KEY_REJECTED') continue;
          markModelFail(model);
          break;
        }
      }
    }

    throw new Error('Tất cả model và key đều thất bại');
  });
}

export async function streamWithBalancer(messages, systemPrompt) {
  const keys = loadKeys();

  if (keys.length === 0) {
    throw new Error('Không có Pollinations key nào được cấu hình');
  }

  // ✅ FIX: Thử từng model, nhưng MỖI MODEL thử NHIỀU KEY trước khi chuyển model
  for (let modelAttempt = 0; modelAttempt < MODELS.length; modelAttempt++) {
    const model = getAvailableModel();
    let lastError = null;

    // ✅ Loop qua nhiều key cho mỗi model
    for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt++) {
      const key = getNextAvailableKey(keys);
      if (!key) break; // hết key available → thử model tiếp

      try {
        console.log(`[Balancer] 🎯 Stream | Model: ${model} | Key: ...${key.slice(-6)}`);
        const response = await callPollinationsWithKey(key, messages, systemPrompt, {
          stream: true,
          maxTokens: 8000,
          temperature: 0.7,
          model,
        });

        // ✅ KIỂM TRA STREAM CÓ DATA THẬT KHÔNG
        const reader = response.body.getReader();
        const firstChunks = [];
        let totalBytes = 0;
        let hasRealData = false;
        const startTime = Date.now();

        // Đọc tối đa 3 chunks hoặc 5 giây, tìm SSE markers
        try {
          while (Date.now() - startTime < 5000 && firstChunks.length < 3) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value?.length > 0) {
              firstChunks.push(value);
              totalBytes += value.length;
              const text = new TextDecoder().decode(value);
              // Kiểm tra SSE format: "choices", "delta", "content"
              if (text.includes('"choices"') || text.includes('"delta"') || text.includes('"content"')) {
                hasRealData = true;
                break; // Đủ rồi, có data thật
              }
            }
          }
        } catch (readErr) {
          console.warn(`[Balancer] ⚠️ Read check error: ${readErr.message}`);
          reader.cancel();
          throw readErr;
        }

        // Nếu stream rỗng → model fail, thử key/model tiếp
        if (!hasRealData && totalBytes === 0) {
          console.warn(`[Balancer] ❌ Model ${model} key ...${key.slice(-6)} stream RỖNG (0 bytes)`);
          markModelFail(model);
          reader.cancel();
          break; // ← Chuyển model (không thử key tiếp cho model này)
        }

        // ✅ Stream có data → tạo combined stream từ pre-read chunks + remaining
        const combinedStream = new ReadableStream({
          async start(controller) {
            try {
              // Enqueue các chunks đã đọc
              for (const chunk of firstChunks) {
                controller.enqueue(chunk);
              }
              // Tiếp tục đọc phần còn lại
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
            } catch (err) {
              controller.error(err);
            } finally {
              controller.close();
            }
          },
        });

        console.log(`[Balancer] ✅ Stream OK | Model ${model} | Key ...${key.slice(-6)} | ${totalBytes} initial bytes`);
        markModelSuccess(model);
        return new Response(combinedStream, {
          status: response.status,
          headers: response.headers,
        });
      } catch (err) {
        lastError = err;
        if (err.message === 'POLLEN_EXHAUSTED' || err.message === 'KEY_REJECTED') {
          console.warn(`[Balancer] Key ${err.message === 'KEY_REJECTED' ? 'bị từ chối' : 'hết pollen'}, thử key tiếp...`);
          continue; // ← thử key tiếp, KHÔNG chuyển model ngay
        }
        if (err.name === 'AbortError') {
          console.warn(`[Balancer] ⏱️ Timeout sau 30s, thử model tiếp...`);
        } else {
          console.warn(`[Balancer] ⚠️ Error: ${err.message}`);
        }
        // Lỗi khác (500, timeout...) → chuyển model
        markModelFail(model);
        break;
      }
    }
  }

  throw new Error('Tất cả model đều thất bại');
}

// Health check
export function getBalancerHealth() {
  const keys = loadKeys();
  const available = keys.filter(k => !isKeyCoolingDown(k)).length;
  const exhausted = keys.length - available;
  return {
    totalKeys: keys.length,
    availableKeys: available,
    exhaustedKeys: exhausted,
    currentModel: getAvailableModel(),
    modelStatus: MODELS.map(m => ({
      model: m,
      available: isModelAvailable(m),
      fails: modelFailCounts[m]?.consecutiveFails || 0,
    })),
    queueStatus: requestQueue.getStatus(),
  };
}
