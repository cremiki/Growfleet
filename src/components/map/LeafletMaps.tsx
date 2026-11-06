"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";
import { courseAt, ITALY_CENTER, TRACK_COLOR, vehicleSvg, withPosition, type FleetMapProps, type TrackMapProps } from "./shared";

const OSM = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

function icon(svg: string, selected: boolean) {
  const s = selected ? 38 : 28;
  return L.divIcon({ html: svg, className: "vehicle-icon", iconSize: [s, s], iconAnchor: [s / 2, s / 2] });
}

function FitOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
  }, [map, points]);
  return null;
}

function FollowSelected({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  const key = pos ? `${pos[0].toFixed(5)},${pos[1].toFixed(5)}` : "";
  const last = useRef<string>("");
  useEffect(() => {
    if (!pos || key === last.current) return;
    const first = last.current === "";
    last.current = key;
    if (first) map.flyTo(pos, Math.max(map.getZoom(), 14), { duration: 0.6 });
    else map.panTo(pos);
  }, [map, pos, key]);
  return null;
}

export function LeafletFleetMap({ vehicles, selectedId, onSelect }: FleetMapProps) {
  const located = withPosition(vehicles);
  const pts = useMemo(() => located.map((v) => [v.lat, v.lon] as [number, number]), [located]);
  const sel = located.find((v) => v.id === selectedId);
  return (
    <MapContainer center={ITALY_CENTER} zoom={6} className="h-full w-full" zoomControl={false}>
      <TileLayer {...OSM} />
      <ZoomControl position="bottomright" />
      <FitOnce points={pts} />
      <FollowSelected key={selectedId ?? "none"} pos={sel ? [sel.lat, sel.lon] : null} />
      {located.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lon]} icon={icon(vehicleSvg(v, v.id === selectedId), v.id === selectedId)}
          zIndexOffset={v.id === selectedId ? 1000 : 0} eventHandlers={{ click: () => onSelect(v.id) }}
          title={v.name}>
          <Tooltip direction="top" offset={[0, -14]}>{v.name}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

function FitTrack({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    else if (points.length === 1) map.setView(points[0], 15);
  }, [map, points]);
  return null;
}

export function LeafletTrackMap({ points, cursor }: TrackMapProps) {
  const line = useMemo(() => points.map((p) => [p.lat, p.lon] as [number, number]), [points]);
  const cur = cursor != null ? points[cursor] : null;
  return (
    <MapContainer center={ITALY_CENTER} zoom={6} className="h-full w-full">
      <TileLayer {...OSM} />
      <FitTrack points={line} />
      {line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ color: "#fff", weight: 8, opacity: 0.9 }} />
          <Polyline positions={line} pathOptions={{ color: TRACK_COLOR, weight: 4 }} />
          <CircleMarker center={line[0]} radius={7} pathOptions={{ color: "#fff", weight: 3, fillColor: "#0a7a45", fillOpacity: 1 }}>
            <Tooltip>Partenza</Tooltip>
          </CircleMarker>
          <CircleMarker center={line[line.length - 1]} radius={7} pathOptions={{ color: "#fff", weight: 3, fillColor: "#b3261e", fillOpacity: 1 }}>
            <Tooltip>Arrivo</Tooltip>
          </CircleMarker>
        </>
      )}
      {cur && (
        <Marker position={[cur.lat, cur.lon]} zIndexOffset={1000}
          icon={icon(vehicleSvg({ status: (cur.speed ?? 0) > 3 ? "moving" : cur.ignition ? "idle" : "stopped", course: courseAt(points, cursor!) }, true), true)} />
      )}
    </MapContainer>
  );
}
