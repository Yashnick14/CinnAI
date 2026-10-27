# Responsive workspace

The browser UI uses compiled Tailwind CSS 4. Native Expo Go continues to use React Native styles; no native styling runtime or model dependency was changed.

- `npm run web` builds CSS then starts Expo web.
- `npm run styles:watch` watches Tailwind classes while editing (second terminal).
- `npm run export:web` rebuilds CSS and exports the web app.
- `npm run go` continues to start Expo Go.

Edit `src/styles/tailwind.css`, not the generated CSS. The generated stylesheet is checked into the workspace so direct Expo starts also work; rebuild after class changes.

Browser-specific screens use `.web.tsx` files. The shared navigation selects a sidebar at 1024px and above, and preserves bottom tabs below that width. Shared page content uses a fluid 12-column layout; panels stack below 768px. Native UI primitives live in `uiBase.tsx` and are re-exported by `ui.tsx`.

Tailwind Preflight is intentionally omitted to avoid overriding React Native Web resets. Buttons include focus-visible feedback; CSS entrance/hover transitions honor reduced-motion preferences. Dashboard metrics use existing local history and do not invent grading records. Result views call the existing `finalSummary` function; inference and validation remain unchanged.
