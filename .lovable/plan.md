
## Fix: Long Positive Messages Should Wrap, Not Truncate

### Problem
The message `<p>` tag on line 63 of `Dashboard.tsx` has the `truncate` class applied. This means if the message + signature text is wider than the available space (logo on left, Play button on right), it silently cuts off with `…`. Users on smaller screens or with long messages could miss part of the content.

### Solution
Remove `truncate` and instead allow the text to wrap naturally to a second line. To keep it readable and prevent it from growing uncontrollably tall (which could push the main grid down), cap it at 2 lines using `line-clamp-2`.

- `truncate` → single line, cuts with `…`
- `line-clamp-2` → up to 2 lines, then cuts with `…` (much better for a TV banner)

This is a Tailwind utility (`line-clamp-2`) that combines `overflow-hidden`, `display: -webkit-box`, `-webkit-line-clamp: 2`, and `-webkit-box-orient: vertical` — fully supported in modern browsers used on TVs.

### Files to Change

**`src/pages/Dashboard.tsx` — line 63 only**

Change:
```tsx
<p className="text-[clamp(14px,1.3vw,28px)] font-medium leading-snug truncate">
```

To:
```tsx
<p className="text-[clamp(14px,1.3vw,28px)] font-medium leading-snug line-clamp-2">
```

That single class swap is the entire change needed. Everything else (flex layout, `min-w-0`, centering) stays the same.

### Technical Notes
- `min-w-0` on the parent `div` (line 62) already prevents the text area from overflowing the flex container — that stays.
- `line-clamp-2` is supported in Tailwind CSS v3+ without any plugin, which this project uses.
- The header height will only grow if there are actually 2 lines of text, and will stay single-line height for short messages (the common case).
