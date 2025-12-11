/**
 * drawing.ts
 * 
 * Handles user input for drawing strokes in the wedge area.
 * Captures pointer events and converts them into SVG path elements.
 */

import { snapToNearestSnowflakeEndpoint } from './snapping';
import { SymmetryManager } from './symmetry';

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
 * 
 * @param point - The point to check
 * @param center - The center of the wedge
 * @returns true if the point is inside the wedge
 */
export function isPointInWedge(point: Point, center: Point = { x: 500, y: 500 }): boolean {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  
  // Calculate angle from center (0° is up, increasing clockwise)
  let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  
  // Wedge spans from 0° to 30°
  return angle >= 0 && angle <= 30;
}

/**
 * Converts an array of points into an SVG path data string.
 * Uses quadratic curves for smoother paths with proper control point calculation.
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
  
  // Use quadratic curves with proper smoothing
  // First segment: line to first point
  pathData += ` L ${points[1].x} ${points[1].y}`;
  
  // Middle segments: use quadratic curves with the current point as control
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    // Calculate a smooth control point
    // Use the current point but smooth it based on neighbors
    const controlX = p1.x;
    const controlY = p1.y;
    
    // Endpoint is midway to next point for smooth connection
    const endX = (p1.x + p2.x) / 2;
    const endY = (p1.y + p2.y) / 2;
    
    pathData += ` Q ${controlX} ${controlY} ${endX} ${endY}`;
  }
  
  // Last segment: line to the final point
  const lastPoint = points[points.length - 1];
  pathData += ` L ${lastPoint.x} ${lastPoint.y}`;
  
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

  constructor(svg: SVGSVGElement, wedgeLayer: SVGGElement, symmetryManager: SymmetryManager) {
    this.svg = svg;
    this.wedgeLayer = wedgeLayer;
    this.symmetryManager = symmetryManager;
    this.createSnapIndicator();
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
    let point = this.screenToSVG(event.clientX, event.clientY);
    
    if (!isPointInWedge(point)) return;
    
    // Snap to nearby endpoints from the full snowflake
    const snappedPoint = snapToNearestSnowflakeEndpoint(point, this.symmetryManager);
    if (snappedPoint.x !== point.x || snappedPoint.y !== point.y) {
      point = snappedPoint;
      this.showSnapIndicator(point);
      setTimeout(() => this.hideSnapIndicator(), 200);
    }
    
    this.isDrawing = true;
    this.currentStroke = [point];
    
    // Create new path element
    this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.currentPath.setAttribute('stroke-width', this.strokeWidth.toString());
    this.currentPath.setAttribute('d', `M ${point.x} ${point.y}`);
    this.wedgeLayer.appendChild(this.currentPath);
  };

  /**
   * Handles pointer move event to continue the current stroke.
   */
  public handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDrawing || !this.currentPath) return;
    
    const point = this.screenToSVG(event.clientX, event.clientY);
    
    if (!isPointInWedge(point)) return;
    
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
  public handlePointerUp = (): void => {
    if (!this.isDrawing || !this.currentPath) return;
    
    this.isDrawing = false;
    
    if (this.currentStroke.length > 0) {
      // Snap the last point to nearby endpoints from the full snowflake
      const lastPoint = this.currentStroke[this.currentStroke.length - 1];
      const snappedEnd = snapToNearestSnowflakeEndpoint(lastPoint, this.symmetryManager);
      
      if (snappedEnd.x !== lastPoint.x || snappedEnd.y !== lastPoint.y) {
        // Update the last point
        this.currentStroke[this.currentStroke.length - 1] = snappedEnd;
        
        // Update the path data
        const pathData = pointsToPathData(this.currentStroke);
        this.currentPath.setAttribute('d', pathData);
        
        // Show snap indicator briefly
        this.showSnapIndicator(snappedEnd);
        setTimeout(() => this.hideSnapIndicator(), 300);
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
