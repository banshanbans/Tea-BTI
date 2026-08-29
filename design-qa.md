# Tea-BTI H5 Design QA

## Evidence

- Source visual truth: `/Users/carrey/Desktop/贵客松/tea -Tpti/index.html` (read-only teammate prototype).
- Source captures: `docs/design/qa/tea-bti-h5/.design-qa-reference.png`, `docs/design/qa/tea-bti-h5/.design-qa-reference-feed.png`.
- Final implementation captures: `docs/design/qa/tea-bti-h5/.design-qa-implementation-final.png`, `docs/design/qa/tea-bti-h5/.design-qa-implementation-feed-final.png`.
- Full-view comparison evidence: `docs/design/qa/tea-bti-h5/.design-qa-launch-comparison-final.png`, `docs/design/qa/tea-bti-h5/.design-qa-feed-comparison-final.png`.
- Focused comparison evidence: `docs/design/qa/tea-bti-h5/.design-qa-launch-focus-final.png`, `docs/design/qa/tea-bti-h5/.design-qa-feed-focus-final.png`.
- Secondary screen evidence: `docs/design/qa/tea-bti-h5/.design-qa-secondary-screens.png`, covering tea detail, immersive voice, Tea Realm home and Tea Profile.
- Responsive evidence: `docs/design/qa/tea-bti-h5/.design-qa-320-feed.png`, `docs/design/qa/tea-bti-h5/.design-qa-430-feed.png`.
- Viewport: 390 × 844 CSS px for primary comparison; 320 × 844 and 430 × 844 for boundary checks.
- Density normalization: both source and implementation page contexts reported device pixel ratio 2; the in-app browser produced normalized 390 × 844 pixel captures, so comparison inputs are equal-sized 1:1 CSS-pixel outputs.
- States: brand launch, Blind Swipe, tea detail, pre-connection voice, Realm home, Realm scene 1 and private Tea Profile.

## Final Findings

No actionable P0, P1 or P2 differences remain.

- Fonts and typography: the implementation keeps the prototype's Song-style editorial display hierarchy, compact sans-serif UI labels and high-contrast headline rhythm. Brand and headline wrapping remain intentional at 320–430 px.
- Spacing and layout rhythm: the 390 px feed preserves a 16 px gap between the Swipe action row (`bottom: 750`) and persistent navigation (`top: 766`). No horizontal overflow was found at 320, 390 or 430 px.
- Colors and tokens: warm rice paper, ink green, leaf green, amber accents, soft borders and low-elevation shadows are consistently mapped across discovery, detail, Realm and Profile. The dark launch and voice surfaces are explicit product requirements.
- Image quality and assets: tea and Realm imagery continue to come from the registered backend manifest. Phosphor icons replace emoji and text-glyph controls. No placeholder boxes, handwritten SVG assets or fake camera visuals remain.
- Copy and content: `Tea-BTI` is the formal brand; “刷茶” remains only as the discovery action and navigation label. The duplicated `适合 适合…` copy was removed.
- Accessibility and interaction: primary controls are at least 44 px, focus-visible styling is present, reduced-motion rules are retained, and the flow does not request a camera. The clean final browser tab reported zero console errors.

## Intentional Product Differences From The Prototype

- The source landing is a warm static home screen; the implementation uses a dark Tea-BTI brand launch because the approved plan requires a launch screen on every home entry.
- The source jumps directly into Mock Swipe content; the implementation preserves the real MBTI → three-cup Seed → server-backed Blind Feed journey.
- The source Blind Card is mostly typographic; the implementation uses the reviewed tea visual manifest while preserving Blind identity privacy.
- The source uses emoji and character controls; the implementation uses a consistent rounded icon library and does not add the unsupported global tea-companion bubble.

## Comparison History

### Iteration 1 — blocked

Evidence: `docs/design/qa/tea-bti-h5/.design-qa-feed-comparison-1.png`.

- [P2] Swipe controls overlapped the persistent bottom navigation at 390 × 844.
- [P2] Scene copy could render as `适合 适合…` when the API value already contained the prefix.
- [P2] Scene typography was too large and competed with the card headline.
- [P2] The Next development indicator obscured the lower-left navigation area.

Fixes:

- Reduced the deck maximum height and allowed flex shrink so actions remain above navigation.
- Added conditional scene-prefix handling.
- Reduced scene copy to 22 px with a 1.35 line height.
- Disabled the development indicator in Next configuration.

### Iteration 2 — passed

Post-fix evidence: `docs/design/qa/tea-bti-h5/.design-qa-feed-comparison-final.png` and `docs/design/qa/tea-bti-h5/.design-qa-feed-focus-final.png`.

- Action row ends at 750 px and navigation starts at 766 px.
- Scene copy renders once and no longer dominates the card.
- No development indicator is present.
- 320, 390 and 430 px checks report zero horizontal overflow.

## Primary Interactions Tested

- Launch preload → start → MBTI or returning-user Feed recovery.
- MBTI skip → three Seed cards → Blind Feed.
- Tea detail routes and Brew/Taste/Realm entry affordances.
- Mock-capable immersive voice pre-connection state.
- Realm home and seven-scene experience shell; seven progress dots present, with no camera or microphone dependency.
- Four-block Tea Profile layout and persistent navigation.

## Follow-up Polish

- No P3 item blocks this handoff. Future visual changes can follow the later high-fidelity prototype without changing the current service-backed boundaries.

final result: passed
