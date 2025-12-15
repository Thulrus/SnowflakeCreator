/**
 * drawing.ts
 * 
 * Handles user input for drawing strokes in the wedge area.
 * Captures pointer events and converts them into SVG path elements.
 */

import { snapToNearestSnowflakeEndpoint } from './snapping';
import { SymmetryManager } from './symmetry';

export type DrawMode = 'freehand' | 'line';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  pathElement: SVGPathElement;
}

/**
 * Checks if a point is inside the 30° wedge.
 * The wedge is defined from center (500, 500) with edges at 0° and 30°.
 * Also limits to within a 400px radius circle.
 * 
 * @param point - The point to check
 * @param center - The center of the wedge
 * @returns true if the point is inside the wedge
 */
export function isPointInWedge(point: Point, center: Point = { x: 500, y: 500 }): boolean {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  
  // Check if within radius
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > 400) return false;
  
  // Calculate angle from center (0° is up, increasing clockwise)
  let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  
  // Wedge spans from 0° to 30°
  return angle >= 0 && angle <= 30;
}

/**
 * Clips a line to the wedge boundaries.
 * If the line goes outside the wedge, returns the intersection point at the boundary.
 * 
 * @param start - Starting point (must be inside wedge)
 * @param end - Ending point (may be outside wedge)
 * @param center - The center of the wedge
 * @returns The clipped end point
 */
export function clipLineToWedge(start: Point, end: Point, center: Point = { x: 500, y: 500 }): Point {
  // If end is already inside, no clipping needed
  if (isPointInWedge(end, center)) {
    return end;
  }
  
  // Check which boundary the line crosses
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  
  let closestIntersection = end;
  let minT = Infinity;
  
  // Check intersection with radius boundary (circle at 400px)
  const a = dx * dx + dy * dy;
  const b = 2 * ((start.x - center.x) * dx + (start.y - center.y) * dy);
  const c = (start.x - center.x) ** 2 + (start.y - center.y) ** 2 - 400 * 400;
  const discriminant = b * b - 4 * a * c;
  
  if (discriminant >= 0) {
    const t = (-b + Math.sqrt(discriminant)) / (2 * a);
    if (t > 0 && t < 1 && t < minT) {
      minT = t;
      closestIntersection = {
        x: start.x + t * dx,
        y: start.y + t * dy
      };
    }
  }
  
  // Check intersection with 0° line (vertical line at x = center.x, y < center.y)
  if (dx !== 0) {
    const t = (center.x - start.x) / dx;
    if (t > 0 && t < 1 && t < minT) {
      const intersectY = start.y + t * dy;
      if (intersectY <= center.y) {
        minT = t;
        closestIntersection = {
          x: center.x,
          y: intersectY
        };
      }
    }
  }
  
  // Check intersection with 30° line
  // Line equation: passes through center with angle 30°
  // Direction: (sin(30°), -cos(30°)) = (0.5, -0.866)
  const angle30 = 30 * Math.PI / 180;
  const lineDir = { x: Math.sin(angle30), y: -Math.cos(angle30) };
  
  // Parametric line intersection
  // start + t * (end - start) = center + s * lineDir
  const det = dx * lineDir.y - dy * lineDir.x;
  if (Math.abs(det) > 0.0001) {
    const t = ((center.x - start.x) * lineDir.y - (center.y - start.y) * lineDir.x) / det;
    const s = ((center.x - start.x) * dy - (center.y - start.y) * dx) / det;
    
    if (t > 0 && t < 1 && s > 0 && t < minT) {
      minT = t;
      closestIntersection = {
        x: start.x + t * dx,
        y: start.y + t * dy
      };
    }
  }
  
  return closestIntersection;
}

/**
 * Calculates the perpendicular distance from a point to a line segment.
 * Used in the Ramer-Douglas-Peucker algorithm.
 * 
 * @param point - The point to measure
 * @param lineStart - Start of the line segment
 * @param lineEnd - End of the line segment
 * @returns The perpendicular distance
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    // Line start and end are the same point
    const distX = point.x - lineStart.x;
    const distY = point.y - lineStart.y;
    return Math.sqrt(distX * distX + distY * distY);
  }
  
  const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  const denominator = Math.sqrt(dx * dx + dy * dy);
  
  return numerator / denominator;
}

/**
 * Simplifies a path using the Ramer-Douglas-Peucker algorithm.
 * Reduces the number of points while preserving the overall shape.
 * 
 * @param points - Array of points to simplify
 * @param epsilon - Distance threshold for simplification (larger = more aggressive)
 * @returns Simplified array of points
 */
export function simplifyPath(points: Point[], epsilon: number = 2.0): Point[] {
  if (points.length <= 2) return points;
  
  // Find the point with the maximum distance from the line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const end = points.length - 1;
  
  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  
  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive call
    const leftSegment = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const rightSegment = simplifyPath(points.slice(maxIndex), epsilon);
    
    // Combine results (remove duplicate point at maxIndex)
    return leftSegment.slice(0, -1).concat(rightSegment);
  } else {
    // All points are close to the line, return just the endpoints
    return [points[0], points[end]];
  }
}

/**
 * Converts an array of points into an SVG path data string.
 * Uses Catmull-Rom splines for smoother paths with better interpolation.
 * 
 * @param points - Array of points to convert
 * @returns SVG path data string
 */
export function pointsToPathData(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    // Single point - draw a small circle
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y}`;
  }
  
  let pathData = `M ${points[0].x} ${points[0].y}`;
  
  if (points.length === 2) {
    pathData += ` L ${points[1].x} ${points[1].y}`;
    return pathData;
  }
  
  // Use Catmull-Rom splines for smooth interpolation
  // This creates a curve that passes through all points smoothly
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];
    
    // Convert Catmull-Rom to cubic Bezier
    // Control points for cubic Bezier curve
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    
    pathData += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  
  return pathData;
}

/**
 * Manages the drawing state and interactions for the wedge layer.
 */
export class DrawingManager {
  private wedgeLayer: SVGGElement;
  private svg: SVGSVGElement;
  private symmetryManager: SymmetryManager;
  private currentStroke: Point[] = [];
  private currentPath: SVGPathElement | null = null;
  private strokes: Stroke[] = [];
  private isDrawing = false;
  private strokeWidth = 2;
  private onStrokeComplete?: (stroke: Stroke) => void;
  private onStrokeUpdate?: (stroke: Stroke) => void;
  private snapIndicator: SVGCircleElement | null = null;
  private mode: DrawMode = 'freehand';
  private previewLine: SVGLineElement | null = null;

  constructor(svg: SVGSVGElement, wedgeLayer: SVGGElement, symmetryManager: SymmetryManager) {
    this.svg = svg;
    this.wedgeLayer = wedgeLayer;
    this.symmetryManager = symmetryManager;
    this.createSnapIndicator();
    this.createPreviewLine();
  }

  /**
   * Creates a visual indicator for snap points.
   */
  private createSnapIndicator(): void {
    this.snapIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.snapIndicator.setAttribute('r', '8');
    this.snapIndicator.setAttribute('fill', 'none');
    this.snapIndicator.setAttribute('stroke', '#00ff00');
    this.snapIndicator.setAttribute('stroke-width', '2');
    this.snapIndicator.setAttribute('pointer-events', 'none');
    this.snapIndicator.style.display = 'none';
    this.svg.appendChild(this.snapIndicator);
  }

  /**
   * Creates a preview line for line tool mode.
   */
  private createPreviewLine(): void {
    this.previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.previewLine.setAttribute('stroke', '#0080ff');
    this.previewLine.setAttribute('stroke-width', '2');
    this.previewLine.setAttribute('stroke-dasharray', '5,5');
    this.previewLine.setAttribute('pointer-events', 'none');
    this.previewLine.style.display = 'none';
    this.svg.appendChild(this.previewLine);
  }

  /**
   * Sets the drawing mode.
   */
  public setMode(mode: DrawMode): void {
    this.mode = mode;
    this.hidePreviewLine();
  }

  /**
   * Shows the snap indicator at a position.
   */
  private showSnapIndicator(point: Point): void {
    if (this.snapIndicator) {
      this.snapIndicator.setAttribute('cx', point.x.toString());
      this.snapIndicator.setAttribute('cy', point.y.toString());
      this.snapIndicator.style.display = 'block';
    }
  }

  /**
   * Hides the snap indicator.
   */
  private hideSnapIndicator(): void {
    if (this.snapIndicator) {
      this.snapIndicator.style.display = 'none';
    }
  }

  /**
   * Shows the preview line for line tool.
   */
  private showPreviewLine(x1: number, y1: number, x2: number, y2: number): void {
    if (this.previewLine) {
      this.previewLine.setAttribute('x1', x1.toString());
      this.previewLine.setAttribute('y1', y1.toString());
      this.previewLine.setAttribute('x2', x2.toString());
      this.previewLine.setAttribute('y2', y2.toString());
      this.previewLine.style.display = 'block';
    }
  }

  /**
   * Hides the preview line.
   */
  private hidePreviewLine(): void {
    if (this.previewLine) {
      this.previewLine.style.display = 'none';
    }
  }

  /**
   * Sets the callback to be invoked when a stroke is completed.
   */
  public onStrokeCompleted(callback: (stroke: Stroke) => void): void {
    this.onStrokeComplete = callback;
  }

  /**
   * Sets the callback to be invoked when a stroke is updated (real-time drawing).
   */
  public onStrokeUpdated(callback: (stroke: Stroke) => void): void {
    this.onStrokeUpdate = callback;
  }

  /**
   * Sets the stroke width for new strokes.
   */
  public setStrokeWidth(width: number): void {
    this.strokeWidth = width;
  }

  /**
   * Gets all completed strokes.
   */
  public getStrokes(): Stroke[] {
    return this.strokes;
  }

  /**
   * Removes the last stroke.
   */
  public undoLastStroke(): void {
    if (this.strokes.length === 0) return;
    
    const lastStroke = this.strokes.pop()!;
    this.wedgeLayer.removeChild(lastStroke.pathElement);
  }

  /**
   * Clears all strokes.
   */
  public clearAll(): void {
    this.strokes = [];
    while (this.wedgeLayer.firstChild) {
      this.wedgeLayer.removeChild(this.wedgeLayer.firstChild);
    }
  }

  /**
   * Converts screen coordinates to SVG coordinates.
   */
  private screenToSVG(screenX: number, screenY: number): Point {
    const pt = this.svg.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const transformed = pt.matrixTransform(this.svg.getScreenCTM()!.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  /**
   * Handles pointer down event to start a new stroke.
   */
  public handlePointerDown = (event: PointerEvent): void => {
    // Ignore middle mouse button (used for panning)
    if (event.button === 1) return;
    
    let point = this.screenToSVG(event.clientX, event.clientY);
    
    // Start drawing state even if outside wedge (allows drag-to-edge workflow)
    this.isDrawing = true;
    
    // If starting inside wedge, snap and begin the path
    if (isPointInWedge(point)) {
      // Snap to nearby endpoints from the full snowflake
      // The snapped point might be slightly outside the wedge, which is OK
      const snappedPoint = snapToNearestSnowflakeEndpoint(point, this.symmetryManager);
      if (snappedPoint.x !== point.x || snappedPoint.y !== point.y) {
        point = snappedPoint;
        this.showSnapIndicator(point);
        setTimeout(() => this.hideSnapIndicator(), 200);
      }
      
      this.currentStroke = [point];
      
      // Create new path element
      this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this.currentPath.setAttribute('stroke-width', this.strokeWidth.toString());
      this.currentPath.setAttribute('d', `M ${point.x} ${point.y}`);
      this.wedgeLayer.appendChild(this.currentPath);
    }
    // If starting outside wedge, wait for pointermove to enter wedge
  };

  /**
   * Handles pointer move event to continue the current stroke.
   */
  public handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDrawing) return;
    
    const point = this.screenToSVG(event.clientX, event.clientY);
    
    // Line mode: show preview even if mouse is outside (clip to boundary)
    if (this.mode === 'line' && this.currentPath) {
      const startPoint = this.currentStroke[0];
      const clippedEnd = clipLineToWedge(startPoint, point);
      this.showPreviewLine(startPoint.x, startPoint.y, clippedEnd.x, clippedEnd.y);
      return;
    }
    
    // For freehand mode or when creating initial path, need to be in wedge
    if (!isPointInWedge(point)) return;
    
    // If no path yet (started outside wedge), create it now
    if (!this.currentPath) {
      // Snap to nearby endpoints
      let startPoint = point;
      const snappedPoint = snapToNearestSnowflakeEndpoint(point, this.symmetryManager);
      if (snappedPoint.x !== point.x || snappedPoint.y !== point.y) {
        startPoint = snappedPoint;
        this.showSnapIndicator(startPoint);
        setTimeout(() => this.hideSnapIndicator(), 200);
      }
      
      this.currentStroke = [startPoint];
      this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this.currentPath.setAttribute('stroke-width', this.strokeWidth.toString());
      this.currentPath.setAttribute('d', `M ${startPoint.x} ${startPoint.y}`);
      this.wedgeLayer.appendChild(this.currentPath);
      return;
    }
    
    // Freehand mode: add points and update path
    this.currentStroke.push(point);
    
    // Update path
    const pathData = pointsToPathData(this.currentStroke);
    this.currentPath.setAttribute('d', pathData);
    
    // Notify for real-time symmetry update
    if (this.onStrokeUpdate) {
      const tempStroke: Stroke = {
        points: [...this.currentStroke],
        pathElement: this.currentPath
      };
      this.onStrokeUpdate(tempStroke);
    }
  };

  /**
   * Handles pointer up event to complete the current stroke.
   */
  public handlePointerUp = (event: PointerEvent): void => {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    this.hidePreviewLine();
    
    // If no path was created (pointer up outside wedge), just reset
    if (!this.currentPath) {
      this.currentStroke = [];
      return;
    }
    
    if (this.currentStroke.length > 0) {
      // In line mode, add the end point and create a straight line
      if (this.mode === 'line') {
        const startPoint = this.currentStroke[0];
        const currentPoint = this.screenToSVG(event.clientX, event.clientY);
        
        // Clip the line to wedge boundaries if needed
        const clippedEnd = clipLineToWedge(startPoint, currentPoint);
        
        // Snap the clipped endpoint if it's near another endpoint
        const snappedEnd = snapToNearestSnowflakeEndpoint(clippedEnd, this.symmetryManager);
        this.currentStroke.push(snappedEnd);
        
        if (snappedEnd.x !== clippedEnd.x || snappedEnd.y !== clippedEnd.y) {
          this.showSnapIndicator(snappedEnd);
          setTimeout(() => this.hideSnapIndicator(), 300);
        }
        
        // Create straight line path
        const pathData = `M ${startPoint.x} ${startPoint.y} L ${snappedEnd.x} ${snappedEnd.y}`;
        this.currentPath.setAttribute('d', pathData);
      } else {
        // Freehand mode: simplify and smooth the path, then snap the last point if possible
        // Simplify the path to reduce jaggedness
        const simplifiedPoints = simplifyPath(this.currentStroke, 2.0);
        this.currentStroke = simplifiedPoints;
        
        const lastPoint = this.currentStroke[this.currentStroke.length - 1];
        const snappedEnd = snapToNearestSnowflakeEndpoint(lastPoint, this.symmetryManager);
        
        if (snappedEnd.x !== lastPoint.x || snappedEnd.y !== lastPoint.y) {
          // Update the last point
          this.currentStroke[this.currentStroke.length - 1] = snappedEnd;
          
          // Show snap indicator briefly
          this.showSnapIndicator(snappedEnd);
          setTimeout(() => this.hideSnapIndicator(), 300);
        }
        
        // Update the path data with simplified and smoothed curve
        const pathData = pointsToPathData(this.currentStroke);
        this.currentPath.setAttribute('d', pathData);
      }
      
      const stroke: Stroke = {
        points: [...this.currentStroke],
        pathElement: this.currentPath
      };
      
      this.strokes.push(stroke);
      
      if (this.onStrokeComplete) {
        this.onStrokeComplete(stroke);
      }
    }
    
    this.currentStroke = [];
    this.currentPath = null;
  };

  /**
   * Enables drawing mode by attaching event listeners.
   */
  public enable(): void {
    this.svg.addEventListener('pointerdown', this.handlePointerDown);
    this.svg.addEventListener('pointermove', this.handlePointerMove);
    this.svg.addEventListener('pointerup', this.handlePointerUp);
    this.svg.addEventListener('pointerleave', this.handlePointerUp);
  }

  /**
   * Disables drawing mode by removing event listeners.
   */
  public disable(): void {
    this.svg.removeEventListener('pointerdown', this.handlePointerDown);
    this.svg.removeEventListener('pointermove', this.handlePointerMove);
    this.svg.removeEventListener('pointerup', this.handlePointerUp);
    this.svg.removeEventListener('pointerleave', this.handlePointerUp);
  }
}
