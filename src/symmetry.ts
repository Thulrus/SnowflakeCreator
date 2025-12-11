/**
 * symmetry.ts
 * 
 * Handles twelve-fold rotational symmetry with mirroring for snowflake generation.
 * Each stroke in the 30° wedge is:
 * 1. Mirrored across the centerline to create a 60° section
 * 2. Rotated 6 times at 60° intervals to create the full snowflake
 */

import { Stroke } from './drawing';

/**
 * The center point of the snowflake (and rotation center).
 */
const CENTER = { x: 500, y: 500 };

/**
 * Rotation angles for six-fold symmetry (in degrees).
 */
const ROTATION_ANGLES = [0, 60, 120, 180, 240, 300];

/**
 * Manages the snowflake layer and applies twelve-fold symmetry to strokes.
 */
export class SymmetryManager {
  private snowflakeLayer: SVGGElement;
  private strokePaths: Map<SVGPathElement, SVGPathElement[]> = new Map();

  constructor(snowflakeLayer: SVGGElement) {
    this.snowflakeLayer = snowflakeLayer;
  }

  /**
   * Mirrors a path across the vertical centerline (0° line).
   * This creates the reflection needed for the 60° section.
   * 
   * @param original - The original path element
   * @returns The mirrored path element
   */
  private mirrorPath(original: SVGPathElement): SVGPathElement {
    const mirror = original.cloneNode(true) as SVGPathElement;
    
    // Mirror across the vertical centerline (x = CENTER.x)
    // This is achieved by scaling with -1 on X axis around the center
    const transform = `scale(-1, 1) translate(${-2 * CENTER.x}, 0)`;
    mirror.setAttribute('transform', transform);
    
    return mirror;
  }

  /**
   * Creates a rotated clone of an SVG path element.
   * 
   * @param original - The original path element
   * @param angle - Rotation angle in degrees
   * @returns The cloned and rotated path element
   */
  private cloneAndRotate(original: SVGPathElement, angle: number): SVGPathElement {
    const clone = original.cloneNode(true) as SVGPathElement;
    
    // Get existing transform if any
    const existingTransform = original.getAttribute('transform') || '';
    
    // Apply rotation transform around the center point
    const rotateTransform = `rotate(${angle} ${CENTER.x} ${CENTER.y})`;
    
    // Combine transforms
    const finalTransform = existingTransform 
      ? `${rotateTransform} ${existingTransform}`
      : rotateTransform;
    
    clone.setAttribute('transform', finalTransform);
    
    return clone;
  }

  /**
   * Adds a stroke to the snowflake layer with twelve-fold symmetry.
   * For each stroke:
   * 1. Creates the original path
   * 2. Creates a mirrored version
   * 3. Rotates both versions 6 times (0°, 60°, 120°, 180°, 240°, 300°)
   * Total: 12 copies (6 original + 6 mirrored)
   * 
   * @param stroke - The stroke to add
   */
  public addStroke(stroke: Stroke): void {
    const allPaths: SVGPathElement[] = [];
    
    // For each rotation angle
    for (const angle of ROTATION_ANGLES) {
      // Add the original rotated
      const rotatedOriginal = this.cloneAndRotate(stroke.pathElement, angle);
      this.snowflakeLayer.appendChild(rotatedOriginal);
      allPaths.push(rotatedOriginal);
      
      // Add the mirrored version rotated
      const mirrored = this.mirrorPath(stroke.pathElement);
      const rotatedMirror = this.cloneAndRotate(mirrored, angle);
      this.snowflakeLayer.appendChild(rotatedMirror);
      allPaths.push(rotatedMirror);
    }
    
    this.strokePaths.set(stroke.pathElement, allPaths);
  }

  /**
   * Updates an existing stroke in the snowflake layer.
   * This is called in real-time as the user draws.
   * 
   * @param stroke - The stroke to update
   */
  public updateStroke(stroke: Stroke): void {
    // Get existing paths for this stroke
    const existingPaths = this.strokePaths.get(stroke.pathElement);
    
    if (existingPaths) {
      // Remove old paths
      for (const path of existingPaths) {
        if (path.parentNode === this.snowflakeLayer) {
          this.snowflakeLayer.removeChild(path);
        }
      }
      // Don't delete from map yet, will be replaced by addStroke
    }
    
    // Add updated paths (replaces the map entry)
    this.addStroke(stroke);
  }

  /**
   * Removes a stroke from the snowflake layer.
   * 
   * @param stroke - The stroke to remove
   */
  public removeStroke(stroke: Stroke): void {
    const paths = this.strokePaths.get(stroke.pathElement);
    if (!paths) return;
    
    // Remove all copies from the DOM
    for (const path of paths) {
      if (path.parentNode === this.snowflakeLayer) {
        this.snowflakeLayer.removeChild(path);
      }
    }
    
    this.strokePaths.delete(stroke.pathElement);
  }

  /**
   * Clears all strokes from the snowflake layer.
   */
  public clearAll(): void {
    while (this.snowflakeLayer.firstChild) {
      this.snowflakeLayer.removeChild(this.snowflakeLayer.firstChild);
    }
    this.strokePaths.clear();
  }

  /**
   * Gets all paths in the snowflake layer for export.
   * Returns an array of all rotated and mirrored path elements.
   * 
   * @returns Array of all path elements with transforms applied
   */
  public getAllPaths(): SVGPathElement[] {
    const paths: SVGPathElement[] = [];
    const children = this.snowflakeLayer.children;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child instanceof SVGPathElement) {
        paths.push(child);
      }
    }
    
    return paths;
  }

  /**
   * Generates the complete snowflake geometry by applying transforms to all paths.
   * This is useful for exporting a "baked" version where transforms are applied to coordinates.
   * 
   * @returns Array of path elements with transforms applied to their coordinates
   */
  public generateBakedPaths(): SVGPathElement[] {
    const paths = this.getAllPaths();
    const bakedPaths: SVGPathElement[] = [];
    
    for (const path of paths) {
      const bakedPath = this.bakeTransform(path);
      bakedPaths.push(bakedPath);
    }
    
    return bakedPaths;
  }

  /**
   * Applies the transform attribute to the path coordinates themselves.
   * 
   * @param path - The path with a transform attribute
   * @returns A new path with the transform baked into the coordinates
   */
  private bakeTransform(path: SVGPathElement): SVGPathElement {
    const newPath = path.cloneNode(true) as SVGPathElement;
    const transform = path.getAttribute('transform');
    
    if (!transform) {
      newPath.removeAttribute('transform');
      return newPath;
    }
    
    // Parse the d attribute and apply transform
    const pathData = path.getAttribute('d');
    if (pathData) {
      const transformedData = this.transformPathData(pathData, transform);
      newPath.setAttribute('d', transformedData);
    }
    
    newPath.removeAttribute('transform');
    return newPath;
  }

  /**
   * Transforms path data coordinates by applying rotation and mirroring.
   * Parses the path commands and transforms each coordinate point.
   * SVG transforms are applied right-to-left, so we need to apply them in reverse order.
   * 
   * @param pathData - The original path data string
   * @param transform - The transform string (e.g., "rotate(60 500 500) scale(-1, 1) translate(-1000, 0)")
   * @returns Transformed path data string
   */
  private transformPathData(pathData: string, transform: string): string {
    // Parse all transformations
    const rotateMatch = transform.match(/rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/);
    const scaleMatch = transform.match(/scale\(([-\d.]+),\s*([-\d.]+)\)/);
    const translateMatch = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
    
    // Parse path data properly - match command letter followed by its coordinates
    // Support M (move), L (line), Q (quadratic), C (cubic)
    const commandRegex = /([MLQC])\s*([-\d.,\s]+)/gi;
    let transformedData = '';
    let match;
    
    while ((match = commandRegex.exec(pathData)) !== null) {
      const command = match[1].toUpperCase();
      const coordsStr = match[2];
      const coords = coordsStr.trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
      
      transformedData += command;
      
      // Transform each coordinate pair in this command
      for (let i = 0; i < coords.length; i += 2) {
        if (i + 1 >= coords.length) break;
        
        let x = coords[i];
        let y = coords[i + 1];
        
        // Apply transforms in reverse order (right-to-left in SVG)
        // 1. Apply translate first (rightmost in transform string)
        if (translateMatch) {
          x += parseFloat(translateMatch[1]);
          y += parseFloat(translateMatch[2]);
        }
        
        // 2. Apply scale (mirroring)
        if (scaleMatch) {
          const scaleX = parseFloat(scaleMatch[1]);
          const scaleY = parseFloat(scaleMatch[2]);
          x = x * scaleX;
          y = y * scaleY;
        }
        
        // 3. Apply rotation last (leftmost in transform string)
        if (rotateMatch) {
          const angle = parseFloat(rotateMatch[1]) * (Math.PI / 180);
          const cx = parseFloat(rotateMatch[2]);
          const cy = parseFloat(rotateMatch[3]);
          
          const dx = x - cx;
          const dy = y - cy;
          x = cx + dx * Math.cos(angle) - dy * Math.sin(angle);
          y = cy + dx * Math.sin(angle) + dy * Math.cos(angle);
        }
        
        // Add transformed coordinates
        if (i > 0) transformedData += ',';
        transformedData += ` ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      
      transformedData += ' ';
    }
    
    return transformedData.trim();
  }
}
