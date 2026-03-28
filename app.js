/* ===================================================
   app.js — 主應用程式控制器
   =================================================== */
'use strict';

/* ── DOM 參照 ── */
const $ = id => document.getElementById(id);

/* ── 安全清空元素內容 ── */
function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const DOM = {
  // Mode Tabs
  modeTabs:        document.querySelectorAll('.mode-tab'),
  modeReply:       $('mode-reply'),
  modeInitiative:  $('mode-initiative'),

  // Input Tabs
  tabBtns:         document.querySelectorAll('.tab-btn'),

  // PDF Upload
  dropZone:        $('drop-zone'),
  fileInput:       $('file-input'),
  fileInfo:        $('file-info'),
  fileName:        $('file-name'),
  fileSize:        $('file-size'),
  fileWarning:     $('file-warning'),
  fileWarningText: $('file-warning-text'),
  btnClearFile:    $('btn-clear-file'),
  pdfPreview:      $('pdf-preview'),
  pdfTextPreview:  $('pdf-text-preview'),
  pdfCharCount:    $('pdf-char-count'),

  // Text Paste
  textInput:       $('text-input'),
  charCount:       $('char-count'),
  autosaveStatus:  $('autosave-status'),

  // Reply Metadata
  inputAgency:     $('input-agency'),
  inputDocType:    $('input-doc-type'),
  inputDirection:  $('input-direction'),
  replyAgency:     $('reply-agency'),

  // Initiative Fields
  initPurpose:     $('initiative-purpose'),
  initCharCount:   $('init-char-count'),
  initAutosave:    $('init-autosave-status'),
  initFromAgency:  $('init-from-agency'),
  initToAgency:    $('init-to-agency'),
  initDocType:     $('init-doc-type'),
  initDirection:   $('init-direction'),
  initBasis:       $('init-basis'),
  initAttachment:  $('init-attachment'),

  // Panel Titles
  panelOutputTitle: $('panel-output-title'),

  // Generate
  btnGenerate:     $('btn-generate'),
  btnLabel:        $('btn-label'),
  btnSpinner:      $('btn-spinner'),
  cooldownHint:    $('cooldown-hint'),

  // Output
  outputEmpty:     $('output-empty'),
  outputLoading:   $('output-loading'),
  outputError:     $('output-error'),
  outputResult:    $('output-result'),
  outputText:      $('output-text'),
  outputActions:   $('output-actions'),
  errorMessage:    $('error-message'),
  errorHint:       $('error-hint'),
  btnRetry:        $('btn-retry'),
  btnCopy:         $('btn-copy'),
  btnDownload:     $('btn-download'),
  btnPrint:        $('btn-print'),
  btnRegenerate:   $('btn-regenerate'),

  // Compliance Checklist
  complianceChecklist: $('compliance-checklist'),
  checklistItems:      $('checklist-items'),

  // Dark Mode
  btnDarkMode:     $('btn-dark-mode'),
  darkModeIcon:    $('dark-mode-icon'),

  // History
  btnHistory:      $('btn-history'),
  modalHistory:    $('modal-history'),
  historyClose:    $('history-close'),
  historyEmpty:    $('history-empty'),
  historyList:     $('history-list'),
  historyActions:  $('history-actions'),
  btnClearHistory: $('btn-clear-history'),

  // Templates
  btnTemplates:    $('btn-templates'),
  modalTemplates:  $('modal-templates'),
  templatesClose:  $('templates-close'),
  templateList:    $('template-list'),

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
  mode:               'reply',    // 'reply' | 'initiative'
  activeTab:          'upload',
  extractedPdfText:   '',
  isGenerating:       false,
  lastGeneratedText:  '',
  lastGenerateTime:   0,
  cooldownTimer:      null,
};

/* ── 常數 ── */
const COOLDOWN_MS       = 5000;
const AUTOSAVE_DELAY_MS = 3000;
const LS_DRAFT_KEY      = 'gongwen_draft';
const LS_HISTORY_KEY    = 'gongwen_history';
const LS_DARK_MODE_KEY  = 'gongwen_dark_mode';
const MAX_HISTORY       = 30;

/* ====================================================
   初始化
   ==================================================== */
function init() {
  bindEvents();
  refreshApiKeyStatus();
  updateGenerateButton();
  restoreDraft();
  initDarkMode();
  renderTemplateList();

  if (!GeminiApi.hasApiKey()) {
    openApiModal();
  }
}

/* ====================================================
   事件綁定
   ==================================================== */
function bindEvents() {
  // 模式切換
  DOM.modeTabs.forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

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

  // 文字輸入 + 自動儲存
  let autosaveTimer = null;
  DOM.textInput.addEventListener('input', () => {
    DOM.charCount.textContent = DOM.textInput.value.length.toLocaleString();
    updateGenerateButton();
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveDraft, AUTOSAVE_DELAY_MS);
  });

  // 主動函文輸入
  let initAutosaveTimer = null;
  DOM.initPurpose.addEventListener('input', () => {
    DOM.initCharCount.textContent = DOM.initPurpose.value.length.toLocaleString();
    updateGenerateButton();
    clearTimeout(initAutosaveTimer);
    initAutosaveTimer = setTimeout(saveDraft, AUTOSAVE_DELAY_MS);
  });

  // 生成 / 重試 / 重新生成
  DOM.btnGenerate.addEventListener('click', handleGenerate);
  DOM.btnRetry.addEventListener('click', handleGenerate);
  DOM.btnRegenerate.addEventListener('click', handleGenerate);

  // 輸出操作
  DOM.btnCopy.addEventListener('click', copyOutput);
  DOM.btnDownload.addEventListener('click', downloadOutput);
  DOM.btnPrint.addEventListener('click', () => window.print());

  // Dark Mode
  DOM.btnDarkMode.addEventListener('click', toggleDarkMode);

  // History Modal
  DOM.btnHistory.addEventListener('click', openHistoryModal);
  DOM.historyClose.addEventListener('click', closeHistoryModal);
  DOM.modalHistory.addEventListener('click', e => { if (e.target === DOM.modalHistory) closeHistoryModal(); });
  DOM.btnClearHistory.addEventListener('click', clearHistory);

  // Templates Modal
  DOM.btnTemplates.addEventListener('click', openTemplatesModal);
  DOM.templatesClose.addEventListener('click', closeTemplatesModal);
  DOM.modalTemplates.addEventListener('click', e => { if (e.target === DOM.modalTemplates) closeTemplatesModal(); });

  // API Modal
  DOM.btnApiSettings.addEventListener('click', openApiModal);
  DOM.modalClose.addEventListener('click', closeApiModal);
  DOM.modalApi.addEventListener('click', e => {
    if (e.target === DOM.modalApi) closeApiModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!DOM.modalApi.hidden) closeApiModal();
      else if (!DOM.modalHistory.hidden) closeHistoryModal();
      else if (!DOM.modalTemplates.hidden) closeTemplatesModal();
    }
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
   模式切換
   ==================================================== */
function switchMode(mode) {
  state.mode = mode;

  DOM.modeTabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  DOM.modeReply.hidden = mode !== 'reply';
  DOM.modeInitiative.hidden = mode !== 'initiative';

  // 更新面板標題
  DOM.panelOutputTitle.textContent = mode === 'reply' ? '生成回文' : '生成公文';

  // 更新按鈕文字
  if (!state.isGenerating) {
    DOM.btnLabel.textContent = mode === 'reply' ? '生成回文' : '生成公文';
  }

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

  // 檔案大小檢查
  const sizeCheck = PdfHandler.checkFileSize(file);
  DOM.fileName.textContent = file.name;
  DOM.fileSize.textContent = sizeCheck.sizeText;
  DOM.fileInfo.hidden = false;

  if (!sizeCheck.ok) {
    DOM.fileWarningText.textContent = sizeCheck.error;
    DOM.fileWarning.hidden = false;
    showToast(sizeCheck.error, 'error');
    return;
  }

  if (sizeCheck.warning) {
    DOM.fileWarningText.textContent = sizeCheck.warning;
    DOM.fileWarning.hidden = false;
  } else {
    DOM.fileWarning.hidden = true;
  }

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
      DOM.pdfTextPreview.textContent = '\u26a0\ufe0f ' + check.reason;
      showToast(check.reason, 'error');
      return;
    }

    state.extractedPdfText = text;
    DOM.pdfCharCount.textContent = `${text.length.toLocaleString()} 字元`;
    DOM.pdfTextPreview.textContent =
      text.slice(0, 500) + (text.length > 500 ? '\n\u22ef\uff08\u5171 ' + text.length.toLocaleString() + ' \u5b57\u5143\u5df2\u64f7\u53d6\uff09' : '');

    showToast(`PDF 擷取成功（${text.length.toLocaleString()} 字元）`, 'success');
    updateGenerateButton();
  } catch (err) {
    DOM.pdfTextPreview.textContent = '\u26a0\ufe0f 擷取失敗：' + err.message;
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
  DOM.fileWarning.hidden = true;
  updateGenerateButton();
}

/* ====================================================
   生成按鈕狀態
   ==================================================== */
function updateGenerateButton() {
  let hasContent;
  if (state.mode === 'initiative') {
    hasContent = DOM.initPurpose.value.trim().length > 10;
  } else {
    hasContent = state.activeTab === 'upload'
      ? state.extractedPdfText.length > 0
      : DOM.textInput.value.trim().length > 10;
  }

  DOM.btnGenerate.disabled = !hasContent || state.isGenerating;
}

/* ====================================================
   速率限制
   ==================================================== */
function checkCooldown() {
  const elapsed = Date.now() - state.lastGenerateTime;
  if (elapsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    DOM.cooldownHint.textContent = `請等待 ${remaining} 秒後再次生成`;
    DOM.cooldownHint.hidden = false;
    return false;
  }
  DOM.cooldownHint.hidden = true;
  return true;
}

function startCooldown() {
  state.lastGenerateTime = Date.now();
  DOM.cooldownHint.hidden = false;
  let remaining = Math.ceil(COOLDOWN_MS / 1000);
  DOM.cooldownHint.textContent = `請等待 ${remaining} 秒後可再次生成`;

  clearInterval(state.cooldownTimer);
  state.cooldownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(state.cooldownTimer);
      DOM.cooldownHint.hidden = true;
    } else {
      DOM.cooldownHint.textContent = `請等待 ${remaining} 秒後可再次生成`;
    }
  }, 1000);
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

  if (!checkCooldown()) {
    showToast('請稍候再試', 'error');
    return;
  }

  let systemPrompt, userPrompt, inputText;

  if (state.mode === 'initiative') {
    const purpose = DOM.initPurpose.value.trim();
    if (!purpose) {
      showToast('請先輸入發文目的', 'error');
      return;
    }
    inputText = purpose;
    systemPrompt = DocumentFormatter.buildInitiativeSystemPrompt();
    userPrompt = DocumentFormatter.buildInitiativeUserPrompt({
      purpose,
      fromAgency: DOM.initFromAgency.value.trim(),
      toAgency:   DOM.initToAgency.value.trim(),
      docType:    DOM.initDocType.value,
      direction:  DOM.initDirection.value,
      basis:      DOM.initBasis.value.trim(),
      attachment: DOM.initAttachment.value.trim(),
    });
  } else {
    const documentText = state.activeTab === 'upload'
      ? state.extractedPdfText
      : DOM.textInput.value;

    if (!documentText.trim()) {
      showToast('請先輸入或上傳公文內容', 'error');
      return;
    }
    inputText = documentText;
    systemPrompt = DocumentFormatter.buildSystemPrompt();
    userPrompt = DocumentFormatter.buildUserPrompt({
      documentText,
      fromAgency: DOM.inputAgency.value.trim(),
      docType:    DOM.inputDocType.value,
      direction:  DOM.inputDirection.value,
      replyAgency: DOM.replyAgency.value.trim(),
    });
  }

  state.isGenerating = true;
  setGeneratingUI(true);
  setOutputState('loading');

  try {
    const result = await GeminiApi.generateReply(systemPrompt, userPrompt);

    state.lastGeneratedText = result;
    DOM.outputText.textContent = result;
    setOutputState('result');
    showToast(state.mode === 'initiative' ? '公文生成完成' : '回文生成完成', 'success');

    // 合規檢查
    runComplianceCheck(result);

    // 儲存到歷史
    saveToHistory(inputText, result);

    // 啟動冷卻
    startCooldown();
  } catch (err) {
    DOM.errorMessage.textContent = err.message;
    DOM.errorHint.textContent = err.hint || '';
    setOutputState('error');
    showToast('生成失敗', 'error');
  } finally {
    state.isGenerating = false;
    setGeneratingUI(false);
    updateGenerateButton();
  }
}

function setGeneratingUI(generating) {
  const label = state.mode === 'initiative' ? '生成公文' : '生成回文';
  DOM.btnLabel.textContent = generating ? '生成中⋯' : label;
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
   合規檢查
   ==================================================== */
function runComplianceCheck(text) {
  const results = DocumentFormatter.checkCompliance(text);
  clearChildren(DOM.checklistItems);

  for (const item of results) {
    const li = document.createElement('li');
    const icon = item.status === 'pass' ? '\u2705' : item.status === 'warn' ? '\u26a0\ufe0f' : '\u274c';
    li.className = item.status === 'pass' ? 'check-pass' : item.status === 'warn' ? 'check-warn' : 'check-fail';
    li.textContent = `${icon} ${item.label}\uff1a${item.detail}`;
    DOM.checklistItems.appendChild(li);
  }

  DOM.complianceChecklist.hidden = false;
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
   自動儲存草稿
   ==================================================== */
function saveDraft() {
  const draft = {
    mode: state.mode,
    // Reply fields
    text: DOM.textInput.value,
    agency: DOM.inputAgency.value,
    docType: DOM.inputDocType.value,
    direction: DOM.inputDirection.value,
    replyAgency: DOM.replyAgency.value,
    // Initiative fields
    initPurpose: DOM.initPurpose.value,
    initFromAgency: DOM.initFromAgency.value,
    initToAgency: DOM.initToAgency.value,
    initDocType: DOM.initDocType.value,
    initDirection: DOM.initDirection.value,
    initBasis: DOM.initBasis.value,
    initAttachment: DOM.initAttachment.value,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(draft));
    const statusEl = state.mode === 'initiative' ? DOM.initAutosave : DOM.autosaveStatus;
    statusEl.textContent = '已自動儲存';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch { /* localStorage full — ignore */ }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(LS_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    // Reply fields
    if (draft.text) {
      DOM.textInput.value = draft.text;
      DOM.charCount.textContent = draft.text.length.toLocaleString();
    }
    if (draft.agency) DOM.inputAgency.value = draft.agency;
    if (draft.docType) DOM.inputDocType.value = draft.docType;
    if (draft.direction) DOM.inputDirection.value = draft.direction;
    if (draft.replyAgency) DOM.replyAgency.value = draft.replyAgency;
    // Initiative fields
    if (draft.initPurpose) {
      DOM.initPurpose.value = draft.initPurpose;
      DOM.initCharCount.textContent = draft.initPurpose.length.toLocaleString();
    }
    if (draft.initFromAgency) DOM.initFromAgency.value = draft.initFromAgency;
    if (draft.initToAgency) DOM.initToAgency.value = draft.initToAgency;
    if (draft.initDocType) DOM.initDocType.value = draft.initDocType;
    if (draft.initDirection) DOM.initDirection.value = draft.initDirection;
    if (draft.initBasis) DOM.initBasis.value = draft.initBasis;
    if (draft.initAttachment) DOM.initAttachment.value = draft.initAttachment;
    // Restore mode
    if (draft.mode && draft.mode !== 'reply') {
      switchMode(draft.mode);
    }
    updateGenerateButton();
  } catch { /* corrupted data — ignore */ }
}

/* ====================================================
   歷史紀錄管理
   ==================================================== */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveToHistory(inputText, outputText) {
  const history = getHistory();
  history.unshift({
    id: Date.now(),
    date: new Date().toLocaleString('zh-TW'),
    mode: state.mode,
    inputPreview: inputText.trim().slice(0, 80),
    outputPreview: outputText.trim().slice(0, 120),
    output: outputText,
  });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try {
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history));
  } catch { /* localStorage full — ignore */ }
}

function openHistoryModal() {
  const history = getHistory();
  clearChildren(DOM.historyList);

  if (history.length === 0) {
    DOM.historyEmpty.hidden = false;
    DOM.historyActions.hidden = true;
  } else {
    DOM.historyEmpty.hidden = true;
    DOM.historyActions.hidden = false;

    for (const item of history) {
      const div = document.createElement('div');
      div.className = 'history-item';

      const header = document.createElement('div');
      header.className = 'history-item-header';

      const date = document.createElement('span');
      date.className = 'history-item-date';
      date.textContent = item.date;

      if (item.mode) {
        const badge = document.createElement('span');
        badge.className = 'history-mode-badge ' + (item.mode === 'initiative' ? 'badge-initiative' : 'badge-reply');
        badge.textContent = item.mode === 'initiative' ? '主動' : '回文';
        date.appendChild(document.createTextNode(' '));
        date.appendChild(badge);
      }

      const del = document.createElement('button');
      del.className = 'history-item-delete';
      del.textContent = '刪除';
      del.addEventListener('click', e => {
        e.stopPropagation();
        deleteHistoryItem(item.id);
        openHistoryModal();
      });

      header.appendChild(date);
      header.appendChild(del);

      const preview = document.createElement('div');
      preview.className = 'history-item-preview';
      preview.textContent = item.outputPreview;

      div.appendChild(header);
      div.appendChild(preview);

      div.addEventListener('click', () => {
        state.lastGeneratedText = item.output;
        DOM.outputText.textContent = item.output;
        setOutputState('result');
        runComplianceCheck(item.output);
        closeHistoryModal();
        showToast('已載入歷史紀錄', 'success');
      });

      DOM.historyList.appendChild(div);
    }
  }

  DOM.modalHistory.hidden = false;
}

function closeHistoryModal() {
  DOM.modalHistory.hidden = true;
}

function deleteHistoryItem(id) {
  const history = getHistory().filter(h => h.id !== id);
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history));
}

function clearHistory() {
  localStorage.removeItem(LS_HISTORY_KEY);
  openHistoryModal();
  showToast('歷史紀錄已清除', 'success');
}

/* ====================================================
   公文範本庫
   ==================================================== */
const TEMPLATES = [
  {
    title: '函覆查照（平行文）',
    desc: '回覆平行機關來函，告知已知悉或已辦理',
    text: '受文者：○○部○○司\n發文日期：中華民國○○年○月○日\n發文字號：○○字第○○○○號\n速別：普通件\n主旨：復貴部○○年○月○日○字第○○○號函，有關○○○○事宜，復請查照。\n說明：\n一、依據貴部○○年○月○日○字第○○○號函辦理。\n二、有關○○○○事項，本部已依規定辦理完竣。\n三、如有疑問，請洽本部○○科（聯絡電話：02-○○○○○○○○）。\n正本：○○部○○司\n副本：'
  },
  {
    title: '陳核請示（上行文）',
    desc: '向上級機關陳報並請求核示',
    text: '受文者：○○部\n發文日期：中華民國○○年○月○日\n發文字號：○○字第○○○○號\n速別：普通件\n主旨：為○○○○事宜，謹陳核示。\n說明：\n一、依據○○法第○條規定辦理。\n二、○○○○○○○○○○○○，爰擬○○○○。\n三、檢附○○○○乙份。\n四、如有疑問，請洽本處○○科（聯絡電話：02-○○○○○○○○）。\n正本：○○部\n副本：'
  },
  {
    title: '轉知辦理（下行文）',
    desc: '上級機關轉知下級機關辦理事項',
    text: '受文者：○○局\n發文日期：中華民國○○年○月○日\n發文字號：○○字第○○○○號\n速別：普通件\n主旨：轉知○○○○事宜，請查照辦理。\n說明：\n一、依據○○部○○年○月○日○字第○○○號函辦理。\n二、○○○○○○○○○○，請該局依規定辦理。\n三、請於○○年○月○日前辦理完竣，並函報辦理情形。\n四、如有疑問，請洽本部○○科（聯絡電話：02-○○○○○○○○）。\n正本：○○局\n副本：'
  },
  {
    title: '書函（內部協調）',
    desc: '機關內部或非正式聯繫用書函',
    text: '受文者：○○處\n發文日期：中華民國○○年○月○日\n發文字號：○○字第○○○○號\n主旨：有關○○○○事宜，請惠予協助辦理。\n說明：\n一、因本處辦理○○○○業務需要，擬請貴處協助提供○○○○資料。\n二、煩請於○○年○月○日前提供，以利後續作業。\n三、如有疑問，請洽本處○○（聯絡電話：○○○○）。\n正本：○○處\n副本：'
  },
  {
    title: '公告（對公眾發布）',
    desc: '機關對外公告周知事項',
    text: '發文日期：中華民國○○年○月○日\n發文字號：○○字第○○○○號\n主旨：公告○○○○事項。\n依據：○○法第○條規定。\n公告事項：\n一、○○○○○○○○○○○○。\n二、○○○○○○○○○○○○。\n三、本公告自即日起生效。'
  },
];

function renderTemplateList() {
  clearChildren(DOM.templateList);
  for (const tpl of TEMPLATES) {
    const card = document.createElement('div');
    card.className = 'template-card';

    const title = document.createElement('div');
    title.className = 'template-card-title';
    title.textContent = tpl.title;

    const desc = document.createElement('div');
    desc.className = 'template-card-desc';
    desc.textContent = tpl.desc;

    const preview = document.createElement('div');
    preview.className = 'template-card-preview';
    preview.textContent = tpl.text.slice(0, 150) + '\u22ef';

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(preview);

    card.addEventListener('click', () => {
      switchTab('paste');
      DOM.textInput.value = tpl.text;
      DOM.charCount.textContent = tpl.text.length.toLocaleString();
      updateGenerateButton();
      saveDraft();
      closeTemplatesModal();
      showToast(`已載入範本「${tpl.title}」`, 'success');
    });

    DOM.templateList.appendChild(card);
  }
}

function openTemplatesModal() {
  DOM.modalTemplates.hidden = false;
}

function closeTemplatesModal() {
  DOM.modalTemplates.hidden = true;
}

/* ====================================================
   深色模式
   ==================================================== */
function initDarkMode() {
  const saved = localStorage.getItem(LS_DARK_MODE_KEY);
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    DOM.darkModeIcon.textContent = '\u2600\ufe0f';
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    DOM.darkModeIcon.textContent = '\ud83c\udf19';
    localStorage.setItem(LS_DARK_MODE_KEY, 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    DOM.darkModeIcon.textContent = '\u2600\ufe0f';
    localStorage.setItem(LS_DARK_MODE_KEY, 'dark');
  }
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
  DOM.btnToggleKey.textContent = isPassword ? '\ud83d\ude48' : '\ud83d\udc41\ufe0f';
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
    const masked = key.slice(0, 8) + '\u2022'.repeat(Math.max(0, key.length - 12)) + key.slice(-4);
    DOM.apiKeyStatus.textContent = '\u2705 金鑰已儲存：' + masked;
    DOM.apiKeyStatus.className = 'api-key-status status-ok';
  } else {
    DOM.apiKeyStatus.textContent = '\u26a0\ufe0f 尚未設定 API 金鑰，請輸入後儲存';
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
