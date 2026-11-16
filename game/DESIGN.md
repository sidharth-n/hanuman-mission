# Hanuman Mission: how the screens look

The look is "carved stone and beaten gold": the game's own night city, with every panel, button and icon made of
dark temple stone, hammered gold and lamp flame. The reference is the approved mock-up set in `assets/screens/`
(style A: `s01-title`, `s03-run`, `s07-settings`, `s08-captured`, `s09-victory`, `s12-icons`).

## Type
- **Cinzel** (700 and 900): the title, headings, buttons, labels and all numbers. Always capitals, wide tracking.
- **Cormorant Garamond** (500 and 600): sentences only (the line under the title, hints, help text).
- Sizes: 12, 14, 16, 20, 28, 40, and the title at 40 to 76 depending on the screen.

## Colour
- Gold, the one accent: light `#fbe7ae`, gold `#e8b44c`, deep `#b07a24`, shadow `#5a3a10`.
- Stone and night: night `#070b1c`, stone `#1a1613`, stone light `#2a241e`.
- Words: ink `#f3e9d8`, quiet `#b9a98d`.
- Flame `#ff8a2a` only for things that are charged or burning (the strength bar, a ready power, an alert).

## Spacing
4, 8, 12, 16, 24, 32, 48, 64. Nothing in between.

## Parts
- **Plaque button**: gold, pointed at both ends, dark engraved lettering. The quiet version is stone with gold lettering.
- **Tablet**: a stone panel with a gold edge and a strip of carved lotus trim along the top and bottom.
- **Medallion**: the round gold icons cut from `s12-icons`. A power that is not charged is dim; charged, it glows and
  a ring around it shows the charge, then counts down while the power is in use.
- **Counter**: a small stone tag with a gold edge holding one icon and one number.

## Rules
- Words are never set in gradient colours; depth comes from a light top edge and a dark lower edge.
- One tablet at a time, never a panel inside a panel.
- Everything works at 390 px wide upright and 844 by 390 sideways, inside the phone's safe areas.
