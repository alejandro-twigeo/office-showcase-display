
# Fix Mystery Image Cropping + Enable Panning at All Zoom Levels

## Problem
The `ZoomableImage` component uses `object-cover` on the image, which crops/cuts parts of the image to fill the container. Users can only pan when zoomed in (`scale > 1`), so at default zoom they can't see the hidden parts.

## Solution
Two changes to the `ZoomableImage` component in `src/components/play/GuessMap.tsx`:

1. **Change `object-cover` to `object-contain`** -- This ensures the full image is always visible without cropping. The image will fit entirely within the container (with letterboxing if needed).

2. **Allow panning at all zoom levels** -- Remove the `if (scale <= 1) return;` guard in `handlePointerDown`, so users can drag/pan the image even at 1x zoom. This lets them explore the image freely. Also remove the auto-reset of translate when scale is 1.

3. **Update cursor** -- Show grab cursor at all times (not just when zoomed in) to signal the image is draggable.

## Technical Details

**File: `src/components/play/GuessMap.tsx`**

- Line 98: Remove the `useEffect` that resets translate when `scale === 1`
- Line 100-101: Remove the `if (scale <= 1) return;` guard in `handlePointerDown`
- Line 125: Change cursor logic from `scale > 1 ? ... : 'default'` to always show grab/grabbing
- Line 132: Change `object-cover` to `object-contain`
