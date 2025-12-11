/**
 * main.ts
 * 
 * Entry point for the Snowflake Creator application.
 * Initializes all modules and coordinates the application flow.
 */

import './styles.css';
import { DrawingManager } from './drawing';
import { SymmetryManager } from './symmetry';
import { ExportManager } from './export';
import { UIManager } from './ui';

/**
 * Application initialization.
 */
function initializeApp(): void {
  console.log('Initializing Snowflake Creator...');

  // Get SVG and layer elements
  const svg = document.getElementById('main-svg') as unknown as SVGSVGElement;
  const wedgeLayer = document.getElementById('wedge-layer') as unknown as SVGGElement;
  const snowflakeLayer = document.getElementById('snowflake-layer') as unknown as SVGGElement;

  if (!svg || !wedgeLayer || !snowflakeLayer) {
    console.error('Required SVG elements not found');
    return;
  }

  // Initialize managers
  const drawingManager = new DrawingManager(svg, wedgeLayer);
  const symmetryManager = new SymmetryManager(snowflakeLayer);
  const exportManager = new ExportManager(symmetryManager);
  const uiManager = new UIManager(drawingManager, symmetryManager, exportManager, svg);

  // Connect drawing to symmetry
  uiManager.setupDrawingSymmetry();

  console.log('Snowflake Creator initialized successfully');
  console.log('Keyboard shortcuts:');
  console.log('  Ctrl/Cmd + Z: Undo');
  console.log('  Ctrl/Cmd + E: Export');
  console.log('  Shift + Delete: Clear all');
  console.log('  Escape: Reset view');
  console.log('  Shift + Drag: Pan');
  console.log('  Mouse wheel: Zoom');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Make app accessible for debugging
declare global {
  interface Window {
    snowflakeApp?: {
      version: string;
    };
  }
}

window.snowflakeApp = {
  version: '1.0.0',
};
