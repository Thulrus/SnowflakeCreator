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
  private svg: SVGSVGElement;
  private symmetryManager: SymmetryManager;
  private fillLayer: SVGGElement;
  private isEnabled = false;
  private backgroundRect: SVGRectElement | null = null;
  private fillGroup: SVGGElement | null = null;

  constructor(svg: SVGSVGElement, symmetryManager: SymmetryManager) {
    this.svg = svg;
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
   */
  public update(): void {
    if (!this.isEnabled) return;

    this.clearFill();

    // Get paths with transforms baked in (actual positions)
    const paths = this.symmetryManager.generateBakedPaths();
    if (paths.length === 0) {
      return;
    }

    // Create a compound path with all snowflake paths
    // Use evenodd fill rule to create alternating fills
    let combinedPathData = '';
    for (const path of paths) {
      const d = path.getAttribute('d');
      
      if (d) {
        combinedPathData += ' ' + d;
      }
    }

    // Create the fill group
    this.fillGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.fillGroup.setAttribute('opacity', '0.4');

    // Create background rectangle (represents the paper)
    this.backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.backgroundRect.setAttribute('x', '0');
    this.backgroundRect.setAttribute('y', '0');
    this.backgroundRect.setAttribute('width', '1000');
    this.backgroundRect.setAttribute('height', '1000');
    this.backgroundRect.setAttribute('fill', '#666666');

    // Create clipping path with all the cut paths
    const clipPathId = 'cut-area-clip';
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.id = clipPathId;

    const clipPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    clipPathElement.setAttribute('d', combinedPathData);
    clipPathElement.setAttribute('fill-rule', 'evenodd');
    clipPathElement.setAttribute('clip-rule', 'evenodd');
    
    clipPath.appendChild(clipPathElement);

    // Add mask to show cut areas (holes) in white
    const maskId = 'cut-area-mask';
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.id = maskId;

    const maskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    maskRect.setAttribute('x', '0');
    maskRect.setAttribute('y', '0');
    maskRect.setAttribute('width', '1000');
    maskRect.setAttribute('height', '1000');
    maskRect.setAttribute('fill', 'white');
    mask.appendChild(maskRect);

    const maskPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    maskPath.setAttribute('d', combinedPathData);
    maskPath.setAttribute('fill', 'black');
    maskPath.setAttribute('fill-rule', 'evenodd');
    mask.appendChild(maskPath);

    // Add defs
    const defs = this.svg.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    if (!this.svg.querySelector('defs')) {
      this.svg.insertBefore(defs, this.svg.firstChild);
    }
    
    // Remove old clip/mask if exists
    const oldClip = defs.querySelector(`#${clipPathId}`);
    const oldMask = defs.querySelector(`#${maskId}`);
    if (oldClip) defs.removeChild(oldClip);
    if (oldMask) defs.removeChild(oldMask);
    
    defs.appendChild(clipPath);
    defs.appendChild(mask);

    // Apply mask to background
    this.backgroundRect.setAttribute('mask', `url(#${maskId})`);

    this.fillGroup.appendChild(this.backgroundRect);
    this.fillLayer.appendChild(this.fillGroup);
  }

  /**
   * Clears the fill visualization.
   */
  private clearFill(): void {
    while (this.fillLayer.firstChild) {
      this.fillLayer.removeChild(this.fillLayer.firstChild);
    }
    this.backgroundRect = null;
    this.fillGroup = null;
  }
}
