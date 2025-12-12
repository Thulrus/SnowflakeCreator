/**
 * visualization.ts
 * 
 * Handles fill visualization to show positive (paper) and negative (cut) space.
 * Uses SVG fill rules to alternate between black and white based on path winding.
 */

import { SymmetryManager } from './symmetry';

/**
 * Manages fill visualization for the snowflake to show cut vs. paper areas.
 */
export class FillVisualization {
  private symmetryManager: SymmetryManager;
  private fillLayer: SVGGElement;
  private isEnabled = false;
  private fillGroup: SVGGElement | null = null;

  constructor(_svg: SVGSVGElement, symmetryManager: SymmetryManager) {
    this.symmetryManager = symmetryManager;
    
    // Create fill layer (insert before snowflake layer)
    this.fillLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.fillLayer.id = 'fill-visualization-layer';
    
    const snowflakeLayer = document.getElementById('snowflake-layer');
    if (snowflakeLayer && snowflakeLayer.parentNode) {
      snowflakeLayer.parentNode.insertBefore(this.fillLayer, snowflakeLayer);
    }
  }

  /**
   * Enables fill visualization.
   */
  public enable(): void {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.update();
  }

  /**
   * Disables fill visualization.
   */
  public disable(): void {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    this.clearFill();
  }

  /**
   * Toggles fill visualization on/off.
   */
  public toggle(): void {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Returns whether fill visualization is currently enabled.
   */
  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Updates the fill visualization based on current paths.
   * Uses canvas-based flood fill to detect enclosed regions.
   */
  public update(): void {
    if (!this.isEnabled) return;

    this.clearFill();

    // Get paths with transforms baked in (actual positions)
    const paths = this.symmetryManager.generateBakedPaths();
    console.log(`[Fill] Updating with ${paths.length} baked paths`);
    
    if (paths.length === 0) {
      return;
    }

    // Create an offscreen canvas to rasterize the strokes
    const canvas = document.createElement('canvas');
    const size = 1000;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Fill with white (areas that flood fill can reach)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);

    // Draw all strokes in black (barriers)
    ctx.strokeStyle = 'black';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    let pathCount = 0;
    for (const path of paths) {
      const d = path.getAttribute('d');
      const strokeWidth = parseFloat(path.getAttribute('stroke-width') || '2');
      
      if (d) {
        try {
          ctx.lineWidth = strokeWidth * 2; // Make barriers thicker
          const path2d = new Path2D(d);
          ctx.stroke(path2d);
          pathCount++;
        } catch (e) {
          console.error('[Fill] Error drawing path:', e, d.substring(0, 100));
        }
      }
    }
    
    console.log(`[Fill] Drew ${pathCount} paths on canvas`);

    // Flood fill from edges - fill all white areas that can be reached from outside
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    // Count initial white pixels
    let whitePixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 200 && g > 200 && b > 200) {
        whitePixels++;
      }
    }
    console.log(`[Fill] Canvas has ${whitePixels} white pixels before flood fill`);
    
    // Simple flood fill from all edges
    const visited = new Set<number>();
    const queue: [number, number][] = [];
    
    // Add all edge pixels to queue
    for (let x = 0; x < size; x++) {
      queue.push([x, 0]); // Top edge
      queue.push([x, size - 1]); // Bottom edge
    }
    for (let y = 0; y < size; y++) {
      queue.push([0, y]); // Left edge
      queue.push([size - 1, y]); // Right edge
    }
    
    console.log('[Fill] Starting flood fill from edges');
    
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const idx = (y * size + x) * 4;
      const key = y * size + x;
      
      if (visited.has(key)) continue;
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      
      // Check if this pixel is white (not a stroke)
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      if (r > 200 && g > 200 && b > 200) { // White-ish
        visited.add(key);
        // Mark as gray (will be cut away)
        data[idx] = 102;     // R
        data[idx + 1] = 102; // G
        data[idx + 2] = 102; // B
        data[idx + 3] = 255; // A (fully opaque)
        
        // Add neighbors
        queue.push([x + 1, y]);
        queue.push([x - 1, y]);
        queue.push([x, y + 1]);
        queue.push([x, y - 1]);
      }
    }
    
    console.log(`[Fill] Flood filled ${visited.size} pixels`);
    
    // Convert to data URL
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL();
    
    // Create image element from canvas
    this.fillGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', '1000');
    image.setAttribute('height', '1000');
    image.setAttribute('href', dataUrl);
    image.setAttribute('opacity', '0.5');
    
    this.fillGroup.appendChild(image);
    this.fillLayer.appendChild(this.fillGroup);
    
    console.log('[Fill] Created flood fill visualization');
  }

  /**
   * Clears the fill visualization.
   */
  private clearFill(): void {
    while (this.fillLayer.firstChild) {
      this.fillLayer.removeChild(this.fillLayer.firstChild);
    }
    this.fillGroup = null;
  }
}
