/**
 * ui.ts
 * 
 * Handles UI interactions, toolbar buttons, and zoom/pan functionality.
 */

import { DrawingManager } from './drawing';
import { SymmetryManager } from './symmetry';
import { ExportManager } from './export';
import { FillVisualization } from './visualization';

/**
 * Manages UI interactions and coordinates between different modules.
 */
export class UIManager {
  private drawingManager: DrawingManager;
  private symmetryManager: SymmetryManager;
  private exportManager: ExportManager;
  private fillVisualization: FillVisualization;
  private svg: SVGSVGElement;

  // UI elements
  private btnDraw: HTMLButtonElement;
  private btnLine: HTMLButtonElement;
  private btnUndo: HTMLButtonElement;
  private btnClear: HTMLButtonElement;
  private btnExport: HTMLButtonElement;
  private btnToggleFill: HTMLButtonElement;

  // Zoom and pan state
  private viewBox = { x: 0, y: 0, width: 1000, height: 1000 };
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private scale = 1;

  // Touch state
  private touchStartDistance = 0;
  private touchStartScale = 1;
  private touchStartViewBox = { x: 0, y: 0, width: 1000, height: 1000 };
  private touchCount = 0;

  constructor(
    drawingManager: DrawingManager,
    symmetryManager: SymmetryManager,
    exportManager: ExportManager,
    fillVisualization: FillVisualization,
    svg: SVGSVGElement
  ) {
    this.drawingManager = drawingManager;
    this.symmetryManager = symmetryManager;
    this.exportManager = exportManager;
    this.fillVisualization = fillVisualization;
    this.svg = svg;

    // Get UI elements
    this.btnDraw = document.getElementById('btn-draw') as HTMLButtonElement;
    this.btnLine = document.getElementById('btn-line') as HTMLButtonElement;
    this.btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
    this.btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
    this.btnExport = document.getElementById('btn-export') as HTMLButtonElement;
    this.btnToggleFill = document.getElementById('btn-toggle-fill') as HTMLButtonElement;

    this.initializeEventListeners();
    this.enableDrawMode();
  }

  /**
   * Initializes all event listeners for UI elements.
   */
  private initializeEventListeners(): void {
    // Toolbar buttons
    this.btnDraw.addEventListener('click', () => this.enableDrawMode());
    this.btnLine.addEventListener('click', () => this.enableLineMode());
    this.btnUndo.addEventListener('click', () => this.handleUndo());
    this.btnClear.addEventListener('click', () => this.handleClear());
    this.btnExport.addEventListener('click', () => this.handleExport());
    this.btnToggleFill.addEventListener('click', () => this.handleToggleFill());

    // Zoom with mouse wheel
    this.svg.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

    // Pan with middle mouse button or Space + drag
    this.svg.addEventListener('mousedown', (e) => this.handlePanStart(e));
    this.svg.addEventListener('mousemove', (e) => this.handlePanMove(e));
    this.svg.addEventListener('mouseup', () => this.handlePanEnd());
    this.svg.addEventListener('mouseleave', () => this.handlePanEnd());

    // Touch events for pinch-zoom and two-finger pan
    this.svg.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.svg.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.svg.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    this.svg.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  /**
   * Enables draw mode.
   */
  private enableDrawMode(): void {
    this.btnDraw.classList.add('active');
    this.btnLine.classList.remove('active');
    this.svg.style.cursor = 'crosshair';
    this.drawingManager.setMode('freehand');
    this.drawingManager.enable();
  }

  /**
   * Enables line mode.
   */
  private enableLineMode(): void {
    this.btnLine.classList.add('active');
    this.btnDraw.classList.remove('active');
    this.svg.style.cursor = 'crosshair';
    this.drawingManager.setMode('line');
    this.drawingManager.enable();
  }

  /**
   * Handles undo action.
   */
  private handleUndo(): void {
    const strokes = this.drawingManager.getStrokes();
    if (strokes.length === 0) return;

    const lastStroke = strokes[strokes.length - 1];
    this.symmetryManager.removeStroke(lastStroke);
    this.drawingManager.undoLastStroke();
    
    // Update fill visualization
    this.fillVisualization.update();
  }

  /**
   * Handles clear all action.
   */
  private handleClear(): void {
    if (this.drawingManager.getStrokes().length === 0) return;

    if (confirm('Clear all strokes? This cannot be undone.')) {
      this.drawingManager.clearAll();
      this.symmetryManager.clearAll();
      
      // Update fill visualization
      this.fillVisualization.update();
    }
  }

  /**
   * Handles export action.
   */
  private handleExport(): void {
    try {
      this.exportManager.exportToFile('snowflake.svg');
    } catch (error) {
      console.error('Export error:', error);
    }
  }

  /**
   * Handles toggle fill visualization.
   */
  private handleToggleFill(): void {
    this.fillVisualization.toggle();
    
    // Update button appearance
    if (this.fillVisualization.getEnabled()) {
      this.btnToggleFill.classList.add('active');
      this.btnToggleFill.textContent = '';
      this.btnToggleFill.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20">
          <rect x="3" y="3" width="14" height="14" fill="currentColor" opacity="0.5" stroke="currentColor" stroke-width="2"/>
        </svg>
        Hide Fill
      `;
    } else {
      this.btnToggleFill.classList.remove('active');
      this.btnToggleFill.textContent = '';
      this.btnToggleFill.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20">
          <rect x="3" y="3" width="14" height="14" fill="currentColor" opacity="0.5" stroke="currentColor" stroke-width="2"/>
        </svg>
        Show Fill
      `;
    }
  }

  /**
   * Handles mouse wheel for zooming.
   */
  private handleWheel(event: WheelEvent): void {
    event.preventDefault();

    // Reverse direction: scroll up (negative deltaY) zooms in, scroll down (positive) zooms out
    const delta = event.deltaY > 0 ? 1.1 : 0.9;
    this.scale /= delta;

    // Limit zoom range
    this.scale = Math.max(0.1, Math.min(10, this.scale));

    // Zoom towards mouse position
    const rect = this.svg.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const svgX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
    const svgY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;

    const newWidth = 1000 / this.scale;
    const newHeight = 1000 / this.scale;

    this.viewBox.x = svgX - (mouseX / rect.width) * newWidth;
    this.viewBox.y = svgY - (mouseY / rect.height) * newHeight;
    this.viewBox.width = newWidth;
    this.viewBox.height = newHeight;

    this.updateViewBox();
  }

  /**
   * Handles pan start.
   */
  private handlePanStart(event: MouseEvent): void {
    // Middle mouse button or Space + left mouse button
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      event.preventDefault();
      this.isPanning = true;
      this.panStart = { x: event.clientX, y: event.clientY };
      this.svg.classList.add('panning');
      this.drawingManager.disable();
    }
  }

  /**
   * Handles pan move.
   */
  private handlePanMove(event: MouseEvent): void {
    if (!this.isPanning) return;

    const dx = event.clientX - this.panStart.x;
    const dy = event.clientY - this.panStart.y;

    const rect = this.svg.getBoundingClientRect();
    const scaleX = this.viewBox.width / rect.width;
    const scaleY = this.viewBox.height / rect.height;

    this.viewBox.x -= dx * scaleX;
    this.viewBox.y -= dy * scaleY;

    this.panStart = { x: event.clientX, y: event.clientY };
    this.updateViewBox();
  }

  /**
   * Handles pan end.
   */
  private handlePanEnd(): void {
    if (this.isPanning) {
      this.isPanning = false;
      this.svg.classList.remove('panning');
      if (this.btnDraw.classList.contains('active')) {
        this.drawingManager.enable();
      }
    }
  }

  /**
   * Updates the SVG viewBox attribute.
   */
  private updateViewBox(): void {
    const { x, y, width, height } = this.viewBox;
    this.svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  }

  /**
   * Handles keyboard shortcuts.
   */
  private handleKeyboard(event: KeyboardEvent): void {
    // Ctrl/Cmd + Z: Undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      event.preventDefault();
      this.handleUndo();
    }

    // Delete/Backspace: Clear (with confirmation)
    if (event.key === 'Delete' && event.shiftKey) {
      event.preventDefault();
      this.handleClear();
    }

    // Ctrl/Cmd + E: Export
    if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
      event.preventDefault();
      this.handleExport();
    }

    // Escape: Reset view
    if (event.key === 'Escape') {
      this.resetView();
    }
  }

  /**
   * Resets the view to default zoom and position.
   */
  private resetView(): void {
    this.viewBox = { x: 0, y: 0, width: 1000, height: 1000 };
    this.scale = 1;
    this.updateViewBox();
  }

  /**
   * Sets up the connection between drawing and symmetry.
   */
  public setupDrawingSymmetry(): void {
    // Track current pathElement for real-time updates
    let currentPathElement: SVGPathElement | null = null;
    
    // Real-time symmetry updates while drawing
    this.drawingManager.onStrokeUpdated((stroke) => {
      if (currentPathElement === stroke.pathElement) {
        // Update existing symmetry
        this.symmetryManager.updateStroke(stroke);
      } else {
        // First update - add the stroke
        this.symmetryManager.addStroke(stroke);
        currentPathElement = stroke.pathElement;
      }
    });
    
    // Finalize when stroke is completed
    this.drawingManager.onStrokeCompleted((stroke) => {
      if (!currentPathElement) {
        // If no real-time updates occurred, add now
        this.symmetryManager.addStroke(stroke);
      } else {
        // Final update to ensure everything is synchronized
        this.symmetryManager.updateStroke(stroke);
      }
      currentPathElement = null;
      
      // Update fill visualization
      this.fillVisualization.update();
    });
  }

  /**
   * Calculates the distance between two touch points.
   */
  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Gets the center point between two touches.
   */
  private getTouchCenter(touch1: Touch, touch2: Touch): { x: number; y: number } {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }

  /**
   * Handles touch start for pinch-zoom and two-finger pan.
   */
  private handleTouchStart(event: TouchEvent): void {
    this.touchCount = event.touches.length;

    if (this.touchCount === 2) {
      // Two fingers: prepare for pinch-zoom or pan
      event.preventDefault();
      this.drawingManager.disable();

      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      this.touchStartDistance = this.getTouchDistance(touch1, touch2);
      this.touchStartScale = this.scale;
      this.touchStartViewBox = { ...this.viewBox };

      const center = this.getTouchCenter(touch1, touch2);
      this.panStart = center;
      this.isPanning = true;
    }
    // Single finger: let drawing manager handle it
  }

  /**
   * Handles touch move for pinch-zoom and two-finger pan.
   */
  private handleTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2 && this.touchCount === 2) {
      event.preventDefault();

      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      // Calculate pinch-zoom
      const currentDistance = this.getTouchDistance(touch1, touch2);
      const scaleChange = currentDistance / this.touchStartDistance;
      this.scale = this.touchStartScale * scaleChange;
      this.scale = Math.max(0.1, Math.min(10, this.scale));

      // Calculate center point for zoom
      const center = this.getTouchCenter(touch1, touch2);
      const rect = this.svg.getBoundingClientRect();
      
      // Convert center to SVG coordinates at start scale
      const svgCenterX = this.touchStartViewBox.x + (center.x - rect.left) / rect.width * this.touchStartViewBox.width;
      const svgCenterY = this.touchStartViewBox.y + (center.y - rect.top) / rect.height * this.touchStartViewBox.height;

      // Calculate new viewBox dimensions
      const newWidth = 1000 / this.scale;
      const newHeight = 1000 / this.scale;

      // Calculate pan delta
      const dx = center.x - this.panStart.x;
      const dy = center.y - this.panStart.y;
      const scaleX = this.touchStartViewBox.width / rect.width;
      const scaleY = this.touchStartViewBox.height / rect.height;

      // Apply zoom centered on pinch point, plus pan
      const centerRatioX = (center.x - rect.left) / rect.width;
      const centerRatioY = (center.y - rect.top) / rect.height;
      
      this.viewBox.x = svgCenterX - centerRatioX * newWidth - dx * scaleX;
      this.viewBox.y = svgCenterY - centerRatioY * newHeight - dy * scaleY;
      this.viewBox.width = newWidth;
      this.viewBox.height = newHeight;

      this.updateViewBox();
    }
  }

  /**
   * Handles touch end.
   */
  private handleTouchEnd(event: TouchEvent): void {
    this.touchCount = event.touches.length;

    if (this.touchCount < 2) {
      this.isPanning = false;
      this.touchStartDistance = 0;
      
      // Re-enable drawing if in draw mode
      if (this.btnDraw.classList.contains('active') || this.btnLine.classList.contains('active')) {
        this.drawingManager.enable();
      }
    }
  }
}
