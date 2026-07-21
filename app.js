// ============================================================
// PDF 盖章工具 - 纯前端实现
// 依赖: pdf-lib (PDFDocument), pdfjs-dist (pdfjsLib)
// ============================================================

(function () {
  'use strict';

  // ---- 状态 ----
  const state = {
    pdfBytes: null,          // PDF 原始 ArrayBuffer
    pdfDoc: null,            // pdf-lib PDFDocument 实例
    stampBytes: null,        // 印章图片 ArrayBuffer
    stampImageType: null,    // 'png' | 'jpg'
    totalPages: 0,
    previewPage: 1,          // 当前预览页码 (1-based)
    previewScale: 1.5,
    customStampPos: null,    // { x, y } 自定义拖拽位置（百分比，0~100，Y从底部算）
    processedBlob: null,
  };

  // ---- 工具函数 ----
  const $ = (sel) => document.querySelector(sel);

  // ---- DOM 引用 ----
  const pdfUploadZone = $('#pdf-upload-zone');
  const pdfInput = $('#pdf-input');
  const pdfHint = $('#pdf-upload-hint');
  const pdfLoaded = $('#pdf-loaded-info');
  const pdfName = $('#pdf-name');
  const pdfPages = $('#pdf-pages');

  const stampUploadZone = $('#stamp-upload-zone');
  const stampInput = $('#stamp-input');
  const stampHint = $('#stamp-upload-hint');
  const stampLoaded = $('#stamp-loaded-info');
  const stampThumb = $('#stamp-thumb');
  const stampNameEl = $('#stamp-name');

  const controlsPanel = $('#controls-panel');
  const scaleSlider = $('#scale-slider');
  const scaleValue = $('#scale-value');
  const opacitySlider = $('#opacity-slider');
  const opacityValue = $('#opacity-value');
  const rotationSlider = $('#rotation-slider');
  const rotationValue = $('#rotation-value');
  const pageRange = $('#page-range');
  const customPagesRow = $('#custom-pages-row');
  const customPagesInput = $('#custom-pages-input');

  const previewSection = $('#preview-section');
  const previewContainer = $('#preview-container');
  const previewPageNum = $('#preview-page-num');
  const previewTotalPages = $('#preview-total-pages');
  const prevPageBtn = $('#prev-page-btn');
  const nextPageBtn = $('#next-page-btn');

  const actionSection = $('#action-section');
  const processBtn = $('#process-btn');
  const progressBar = $('#progress-bar');
  const progressFill = $('#progress-fill');
  const progressText = $('#progress-text');
  const downloadSection = $('#download-section');
  const downloadBtn = $('#download-btn');
  const resetBtn = $('#reset-btn');

  // ============================================================
  // 初始化
  // ============================================================
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  // ============================================================
  // 事件绑定
  // ============================================================

  // PDF 上传
  pdfUploadZone.addEventListener('click', () => pdfInput.click());
  pdfUploadZone.addEventListener('dragover', (e) => { e.preventDefault(); pdfUploadZone.classList.add('border-red-400', 'bg-red-50/50'); });
  pdfUploadZone.addEventListener('dragleave', () => { pdfUploadZone.classList.remove('border-red-400', 'bg-red-50/50'); });
  pdfUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfUploadZone.classList.remove('border-red-400', 'bg-red-50/50');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') loadPdf(file);
  });
  pdfInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadPdf(file);
  });

  // 印章上传
  stampUploadZone.addEventListener('click', () => stampInput.click());
  stampUploadZone.addEventListener('dragover', (e) => { e.preventDefault(); stampUploadZone.classList.add('border-red-400', 'bg-red-50/50'); });
  stampUploadZone.addEventListener('dragleave', () => { stampUploadZone.classList.remove('border-red-400', 'bg-red-50/50'); });
  stampUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    stampUploadZone.classList.remove('border-red-400', 'bg-red-50/50');
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) loadStamp(file);
  });
  stampInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadStamp(file);
  });

  // 控制面板事件
  scaleSlider.addEventListener('input', () => { scaleValue.textContent = scaleSlider.value + '%'; debounceRenderPreview(); });
  opacitySlider.addEventListener('input', () => { opacityValue.textContent = opacitySlider.value + '%'; debounceRenderPreview(); });
  rotationSlider.addEventListener('input', () => { rotationValue.textContent = rotationSlider.value + '°'; debounceRenderPreview(); });
  pageRange.addEventListener('change', () => {
    customPagesRow.classList.toggle('hidden', pageRange.value !== 'custom');
    renderPreview();
  });
  customPagesInput.addEventListener('input', () => { renderPreview(); });

  // 预览翻页
  prevPageBtn.addEventListener('click', () => { if (state.previewPage > 1) { state.previewPage--; renderPreview(); } });
  nextPageBtn.addEventListener('click', () => { if (state.previewPage < state.totalPages) { state.previewPage++; renderPreview(); } });

  // 处理按钮
  processBtn.addEventListener('click', processPdf);

  // 下载 & 重置
  downloadBtn.addEventListener('click', () => {
    if (!state.processedBlob) return;
    const url = URL.createObjectURL(state.processedBlob);
    const a = document.createElement('a');
    const origName = pdfName.textContent.replace('.pdf', '') || 'document';
    a.href = url;
    a.download = origName + '_stamped.pdf';
    a.click();
    URL.revokeObjectURL(url);
  });
  resetBtn.addEventListener('click', resetAll);

  // ============================================================
  // 核心函数
  // ============================================================

  async function loadPdf(file) {
    if (file.size > 30 * 1024 * 1024) {
      alert('PDF 文件不能超过 30MB');
      return;
    }
    const buffer = await file.arrayBuffer();
    state.pdfBytes = buffer;
    state.pdfDoc = await PDFLib.PDFDocument.load(buffer);
    state.totalPages = state.pdfDoc.getPageCount();
    state.previewPage = 1;
    state.customStampPos = null;

    pdfName.textContent = file.name;
    pdfPages.textContent = state.totalPages + ' 页 · ' + (file.size / 1024 / 1024).toFixed(1) + ' MB';
    pdfHint.classList.add('hidden');
    pdfLoaded.classList.remove('hidden');

    checkReady();
  }

  function loadStamp(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      state.stampBytes = e.target.result;
      state.stampImageType = file.type === 'image/png' ? 'png' : 'jpg';

      stampThumb.src = URL.createObjectURL(file);
      stampNameEl.textContent = file.name;
      stampHint.classList.add('hidden');
      stampLoaded.classList.remove('hidden');

      checkReady();
    };
    reader.readAsArrayBuffer(file);
  }

  function checkReady() {
    if (state.pdfBytes && state.stampBytes) {
      controlsPanel.classList.remove('hidden');
      previewSection.classList.remove('hidden');
      actionSection.classList.remove('hidden');
      downloadSection.classList.add('hidden');
      state.processedBlob = null;
      renderPreview();
    }
  }

  // ============================================================
  // 预览渲染
  // ============================================================

  let renderTimer = null;
  function debounceRenderPreview() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 100);
  }

  async function renderPreview() {
    if (!state.pdfBytes) return;

    previewPageNum.textContent = state.previewPage;
    previewTotalPages.textContent = state.totalPages;

    prevPageBtn.disabled = state.previewPage <= 1;
    nextPageBtn.disabled = state.previewPage >= state.totalPages;

    try {
      const pdf = await pdfjsLib.getDocument({ data: state.pdfBytes.slice(0) }).promise;
      const page = await pdf.getPage(state.previewPage);
      const viewport = page.getViewport({ scale: state.previewScale });

      // 清理旧内容
      previewContainer.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      previewContainer.appendChild(wrapper);

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      wrapper.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // 先保存底座
      const baseImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (!state.stampBytes) {
        pdf.destroy();
        return;
      }

      const pw = viewport.width;
      const ph = viewport.height;

      const blob = new Blob([state.stampBytes], { type: state.stampImageType === 'png' ? 'image/png' : 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        // 渲染印章（若已设置 customStampPos 则使用，否则默认右下角）
        if (state.customStampPos) {
          drawStampAtPos(ctx, img, baseImgData, pw, ph, state.customStampPos.x, state.customStampPos.y, false);
        } else {
          // 默认放在右下角，提示用户拖动
          drawStampAtPos(ctx, img, baseImgData, pw, ph, 85, 10, true);
        }

        // 自定义拖拽事件
        setupDrag(ctx, canvas, img, baseImgData, pw, ph);

        URL.revokeObjectURL(url);
      };

      img.src = url;

      pdf.destroy();
    } catch (err) {
      console.error('Preview render error:', err);
      previewContainer.innerHTML = '<p class="text-gray-400 text-sm py-8">预览渲染失败，不影响盖章功能</p>';
    }
  }

  // 在指定位置（百分比）绘制印章到 canvas
  function drawStampAtPos(ctx, img, baseImgData, pw, ph, pctX, pctY, isDefault) {
    const scaleVal = parseInt(scaleSlider.value) / 100;
    const aspect = img.naturalWidth / img.naturalHeight;
    const sw = pw * 0.2 * scaleVal;
    const sh = sw / aspect;
    const cx = pctX / 100 * pw;
    const cy = (1 - pctY / 100) * ph; // Y 从底部算
    const opacity = parseInt(opacitySlider.value) / 100;
    const angle = parseInt(rotationSlider.value);

    if (baseImgData) ctx.putImageData(baseImgData, 0, 0);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();

    // 虚线边界框
    ctx.save();
    ctx.strokeStyle = isDefault ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.translate(cx, cy);
    ctx.rotate(angle * Math.PI / 180);
    ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }

  // 拖拽交互
  function setupDrag(ctx, canvas, img, baseImgData, pw, ph) {
    let dragging = false;
    canvas.style.cursor = 'crosshair';

    const drawAtCursor = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      // 转为百分比（Y 从底部算）
      const pctX = Math.max(0, Math.min(100, cx / canvas.width * 100));
      const pctY = Math.max(0, Math.min(100, (1 - cy / canvas.height) * 100));
      drawStampAtPos(ctx, img, baseImgData, pw, ph, pctX, pctY, false);
      return { pctX, pctY };
    };

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      e.preventDefault();
      drawAtCursor(e);
    });

    canvas.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      const { pctX, pctY } = drawAtCursor(e);
      state.customStampPos = {
        x: parseFloat(pctX.toFixed(1)),
        y: parseFloat(pctY.toFixed(1))
      };
    });

    canvas.addEventListener('mouseleave', () => { dragging = false; });
  }

  // ============================================================
  // 解析页码范围
  // ============================================================

  function getTargetPages() {
    const mode = pageRange.value;
    if (mode === 'all') {
      return Array.from({ length: state.totalPages }, (_, i) => i);
    }
    if (mode === 'first') return [0];
    if (mode === 'last') return [state.totalPages - 1];
    if (mode === 'custom') {
      const raw = customPagesInput.value.trim();
      if (!raw) return [];
      const pages = [];
      raw.split(',').forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
          const [s, e] = part.split('-').map(Number);
          for (let i = s; i <= e && i <= state.totalPages; i++) {
            if (i >= 1 && !pages.includes(i - 1)) pages.push(i - 1);
          }
        } else {
          const n = parseInt(part);
          if (n >= 1 && n <= state.totalPages && !pages.includes(n - 1)) pages.push(n - 1);
        }
      });
      return pages.sort((a, b) => a - b);
    }
    return [];
  }

  // ============================================================
  // 处理 PDF
  // ============================================================

  async function processPdf() {
    if (!state.pdfDoc || !state.stampBytes) return;

    if (!state.customStampPos) {
      alert('请先在预览区拖动印章到目标位置');
      return;
    }

    const targetPages = getTargetPages();
    if (targetPages.length === 0) {
      alert('请指定有效的页码范围');
      return;
    }

    processBtn.classList.add('hidden');
    progressBar.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = '正在处理...';

    try {
      const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes);

      let stampImage;
      if (state.stampImageType === 'png') {
        stampImage = await pdfDoc.embedPng(state.stampBytes);
      } else {
        stampImage = await pdfDoc.embedJpg(state.stampBytes);
      }

      const pages = pdfDoc.getPages();
      const total = targetPages.length;

      for (let i = 0; i < total; i++) {
        const pageIndex = targetPages[i];
        const page = pages[pageIndex];
        const { width, height } = page.getSize();

        // 缩放：基于页面宽度的 20% * 用户缩放比例
        const scale = parseInt(scaleSlider.value) / 100;
        const desiredW = width * 0.2 * scale;
        const imgScale = desiredW / stampImage.width;
        const stampDims = stampImage.scale(imgScale);

        // 位置：基于自定义拖拽百分比（Y 从底部算）
        const cx = state.customStampPos.x / 100 * width;
        const cy = state.customStampPos.y / 100 * height;
        const x = cx - stampDims.width / 2;
        const y = cy - stampDims.height / 2;

        const opacity = parseInt(opacitySlider.value) / 100;
        const rotation = PDFLib.degrees(parseInt(rotationSlider.value));

        page.drawImage(stampImage, {
          x: x,
          y: y,
          width: stampDims.width,
          height: stampDims.height,
          opacity: opacity,
          rotate: rotation,
        });

        const pct = Math.round(((i + 1) / total) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `已处理 ${i + 1}/${total} 页`;
      }

      const pdfBytesOut = await pdfDoc.save();
      const origName = pdfName.textContent.replace('.pdf', '') || 'document';
      state.processedBlob = new Blob([pdfBytesOut], { type: 'application/pdf' });

      progressBar.classList.add('hidden');
      downloadSection.classList.remove('hidden');
      actionSection.classList.add('hidden');
    } catch (err) {
      console.error('Process error:', err);
      progressBar.classList.add('hidden');
      processBtn.classList.remove('hidden');
      alert('Processing failed: ' + err.message);
    }
  }

  // ============================================================
  // 重置
  // ============================================================

  function resetAll() {
    state.pdfBytes = null;
    state.pdfDoc = null;
    state.stampBytes = null;
    state.stampImageType = null;
    state.totalPages = 0;
    state.previewPage = 1;
    state.customStampPos = null;
    state.processedBlob = null;

    pdfHint.classList.remove('hidden');
    pdfLoaded.classList.add('hidden');
    stampHint.classList.remove('hidden');
    stampLoaded.classList.add('hidden');
    controlsPanel.classList.add('hidden');
    previewSection.classList.add('hidden');
    actionSection.classList.add('hidden');
    downloadSection.classList.add('hidden');
    progressBar.classList.add('hidden');
    processBtn.classList.remove('hidden');
    previewContainer.innerHTML = '';
    pdfInput.value = '';
    stampInput.value = '';

    scaleSlider.value = 100;
    scaleValue.textContent = '100%';
    opacitySlider.value = 85;
    opacityValue.textContent = '85%';
    rotationSlider.value = 0;
    rotationValue.textContent = '0°';
    pageRange.value = 'all';
    customPagesRow.classList.add('hidden');
    customPagesInput.value = '';
  }

})();
