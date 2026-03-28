/* ===================================================
   gemini-api.js
   Gemini API 呼叫 + localStorage 金鑰管理
   =================================================== */
'use strict';

const GeminiApi = (() => {

  const MODEL   = 'gemini-1.5-pro';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const LS_KEY  = 'gongwen_gemini_api_key';

  /* ── 金鑰管理 ── */
  function saveApiKey(key) {
    const trimmed = (key || '').trim();
    if (!trimmed) throw new Error('API 金鑰不可為空');
    if (!trimmed.startsWith('AIza')) {
      throw new Error('API 金鑰格式不正確，有效金鑰應以「AIza」開頭');
    }
    localStorage.setItem(LS_KEY, trimmed);
  }

  function getApiKey() {
    return localStorage.getItem(LS_KEY) || '';
  }

  function clearApiKey() {
    localStorage.removeItem(LS_KEY);
  }

  function hasApiKey() {
    return Boolean(getApiKey());
  }

  /* ── 主要生成呼叫 ── */
  async function generateReply(systemPrompt, userPrompt) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('請先在右上角「API 設定」中輸入 Gemini API 金鑰');
    }

    const url = `${API_URL}?key=${encodeURIComponent(apiKey)}`;

    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature:      0.3,
        topP:             0.8,
        topK:             40,
        maxOutputTokens:  4096,
        candidateCount:   1
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
      ]
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch {
      throw new Error('網路連線失敗，請確認網路狀態後重試');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || '';

      if (response.status === 400) {
        throw new Error('API 金鑰無效或請求格式錯誤，請至設定重新確認金鑰（' + (msg || '400') + '）');
      }
      if (response.status === 403) {
        throw new Error('API 金鑰無存取權限，請至 Google AI Studio 確認已啟用 Generative Language API');
      }
      if (response.status === 429) {
        throw new Error('已超過 API 使用限制（免費方案每分鐘最多 15 次），請稍候 1 分鐘後重試');
      }
      if (response.status >= 500) {
        throw new Error(`Google Gemini 服務暫時異常（${response.status}），請稍後重試`);
      }
      throw new Error(`API 回應錯誤 ${response.status}：${msg || '未知錯誤'}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];

    if (!candidate) {
      throw new Error('API 未回傳有效候選結果，請重試');
    }
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('內容被 Gemini 安全過濾器攔截，請確認輸入的公文內容是否適當');
    }
    if (candidate.finishReason === 'MAX_TOKENS') {
      // 部分結果仍可用
      const partialText = candidate?.content?.parts?.[0]?.text;
      if (partialText) return partialText.trim() + '\n\n（注意：回文已達最大長度限制，可能不完整）';
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('API 回傳內容為空，請重試');
    }

    return text.trim();
  }

  return { saveApiKey, getApiKey, clearApiKey, hasApiKey, generateReply };
})();
