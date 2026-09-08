---
name: CineShield AI Director Interface
colors:
  surface: '#181309'
  surface-dim: '#181309'
  surface-bright: '#3f382d'
  surface-container-lowest: '#120e05'
  surface-container-low: '#201b11'
  surface-container: '#241f15'
  surface-container-high: '#2f291f'
  surface-container-highest: '#3a3429'
  on-surface: '#ede1d1'
  on-surface-variant: '#d4c4ac'
  inverse-surface: '#ede1d1'
  inverse-on-surface: '#363025'
  outline: '#9d8f78'
  outline-variant: '#504533'
  surface-tint: '#fdbc13'
  primary: '#ffd584'
  on-primary: '#402d00'
  primary-container: '#f4b400'
  on-primary-container: '#654800'
  inverse-primary: '#7a5900'
  secondary: '#ffb3ad'
  on-secondary: '#680008'
  secondary-container: '#c00019'
  on-secondary-container: '#ffcdc8'
  tertiary: '#a9e2ff'
  on-tertiary: '#003546'
  tertiary-container: '#45ccff'
  on-tertiary-container: '#00546d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdea3'
  primary-fixed-dim: '#fdbc13'
  on-primary-fixed: '#261900'
  on-primary-fixed-variant: '#5d4200'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb3ad'
  on-secondary-fixed: '#410003'
  on-secondary-fixed-variant: '#930010'
  tertiary-fixed: '#bee9ff'
  tertiary-fixed-dim: '#6ad3ff'
  on-tertiary-fixed: '#001f2a'
  on-tertiary-fixed-variant: '#004d65'
  background: '#181309'
  on-background: '#ede1d1'
  surface-variant: '#3a3429'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max: 1440px
---

## Brand & Style

The design system is engineered for the high-stakes environment of AI-driven legal protection in cinema. It adopts an **Experimental Technical** aesthetic, merging the precision of a digital forensics command center with the sleek, high-end finish of a professional film studio. 

The atmosphere is authoritative and raw. It rejects the softness of consumer apps in favor of a "mechanical" reliability. By utilizing sharp edges, high-contrast monochrome surfaces, and monospaced accents, the interface communicates immediate technical competence. The emotional response is one of total control—giving legal teams and studio executives a clear-eyed view of complex AI-generated risks through a lens of uncompromising clarity.

## Colors

The palette is anchored in a deep "Obsidian" base to provide maximum contrast for data visualization. 

- **Primary Alert (#F4B400):** Used for "Caution" states, legal highlights, and critical metric indicators. It is the primary "action" color, cutting through the dark background like a warning tape on a high-security set.
- **Critical Alert (#FF3E3E):** Reserved exclusively for copyright violations, critical errors, and legal breaches.
- **Monochrome Foundation:** We utilize a tiered grayscale starting from `#0A0A0A` for the canvas, `#121212` for primary containers, and `#1E1E1E` for interactive elements.
- **Typography:** Pure white (`#FFFFFF`) is used for headlines to ensure "glanceability," while light grays handle metadata and body text to reduce visual fatigue.

## Typography

This design system utilizes a high-contrast typographic pairing to reinforce the "Forensic Cinema" narrative.

- **Space Grotesk (Headlines):** A technical, geometric font that feels futuristic yet professional. Its wider apertures and distinct glyphs ensure that high-level data points and section titles command attention.
- **JetBrains Mono (Body & Labels):** A monospaced powerhouse that evokes the raw nature of data analysis. It is used for all functional text, legal descriptions, and code-like metadata. Its fixed-width nature aids in the readability of tabular legal data and timestamps.

All labels and status tags should use `label-caps` to distinguish meta-information from primary content.

## Layout & Spacing

The layout philosophy follows a **Rigid Technical Grid**. Everything is aligned to a 4px baseline, ensuring a compact and information-dense environment suitable for professional monitoring.

- **Grid:** A 12-column fluid grid for the main dashboard content.
- **Gaps:** Use a standard 24px gutter between primary cards to allow the "Obsidian" background to act as a structural separator.
- **Density:** The design favors high-density layouts. Content should be packed tightly within panels to reduce the need for scrolling during time-sensitive legal reviews.
- **Sidebars:** Persistent left-hand navigation at 240px width, utilizing a fixed position to maintain the "control center" feel.

## Elevation & Depth

In a world of zero-radius shapes, depth is achieved through **Tonal Layering** and **Glassmorphism**, rather than traditional shadows.

- **Tier 1 (Base):** `#0A0A0A` — The infinite void of the dashboard background.
- **Tier 2 (Panels):** `#121212` with a 1px solid border of `#2A2A2A`. No rounded corners.
- **Tier 3 (Modals/Popovers):** Semi-transparent `#1E1E1E` (85% opacity) with a `backdrop-filter: blur(12px)`. This creates a "frosted lens" effect that feels cinematic and high-end.
- **High-Contrast Metrics:** Metric cards for "Risk Scores" or "Copyright Matches" do not use depth; they use high-contrast fills of the primary yellow or red to "pop" forward visually.

## Shapes

The shape language is strictly **Radical Square**. 

By maintaining a `0px` border radius across every element—from buttons to input fields to the main dashboard cards—the design system communicates a sense of structural integrity and technical precision. There are no "soft" edges in legal protection. 

Every interactive element is defined by its 1px border or its high-contrast fill. This "brutalist-professional" approach ensures the interface feels like a custom-built piece of studio hardware.

## Components

- **Buttons:** Rectangular, zero-radius. Primary buttons use a solid `#F4B400` fill with black `#000000` text. Secondary buttons use a transparent background with a 1px white border.
- **Metric Cards:** Large, monospaced numbers. If a threshold is crossed, the entire top border of the card (2px) should glow in the alert color (Yellow/Red).
- **Input Fields:** Bottom-border only or a subtle 1px `#2A2A2A` box. Labels are always `label-caps` positioned above the field.
- **Status Chips:** Small, rectangular tags with no rounded corners. Use `label-caps` font. Violation chips use a `#FF3E3E` background; "Under Review" uses `#F4B400`.
- **Lists/Tables:** High-density, no row separators—only a hover state change to `#1E1E1E`. Use JetBrains Mono for all cell data to emphasize the "data forensic" nature of the dashboard.
- **The "Scanner" Progress Bar:** A thin, 2px line that moves across the top of panels during AI analysis, using a pulse effect of the primary yellow.