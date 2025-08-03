/**
 * G-Code Visualizer Library
 * Библиотека для визуализации G-кода с поддержкой 2D и 3D режимов
 */
class GCodeVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Переменные визуализации
    this.currentSegs = null;
    this.viewMode = 'XY'; // XY, XZ, YZ, 3D
    this.scale = 2;
    this.panX = 0;
    this.panY = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.stepMM = 50;
    
    // 3D переменные
    this.rotationX = -2.0;  // Угол поворота по X (радианы) - вид сверху
    this.rotationY = 0; // Угол поворота по Y
    this.rotationZ = 0;    // Угол поворота по Z
    this.distance = 500;   // Расстояние от камеры
    this.autoRotate = false;
    
    // Переменные для кнопок в canvas
    this.viewButtons = [];
    this.hoveredButton = null;
    
    // Темы и цвета
    this.currentTheme = 'dark';
    this.themes = {
      dark: {
        grid: '#444',
        gridText: '#888',
        axisX: '#ff6666',
        axisY: '#66ff66', 
        axisZ: '#6666ff',
        rapidMove: '#ff6b6b',
        workMove: '#4fc3f7',
        startPoint: '#4caf50',
        infoText: '#fff',
        background: 'transparent',
        buttonBg: 'rgba(255,255,255,0.1)',
        buttonBgHover: 'rgba(255,255,255,0.2)',
        buttonBgActive: '#4fc3f7',
        buttonText: '#fff'
      },
      light: {
        grid: '#ddd',
        gridText: '#666',
        axisX: '#d73a49',
        axisY: '#28a745',
        axisZ: '#0969da',
        rapidMove: '#dc3545',
        workMove: '#0969da',
        startPoint: '#28a745',
        infoText: '#24292f',
        background: 'transparent',
        buttonBg: 'rgba(0,0,0,0.1)',
        buttonBgHover: 'rgba(0,0,0,0.2)',
        buttonBgActive: '#4fc3f7',
        buttonText: '#24292f'
      }
    };
    
    this.initViewButtons();
    this.initEvents();
    this.initThemeDetection();
    this.fitCanvas();
    this.draw();
  }
  
  /* ---------- Парсер G-кода ---------- */
  parseGCode(text) {
    const segs = [];
    const lines = text.split(/\r?\n/);
    let x = 0, y = 0, z = 0;
    
    for (const raw of lines) {
      const line = raw.split(';')[0].trim();
      if (!line) continue;
      
      const words = line.split(/\s+/);
      const cmd = words[0].toUpperCase();
      
      if (cmd === 'G0' || cmd === 'G00' || cmd === 'G1' || cmd === 'G01') {
        let nx = x, ny = y, nz = z;
        
        for (const w of words.slice(1)) {
          const letter = w[0].toUpperCase();
          const value = parseFloat(w.slice(1));
          if (letter === 'X') nx = value;
          if (letter === 'Y') ny = value;
          if (letter === 'Z') nz = value;
        }
        
        segs.push([
          { x, y, z },
          { x: nx, y: ny, z: nz },
          cmd.startsWith('G0') // isRapid
        ]);
        
        x = nx;
        y = ny;
        z = nz;
      }
    }
    
    return segs;
  }
  
  /* ---------- 3D математика ---------- */
  rotatePoint3D(x, y, z, rx, ry, rz) {
    // Поворот по X
    let y1 = y * Math.cos(rx) - z * Math.sin(rx);
    let z1 = y * Math.sin(rx) + z * Math.cos(rx);
    
    // Поворот по Y  
    let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
    let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
    
    // Поворот по Z
    let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
    let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
    
    return [x3, y3, z2];
  }
  
  project3D(x, y, z) {
    // Изометрическая проекция с перспективой
    const perspective = this.distance / (this.distance + z);
    const px = x * perspective;
    const py = y * perspective;
    
    return [
      px * this.scale + this.canvas.width / 2 + this.panX,
      this.canvas.height / 2 - py * this.scale + this.panY
    ];
  }
  
  /* ---------- Функции координат ---------- */
  getCoords(point) {
    if (this.viewMode === '3D') {
      const [rx, ry, rz] = this.rotatePoint3D(point.x, point.y, point.z, this.rotationX, this.rotationY, this.rotationZ);
      return this.project3D(rx, ry, rz);
    }
    
    switch (this.viewMode) {
      case 'XY': return [point.x, point.y];
      case 'XZ': return [point.x, point.z];
      case 'YZ': return [point.y, point.z];
      default: return [point.x, point.y];
    }
  }
  
  coordToPixel(coord1, coord2) {
    if (this.viewMode === '3D') {
      return coord1; // В 3D режиме координаты уже преобразованы
    }
    
    const x = coord1 * this.scale + this.panX;
    const y = this.canvas.height - (coord2 * this.scale + this.panY);
    return [x, y];
  }
  
  /* ---------- Отрисовка ---------- */
  fitCanvas() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }
  
  drawGrid() {
    if (this.viewMode === '3D') {
      this.draw3DAxes();
      return;
    }
    
    const stepPx = this.stepMM * this.scale;
    const colors = this.getCurrentColors();
    
    // Сетка
    this.ctx.strokeStyle = colors.grid;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    for (let x = this.panX % stepPx; x < this.canvas.width; x += stepPx) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
    }
    
    for (let y = (this.canvas.height - this.panY) % stepPx; y < this.canvas.height; y += stepPx) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
    }
    
    this.ctx.stroke();
    
    // Подписи
    this.ctx.fillStyle = colors.gridText;
    this.ctx.font = '12px Arial';
    this.ctx.textBaseline = 'top';
    
    this.ctx.textAlign = 'center';
    for (let x = this.panX % stepPx; x < this.canvas.width; x += stepPx) {
      const mm = Math.round((x - this.panX) / this.scale);
      
      this.ctx.fillText(mm + 'мм', x + 2, 2);
    }
    
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'left';
    for (let y = (this.canvas.height - this.panY) % stepPx; y < this.canvas.height; y += stepPx) {
      const mm = Math.round((this.canvas.height - y - this.panY) / this.scale);
      
      this.ctx.fillText(mm + 'мм', 5, y);
    }
  }
  
  draw3DAxes() {
    const axisLength = 50;
    const origin = { x: 0, y: 0, z: 0 };
    const colors = this.getCurrentColors();
    
    // Оси координат
    const axes = [
      [origin, { x: axisLength, y: 0, z: 0 }, colors.axisX], // X
      [origin, { x: 0, y: axisLength, z: 0 }, colors.axisY], // Y  
      [origin, { x: 0, y: 0, z: axisLength }, colors.axisZ]  // Z
    ];
    
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([]);
    
    for (const [start, end, color] of axes) {
      const [sx, sy] = this.getCoords(start);
      const [ex, ey] = this.getCoords(end);
      
      this.ctx.strokeStyle = color;
      this.ctx.beginPath();
      this.ctx.moveTo(sx, sy);
      this.ctx.lineTo(ex, ey);
      this.ctx.stroke();
    }
    
    // Подписи осей
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const xPos = this.getCoords({ x: axisLength + 15, y: 0, z: 0 });
    const yPos = this.getCoords({ x: 0, y: axisLength + 15, z: 0 });
    const zPos = this.getCoords({ x: 0, y: 0, z: axisLength + 15 });
    
    this.ctx.fillStyle = colors.axisX;
    this.ctx.fillText('X', xPos[0], xPos[1]);
    this.ctx.fillStyle = colors.axisY;
    this.ctx.fillText('Y', yPos[0], yPos[1]);
    this.ctx.fillStyle = colors.axisZ;
    this.ctx.fillText('Z', zPos[0], zPos[1]);
  }
  
  drawPath(segs) {
    if (!segs || segs.length === 0) return;
    
    const colors = this.getCurrentColors();
    
    // Быстрые перемещения (пунктир)
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeStyle = colors.rapidMove;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    for (const [p1, p2, isRapid] of segs) {
      if (isRapid) {
        const coords1 = this.getCoords(p1);
        const coords2 = this.getCoords(p2);
        
        let px1, py1, px2, py2;
        
        if (this.viewMode === '3D') {
          [px1, py1] = coords1;
          [px2, py2] = coords2;
        } else {
          [px1, py1] = this.coordToPixel(coords1[0], coords1[1]);
          [px2, py2] = this.coordToPixel(coords2[0], coords2[1]);
        }
        
        this.ctx.moveTo(px1, py1);
        this.ctx.lineTo(px2, py2);
      }
    }
    
    this.ctx.stroke();
    
    // Рабочие перемещения (сплошная линия)
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = colors.workMove;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    
    for (const [p1, p2, isRapid] of segs) {
      if (!isRapid) {
        const coords1 = this.getCoords(p1);
        const coords2 = this.getCoords(p2);
        
        let px1, py1, px2, py2;
        
        if (this.viewMode === '3D') {
          [px1, py1] = coords1;
          [px2, py2] = coords2;
        } else {
          [px1, py1] = this.coordToPixel(coords1[0], coords1[1]);
          [px2, py2] = this.coordToPixel(coords2[0], coords2[1]);
        }
        
        this.ctx.moveTo(px1, py1);
        this.ctx.lineTo(px2, py2);
      }
    }
    
    this.ctx.stroke();
    
    // Точка старта
    if (segs.length > 0) {
      const coords = this.getCoords(segs[0][0]);
      
      let px, py;
      if (this.viewMode === '3D') {
        [px, py] = coords;
      } else {
        [px, py] = this.coordToPixel(coords[0], coords[1]);
      }
      
      this.ctx.fillStyle = colors.startPoint;
      this.ctx.beginPath();
      this.ctx.arc(px, py, 6, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();
    
    if (this.currentSegs) {
      this.drawPath(this.currentSegs);
    }
    
    // Обновляем позиции кнопок при изменении размера canvas
    this.updateButtonPositions();
    
    // Рисуем кнопки управления видом
    this.drawViewButtons();
    
    // Информация о виде (перенесем левее, чтобы не перекрывала кнопки)
    const colors = this.getCurrentColors();
    this.ctx.fillStyle = colors.infoText;
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`Вид: ${this.viewMode}`, 10, 10);
  }
  
  /* ---------- Инициализация кнопок в canvas ---------- */
  initViewButtons() {
    // Определяем кнопки для отрисовки в canvas
    const buttonData = [
      { text: 'XY', mode: 'XY' },
      { text: 'XZ', mode: 'XZ' },
      { text: 'YZ', mode: 'YZ' },
      { text: '3D', mode: '3D' }
    ];
    
    this.viewButtons = buttonData.map((data, index) => ({
      ...data,
      x: 0, // будет вычислено в updateButtonPositions
      y: 0,
      width: 40,
      height: 32,
      index
    }));
    
    this.updateButtonPositions();
  }
  
  updateButtonPositions() {
    // Размещаем кнопки в правом верхнем углу
    const padding = 10;
    const gap = 8;
    let x = this.canvas.width - padding;
    
    // Вычисляем позиции справа налево
    for (let i = this.viewButtons.length - 1; i >= 0; i--) {
      const button = this.viewButtons[i];
      button.x = x - button.width;
      button.y = padding;
      x = button.x - gap;
    }
  }
  
  drawRoundedRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  drawViewButtons() {
    const colors = this.getCurrentColors();
    
    for (const button of this.viewButtons) {
      // Определяем состояние кнопки
      const isActive = button.mode === this.viewMode;
      const isHovered = this.hoveredButton === button;
      
      // Фон кнопки
      let bgColor;
      if (isActive) {
        bgColor = colors.buttonBgActive;
      } else if (isHovered) {
        bgColor = colors.buttonBgHover;
      } else {
        bgColor = colors.buttonBg;
      }
      
      // Рисуем тень
      this.ctx.shadowColor = 'rgba(0,0,0,0.2)';
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetY = 2;
      this.ctx.fillStyle = bgColor;
      this.drawRoundedRect(button.x, button.y, button.width, button.height, 6);
      this.ctx.fill();
      
      // Сбрасываем тень и рисуем основной фон
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetY = 0;
      this.ctx.fillStyle = bgColor;
      this.drawRoundedRect(button.x, button.y, button.width, button.height, 6);
      this.ctx.fill();
      
      // Текст кнопки
      this.ctx.fillStyle = isActive ? '#ffffff' : colors.buttonText;
      this.ctx.font = 'bold 14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        button.text,
        button.x + button.width / 2,
        button.y + button.height / 2
      );
    }
  }
  
  isPointInButton(x, y, button) {
    return x >= button.x && x <= button.x + button.width &&
           y >= button.y && y <= button.y + button.height;
  }
  
  getButtonAtPoint(x, y) {
    for (const button of this.viewButtons) {
      if (this.isPointInButton(x, y, button)) {
        return button;
      }
    }
    return null;
  }

  /* ---------- Инициализация отслеживания тем ---------- */
  initThemeDetection() {
    // Определяем текущую тему из localStorage
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme === 'light') {
      this.currentTheme = 'light';
    } else {
      this.currentTheme = 'dark';
    }
    
    // Отслеживаем изменения localStorage для автоматической смены темы
    window.addEventListener('storage', (e) => {
      if (e.key === 'selectedTheme') {
        this.setTheme(e.newValue === 'light' ? 'light' : 'dark');
      }
    });
    
    // Отслеживаем изменения через mutation observer для кнопок тем
    const observer = new MutationObserver(() => {
      const savedTheme = localStorage.getItem('selectedTheme');
      const newTheme = savedTheme === 'light' ? 'light' : 'dark';
      if (newTheme !== this.currentTheme) {
        this.setTheme(newTheme);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Проверяем тему каждые 500мс (резервный метод)
    setInterval(() => {
      const savedTheme = localStorage.getItem('selectedTheme');
      const newTheme = savedTheme === 'light' ? 'light' : 'dark';
      if (newTheme !== this.currentTheme) {
        this.setTheme(newTheme);
      }
    }, 500);
  }
  
  setTheme(themeName) {
    if (this.themes[themeName]) {
      this.currentTheme = themeName;
      this.draw(); // Перерисовываем с новыми цветами
    }
  }
  
  getCurrentColors() {
    return this.themes[this.currentTheme];
  }

  /* ---------- События мыши ---------- */
  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Проверяем клик по кнопкам
      const clickedButton = this.getButtonAtPoint(x, y);
      if (clickedButton) {
        this.setViewMode(clickedButton.mode);
        return; // Не начинаем перетаскивание при клике на кнопку
      }
      
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    });
    
    window.addEventListener('mouseup', () => {
      this.dragging = false;
      this.canvas.style.cursor = 'grab';
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Проверяем наведение на кнопки
      const hoveredButton = this.getButtonAtPoint(x, y);
      
      if (hoveredButton !== this.hoveredButton) {
        this.hoveredButton = hoveredButton;
        this.draw(); // Перерисовываем для отображения hover эффекта
      }
      
      // Устанавливаем курсор
      if (hoveredButton) {
        this.canvas.style.cursor = 'pointer';
      } else if (this.dragging) {
        this.canvas.style.cursor = 'grabbing';
      } else {
        this.canvas.style.cursor = 'grab';
      }
      
      // Перетаскивание только если не наводимся на кнопки
      if (this.dragging && !hoveredButton) {
        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;
        
        if (this.viewMode === '3D') {
          // В 3D режиме - вращение модели
          this.rotationY += deltaX * 0.01;
          this.rotationX += deltaY * 0.01;
        } else {
          // В 2D режимах - панорамирование
          this.panX += deltaX;
          this.panY -= deltaY;
        }
        
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        
        this.draw();
      }
    });
    
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      
      const deltaX = e.clientX - this.lastX;
      const deltaY = e.clientY - this.lastY;
      
      if (this.viewMode === '3D') {
        // В 3D режиме - вращение модели
        this.rotationY += deltaX * 0.01;
        this.rotationX += deltaY * 0.01;
      } else {
        // В 2D режимах - панорамирование
        this.panX += deltaX;
        this.panY -= deltaY;
      }
      
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      
      this.draw();
    });
    
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      // Во всех режимах изменяем масштаб
      const prevScale = this.scale;
      this.scale *= (e.deltaY < 0) ? 1.1 : 0.9;
      this.scale = Math.max(0.1, Math.min(50, this.scale));
      
      if (this.viewMode !== '3D') {
        // В 2D режимах - учитываем позицию мыши для масштабирования
        const rect = this.canvas.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;
        
        this.panX = centerX - (centerX - this.panX) * (this.scale / prevScale);
        this.panY = -((centerY - this.panY) * (this.scale / prevScale) - centerY);
      }
      
      this.draw();
    }, { passive: false });
    
    window.addEventListener('resize', () => {
      this.fitCanvas();
      this.draw();
    });
  }
  
  /* ---------- Автоподгонка масштаба ---------- */
  autoFit() {
    if (!this.currentSegs || this.currentSegs.length === 0) return;
    
    if (this.viewMode === '3D') {
      this.autoFit3D();
      return;
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const [p1, p2] of this.currentSegs) {
      const [x1, y1] = this.getCoords(p1);
      const [x2, y2] = this.getCoords(p2);
      
      minX = Math.min(minX, x1, x2);
      maxX = Math.max(maxX, x1, x2);
      minY = Math.min(minY, y1, y2);
      maxY = Math.max(maxY, y1, y2);
    }
    
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    
    if (rangeX > 0 && rangeY > 0) {
      const scaleX = (this.canvas.width * 0.8) / rangeX;
      const scaleY = (this.canvas.height * 0.8) / rangeY;
      this.scale = Math.min(scaleX, scaleY);
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      this.panX = this.canvas.width / 2 - centerX * this.scale;
      this.panY = this.canvas.height / 2 - centerY * this.scale;
    }
  }
  
  autoFit3D() {
    if (!this.currentSegs || this.currentSegs.length === 0) return;
    
    // Найти размеры объекта в 3D
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity; 
    let minZ = Infinity, maxZ = -Infinity;
    
    for (const [p1, p2] of this.currentSegs) {
      minX = Math.min(minX, p1.x, p2.x);
      maxX = Math.max(maxX, p1.x, p2.x);
      minY = Math.min(minY, p1.y, p2.y);
      maxY = Math.max(maxY, p1.y, p2.y);
      minZ = Math.min(minZ, p1.z, p2.z);
      maxZ = Math.max(maxZ, p1.z, p2.z);
    }
    
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const rangeZ = maxZ - minZ;
    const maxRange = Math.max(rangeX, rangeY, rangeZ);
    
    if (maxRange > 0) {
      this.scale = Math.min(this.canvas.width, this.canvas.height) * 0.6 / maxRange;
      this.panX = 0;
      this.panY = 0;
      this.distance = maxRange * 2; // Установить расстояние камеры
    }
  }
  
  /* ---------- Публичные методы ---------- */
  loadGCode(gcode) {
    this.currentSegs = this.parseGCode(gcode);
    this.autoFit();
    this.draw();
  }
  
  setViewMode(mode) {
    this.viewMode = mode;
    this.autoFit();
    this.draw();
  }
  
  setViewXY() { this.setViewMode('XY'); }
  setViewXZ() { this.setViewMode('XZ'); }
  setViewYZ() { this.setViewMode('YZ'); }
  setView3D() { this.setViewMode('3D'); }
  
  refresh() {
    this.fitCanvas();
    this.draw();
  }
  
  // Геттеры
  getViewMode() { return this.viewMode; }
  hasGCode() { return this.currentSegs && this.currentSegs.length > 0; }
}

// Экспорт для использования в модулях или глобально
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GCodeVisualizer;
} else if (typeof window !== 'undefined') {
  window.GCodeVisualizer = GCodeVisualizer;
}
