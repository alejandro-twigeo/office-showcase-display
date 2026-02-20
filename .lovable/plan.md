
## Root Cause (Confirmed)

The chain from the grid down to the iframe:

```text
grid row (55fr) 
  └─ div.min-h-0.overflow-hidden          ← no h-full → collapses on large TVs
       └─ Card.h-full.flex-col
            └─ CardContent.flex-1.min-h-0.flex-col   ← p-6 pt-0 (adds padding)
                 └─ div.flex-1.min-h-0               ← the video wrapper
                      └─ div[containerRef].flex-1.min-h-0   ← the YT container
                           └─ iframe height="100%"   ← 100% of 0 = invisible
```

The `min-h-0` at each level allows the flex children to shrink to zero. On a laptop the viewport is smaller so concrete pixel heights bleed through naturally. On a large TV (1080p/4K) the flex tree expands freely and `height: "100%"` on the iframe resolves to 0. Audio still plays because the iframe document loads fully — only the visible canvas collapses.

## Fix

Two targeted changes, both in `src/components/dashboard/YouTubeDisplay.tsx`:

**1. Make the container relatively positioned and use absolute positioning for the player**

Replace the `flex-1 min-h-0` sizing strategy for the container with a `relative` wrapper that has a known size, and position the player absolutely inside it:

```tsx
{/* outer div stays flex-1 to take available space */}
<div className="flex-1 min-h-0 relative">
  <div
    ref={containerRef}
    className="absolute inset-0 bg-secondary rounded-lg overflow-hidden"
  />
</div>
```

This guarantees the iframe container always has a concrete bounding box (`inset-0` means top/left/right/bottom = 0 relative to the positioned parent). The `flex-1 min-h-0` parent still participates in the flex layout to claim space, but the actual container that the YT player lives in is anchored absolutely.

**2. Pass pixel dimensions to YT.Player (not percentage strings)**

Read the container's actual pixel size right before creating the player, and pass those numbers. Also extend the type to include `setSize`:

```typescript
type YTPlayer = {
  loadVideoById: (videoId: string) => void;
  setSize: (width: number, height: number) => void;
  destroy: () => void;
};

// inside initPlayer:
const w = containerRef.current.offsetWidth || 1280;
const h = containerRef.current.offsetHeight || 720;

playerRef.current = new window.YT.Player(div, {
  width: w,
  height: h,
  ...
});
```

**3. Add a ResizeObserver to keep the player sized correctly**

When the window or layout changes (e.g. sidebar opens, font-size scaling kicks in), call `setSize()` on the existing player:

```typescript
useEffect(() => {
  if (!containerRef.current) return;
  const observer = new ResizeObserver(() => {
    if (!containerRef.current || !playerRef.current) return;
    const { offsetWidth: w, offsetHeight: h } = containerRef.current;
    playerRef.current.setSize(w, h);
  });
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, []);
```

**4. Fix the wrapper in Dashboard.tsx**

The immediate wrapper of `<YouTubeDisplay />` is missing `h-full`, so the Card's `h-full` has nothing to fill:

```tsx
{/* Before */}
<div className="min-h-0 overflow-hidden rounded-xl">

{/* After */}
<div className="min-h-0 h-full overflow-hidden rounded-xl">
```

## Files to Change

- `src/components/dashboard/YouTubeDisplay.tsx` — container layout + pixel dimensions + ResizeObserver
- `src/pages/Dashboard.tsx` — add `h-full` to the YouTube wrapper div
