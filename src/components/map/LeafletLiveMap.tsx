"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap, ZoomControl } from "react-leaflet";
import {
  HIGHLIGHT_COLOR, ITALY_CENTER, ROUTE_COLOR, stopMarkerHtml, vehicleMarkerHtml, withPosition,
  type Focus, type LiveMapProps, type RouteOverlay,
} from "./shared";

const OSM = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

/**
 * Spostamenti senza animazione: se la pagina cambia mentre un'animazione di Leaflet è in corso,
 * l'animazione continua su una mappa già rimossa e l'app va in errore ("_leaflet_pos").
 */
const NO_ANIM = { animate: false } as const;

/*
 * Difetto noto di Leaflet: la fine di un'animazione di zoom (es. rotellina del mouse) arriva con un
 * timer anche se la mappa è già stata rimossa, e legge la posizione di un pannello che non esiste più.
 * Qui la lettura diventa innocua quando la mappa non c'è più.
 */
type MapInternals = { _mapPane?: HTMLElement; _getMapPanePos: () => L.Point };
const proto = L.Map.prototype as unknown as MapInternals;
if (!(proto as { __growfleetPatched?: boolean }).__growfleetPatched) {
  const original = proto._getMapPanePos;
  proto._getMapPanePos = function (this: MapInternals) {
    return this._mapPane ? original.call(this) : new L.Point(0, 0);
  };
  (proto as { __growfleetPatched?: boolean }).__growfleetPatched = true;
}

const htmlIcon = (html: string) => L.divIcon({ html, className: "vehicle-icon", iconSize: [0, 0], iconAnchor: [0, 0] });

function Controller({ all, route, focus, selected, fitAllKey }: {
  all: [number, number][]; route: RouteOverlay | null; focus: Focus | null;
  selected: [number, number] | null; fitAllKey: number;
}) {
  const map = useMap();
  const fitted = useRef(false);
  const lastFit = useRef(-1);
  const lastRoute = useRef("");
  const lastFocus = useRef("");
  const lastSel = useRef("");

  // primo caricamento e "Mostra tutti"
  useEffect(() => {
    if (all.length === 0) return;
    if (fitted.current && lastFit.current === fitAllKey) return;
    fitted.current = true;
    lastFit.current = fitAllKey;
    if (all.length === 1) map.setView(all[0], 14, NO_ANIM);
    else map.fitBounds(L.latLngBounds(all), { padding: [48, 48], maxZoom: 15, ...NO_ANIM });
  }, [map, all, fitAllKey]);

  // percorso o tratto evidenziato
  useEffect(() => {
    if (!route || route.points.length === 0) { lastRoute.current = ""; return; }
    const hk = `${route.key}:${route.highlight?.join("-") ?? ""}`;
    if (hk === lastRoute.current) return;
    lastRoute.current = hk;
    const pts = route.highlight ? route.points.slice(route.highlight[0], route.highlight[1] + 1) : route.points;
    if (pts.length === 1) map.setView([pts[0].lat, pts[0].lon], 15, NO_ANIM);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lon])), { padding: [40, 40], ...NO_ANIM });
  }, [map, route]);

  // ricerca indirizzo o sosta selezionata
  useEffect(() => {
    if (!focus || focus.key === lastFocus.current) return;
    lastFocus.current = focus.key;
    map.setView([focus.lat, focus.lon], focus.zoom ?? 16, NO_ANIM);
  }, [map, focus]);

  // veicolo selezionato (solo senza percorso a schermo)
  const selKey = selected ? selected.join(",") : "";
  useEffect(() => {
    if (!selected || route) { if (!selected) lastSel.current = ""; return; }
    const first = lastSel.current === "";
    if (selKey === lastSel.current) return;
    lastSel.current = selKey;
    if (first) map.setView(selected, Math.max(map.getZoom(), 15), NO_ANIM);
    else map.panTo(selected, NO_ANIM);
  }, [map, selected, selKey, route]);
  return null;
}

export function LeafletLiveMap({ vehicles, selectedId, onSelect, route, focus, fitAllKey }: LiveMapProps) {
  const located = withPosition(vehicles);
  const all = useMemo(() => located.map((v) => [v.lat, v.lon] as [number, number]), [located]);
  const sel = located.find((v) => v.id === selectedId);
  const line = useMemo(() => route?.points.map((p) => [p.lat, p.lon] as [number, number]) ?? [], [route]);
  const hl = route?.highlight ? line.slice(route.highlight[0], route.highlight[1] + 1) : null;

  return (
    <MapContainer center={ITALY_CENTER} zoom={6} className="h-full w-full" zoomControl={false}>
      <TileLayer {...OSM} />
      <ZoomControl position="topleft" />
      <Controller all={all} route={route} focus={focus} selected={sel ? [sel.lat, sel.lon] : null} fitAllKey={fitAllKey} />
      {line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ color: "#fff", weight: 7, opacity: 0.9 }} />
          <Polyline positions={line} pathOptions={{ color: ROUTE_COLOR, weight: 4, dashArray: hl ? "6 6" : undefined, opacity: hl ? 0.6 : 1 }} />
        </>
      )}
      {hl && hl.length > 1 && <Polyline positions={hl} pathOptions={{ color: HIGHLIGHT_COLOR, weight: 6 }} />}
      {route?.stops.map((s) => (
        <Marker key={`s${s.n}`} position={[s.lat, s.lon]} icon={htmlIcon(stopMarkerHtml(s.n))} zIndexOffset={500} />
      ))}
      {located.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lon]} icon={htmlIcon(vehicleMarkerHtml(v, v.id === selectedId))}
          zIndexOffset={v.id === selectedId ? 1000 : 0} eventHandlers={{ click: () => onSelect(v.id) }} title={v.name} />
      ))}
    </MapContainer>
  );
}
