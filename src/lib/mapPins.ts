import L from "leaflet";

/**
 * Map pins for the guessing games: an orange pin for your guess, a green one for the
 * real spot. They drop in with a small bounce (see .map-pin in index.css), and they
 * don't depend on Leaflet's default marker images from a CDN.
 */
export function pinIcon(kind: "guess" | "answer" | "past", label?: string | number) {
  // A numbered past pin (your 1st, 2nd guess…) is a bit bigger so the number reads
  const size = kind === "past" ? (label != null ? 20 : 14) : 22;
  return L.divIcon({
    className: "map-pin-wrap",
    html:
      label != null
        ? `<span class="map-pin map-pin--${kind} map-pin--numbered" style="display:flex;align-items:center;justify-content:center;font:700 10px/1 system-ui,sans-serif;color:#7c2d12">${label}</span>`
        : `<span class="map-pin map-pin--${kind}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
