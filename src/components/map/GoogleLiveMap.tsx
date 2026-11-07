"use client";

import { useEffect, useMemo, useRef } from "react";
import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import {
  HIGHLIGHT_COLOR, ITALY_CENTER, pinHtml, ROUTE_COLOR, stopMarkerHtml, vehicleMarkerHtml, withPosition,
  type Focus, type LiveMapProps, type RouteOverlay,
} from "./shared";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";
const center = { lat: ITALY_CENTER[0], lng: ITALY_CENTER[1] };
type LL = google.maps.LatLngLiteral;

function Html({ html }: { html: string }) {
  // contenitore 0x0: l'ancora del marker coincide con la posizione, come in Leaflet
  return (
    <div style={{ width: 0, height: 0, position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0 }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function bounds(pts: LL[]) {
  const b = new google.maps.LatLngBounds();
  pts.forEach((p) => b.extend(p));
  return b;
}

function Controller({ all, route, focus, selected, fitAllKey }: {
  all: LL[]; route: RouteOverlay | null; focus: Focus | null; selected: LL | null; fitAllKey: number;
}) {
  const map = useMap();
  const fitted = useRef(false), lastFit = useRef(-1), lastRoute = useRef(""), lastFocus = useRef(""), lastSel = useRef("");

  useEffect(() => {
    if (!map || all.length === 0) return;
    if (fitted.current && lastFit.current === fitAllKey) return;
    fitted.current = true; lastFit.current = fitAllKey;
    if (all.length === 1) { map.setCenter(all[0]); map.setZoom(14); } else map.fitBounds(bounds(all), 48);
  }, [map, all, fitAllKey]);

  useEffect(() => {
    if (!map || !route || route.points.length === 0) { lastRoute.current = ""; return; }
    const hk = `${route.key}:${route.highlight?.join("-") ?? ""}`;
    if (hk === lastRoute.current) return;
    lastRoute.current = hk;
    const pts = (route.highlight ? route.points.slice(route.highlight[0], route.highlight[1] + 1) : route.points)
      .map((p) => ({ lat: p.lat, lng: p.lon }));
    if (pts.length === 1) { map.setCenter(pts[0]); map.setZoom(15); } else if (pts.length > 1) map.fitBounds(bounds(pts), 40);
  }, [map, route]);

  useEffect(() => {
    if (!map || !focus || focus.key === lastFocus.current) return;
    lastFocus.current = focus.key;
    map.panTo({ lat: focus.lat, lng: focus.lon });
    map.setZoom(focus.zoom ?? 16);
  }, [map, focus]);

  useEffect(() => {
    if (!map || !selected || route) { if (!selected) lastSel.current = ""; return; }
    const k = `${selected.lat},${selected.lng}`;
    if (k === lastSel.current) return;
    const first = lastSel.current === "";
    lastSel.current = k;
    map.panTo(selected);
    if (first && (map.getZoom() ?? 0) < 15) map.setZoom(15);
  }, [map, selected?.lat, selected?.lng, route]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Lines({ route }: { route: RouteOverlay | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !route || route.points.length < 2) return;
    const path = route.points.map((p) => ({ lat: p.lat, lng: p.lon }));
    const hl = route.highlight ? path.slice(route.highlight[0], route.highlight[1] + 1) : null;
    const objs = [
      new google.maps.Polyline({ path, strokeColor: "#fff", strokeWeight: 7, strokeOpacity: 0.9, map }),
      new google.maps.Polyline({ path, strokeColor: ROUTE_COLOR, strokeWeight: 4, strokeOpacity: hl ? 0.5 : 1, map }),
    ];
    if (hl && hl.length > 1) objs.push(
      new google.maps.Polyline({ path: hl, strokeColor: "#fff", strokeWeight: 9, strokeOpacity: 0.95, map }),
      new google.maps.Polyline({ path: hl, strokeColor: HIGHLIGHT_COLOR, strokeWeight: 6, map }),
    );
    return () => objs.forEach((o) => o.setMap(null));
  }, [map, route]);
  return null;
}

export function GoogleLiveMap({ vehicles, selectedId, onSelect, route, focus, fitAllKey, pin }: LiveMapProps) {
  const located = withPosition(vehicles);
  const all = useMemo(() => located.map((v) => ({ lat: v.lat, lng: v.lon })), [located]);
  const sel = located.find((v) => v.id === selectedId);
  return (
    <APIProvider apiKey={KEY} language="it" region="IT">
      <Map defaultCenter={center} defaultZoom={6} mapId={MAP_ID} gestureHandling="greedy" streetViewControl
        mapTypeControl={false} fullscreenControl={false} className="h-full w-full">
        <Controller all={all} route={route} focus={focus} selected={sel ? { lat: sel.lat, lng: sel.lon } : null} fitAllKey={fitAllKey} />
        <Lines route={route} />
        {pin && <AdvancedMarker position={{ lat: pin.lat, lng: pin.lon }} zIndex={1500}><Html html={pinHtml(pin.label)} /></AdvancedMarker>}
        {route?.stops.map((s) => (
          <AdvancedMarker key={`s${s.n}`} position={{ lat: s.lat, lng: s.lon }} zIndex={500}><Html html={stopMarkerHtml(s.n)} /></AdvancedMarker>
        ))}
        {located.map((v) => (
          <AdvancedMarker key={v.id} position={{ lat: v.lat, lng: v.lon }}
            zIndex={v.id === selectedId ? 1000 : undefined} onClick={() => onSelect(v.id)}>
            <Html html={vehicleMarkerHtml(v, v.id === selectedId)} />
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  );
}
