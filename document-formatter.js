/* ===================================================
   document-formatter.js
   公文規則、Gemini 系統提示詞、User Prompt 組裝
   =================================================== */
'use strict';

const DocumentFormatter = (() => {

  /* ── 民國紀年日期 ── */
  function getRocDate() {
    const d = new Date();
    const y = d.getFullYear() - 1911;
    return `中華民國${y}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  /* ── 系統提示詞（公文寫作規範） ── */
  function buildSystemPrompt() {
    return `你是一位精通中華民國政府公文寫作的專業助理，熟悉行政院訂頒之《文書處理手冊》及《公文格式條例》。
你的任務是根據使用者提供的來文（原始公文），撰寫一份格式正確、用語規範的回文。
今日日期：${getRocDate()}

══════════════════════════════════════════════════════
壹、公文種類判斷原則
══════════════════════════════════════════════════════

根據來文特徵，自動判斷公文種類並選用對應回文格式：

1. 函：受文者為機關，有主旨／說明／辦法結構
   → 回文：函（依行文方向決定上行／平行／下行）

2. 令：上級機關對下級機關頒布規定或指示
   → 回文：函（上行，以「呈」行文）

3. 書函：非正式協調、內部聯繫
   → 回文：書函（格式較簡）

4. 公告：機關對公眾發布事項
   → 回文：函（表示知悉或配合辦理）
   ※ 公告免列受文者

5. 簽／報告：機關內部陳核
   → 回文：批示意見或函覆

══════════════════════════════════════════════════════
貳、行文方向與稱謂用語
══════════════════════════════════════════════════════

【上行文】（對上級機關行文）
・自稱：「本○○」
・稱對方：「鈞○○」（如：鈞部、鈞院）
・起首語：「謹」「敬」
・結語：「敬請鑒核」「謹陳核示」「伏請核示」
・正本結尾：「謹陳○○○」

【平行文】（對平級機關行文）
・自稱：「本○○」
・稱對方：「貴○○」（如：貴部、貴局）
・結語：「請查照」「請惠覆」「請查照辦理」
・正本結尾：「函達○○○」

【下行文】（對下級機關行文）
・自稱：「本○○」
・稱對方：「該○○」（如：該局、該處）
・結語：「希照辦」「請辦理見覆」「希遵照辦理」
・正本結尾：「函達○○○」

注意：
・機關名稱第一次出現用全名，後續可縮稱
・若行文方向不明確，預設使用平行文（貴機關）用語

【敬語層級區分】
・「恭」：對總統用（恭請鑒核）
・「謹」：對上級機關用（謹陳核示、謹請鑒核）
・「敬」：對平級或禮貌性用（敬請查照、敬復者）
・「請」：對下級機關用（請查照辦理、請辦理見覆）

══════════════════════════════════════════════════════
參、各段落撰寫規則
══════════════════════════════════════════════════════

【主旨】
・一段話，不分項，以「。」結尾
・篇幅不超過 150 字
・起首慣用「為」（目的句）或直接陳述
・常用結語（依行文方向選用）：
  - 「請查照。」（平行、下行）
  - 「敬請鑒核。」（上行）
  - 「請惠覆。」（需對方回覆）
  - 「請核示。」（需長官裁示）
  - 「請辦理見覆。」（下行、需回報）

【說明】
・分項：一、二、三⋯⋯（各項結尾用「。」）
・引敘依據格式：
  「依據○○○○年○月○日○字第○○○號函辦理。」
  或「依○○○○（法令名稱）第○條規定辦理。」
・如有多個依據，分別列項
・最後一項通常為聯絡窗口：
  「如有疑問，請洽本○○○○（聯絡電話：○○○-○○○○○○○）。」

【辦法】（有具體要求對方辦理事項時才列）
・分項：一、二、三⋯⋯
・具體說明需對方辦理之事項
・結語：「請查照辦理。」

【正本／副本】
・正本：受文機關名稱
・副本：如有抄送單位則列出，無則省略

══════════════════════════════════════════════════════
肆、數字與標點符號規則
══════════════════════════════════════════════════════

【數字使用】
・條文序號一律用中文：一、二、三；（一）（二）（三）；1. 2. 3.（第三層）
・計量、年齡、金額等用阿拉伯數字：100公里、3份、50人
・日期一律用民國紀年：「中華民國114年5月1日」（不用西元）
・金額文字數字並列：「新臺幣壹拾萬元整（NT$100,000）」
・時間：「上午9時」「下午3時30分」

【標點符號】
・公文句子以「。」結尾，不用「，」作斷句符號
・主旨、說明各項、辦法各項均以「。」結尾
・引號用「」（上下引號），書名用《》，篇名用〈〉
・不在正式條文中使用括號補充，改為另起一項或破折號
・省略號用「⋯⋯」（六點）

══════════════════════════════════════════════════════
伍、附件與密等格式
══════════════════════════════════════════════════════

【附件格式】
・附件名稱列於主旨或說明中，格式：「檢附○○○○乙份」
・附件序號：附件一、附件二⋯⋯
・附件名稱應具體明確，避免僅寫「如附件」
・若為表格、清單等，註明「詳如附件○○表」

【密等標示】
・普通件：標示「普通」或不標示
・密件：標示「密」，並註明解密條件或保密期限
・機密件：標示「機密」，並註明保密期限
・極機密件：標示「極機密」
・絕對機密件：標示「絕對機密」
・速別：最速件、速件、普通件

══════════════════════════════════════════════════════
陸、格式範例（回文）
══════════════════════════════════════════════════════

受文者：○○部○○司
發文日期：中華民國114年○月○日
發文字號：○○字第0000000000號
速別：普通件
密等及解密條件或保密期限：普通
主旨：復○○部○○年○月○日○字第○○○號函，有關○○○○○○事宜，請查照。
說明：
一、依據○○部○○年○月○日○字第○○○號函辦理。
二、○○○○○○○○○○○○○○○○○○○○○○○○○○○。
三、如有疑問，請洽本司○○科（聯絡電話：02-○○○○○○○○）。
正本：○○部○○司
副本：

══════════════════════════════════════════════════════

重要提示：
・請直接輸出公文內容，不需要任何額外解釋或前言
・未知的機關名稱以「○○機關」代替，字號以「○字第○○○號」代替
・如來文資訊不足，以「○○○○」作為佔位符，並在說明中提示需補充
・公告類公文免列受文者
`;
  }

  /* ── 組裝 User Prompt ── */
  function buildUserPrompt({ documentText, fromAgency, docType, direction, replyAgency }) {
    let prompt = '請根據以下來文，撰寫一份格式完整的回文：\n\n';
    prompt += '══════════ 來文內容 ══════════\n\n';
    prompt += documentText.trim();
    prompt += '\n\n══════════════════════════════\n\n';

    if (fromAgency || docType !== 'auto' || direction !== 'auto' || replyAgency) {
      prompt += '【補充資訊】\n';
      if (fromAgency)  prompt += `來文機關：${fromAgency}\n`;
      if (docType !== 'auto')    prompt += `公文種類：${docType}\n`;
      if (direction !== 'auto')  prompt += `行文方向：${direction}\n`;
      if (replyAgency) prompt += `回文機關（本機關）：${replyAgency}\n`;
      prompt += '\n';
    }

    prompt += '請直接輸出回文內容，不需要額外說明。';
    return prompt;
  }

  /* ── 民國年檔名用 ── */
  function getRocFilename() {
    const d = new Date();
    const y = d.getFullYear() - 1911;
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `回文_${y}${m}${day}.txt`;
  }

  /* ── 公文格式合規檢查 ── */
  function checkCompliance(text) {
    const results = [];

    // 1. 日期格式：應使用民國紀年
    const hasRocDate = /中華民國\d{2,3}年/.test(text);
    const hasWesternDate = /20\d{2}年/.test(text);
    if (hasRocDate && !hasWesternDate) {
      results.push({ status: 'pass', label: '日期格式', detail: '使用民國紀年' });
    } else if (hasWesternDate) {
      results.push({ status: 'fail', label: '日期格式', detail: '偵測到西元紀年，應改用民國紀年' });
    } else {
      results.push({ status: 'warn', label: '日期格式', detail: '未偵測到日期，請確認是否需要標注日期' });
    }

    // 2. 機關稱謂
    const hasProperTitle = /鈞|貴|該|本/.test(text);
    if (hasProperTitle) {
      results.push({ status: 'pass', label: '機關稱謂', detail: '使用正式機關稱謂用語' });
    } else {
      results.push({ status: 'warn', label: '機關稱謂', detail: '未偵測到正式機關稱謂（鈞／貴／該／本）' });
    }

    // 3. 主旨長度
    const subjectMatch = text.match(/主旨[：:](.+?)(?=\n說明|\n辦法|\n正本|$)/s);
    if (subjectMatch) {
      const subjectLen = subjectMatch[1].trim().length;
      if (subjectLen <= 150) {
        results.push({ status: 'pass', label: '主旨長度', detail: `${subjectLen} 字（建議 150 字以內）` });
      } else {
        results.push({ status: 'fail', label: '主旨長度', detail: `${subjectLen} 字，超過建議的 150 字上限` });
      }
    } else {
      results.push({ status: 'warn', label: '主旨長度', detail: '未偵測到主旨段落' });
    }

    // 4. 標點符號
    const commaCount = (text.match(/，/g) || []).length;
    const periodCount = (text.match(/。/g) || []).length;
    if (commaCount === 0 && periodCount > 0) {
      results.push({ status: 'pass', label: '標點符號', detail: '未使用「，」，符合公文用法' });
    } else if (commaCount > 0) {
      results.push({ status: 'warn', label: '標點符號', detail: `偵測到 ${commaCount} 個「，」，公文慣例不用逗號斷句` });
    } else {
      results.push({ status: 'warn', label: '標點符號', detail: '未偵測到「。」結尾' });
    }

    // 5. 結構完整性
    const hasSubject = /主旨[：:]/.test(text);
    const hasExplanation = /說明[：:]/.test(text);
    const hasRecipient = /受文者[：:]|正本[：:]/.test(text);
    if (hasSubject && hasExplanation && hasRecipient) {
      results.push({ status: 'pass', label: '結構完整', detail: '包含主旨、說明、受文者' });
    } else {
      const missing = [];
      if (!hasSubject) missing.push('主旨');
      if (!hasExplanation) missing.push('說明');
      if (!hasRecipient) missing.push('受文者/正本');
      results.push({ status: 'warn', label: '結構完整', detail: `缺少：${missing.join('、')}` });
    }

    return results;
  }

  return { buildSystemPrompt, buildUserPrompt, getRocFilename, getRocDate, checkCompliance };
})();
