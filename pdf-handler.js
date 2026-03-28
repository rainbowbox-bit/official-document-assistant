/* ===================================================
   pdf-handler.js
   PDF.js 文字擷取與驗證
   =================================================== */
'use strict';

const PdfHandler = (() => {

  /* ── 從 File 物件擷取所有文字 ── */
  async function extractTextFromFile(file) {
    if (!file || file.type !== 'application/pdf') {
      throw new Error('請選擇有效的 PDF 檔案（.pdf）');
    }

    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF 函式庫載入失敗，請確認網路連線後重新整理頁面');
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pageTexts = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // 利用 Y 座標差值重建換行
      let pageText = '';
      let lastY = null;

      for (const item of textContent.items) {
        if ('str' in item) {
          const y = item.transform[5];
          if (lastY !== null && Math.abs(y - lastY) > 3) {
            pageText += '\n';
          }
          pageText += item.str;
          lastY = y;
        }
      }

      const trimmed = pageText.trim();
      if (trimmed) {
        pageTexts.push(pdf.numPages > 1 ? `【第 ${i} 頁】\n${trimmed}` : trimmed);
      }
    }

    if (pageTexts.length === 0) {
      throw new Error('此 PDF 不含可擷取的文字（可能為掃描圖片），請改用「貼上文字」方式輸入');
    }

    return pageTexts.join('\n\n');
  }

  /* ── 基本內容驗證 ── */
  function validateDocumentText(text) {
    if (!text || text.trim().length < 20) {
      return {
        valid: false,
        reason: '擷取的文字內容過短，此 PDF 可能為掃描圖片而無文字層，請改用「貼上文字」輸入'
      };
    }
    if (text.trim().length > 60000) {
      return {
        valid: false,
        reason: '文件內容過長（超過 60,000 字元），請確認上傳的是正確的公文 PDF'
      };
    }
    return { valid: true };
  }

  return { extractTextFromFile, validateDocumentText };
})();
