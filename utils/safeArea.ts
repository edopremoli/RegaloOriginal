
import { AspectRatioVal, SafeArea } from "../types";

/**
 * Calculates the safe area rectangle within a square master canvas based on a target aspect ratio.
 * This ensures the main composition fits within a region that can be cropped later without losing important content.
 * @param aspectRatio The target aspect ratio ('3:2', '4:5', etc.).
 * @param customRatio The custom aspect ratio value if aspectRatio is 'Custom'.
 * @param S The size of the square master canvas (e.g., 1536px).
 * @param marginPct The percentage of the master size to use as a margin inside the safe area.
 * @returns A SafeArea object with dimensions and normalized coordinates.
 */
export function safeAreaForAspect(aspectRatio: AspectRatioVal, customRatio: number, S: number, marginPct = 0.08): SafeArea { // Increased default margin
    const side = 1; // normalize to 1 for calculations
    
    let r: number;
    switch (aspectRatio) {
        case '16:9':
            r = 16 / 9;
            break;
        case '9:16':
            r = 9 / 16;
            break;
        case '4:3':
            r = 4 / 3;
            break;
        case '3:4':
            r = 3 / 4;
            break;
        case 'Custom':
            r = customRatio;
            break;
        case '1:1':
        default:
            r = 1;
            break;
    }
  
    let w_norm = side, h_norm = side;
    // This logic calculates the largest rectangle with aspect ratio `r` that fits into a 1x1 square.
    if (r >= 1) { // horizontal or square
      w_norm = side;
      h_norm = w_norm / r;
    } else { // vertical
      h_norm = side;
      w_norm = h_norm * r;
    }
    
    const insetX = (side - w_norm) / 2 + marginPct * side;
    const insetY = (side - h_norm) / 2 + marginPct * side;
    
    const normRect = { x: insetX, y: insetY, w: side - 2 * insetX, h: side - 2 * insetY };
  
    return {
      S,
      safeW: Math.floor(normRect.w * S),
      safeH: Math.floor(normRect.h * S),
      cx: Math.floor(S / 2),
      cy: Math.floor(S / 2),
      margin: 1 - (marginPct * 2),
      normRect,
    };
}

/**
 * Calculates the percentage of a bounding box `b` that is inside a safe area `sa`.
 * @param b The normalized bounding box of the product.
 * @param sa The normalized safe area rectangle.
 * @returns The coverage ratio (0 to 1).
 */
export function coverageInSafeArea(b:{x:number,y:number,w:number,h:number}, sa:{x:number,y:number,w:number,h:number}){
  const ix = Math.max(0, Math.min(b.x+b.w, sa.x+sa.w) - Math.max(b.x, sa.x));
  const iy = Math.max(0, Math.min(b.y+b.h, sa.y+sa.h) - Math.max(b.y, sa.y));
  const inter = ix*iy;
  // Add a small epsilon to avoid division by zero for zero-area boxes.
  return inter / (b.w*b.h + 1e-9);
}
