"use client";

import { useEffect, useMemo, useRef } from "react";
import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { courseAt, ITALY_CENTER, TRACK_COLOR, vehicleSvg, withPosition, type FleetMapProps, type TrackMapProps } from "./shared";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";
const center = { lat: ITALY_CENTER[0], lng: ITALY_CENTER[1] };

function Svg({ html }: { html: string }) {
  return <div style={{ transform: "translateY(50%)", cursor: "pointer" }} dangerouslySetInnerHTML={{ __html: html }} />;
}

function FitOnce({ points }: { points: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!map || done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) { map.setCenter(points[0]); map.setZoom(14); return; }
    const b = new google.maps.LatLngBounds();
    points.forEach((p) => b.extend(p));
    map.fitBounds(b, 48);
  }, [map, points]);
  return null;
}

function Follow({ pos }: { pos: google.maps.LatLngLiteral | null }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (!map || !pos) return;
    map.panTo(pos);
    if (first.current) { first.current = false; if ((map.getZoom() ?? 0) < 14) map.setZoom(14); }
  }, [map, pos?.lat, pos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function GoogleFleetMap({ vehicles, selectedId, onSelect }: FleetMapProps) {
  const located = withPosition(vehicles);
  const pts = useMemo(() => located.map((v) => ({ lat: v.lat, lng: v.lon })), [located]);
  const sel = located.find((v) => v.id === selectedId);
  return (
    <APIProvider apiKey={KEY} language="it" region="IT">
      <Map defaultCenter={center} defaultZoom={6} mapId={MAP_ID} gestureHandling="greedy"
        disableDefaultUI={false} streetViewControl={false} className="h-full w-full">
        <FitOnce points={pts} />
        <Follow key={selectedId ?? "none"} pos={sel ? { lat: sel.lat, lng: sel.lon } : null} />
        {located.map((v) => (
          <AdvancedMarker key={v.id} position={{ lat: v.lat, lng: v.lon }} title={v.name}
            zIndex={v.id === selectedId ? 1000 : undefined} onClick={() => onSelect(v.id)}>
            <Svg html={vehicleSvg(v, v.id === selectedId)} />
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  );
}

function TrackLine({ path }: { path: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || path.length < 2) return;
    const casing = new google.maps.Polyline({ path, strokeColor: "#fff", strokeWeight: 8, strokeOpacity: 0.9, map });
    const line = new google.maps.Polyline({ path, strokeColor: TRACK_COLOR, strokeWeight: 4, map });
    const b = new google.maps.LatLngBounds();
    path.forEach((p) => b.extend(p));
    map.fitBounds(b, 40);
    return () => { casing.setMap(null); line.setMap(null); };
  }, [map, path]);
  return null;
}

function Dot({ color }: { color: string }) {
  return <div style={{ width: 16, height: 16, borderRadius: 8, background: color, border: "3px solid #fff", transform: "translateY(50%)", boxShadow: "0 0 0 1px rgba(24,33,43,.25)" }} />;
}

export function GoogleTrackMap({ points, cursor }: TrackMapProps) {
  const path = useMemo(() => points.map((p) => ({ lat: p.lat, lng: p.lon })), [points]);
  const cur = cursor != null ? points[cursor] : null;
  return (
    <APIProvider apiKey={KEY} language="it" region="IT">
      <Map defaultCenter={center} defaultZoom={6} mapId={MAP_ID} gestureHandling="greedy" streetViewControl={false} className="h-full w-full">
        <TrackLine path={path} />
        {path.length > 1 && (
          <>
            <AdvancedMarker position={path[0]} title="Partenza"><Dot color="#0a7a45" /></AdvancedMarker>
            <AdvancedMarker position={path[path.length - 1]} title="Arrivo"><Dot color="#b3261e" /></AdvancedMarker>
          </>
        )}
        {cur && (
          <AdvancedMarker position={{ lat: cur.lat, lng: cur.lon }} zIndex={1000}>
            <Svg html={vehicleSvg({ status: (cur.speed ?? 0) > 3 ? "moving" : cur.ignition ? "idle" : "stopped", course: courseAt(points, cursor!) }, true)} />
          </AdvancedMarker>
        )}
      </Map>
    </APIProvider>
  );
}
