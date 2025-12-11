/**
 * snapping.ts
 * 
 * Handles automatic snapping of path endpoints when they are close together.
 * This helps create continuous paths for laser cutting.
 */

import { Point, Stroke } from './drawing';
import { SymmetryManager } from './symmetry';

const SNAP_THRESHOLD = 20; // pixels - distance within which points will snap (increased for easier snapping)

/**
 * Gets the start and end points of a stroke.
 */
function getStrokeEndpoints(stroke: Stroke): { start: Point; end: Point } | null {
  if (stroke.points.length === 0) return null;
  return {
    start: stroke.points[0],
    end: stroke.points[stroke.points.length - 1]
  };
}

/**
 * Calculates the distance between two points.
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Finds the nearest endpoint from existing strokes to a given point.
 */
export function findNearestEndpoint(
  point: Point,
  existingStrokes: Stroke[],
  excludeStroke?: Stroke
): { point: Point; distance: number } | null {
  let nearest: { point: Point; distance: number } | null = null;

  for (const stroke of existingStrokes) {
    if (excludeStroke && stroke === excludeStroke) continue;
    
    const endpoints = getStrokeEndpoints(stroke);
    if (!endpoints) continue;

    const distToStart = distance(point, endpoints.start);
    const distToEnd = distance(point, endpoints.end);

    if (distToStart < SNAP_THRESHOLD) {
      if (!nearest || distToStart < nearest.distance) {
        nearest = { point: endpoints.start, distance: distToStart };
      }
    }

    if (distToEnd < SNAP_THRESHOLD) {
      if (!nearest || distToEnd < nearest.distance) {
        nearest = { point: endpoints.end, distance: distToEnd };
      }
    }
  }

  return nearest;
}

/**
 * Snaps a point to the nearest endpoint if within threshold.
 */
export function snapToNearestEndpoint(
  point: Point,
  existingStrokes: Stroke[],
  excludeStroke?: Stroke
): Point {
  const nearest = findNearestEndpoint(point, existingStrokes, excludeStroke);
  
  if (nearest && nearest.distance < SNAP_THRESHOLD) {
    return nearest.point;
  }
  
  return point;
}

/**
 * Snaps a point to the nearest endpoint from the full snowflake (including all symmetries).
 * This is the preferred method as it snaps to all visible paths, not just the wedge.
 */
export function snapToNearestSnowflakeEndpoint(
  point: Point,
  symmetryManager: SymmetryManager
): Point {
  const allEndpoints = symmetryManager.getAllBakedEndpoints();
  let nearest: { point: Point; distance: number } | null = null;
  
  for (const endpoint of allEndpoints) {
    const dist = distance(point, endpoint);
    
    if (dist < SNAP_THRESHOLD) {
      if (!nearest || dist < nearest.distance) {
        nearest = { point: endpoint, distance: dist };
      }
    }
  }
  
  if (nearest) {
    return nearest.point;
  }
  
  return point;
}

/**
 * Checks if a point is near any endpoint.
 */
export function isNearEndpoint(
  point: Point,
  existingStrokes: Stroke[],
  excludeStroke?: Stroke
): boolean {
  const nearest = findNearestEndpoint(point, existingStrokes, excludeStroke);
  return nearest !== null;
}

/**
 * Gets the snap threshold distance.
 */
export function getSnapThreshold(): number {
  return SNAP_THRESHOLD;
}
