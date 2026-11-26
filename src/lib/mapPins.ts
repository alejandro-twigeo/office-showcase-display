import L from "leaflet";

/**
 * Map pins for the guessing games: an orange pin for your guess, a green one for the
 * real spot. They drop in with a small bounce (see .map-pin in index.css), and they
 * don't depend on Leaflet's default marker images from a CDN.
 */
export function pinIcon(kind: "guess" | "answer" | "past") {
  const size = kind === "past" ? 14 : 22;
  return L.divIcon({
    className: "map-pin-wrap",
    html: `<span class="map-pin map-pin--${kind}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
