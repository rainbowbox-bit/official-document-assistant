/* ===================================================
   app.js — 主應用程式控制器
   =================================================== */
'use strict';

/* ── DOM 參照 ── */
const $ = id => document.getElementById(id);

const DOM = {
  // Tabs
  tabBtns:         document.querySelectorAll('.tab-btn'),

  // PDF Upload
  dropZone:        $('drop-zone'),
  fileInput:       $('file-input'),
  fileInfo:        $('file-info'),
  fileName:        $('file-name'),
  btnClearFile:    $('btn-clear-file'),
  pdfPreview:      $('pdf-preview'),
  pdfTextPreview:  $('pdf-text-preview'),
  pdfCharCount:    $('pdf-char-count'),

  // Text Paste
  textInput:       $('text-input'),
  charCount:       $('char-count'),

  // Metadata
  inputAgency:     $('input-agency'),
  inputDocType:    $('input-doc-type'),
  inputDirection:  $('input-direction'),
  replyAgency:     $('reply-agency'),

  // Generate
  btnGenerate:     $('btn-generate'),
  btnLabel:        $('btn-label'),
  btnSpinner:      $('btn-spinner'),

  // Output
  outputEmpty:     $('output-empty'),
  outputLoading:   $('output-loading'),
  outputError:     $('output-error'),
  outputResult:    $('output-result'),
  outputText:      $('output-text'),
  outputActions:   $('output-actions'),
  errorMessage:    $('error-message'),
  btnRetry:        $('btn-retry'),
  btnCopy:         $('btn-copy'),
  btnDownload:     $('btn-download'),
  btnRegenerate:   $('btn-regenerate'),

  // API Modal
  btnApiSettings:  $('btn-api-settings'),
  modalApi:        $('modal-api'),
  modalClose:      $('modal-close'),
  apiKeyInput:     $('api-key-input'),
  btnToggleKey:    $('btn-toggle-key'),
  btnSaveKey:      $('btn-save-key'),
  btnClearKey:     $('btn-clear-key'),
  apiKeyStatus:    $('api-key-status'),

  // Toast
  toast:           $('toast'),
};

/* ── 應用程式狀態 ── */
const state = {
  activeTab:          'upload',
  extractedPdfText:   '',
  isGenerating:       false,
  lastGeneratedText:  '',
};

/* ====================================================
   初始化
   ==================================================== */
function init() {
  bindEvents();
  refreshApiKeyStatus();
  updateGenerateButton();

  // 首次使用若無金鑰，自動開啟設定
  if (!GeminiApi.hasApiKey()) {
    openApiModal();
  }
}

/* ====================================================
   事件綁定
   ==================================================== */
function bindEvents() {
  // 分頁切換
  DOM.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // PDF 上傳
  DOM.fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFileSelected(e.target.files[0]);
  });
  DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
  DOM.dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); DOM.fileInput.click(); }
  });
  DOM.dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    DOM.dropZone.classList.add('drag-over');
  });
  DOM.dropZone.addEventListener('dragleave', () => DOM.dropZone.classList.remove('drag-over'));
  DOM.dropZone.addEventListener('drop', e => {
    e.preventDefault();
    DOM.dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });
  DOM.btnClearFile.addEventListener('click', clearFile);

  // 文字輸入
  DOM.textInput.addEventListener('input', () => {
    DOM.charCount.textContent = DOM.textInput.value.length.toLocaleString();
    updateGenerateButton();
  });

  // 生成 / 重試 / 重新生成
  DOM.btnGenerate.addEventListener('click', handleGenerate);
  DOM.btnRetry.addEventListener('click', handleGenerate);
  DOM.btnRegenerate.addEventListener('click', handleGenerate);

  // 輸出操作
  DOM.btnCopy.addEventListener('click', copyOutput);
  DOM.btnDownload.addEventListener('click', downloadOutput);

  // API Modal
  DOM.btnApiSettings.addEventListener('click', openApiModal);
  DOM.modalClose.addEventListener('click', closeApiModal);
  DOM.modalApi.addEventListener('click', e => {
    if (e.target === DOM.modalApi) closeApiModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !DOM.modalApi.hidden) closeApiModal();
  });

  DOM.btnToggleKey.addEventListener('click', toggleKeyVisibility);
  DOM.btnSaveKey.addEventListener('click', saveApiKey);
  DOM.btnClearKey.addEventListener('click', clearApiKey);
}

/* ====================================================
   分頁切換
   ==================================================== */
function switchTab(tab) {
  state.activeTab = tab;

  DOM.tabBtns.forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });

  const tabUpload = $('tab-upload');
  const tabPaste  = $('tab-paste');
  tabUpload.classList.toggle('active', tab === 'upload');
  tabPaste.classList.toggle('active', tab === 'paste');
  tabUpload.hidden = tab !== 'upload';
  tabPaste.hidden  = tab !== 'paste';

  updateGenerateButton();
}

/* ====================================================
   PDF 處理
   ==================================================== */
async function handleFileSelected(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('請選擇 PDF 格式的檔案', 'error');
    return;
  }

  // 顯示檔案資訊
  DOM.fileName.textContent = file.name;
  DOM.fileInfo.hidden = false;

  // 重置預覽
  state.extractedPdfText = '';
  DOM.pdfTextPreview.textContent = '正在擷取文字中⋯';
  DOM.pdfCharCount.textContent = '';
  DOM.pdfPreview.hidden = false;
  updateGenerateButton();

  try {
    const text = await PdfHandler.extractTextFromFile(file);
    const check = PdfHandler.validateDocumentText(text);

    if (!check.valid) {
      DOM.pdfTextPreview.textContent = '⚠️ ' + check.reason;
      showToast(check.reason, 'error');
      return;
    }

    state.extractedPdfText = text;
    DOM.pdfCharCount.textContent = `${text.length.toLocaleString()} 字元`;
    // 預覽前 500 字
    DOM.pdfTextPreview.textContent =
      text.slice(0, 500) + (text.length > 500 ? '\n⋯（共 ' + text.length.toLocaleString() + ' 字元已擷取）' : '');

    showToast(`PDF 擷取成功（${text.length.toLocaleString()} 字元）`, 'success');
    updateGenerateButton();
  } catch (err) {
    DOM.pdfTextPreview.textContent = '⚠️ 擷取失敗：' + err.message;
    showToast('PDF 擷取失敗：' + err.message, 'error');
    state.extractedPdfText = '';
    updateGenerateButton();
  }
}

function clearFile() {
  state.extractedPdfText = '';
  DOM.fileInput.value = '';
  DOM.fileInfo.hidden = true;
  DOM.pdfPreview.hidden = true;
  updateGenerateButton();
}

/* ====================================================
   生成按鈕狀態
   ==================================================== */
function updateGenerateButton() {
  const hasContent = state.activeTab === 'upload'
    ? state.extractedPdfText.length > 0
    : DOM.textInput.value.trim().length > 10;

  DOM.btnGenerate.disabled = !hasContent || state.isGenerating;
}

/* ====================================================
   主要生成流程
   ==================================================== */
async function handleGenerate() {
  if (state.isGenerating) return;

  if (!GeminiApi.hasApiKey()) {
    openApiModal();
    showToast('請先設定 Gemini API 金鑰', 'error');
    return;
  }

  const documentText = state.activeTab === 'upload'
    ? state.extractedPdfText
    : DOM.textInput.value;

  if (!documentText.trim()) {
    showToast('請先輸入或上傳公文內容', 'error');
    return;
  }

  state.isGenerating = true;
  setGeneratingUI(true);
  setOutputState('loading');

  try {
    const systemPrompt = DocumentFormatter.buildSystemPrompt();
    const userPrompt   = DocumentFormatter.buildUserPrompt({
      documentText,
      fromAgency: DOM.inputAgency.value.trim(),
      docType:    DOM.inputDocType.value,
      direction:  DOM.inputDirection.value,
      replyAgency: DOM.replyAgency.value.trim(),
    });

    const result = await GeminiApi.generateReply(systemPrompt, userPrompt);

    state.lastGeneratedText = result;
    DOM.outputText.textContent = result;
    setOutputState('result');
    showToast('回文生成完成', 'success');
  } catch (err) {
    DOM.errorMessage.textContent = err.message;
    setOutputState('error');
    showToast('生成失敗', 'error');
  } finally {
    state.isGenerating = false;
    setGeneratingUI(false);
    updateGenerateButton();
  }
}

function setGeneratingUI(generating) {
  DOM.btnLabel.textContent = generating ? '生成中⋯' : '生成回文';
  DOM.btnSpinner.hidden = !generating;
}

/* ====================================================
   輸出狀態切換
   ==================================================== */
function setOutputState(s) {
  DOM.outputEmpty.hidden   = s !== 'empty';
  DOM.outputLoading.hidden = s !== 'loading';
  DOM.outputError.hidden   = s !== 'error';
  DOM.outputResult.hidden  = s !== 'result';
  DOM.outputActions.hidden = s !== 'result';
}

/* ====================================================
   輸出操作
   ==================================================== */
async function copyOutput() {
  if (!state.lastGeneratedText) return;
  try {
    await navigator.clipboard.writeText(state.lastGeneratedText);
    showToast('已複製到剪貼簿', 'success');
  } catch {
    // Fallback for browsers without clipboard API
    const el = document.createElement('textarea');
    el.value = state.lastGeneratedText;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('已複製到剪貼簿', 'success');
  }
}

function downloadOutput() {
  if (!state.lastGeneratedText) return;
  const filename = DocumentFormatter.getRocFilename();
  const blob = new Blob([state.lastGeneratedText], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`已下載 ${filename}`, 'success');
}

/* ====================================================
   API Key Modal
   ==================================================== */
function openApiModal() {
  DOM.apiKeyInput.value = GeminiApi.getApiKey();
  DOM.modalApi.hidden = false;
  setTimeout(() => DOM.apiKeyInput.focus(), 50);
  refreshApiKeyStatus();
}

function closeApiModal() {
  DOM.modalApi.hidden = true;
}

function toggleKeyVisibility() {
  const isPassword = DOM.apiKeyInput.type === 'password';
  DOM.apiKeyInput.type = isPassword ? 'text' : 'password';
  DOM.btnToggleKey.textContent = isPassword ? '🙈' : '👁️';
  DOM.btnToggleKey.setAttribute('aria-label', isPassword ? '隱藏金鑰' : '顯示金鑰');
}

function saveApiKey() {
  const key = DOM.apiKeyInput.value.trim();
  try {
    GeminiApi.saveApiKey(key);
    refreshApiKeyStatus();
    showToast('API 金鑰已儲存', 'success');
    updateGenerateButton();
    closeApiModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function clearApiKey() {
  GeminiApi.clearApiKey();
  DOM.apiKeyInput.value = '';
  refreshApiKeyStatus();
  showToast('API 金鑰已清除', 'success');
}

function refreshApiKeyStatus() {
  const key = GeminiApi.getApiKey();
  if (key) {
    const masked = key.slice(0, 8) + '•'.repeat(Math.max(0, key.length - 12)) + key.slice(-4);
    DOM.apiKeyStatus.textContent = `✅ 金鑰已儲存：${masked}`;
    DOM.apiKeyStatus.className = 'api-key-status status-ok';
  } else {
    DOM.apiKeyStatus.textContent = '⚠️ 尚未設定 API 金鑰，請輸入後儲存';
    DOM.apiKeyStatus.className = 'api-key-status status-warn';
  }
}

/* ====================================================
   Toast 通知
   ==================================================== */
let toastTimer = null;

function showToast(message, type) {
  clearTimeout(toastTimer);
  DOM.toast.textContent = message;
  DOM.toast.className = 'toast' + (type ? ' ' + type : '');
  DOM.toast.hidden = false;
  toastTimer = setTimeout(() => { DOM.toast.hidden = true; }, 3500);
}

/* ====================================================
   啟動
   ==================================================== */
document.addEventListener('DOMContentLoaded', init);
