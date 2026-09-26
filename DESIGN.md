# Devloom interface

Devloom is a local work surface. The primary tasks are finding a service, changing its lifecycle, inspecting output, and following telemetry.

## Current design rules

- Satoshi throughout. Exactly three text sizes: 14px metadata/controls, 16px body/service names, 24px headings. No tiny auxiliary text or secondary monospace family.
- One viewport. The document does not scroll. Long service lists and output scroll within their own regions.
- Use an actual table with labeled columns and alternating row backgrounds. Selection and hover must remain distinguishable from striping.
- Selecting a service opens a full-width bottom inspector. Keep its normal configuration and controls visible together. Reserve space for the service table above, so it remains independently scrollable.
- Outside click and Escape dismiss the inspector. A row click switches selection. View full opens Logs while preserving the selected service.
- Logs have explicit service, stream, and text filters.
- Prefer spacing and typography to nested containers. Rounded controls and the console soften the work surface; avoid boxing every datum.
- Form groups follow the task: identity, directory, command/arguments, then optional health/networking. Keep Cancel and submit visible in the footer.
- Neutral text colors with distinct primary, secondary, and muted roles. Dark mode uses neutral charcoal surfaces and warm stone chart accents, without blue-tinted panels, selection, or controls. It uses the same hierarchy and preserves table striping, selection, forms, and chart contrast.
- Dropdown and SearchInput are shared components. Dropdowns use custom Tailwind styling over Radix accessibility primitives; search has a consistent focus state, clear action, and Escape behavior.
- Color indicates state. No invented charts, decorative metric cards, generic marketing headings, or unavailable navigation.
- Memory charts use OS RSS samples from managed process trees, a real time axis, explicit units, and a zero baseline. Current usage, session peak, and per-service share have separate labels. Application metrics explain their units and aggregation.
- Tailwind CSS v4 implements the existing design. Theme tokens define the palette and the three text sizes; component styles use short inline utilities. Semantic color tokens adapt to the current theme, so views do not repeat dark-mode overrides.
- Traces and application metrics display exports received by the local OTLP receiver; empty states explain how to connect a real SDK.

## References consulted

- [Kosta Canatselis: Spot the Slop](https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c): product-specific decisions, state design, progressive disclosure.
- [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh): give the work priority, reduce navigation and decorative framing.
- [Fontshare: Satoshi](https://www.fontshare.com/fonts/satoshi): locally hosted UI font.

These are references, not copied layouts. The interaction decisions above follow the user's explicit Devloom requirements.

## Code conventions

- Style the element itself. Avoid selectors that reach into another component or depend on a parent class name.
- Shared primitives own their defaults: `Button`, `TabButton`, `TableHead`, `TableCell`, `FormField`, `Input`, `SearchInput`, and `Dropdown`. Pages pass content, state, and layout props.
- Use the spacing scale and the named `compact` / `desktop` breakpoints. Keep arbitrary values for actual constraints such as chart geometry and the viewport-bound inspector.
- Keep `globals.css` for fonts, reset, theme tokens, and animations. State belongs in hooks; pure transformations belong in `lib`.
- Run `npm run format`. Prettier sorts and wraps Tailwind classes at 100 columns; do not maintain hand-aligned class strings or hide long selectors in style constants.

For example, a primary action is `<Button variant="primary">Add service</Button>`. A table value is `<TableCell>{service.pid ?? '—'}</TableCell>`. The call site communicates intent, while each primitive keeps its small set of Tailwind utilities alongside its markup.
