(function () {
  "use strict";

  const MAX_PHOTO_EDGE = 1800;
  const DETECTION_EDGE = 520;
  const CARD_WIDTH = 1500;

  const elements = {
    input: document.querySelector("#label-photo-input"),
    button: document.querySelector("#scan-button"),
    buttonLabel: document.querySelector("#scan-button-label"),
    status: document.querySelector("#scan-status"),
    kcal: document.querySelector("#kcal-input"),
    name: document.querySelector("#name-input"),
    entryError: document.querySelector("#entry-error"),
  };

  const canvases = {
    photo: document.createElement("canvas"),
    card: document.createElement("canvas"),
    title: document.createElement("canvas"),
    calories: document.createElement("canvas"),
  };

  let worker = null;
  let busy = false;

  function sleep(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function setBusy(value, label) {
    busy = value;
    elements.input.disabled = value;
    elements.button.classList.toggle("is-busy", value);
    elements.button.setAttribute("aria-disabled", String(value));
    elements.buttonLabel.textContent = label || "Сфотографировать ценник";
  }

  function setStatus(message, type = "") {
    elements.status.textContent = message;
    elements.status.classList.toggle("is-success", type === "success");
    elements.status.classList.toggle("is-error", type === "error");
  }

  function showProgress(label, progress) {
    const percent = Math.max(0, Math.min(100, Math.round(progress || 0)));
    elements.buttonLabel.textContent = `${label} · ${percent}%`;
  }

  async function waitForTesseract(timeout = 15000) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      if (window.Tesseract && typeof window.Tesseract.createWorker === "function") return window.Tesseract;
      await sleep(50);
    }
    throw new Error("OCR-модуль не загрузился. Обновите страницу и попробуйте снова.");
  }

  async function ensureWorker() {
    if (worker) return worker;
    const Tesseract = await waitForTesseract();
    setStatus("Первый запуск: загружаю русскую OCR-модель…");
    worker = await Tesseract.createWorker("rus", 1, {
      workerPath: new URL("kkal2-assets/worker.min.js", window.location.href).href,
      corePath: new URL("kkal2-assets/core/", window.location.href).href,
      langPath: new URL("kkal2-assets/lang/", window.location.href).href,
      logger(message) {
        const labels = {
          "loading tesseract core": "OCR-движок",
          "initializing tesseract": "Запуск OCR",
          "loading language traineddata": "Русская модель",
          "initializing api": "Подготовка",
          "recognizing text": "Распознаю",
        };
        showProgress(labels[message.status] || "Подготовка", (message.progress || 0) * 100);
      },
      errorHandler(error) {
        console.error("Label OCR:", error);
      },
    });
    return worker;
  }

  async function decodeImage(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (_error) {
        // Older Safari versions use the image-element fallback below.
      }
    }

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function drawPhoto(image) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(sourceWidth, sourceHeight));
    canvases.photo.width = Math.round(sourceWidth * scale);
    canvases.photo.height = Math.round(sourceHeight * scale);
    canvases.photo.getContext("2d", { alpha: false }).drawImage(
      image,
      0,
      0,
      canvases.photo.width,
      canvases.photo.height,
    );
  }

  function luminance(red, green, blue) {
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  }

  function closeBinaryMask(mask, width, height) {
    const dilated = new Uint8Array(mask.length);
    const closed = new Uint8Array(mask.length);
    const radius = 2;

    for (let y = radius; y < height - radius; y += 1) {
      for (let x = radius; x < width - radius; x += 1) {
        let found = 0;
        for (let dy = -radius; dy <= radius && !found; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (mask[(y + dy) * width + x + dx]) {
              found = 1;
              break;
            }
          }
        }
        dilated[y * width + x] = found;
      }
    }

    for (let y = radius; y < height - radius; y += 1) {
      for (let x = radius; x < width - radius; x += 1) {
        let filled = 1;
        for (let dy = -radius; dy <= radius && filled; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (!dilated[(y + dy) * width + x + dx]) {
              filled = 0;
              break;
            }
          }
        }
        closed[y * width + x] = filled;
      }
    }
    return closed;
  }

  function findDenseRectangle(mask, width, height) {
    const stride = width + 1;
    const integral = new Uint32Array((width + 1) * (height + 1));
    for (let y = 1; y <= height; y += 1) {
      let rowSum = 0;
      for (let x = 1; x <= width; x += 1) {
        rowSum += mask[(y - 1) * width + x - 1];
        integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum;
      }
    }

    const sumRectangle = (x, y, boxWidth, boxHeight) => {
      const right = x + boxWidth;
      const bottom = y + boxHeight;
      return integral[bottom * stride + right]
        - integral[y * stride + right]
        - integral[bottom * stride + x]
        + integral[y * stride + x];
    };

    const heightFractions = [0.2, 0.24, 0.28, 0.32, 0.36, 0.4];
    const aspects = [1.35, 1.5, 1.65, 1.8];
    const step = Math.max(3, Math.round(Math.min(width, height) / 105));
    let best = null;

    for (const heightFraction of heightFractions) {
      const boxHeight = Math.round(height * heightFraction);
      for (const aspect of aspects) {
        const boxWidth = Math.round(boxHeight * aspect);
        if (boxWidth > width * 0.92) continue;
        for (let y = Math.round(height * 0.12); y + boxHeight < height * 0.83; y += step) {
          for (let x = 0; x + boxWidth < width; x += step) {
            const innerArea = boxWidth * boxHeight;
            const innerDensity = sumRectangle(x, y, boxWidth, boxHeight) / innerArea;
            if (innerDensity < 0.38) continue;

            const padX = Math.max(4, Math.round(boxWidth * 0.07));
            const padY = Math.max(4, Math.round(boxHeight * 0.1));
            const outerX = Math.max(0, x - padX);
            const outerY = Math.max(0, y - padY);
            const outerRight = Math.min(width, x + boxWidth + padX);
            const outerBottom = Math.min(height, y + boxHeight + padY);
            const outerWidth = outerRight - outerX;
            const outerHeight = outerBottom - outerY;
            const ringArea = outerWidth * outerHeight - innerArea;
            const ringDark = sumRectangle(outerX, outerY, outerWidth, outerHeight) - innerDensity * innerArea;
            const ringDensity = ringArea > 0 ? ringDark / ringArea : innerDensity;
            const contrast = innerDensity - ringDensity;
            const centerX = x + boxWidth / 2;
            const centerY = y + boxHeight / 2;
            const centerDistance = Math.hypot(
              (centerX - width * 0.52) / width,
              (centerY - height * 0.4) / height,
            );
            const centerScore = Math.max(0.1, 1 - centerDistance * 1.6);
            const areaRatio = innerArea / (width * height);
            const sizeScore = Math.max(0.1, 1 - Math.abs(areaRatio - 0.16) / 0.18);
            const score = innerDensity * 3 + contrast * 2.8 + centerScore * 1.2 + sizeScore * 0.7;
            if (!best || score > best.score) {
              best = { x, y, width: boxWidth, height: boxHeight, score };
            }
          }
        }
      }
    }

    if (!best) return null;
    const seedNearSide = best.x < width * 0.16 || best.x + best.width > width * 0.9;
    if (!seedNearSide) return best;

    const chunk = Math.max(3, step);
    const minimumStripDensity = 0.34;
    let expandedX = best.x;
    let expandedY = best.y;
    let expandedWidth = best.width;
    let expandedHeight = best.height;

    while (expandedX >= chunk) {
      const density = sumRectangle(expandedX - chunk, expandedY, chunk, expandedHeight) / (chunk * expandedHeight);
      if (density < minimumStripDensity) break;
      expandedX -= chunk;
      expandedWidth += chunk;
    }
    while (expandedX + expandedWidth + chunk <= width) {
      const density = sumRectangle(expandedX + expandedWidth, expandedY, chunk, expandedHeight) / (chunk * expandedHeight);
      if (density < minimumStripDensity) break;
      expandedWidth += chunk;
    }
    while (expandedY >= chunk && expandedY > height * 0.08) {
      const density = sumRectangle(expandedX, expandedY - chunk, expandedWidth, chunk) / (expandedWidth * chunk);
      if (density < minimumStripDensity) break;
      expandedY -= chunk;
      expandedHeight += chunk;
    }
    while (expandedY + expandedHeight + chunk <= height * 0.88) {
      const density = sumRectangle(expandedX, expandedY + expandedHeight, expandedWidth, chunk) / (expandedWidth * chunk);
      if (density < minimumStripDensity) break;
      expandedHeight += chunk;
    }

    return { ...best, x: expandedX, y: expandedY, width: expandedWidth, height: expandedHeight };
  }

  function defaultQuad() {
    const { width, height } = canvases.photo;
    return [
      { x: width * 0.14, y: height * 0.23 },
      { x: width * 0.86, y: height * 0.23 },
      { x: width * 0.86, y: height * 0.77 },
      { x: width * 0.14, y: height * 0.77 },
    ];
  }

  function detectPlacard() {
    const scale = Math.min(1, DETECTION_EDGE / Math.max(canvases.photo.width, canvases.photo.height));
    const width = Math.max(1, Math.round(canvases.photo.width * scale));
    const height = Math.max(1, Math.round(canvases.photo.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(canvases.photo, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);

    for (let index = 0; index < mask.length; index += 1) {
      const offset = index * 4;
      const light = luminance(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      const maxChannel = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      mask[index] = light < 105 && maxChannel < 145 ? 1 : 0;
    }

    const denseRectangle = findDenseRectangle(closeBinaryMask(mask, width, height), width, height);
    if (!denseRectangle || denseRectangle.score < 3.8) return defaultQuad();

    const rectangleNearSide = denseRectangle.x < width * 0.16
      || denseRectangle.x + denseRectangle.width > width * 0.9;
    const expectedHeight = denseRectangle.width / (rectangleNearSide ? 1.5 : 1.45);
    const extraHeight = expectedHeight - denseRectangle.height;
    const y = Math.max(
      0,
      denseRectangle.y + (rectangleNearSide ? extraHeight : Math.max(0, extraHeight)) * 0.1,
    );
    const normalizedHeight = Math.min(height - y, expectedHeight);
    const inverseScale = 1 / scale;
    return [
      { x: denseRectangle.x, y },
      { x: denseRectangle.x + denseRectangle.width, y },
      { x: denseRectangle.x + denseRectangle.width, y: y + normalizedHeight },
      { x: denseRectangle.x, y: y + normalizedHeight },
    ].map((point) => ({ x: point.x * inverseScale, y: point.y * inverseScale }));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function orderPoints(points) {
    const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
    const byDiff = [...points].sort((a, b) => a.x - a.y - (b.x - b.y));
    return [bySum[0], byDiff[byDiff.length - 1], bySum[bySum.length - 1], byDiff[0]];
  }

  function interpolateQuad(points, horizontal, vertical) {
    const topX = points[0].x + (points[1].x - points[0].x) * horizontal;
    const topY = points[0].y + (points[1].y - points[0].y) * horizontal;
    const bottomX = points[3].x + (points[2].x - points[3].x) * horizontal;
    const bottomY = points[3].y + (points[2].y - points[3].y) * horizontal;
    return {
      x: topX + (bottomX - topX) * vertical,
      y: topY + (bottomY - topY) * vertical,
    };
  }

  function drawMappedTriangle(context, sourceCanvas, source, destination) {
    const [source0, source1, source2] = source;
    const [destination0, destination1, destination2] = destination;
    const determinant = source0.x * (source1.y - source2.y)
      + source1.x * (source2.y - source0.y)
      + source2.x * (source0.y - source1.y);
    if (Math.abs(determinant) < 0.0001) return;

    const a = (destination0.x * (source1.y - source2.y) + destination1.x * (source2.y - source0.y) + destination2.x * (source0.y - source1.y)) / determinant;
    const c = (destination0.x * (source2.x - source1.x) + destination1.x * (source0.x - source2.x) + destination2.x * (source1.x - source0.x)) / determinant;
    const e = (destination0.x * (source1.x * source2.y - source2.x * source1.y) + destination1.x * (source2.x * source0.y - source0.x * source2.y) + destination2.x * (source0.x * source1.y - source1.x * source0.y)) / determinant;
    const b = (destination0.y * (source1.y - source2.y) + destination1.y * (source2.y - source0.y) + destination2.y * (source0.y - source1.y)) / determinant;
    const d = (destination0.y * (source2.x - source1.x) + destination1.y * (source0.x - source2.x) + destination2.y * (source1.x - source0.x)) / determinant;
    const f = (destination0.y * (source1.x * source2.y - source2.x * source1.y) + destination1.y * (source2.x * source0.y - source0.x * source2.y) + destination2.y * (source0.x * source1.y - source1.x * source0.y)) / determinant;

    context.save();
    context.beginPath();
    context.moveTo(destination0.x, destination0.y);
    context.lineTo(destination1.x, destination1.y);
    context.lineTo(destination2.x, destination2.y);
    context.closePath();
    context.clip();
    context.setTransform(a, b, c, d, e, f);
    context.drawImage(sourceCanvas, 0, 0);
    context.restore();
  }

  function warpCard(points) {
    const ordered = orderPoints(points);
    const measuredWidth = Math.max(distance(ordered[0], ordered[1]), distance(ordered[3], ordered[2]));
    const measuredHeight = Math.max(distance(ordered[0], ordered[3]), distance(ordered[1], ordered[2]));
    const aspect = Math.max(1.15, Math.min(2.25, measuredWidth / Math.max(1, measuredHeight)));
    const width = CARD_WIDTH;
    const height = Math.round(width / aspect);
    const columns = 14;
    const rows = 9;
    canvases.card.width = width;
    canvases.card.height = height;
    const context = canvases.card.getContext("2d", { alpha: false });
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const horizontal0 = column / columns;
        const horizontal1 = (column + 1) / columns;
        const vertical0 = row / rows;
        const vertical1 = (row + 1) / rows;
        const source00 = interpolateQuad(ordered, horizontal0, vertical0);
        const source10 = interpolateQuad(ordered, horizontal1, vertical0);
        const source11 = interpolateQuad(ordered, horizontal1, vertical1);
        const source01 = interpolateQuad(ordered, horizontal0, vertical1);
        const destination00 = { x: horizontal0 * width, y: vertical0 * height };
        const destination10 = { x: horizontal1 * width, y: vertical0 * height };
        const destination11 = { x: horizontal1 * width, y: vertical1 * height };
        const destination01 = { x: horizontal0 * width, y: vertical1 * height };
        drawMappedTriangle(context, canvases.photo, [source00, source10, source11], [destination00, destination10, destination11]);
        drawMappedTriangle(context, canvases.photo, [source00, source11, source01], [destination00, destination11, destination01]);
      }
    }
  }

  function otsuThreshold(histogram, total) {
    let sum = 0;
    for (let level = 0; level < 256; level += 1) sum += level * histogram[level];
    let backgroundWeight = 0;
    let backgroundSum = 0;
    let bestVariance = -1;
    let threshold = 128;

    for (let level = 0; level < 256; level += 1) {
      backgroundWeight += histogram[level];
      if (!backgroundWeight) continue;
      const foregroundWeight = total - backgroundWeight;
      if (!foregroundWeight) break;
      backgroundSum += level * histogram[level];
      const backgroundMean = backgroundSum / backgroundWeight;
      const foregroundMean = (sum - backgroundSum) / foregroundWeight;
      const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
      if (variance > bestVariance) {
        bestVariance = variance;
        threshold = level;
      }
    }
    return threshold;
  }

  function preprocessZone(sourceCanvas, targetCanvas, region, targetHeight, kind) {
    const cropX = Math.round(sourceCanvas.width * region.x);
    const cropY = Math.round(sourceCanvas.height * region.y);
    const cropWidth = Math.round(sourceCanvas.width * region.width);
    const cropHeight = Math.round(sourceCanvas.height * region.height);
    const scale = targetHeight / Math.max(1, cropHeight);
    const innerWidth = Math.round(cropWidth * scale);
    const border = 35;
    targetCanvas.width = innerWidth + border * 2;
    targetCanvas.height = targetHeight + border * 2;
    const context = targetCanvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, border, border, innerWidth, targetHeight);

    const image = context.getImageData(border, border, innerWidth, targetHeight);
    const histogram = new Uint32Array(256);
    const gray = new Uint8Array(innerWidth * targetHeight);
    for (let index = 0; index < gray.length; index += 1) {
      const offset = index * 4;
      const value = Math.round(luminance(image.data[offset], image.data[offset + 1], image.data[offset + 2]));
      gray[index] = value;
      histogram[value] += 1;
    }
    const threshold = Math.max(82, Math.min(190, otsuThreshold(histogram, gray.length) + (kind === "calories" ? 10 : 4)));
    for (let index = 0; index < gray.length; index += 1) {
      const offset = index * 4;
      const value = gray[index] > threshold ? 0 : 255;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, border, border);
  }

  function cleanTitle(rawText) {
    const lines = rawText
      .normalize("NFKC")
      .toUpperCase()
      .split(/\n+/)
      .map((line) => line
        .replace(/[|_[\]{}<>~^`“”„]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^[^А-ЯЁ0-9]+/, "")
        .replace(/[^А-ЯЁ0-9)]+$/, "")
        .trim())
      .filter((line) => {
        if (line.length < 2 || line.length > 45 || /[()]/.test(line)) return false;
        const letters = (line.match(/[А-ЯЁ]/g) || []).length;
        return letters / line.length >= 0.45 && !/^\d+\s*[КK]{1,2}$/.test(line);
      });

    return lines
      .join(" ")
      .replace(/[ЗСЭ]Э?Н+ДВИ+Ч+/g, "СЭНДВИЧ")
      .replace(/ЦЫПЛЕНОК/g, "ЦЫПЛЁНОК")
      .replace(/ГРАНОЛОИ/g, "ГРАНОЛОЙ")
      .replace(/ИНДЕИКИ/g, "ИНДЕЙКИ")
      .replace(/\s+([,.:;])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function normalizeCaloriesText(rawText) {
    return rawText
      .normalize("NFKC")
      .toUpperCase()
      .replace(/[ОOQ]/g, "0")
      .replace(/[ЗЭ]/g, "3")
      .replace(/[Б]/g, "6")
      .replace(/(\d)[АA]/g, (_match, digit) => `${digit}1`)
      .replace(/[АA]/g, "4")
      .replace(/[ВB]/g, "8")
      .replace(/[ЕE]/g, "3")
      .replace(/[ІI|L]/g, "1")
      .replace(/[НH]/g, "К");
  }

  function extractCalories(rawText) {
    const upper = rawText.normalize("NFKC").toUpperCase().replace(/[НH]/g, "К");
    const labelledTokens = [...upper.matchAll(/([0-9ОOQЗЭБАAВBЕEІI|L]{2,5})\s*[КK]{1,2}(?=\D|$)/gm)];
    for (const match of labelledTokens) {
      const normalizedToken = normalizeCaloriesText(match[1]);
      if (!/^\d{2,4}$/.test(normalizedToken)) continue;
      const value = Number(normalizedToken);
      if (value >= 20 && value <= 1500) return value;
    }

    const numericText = rawText
      .normalize("NFKC")
      .toUpperCase()
      .replace(/[ОOQ]/g, "0")
      .replace(/[ІI|L]/g, "1");
    const candidates = [...numericText.matchAll(/\d{2,4}/g)]
      .map((match) => Number(match[0]))
      .filter((value) => value >= 50 && value <= 1500);
    return candidates[0] || null;
  }

  async function recognizePhoto(file) {
    const image = await decodeImage(file);
    drawPhoto(image);
    if (typeof image.close === "function") image.close();

    showProgress("Ищу ценник", 12);
    const points = detectPlacard();
    warpCard(points);
    preprocessZone(canvases.card, canvases.title, { x: 0.025, y: 0.025, width: 0.9, height: 0.5 }, 620, "title");
    preprocessZone(canvases.card, canvases.calories, { x: 0.01, y: 0.46, width: 0.58, height: 0.53 }, 700, "calories");

    const ocrWorker = await ensureWorker();
    await ocrWorker.setParameters({
      tessedit_pageseg_mode: window.Tesseract.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      tessedit_char_blacklist: "|[]{}_=<>~",
    });
    showProgress("Читаю название", 52);
    const titleResult = await ocrWorker.recognize(canvases.title);

    await ocrWorker.setParameters({
      tessedit_pageseg_mode: window.Tesseract.PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "0123456789ККккKkННннHh ",
    });
    showProgress("Ищу калории", 76);
    let caloriesResult = await ocrWorker.recognize(canvases.calories);
    const primaryConfidence = caloriesResult.data.confidence || 0;
    let calories = extractCalories(caloriesResult.data.text);

    if (!calories || primaryConfidence < 25) {
      const alternateCanvas = document.createElement("canvas");
      preprocessZone(canvases.card, alternateCanvas, { x: 0.012, y: 0.7, width: 0.24, height: 0.23 }, 620, "calories");
      await ocrWorker.setParameters({
        tessedit_pageseg_mode: window.Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: "",
      });
      showProgress("Уточняю калории", 88);
      const alternateResult = await ocrWorker.recognize(alternateCanvas);
      const alternateCalories = extractCalories(alternateResult.data.text);
      if (alternateCalories && (!calories || (alternateResult.data.confidence || 0) > primaryConfidence + 10)) {
        calories = alternateCalories;
        caloriesResult = alternateResult;
      }
    }

    await ocrWorker.setParameters({ tessedit_char_whitelist: "" });
    return {
      name: cleanTitle(titleResult.data.text),
      calories,
      confidence: {
        name: titleResult.data.confidence || 0,
        calories: caloriesResult.data.confidence || 0,
      },
    };
  }

  async function onPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Выберите фотографию ценника.", "error");
      elements.input.value = "";
      return;
    }

    setBusy(true, "Открываю снимок…");
    setStatus("Фото обрабатывается только на этом устройстве.");
    try {
      const result = await recognizePhoto(file);
      if (result.calories) {
        elements.kcal.value = String(result.calories);
        elements.kcal.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (result.name) {
        elements.name.value = result.name;
        elements.name.dispatchEvent(new Event("input", { bubbles: true }));
      }
      elements.entryError.textContent = "";
      elements.kcal.removeAttribute("aria-invalid");

      if (result.name && result.calories) {
        setStatus(`Распознано: ${result.name} — ${result.calories} ккал. Проверьте и нажмите «Добавить».`, "success");
      } else if (result.name || result.calories) {
        setStatus("Распознана только часть данных. Заполните второе поле вручную или переснимите ценник.", "error");
      } else {
        setStatus("Не удалось распознать ценник. Снимите его прямо, целиком и без бликов.", "error");
      }
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не удалось распознать снимок. Попробуйте ещё раз.", "error");
    } finally {
      elements.input.value = "";
      setBusy(false);
    }
  }

  elements.input.addEventListener("change", onPhotoSelected);
  window.addEventListener("beforeunload", () => {
    if (worker) worker.terminate();
  });
})();
