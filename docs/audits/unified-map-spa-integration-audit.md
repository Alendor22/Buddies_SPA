# Unified Map SPA Integration Audit

Status: Initial code/agent review baseline  
Branch: `audit/unified-map-spa-integration`

## Objective

Consolidate the Interactive Walk Route Planner and Neighborhood Dog Radar into one SPA map workspace with:

- one Mapbox canvas
- route planning and editable shaping points
- active-dog, buddy-halo, heat, report, and route-memory layers
- translucent collapsible left/right overlay menus
- one context-sensitive bottom-center dynamic text field
- left-side typed-entry history button
- right-side contextual search/submit button
- ordered road routing: Start → Flag 1 → Flag 2 → … → final flag → Start

## Initial findings

### P0 — Routing correctness

1. `src/app/api/maps/directions/route.ts` currently includes a synthetic street-grid/vector fallback. That fallback can return geometry that is not a real road route. It should not be presented as successfully snapped street geometry.
2. The route profile must be changed to `mapbox/driving` for the requested deterministic road route.
3. The API must preserve plotted flag order and append Start only once to close the loop.
4. Failed Mapbox routing must return a typed error. It must not silently substitute approximate geometry.
5. Browser-direct routing and server routing currently overlap. The unified implementation should have one authoritative routing adapter to prevent inconsistent results.

### P0 — SPA/map architecture

1. `src/components/WalkRoutePlanner.tsx` currently owns map rendering, touch gestures, routing, animation, favorite routes, route editing, and large portions of UI state. It is too monolithic for the combined map surface.
2. `src/app/dashboard/social-map/page.tsx` renders a separate simulated radar surface rather than Mapbox layers. This duplicates the map experience and prevents a true SPA interaction model.
3. `/walks`, `/dashboard/social-map`, and create-walk navigation should resolve to one unified map workspace and preserve client state across menu changes.

### P1 — Dynamic text field

The bottom-center command field must be scoped by active menu:

- `route`: address, landmark, route name, route command
- `radar`: dog name, breed, DogID, neighborhood
- `reports`: report search or report entry
- `route-memory`: saved/frequent route search
- `walk-details`: dog, notes, start time, duration

The control shell must contain:

- left mini-button: context-specific typed-entry history
- center input: context-specific placeholder and validation
- right integrated button: contextual search/submit action

History must be partitioned by menu key, deduplicated, capped, and persisted locally. Switching menus must not expose entries from another menu context.

### P1 — Overlay/menu interaction

1. Use a single menu selector that opens the selected sub-menu.
2. Left-origin panels collapse toward the left launcher; right-origin panels collapse toward the right launcher.
3. Overlay controls should use approximately 50% opacity with backdrop blur while preserving legibility and touch targets.
4. The map remains interactive outside the active panel.
5. Only one primary panel should be open at a time.

### P1 — Route editing

1. Preserve existing draggable Start, flags, and temporary route handles.
2. Dragging a temporary route handle should create or reposition a shaping point.
3. Picked-up handles and temporary geometry should visibly pulse/blink.
4. Releasing a handle should invalidate the committed route and request a new driving route.
5. The temporary dotted route remains visible until a valid road-constrained response is received.
6. Successful routing should animate progressively from Start through each flag and back to Start.

### P1 — Radar layers

The unified Mapbox canvas should expose independent toggles for:

- active dog markers
- buddy ice-blue halos
- activity heat layer
- live reports
- frequent-route memory

Data should come from `/api/social-map` or a replacement unified endpoint with a stable typed response.

### P2 — Mobile and accessibility

1. Long-press, drag, double-tap, map pan, and browser gestures can conflict on iOS. Gesture ownership must be explicit and tested on Safari/iPhone.
2. All icon-only controls require accessible names.
3. Collapsible panels require focus management and escape/close behavior.
4. The bottom command field must remain above safe-area and global navigation in portrait and landscape.
5. 50% opacity must not reduce text contrast below usable levels.

## Proposed component boundary

```text
UnifiedMapWorkspace
├── UnifiedMapCanvas
│   ├── DrivingRouteLayer
│   ├── TemporaryRouteLayer
│   ├── RouteEditHandles
│   ├── DogRadarLayer
│   ├── ActivityHeatLayer
│   ├── ReportLayer
│   └── RouteMemoryLayer
├── MapMenuLauncher
├── CollapsibleMapPanel
├── DynamicMapInput
│   ├── ContextHistoryButton
│   ├── ContextInput
│   ├── ContextSearchButton
│   └── ContextResultTray
└── WalkDetailsOverlay
```

## Proposed state boundary

```ts
type MapMenu =
  | 'route'
  | 'radar'
  | 'reports'
  | 'route-memory'
  | 'walk-details';

type DynamicInputHistory = Record<MapMenu, string[]>;

type UnifiedMapState = {
  activeMenu: MapMenu;
  openPanel: MapMenu | null;
  panelOrigin: 'left' | 'right';
  commandValue: string;
  commandLoading: boolean;
  commandHistory: DynamicInputHistory;
  start: Coordinate | null;
  flags: Coordinate[];
  shapingPoints: Coordinate[];
  temporaryRoute: Coordinate[];
  committedRoute: Coordinate[];
  routeStatus: 'idle' | 'editing' | 'routing' | 'ready' | 'error';
};
```

## Routing contract

Request:

```ts
type DrivingRouteRequest = {
  start: Coordinate;
  flags: Coordinate[];
  shapingPoints?: Coordinate[];
};
```

Server sequence:

```text
Start → Flag 1 → Flag 2 → … → Flag N → Start
```

Rules:

- use `mapbox/driving`
- preserve user flag order
- use shaping points only as routing influence
- never return synthetic geometry as a successful snap
- return typed Mapbox errors
- return geometry, legs, distance, duration, and snap metadata

## Implementation sequence

1. Extract an authoritative driving-route adapter and remove synthetic fallback success behavior.
2. Split the current route planner into map, route, gesture, and overlay modules.
3. Convert radar data into real Mapbox sources/layers.
4. Create `UnifiedMapWorkspace` and route the existing map entry points into it.
5. Add collapsible translucent menu panels.
6. Add the context-specific `DynamicMapInput` with history and integrated search.
7. Add route-shaping drag/re-route behavior.
8. Add progressive snapped-route completion animation.
9. Add mobile gesture tests, typecheck, lint, and production smoke coverage.

## Review gates

The integration should not merge until:

- `npm run typecheck` passes
- `npm run lint` passes
- `npm run build:ci` passes
- driving route succeeds for 2, 6, and 20 plotted flags
- final route closes to Start
- alternate-street shaping changes returned geometry
- radar and route layers coexist on one map
- menu switching preserves map state
- dynamic input history remains isolated by menu
- iPhone long-press, drag, pan, and double-tap are verified
