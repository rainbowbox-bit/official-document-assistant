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
      throw new GeminiError(
        '網路連線失敗，請確認網路狀態後重試',
        '請檢查您的網路連線是否正常。如果使用 VPN 或防火牆，可能需要調整設定允許連線至 googleapis.com。'
      );
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || '';

      if (response.status === 400) {
        throw new GeminiError(
          'API 金鑰無效或請求格式錯誤',
          '請至右上角「API 設定」重新確認金鑰是否正確。金鑰應以「AIza」開頭。如金鑰正確但仍出錯，可能是金鑰已被撤銷，請至 Google AI Studio 重新產生。'
        );
      }
      if (response.status === 403) {
        throw new GeminiError(
          'API 金鑰無存取權限',
          '請至 Google AI Studio (aistudio.google.com) 確認已啟用 Generative Language API。如使用機構帳號，可能受組織政策限制，建議改用個人 Google 帳號。'
        );
      }
      if (response.status === 429) {
        throw new GeminiError(
          '已超過 API 使用限制',
          '免費方案每分鐘最多 15 次請求。請等待約 1 分鐘後重試。如經常遇到此問題，可至 Google Cloud Console 升級為付費方案。'
        );
      }
      if (response.status >= 500) {
        throw new GeminiError(
          `Google Gemini 服務暫時異常（${response.status}）`,
          '這是 Google 伺服器端的問題，非您的設定問題。通常幾分鐘後會恢復正常，請稍後重試。'
        );
      }
      throw new GeminiError(
        `API 回應錯誤 ${response.status}`,
        msg || '未知錯誤，請確認網路連線及 API 金鑰是否正確。'
      );
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];

    if (!candidate) {
      throw new GeminiError(
        'API 未回傳有效候選結果',
        '請重試一次。如果持續發生，可能是輸入的公文內容觸發了 API 限制。'
      );
    }
    if (candidate.finishReason === 'SAFETY') {
      throw new GeminiError(
        '內容被 Gemini 安全過濾器攔截',
        '請確認輸入的公文內容是否包含敏感詞彙。您可以嘗試移除可能觸發過濾的內容後重試。'
      );
    }
    if (candidate.finishReason === 'MAX_TOKENS') {
      const partialText = candidate?.content?.parts?.[0]?.text;
      if (partialText) return partialText.trim() + '\n\n（注意：回文已達最大長度限制，可能不完整）';
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new GeminiError(
        'API 回傳內容為空',
        '請重試一次。如持續發生，請嘗試縮短輸入的公文內容。'
      );
    }

    return text.trim();
  }

  /* ── 自訂錯誤類別（含建議提示） ── */
  class GeminiError extends Error {
    constructor(message, hint) {
      super(message);
      this.name = 'GeminiError';
      this.hint = hint || '';
    }
  }

  return { saveApiKey, getApiKey, clearApiKey, hasApiKey, generateReply, GeminiError };
})();
