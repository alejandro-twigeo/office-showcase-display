
## Root Cause

The YouTube IFrame API works by replacing the placeholder `<div>` appended inside `containerRef` with a `<iframe>` element. The CSS fix applied was `[&>iframe]:w-full [&>iframe]:h-full`, but this Tailwind child selector targets a **direct `<iframe>` child** of the container. Since the API first wraps the iframe inside another `<div>` (the one we created), the selector doesn't match, so the iframe gets no width/height and renders as a blank white box.

Audio works because it's processed separately, explaining why sound plays but nothing is visible.

The reason this only breaks on large TVs is that on smaller screens other layout constraints happen to give the container a fixed pixel size that bleeds into the iframe, but on large TVs the flex container expands freely, leaving the unsized iframe completely invisible.

## Fix

Two changes to `src/components/dashboard/YouTubeDisplay.tsx`:

1. **Set explicit `width` and `height` on the `YT.Player` constructor** so the API creates the iframe at 100%/100% from the start:
   ```typescript
   playerRef.current = new window.YT.Player(div, {
     width: "100%",
     height: "100%",
     videoId,
     ...
   });
   ```

2. **Style the inner placeholder div** before passing it to the API, so it fills its parent:
   ```typescript
   const div = document.createElement("div");
   div.style.width = "100%";
   div.style.height = "100%";
   ```

3. **Update the container CSS** to also catch the inner wrapper div the API inserts:
   - Change `[&>iframe]:w-full [&>iframe]:h-full` to `[&>*]:w-full [&>*]:h-full` to catch both the wrapper div and the iframe inside it.
   - Also ensure the container itself gets an explicit height via `h-full` (it currently uses `flex-1 min-h-0` which is correct but needs the children to inherit height properly).

## Files to Change

- `src/components/dashboard/YouTubeDisplay.tsx` — Only this file needs to change:
  - Pass `width: "100%"` and `height: "100%"` to the `YT.Player` constructor
  - Set `style.width = "100%"` and `style.height = "100%"` on the placeholder div before appending
  - Update the container's child selector from `[&>iframe]` to `[&>*]` and add `[&>div>iframe]:w-full [&>div>iframe]:h-full` to cover the nested iframe
