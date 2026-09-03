import React, { useState, useMemo } from "react";
import {
  MapPin,
  Navigation,
  Globe,
  Compass,
  Calendar,
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  Layers,
  ChevronRight
} from "lucide-react";
import { JournalEntry, GeoLocationTag } from "../types";

interface LifeMapExplorerProps {
  entries: JournalEntry[];
  onSelectEntry?: (entry: JournalEntry) => void;
  onAddLocationTag?: (entryId: string, location: GeoLocationTag) => void;
}

// Famous global coordinates reference for preset exploration & projections
export const PRESET_LOCATIONS: { name: string; city: string; country: string; lat: number; lng: number }[] = [
  { name: "Silicon Valley Innovation Hub", city: "San Francisco", country: "United States", lat: 37.7749, lng: -122.4194 },
  { name: "Manhattan Strategic Center", city: "New York", country: "United States", lat: 40.7128, lng: -74.006 },
  { name: "Kyoto Zen Sanctuary", city: "Kyoto", country: "Japan", lat: 35.0116, lng: 135.7681 },
  { name: "Shibuya Tech District", city: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503 },
  { name: "London Creative Studio", city: "London", country: "United Kingdom", lat: 51.5074, lng: -0.1278 },
  { name: "Paris Intellectual Quarter", city: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { name: "Berlin Agile Workspace", city: "Berlin", country: "Germany", lat: 52.52, lng: 13.405 },
  { name: "Singapore Gateway", city: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Sydney Harbour Sanctuary", city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093 },
  { name: "Zurich Cognitive Retreat", city: "Zurich", country: "Switzerland", lat: 47.3769, lng: 8.5417 },
  { name: "Bali Mindfulness Haven", city: "Ubud", country: "Indonesia", lat: -8.5069, lng: 115.2625 }
];

export const LifeMapExplorer: React.FC<LifeMapExplorerProps> = ({
  entries,
  onSelectEntry
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [mapZoom, setMapZoom] = useState(1);

  // Group entries with location tags
  const locationEntries = useMemo(() => {
    return entries.filter((e) => e.location && e.location.latitude && e.location.longitude);
  }, [entries]);

  // Unique cities recorded
  const recordedCities = useMemo(() => {
    const map = new Map<string, { city: string; country?: string; count: number; lat: number; lng: number }>();
    locationEntries.forEach((e) => {
      if (!e.location) return;
      const cityKey = e.location.city || e.location.placeName || "Custom Coordinate";
      const existing = map.get(cityKey);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(cityKey, {
          city: cityKey,
          country: e.location.country,
          count: 1,
          lat: e.location.latitude,
          lng: e.location.longitude
        });
      }
    });
    return Array.from(map.values());
  }, [locationEntries]);

  // Filtered entries based on active selection / search
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchSearch =
        !searchQuery ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.location?.city && e.location.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.location?.placeName && e.location.placeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.tags && e.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchCity =
        !selectedCity ||
        (e.location && (e.location.city === selectedCity || e.location.placeName === selectedCity));

      return matchSearch && matchCity;
    });
  }, [entries, searchQuery, selectedCity]);

  // Equirectangular projection coordinates to SVG viewBox (1000 x 500)
  const projectCoordinates = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x: Math.max(20, Math.min(980, x)), y: Math.max(20, Math.min(480, y)) };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header & Spatial Intro */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Globe className="h-4 w-4" />
            </div>
            <h2 className="font-serif text-2xl text-white sm:text-3xl italic">
              Map of Your Life
            </h2>
            <span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-2.5 py-0.5 text-[10px] font-mono text-teal-300">
              Geospatial Memories
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Revisit reflections, breakthroughs, and mindsets plotted across the physical places where they occurred.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-2 text-xs">
          <div className="rounded-lg border border-white/10 bg-[#0d0d0d] px-3 py-1.5 font-mono text-slate-300">
            <span className="text-teal-400 font-bold">{locationEntries.length}</span> Geotagged Reflections
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0d0d0d] px-3 py-1.5 font-mono text-slate-300">
            <span className="text-emerald-400 font-bold">{recordedCities.length}</span> Unique Destinations
          </div>
        </div>
      </div>

      {/* Main Interactive Map Viewport */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-teal-500/20 bg-[#07090e] shadow-[0_0_50px_rgba(13,148,136,0.07)]">
        {/* Map Top Bar Controls */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0a0d14]/80 p-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories by city, keyword, or tag..."
                className="w-48 sm:w-64 rounded-lg border border-white/10 bg-[#121620] pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
              />
            </div>

            {selectedCity && (
              <button
                onClick={() => setSelectedCity(null)}
                className="flex items-center gap-1 rounded-md bg-teal-500/20 border border-teal-500/40 px-2 py-1 text-[11px] text-teal-300 hover:bg-teal-500/30"
              >
                <span>Filter: {selectedCity}</span>
                <span className="font-bold">×</span>
              </button>
            )}
          </div>

          {/* Quick city filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <button
              onClick={() => setSelectedCity(null)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono transition ${
                !selectedCity
                  ? "bg-teal-500 text-white font-bold"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              All Regions ({locationEntries.length})
            </button>
            {recordedCities.slice(0, 5).map((c) => (
              <button
                key={c.city}
                onClick={() => setSelectedCity(c.city)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono transition ${
                  selectedCity === c.city
                    ? "bg-teal-500 text-white font-bold"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <MapPin className="h-2.5 w-2.5 text-teal-400" />
                <span>{c.city}</span>
                <span className="rounded-full bg-black/40 px-1 text-[9px]">{c.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Stylized Vector Canvas */}
        <div className="relative h-[380px] sm:h-[460px] w-full pt-14 flex items-center justify-center">
          {/* Stylized Dark Grid Map SVG */}
          <svg
            viewBox="0 0 1000 500"
            className="h-full w-full select-none"
            style={{ filter: "drop-shadow(0 0 20px rgba(20, 184, 166, 0.05))" }}
          >
            {/* Background Grid Lines */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.75" />
              </pattern>
              <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(20, 184, 166, 0.12)" />
                <stop offset="100%" stopColor="rgba(10, 15, 26, 0)" />
              </radialGradient>
            </defs>

            <rect width="1000" height="500" fill="#07090e" />
            <rect width="1000" height="500" fill="url(#grid)" />
            <rect width="1000" height="500" fill="url(#mapGlow)" />

            {/* Latitude & Longitude Reference Rings */}
            <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(20,184,166,0.15)" strokeDasharray="4,4" strokeWidth="1" />
            <line x1="500" y1="0" x2="500" y2="500" stroke="rgba(20,184,166,0.15)" strokeDasharray="4,4" strokeWidth="1" />

            {/* Stylized Continent Silhouettes (Abstract Geospatial Outlines) */}
            <g fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.2">
              {/* North America */}
              <path d="M 120 120 Q 180 80 260 100 T 300 200 Q 220 220 180 180 T 120 120 Z" fill="rgba(255,255,255,0.015)" />
              {/* South America */}
              <path d="M 280 260 Q 340 280 320 380 T 260 420 Q 240 340 280 260 Z" fill="rgba(255,255,255,0.015)" />
              {/* Europe */}
              <path d="M 460 100 Q 540 80 560 150 T 480 200 Q 440 160 460 100 Z" fill="rgba(255,255,255,0.015)" />
              {/* Africa */}
              <path d="M 480 220 Q 560 220 560 340 T 480 380 Q 440 300 480 220 Z" fill="rgba(255,255,255,0.015)" />
              {/* Asia */}
              <path d="M 580 90 Q 760 70 820 180 T 700 260 Q 600 220 580 90 Z" fill="rgba(255,255,255,0.015)" />
              {/* Australia */}
              <path d="M 760 320 Q 860 320 840 400 T 760 400 Q 740 360 760 320 Z" fill="rgba(255,255,255,0.015)" />
            </g>

            {/* Connection Arcs between recorded places */}
            {locationEntries.length > 1 && (
              <g stroke="rgba(20, 184, 166, 0.25)" strokeWidth="1" strokeDasharray="3,3" fill="none">
                {locationEntries.slice(0, locationEntries.length - 1).map((curr, idx) => {
                  const next = locationEntries[idx + 1];
                  if (!curr.location || !next.location) return null;
                  const p1 = projectCoordinates(curr.location.latitude, curr.location.longitude);
                  const p2 = projectCoordinates(next.location.latitude, next.location.longitude);
                  const midX = (p1.x + p2.x) / 2;
                  const midY = Math.min(p1.y, p2.y) - 30;
                  return (
                    <path
                      key={idx}
                      d={`M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`}
                      className="transition-all duration-700 hover:stroke-teal-400 hover:stroke-width-2"
                    />
                  );
                })}
              </g>
            )}

            {/* Geotagged Memory Pins */}
            {locationEntries.map((entry) => {
              if (!entry.location) return null;
              const { x, y } = projectCoordinates(entry.location.latitude, entry.location.longitude);
              const isSelected = selectedEntry?.id === entry.id;

              return (
                <g
                  key={entry.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer group"
                  onClick={() => setSelectedEntry(entry)}
                >
                  {/* Outer Radar Ripple */}
                  <circle
                    r="12"
                    className="animate-ping fill-teal-500/20"
                    style={{ animationDuration: "3s" }}
                  />
                  {/* Pin Core */}
                  <circle
                    r={isSelected ? "8" : "6"}
                    className={`${
                      isSelected
                        ? "fill-teal-300 stroke-white stroke-2"
                        : "fill-teal-500 stroke-teal-300/80 stroke-1 group-hover:fill-teal-300"
                    } transition-all duration-300 shadow-lg`}
                  />
                  {/* Small City Tooltip */}
                  <text
                    y="-12"
                    textAnchor="middle"
                    className="fill-slate-300 text-[9px] font-mono tracking-wider opacity-80 group-hover:opacity-100 group-hover:fill-teal-200 transition-opacity select-none"
                  >
                    {entry.location.city || entry.location.placeName || "Reflection"}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Selected Memory Floating Inspection Card */}
          {selectedEntry && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-20 rounded-xl border border-teal-500/40 bg-[#0d111a]/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-teal-400" />
                  <span className="font-mono text-xs font-semibold text-teal-300">
                    {selectedEntry.location?.placeName || selectedEntry.location?.city || "Geotagged Location"}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="rounded p-0.5 text-slate-400 hover:text-white"
                >
                  ×
                </button>
              </div>

              <div className="mt-2 space-y-1.5">
                <h4 className="font-serif text-sm font-medium text-white line-clamp-1">
                  {selectedEntry.title}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                  <span>{new Date(selectedEntry.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span className="text-teal-400 capitalize">{selectedEntry.mode}</span>
                  {selectedEntry.insights?.moodTag && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-300">{selectedEntry.insights.moodTag}</span>
                    </>
                  )}
                </div>

                {selectedEntry.insights?.summary ? (
                  <p className="text-[11px] text-slate-300 line-clamp-2 italic">
                    "{selectedEntry.insights.summary}"
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {selectedEntry.messages?.[0]?.content || "Reflection recorded at this coordinate."}
                  </p>
                )}

                {selectedEntry.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedEntry.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-teal-950/60 px-1.5 py-0.5 text-[9px] font-mono text-teal-300">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty Geotags Guidance if none */}
          {locationEntries.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#07090e]/80">
              <Compass className="h-10 w-10 text-teal-500/60 mb-3 animate-pulse" />
              <h3 className="font-serif text-lg text-white font-medium">No Geotagged Reflections Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
                Tag your next reflection with your current GPS location or choose a preset city in the Journal Workspace to build your spatial map of memories.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Geospatial Memory Feed Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg text-white italic">
            Location-Filtered Reflections ({filteredEntries.length})
          </h3>
          <span className="text-xs font-mono text-slate-500">
            {selectedCity ? `Viewing: ${selectedCity}` : "All Recorded Locations"}
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-8 text-center text-xs text-slate-500">
            No reflections match the current location filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                  selectedEntry?.id === entry.id
                    ? "border-teal-500 bg-[#121620] shadow-[0_0_15px_rgba(20,184,166,0.15)]"
                    : "border-white/10 bg-[#0d0d0d] hover:border-white/20 hover:bg-[#121212]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-teal-400 font-mono">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[180px]">
                      {entry.location?.placeName || entry.location?.city || "Unpinned Reflection"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>

                <h4 className="mt-2 font-serif text-sm font-medium text-white group-hover:text-teal-300 transition-colors line-clamp-1">
                  {entry.title}
                </h4>

                <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                  {entry.insights?.summary || entry.messages?.[0]?.content || "Reflection notes..."}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-slate-500">
                  <span className="capitalize">{entry.mode}</span>
                  {entry.insights?.moodTag && (
                    <span className="rounded bg-teal-950/40 px-1.5 py-0.5 font-mono text-teal-300">
                      {entry.insights.moodTag}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
