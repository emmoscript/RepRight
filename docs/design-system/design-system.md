# RepRight — Design System

> Dark mode first. Data-forward. Minimal friction. Whoop-inspired.
> Fonts: Space Grotesk (headlines) + Inter (body). Material Symbols Outlined (icons).

---

## Color Palette

```
Primary Accent    #00FF87   ← green, success, active states, CTAs
Error / Critical  #FF4444   ← critical biomechanical errors
Warning           #FFB800   ← warning-level errors, streak fire icon
Info / Neutral    #4A9EFF   ← informational, reserved

Background        #0D0D0D   ← base background
Surface           #1A1A1A   ← cards, modals
Surface High      #201F1F   ← elevated cards
Surface Highest   #262626   ← highest elevation surface
Surface Low       #131313   ← header, nav bar
Surface Overlay   rgba(0,0,0,0.85)

Text Primary      #FFFFFF
Text Secondary    #888888
Text Disabled     #444444

Skeleton Default  #FFFFFF   ← keypoint joints/lines (no error)
Skeleton Error    #FF4444   ← keypoint with active error
Skeleton OK       #00FF87   ← keypoint confirmed good

Border Subtle     #2A2A2A
Border Active     #00FF87
```

### Score Color Mapping
```
90–100  Excellent    #00FF87   green
70–89   Good         #7ED957   light green
50–69   Needs Work   #FFB800   amber
< 50    Poor Form    #FF4444   red
```

---

## Typography

```
Headline font:  Space Grotesk
Body font:      Inter
Icon font:      Material Symbols Outlined

Scale:
  display    32px   Space Grotesk Bold    — score numbers, hero stats
  xxl        24px   Space Grotesk Bold    — screen titles
  xl         20px   Space Grotesk Bold    — card headers
  lg         17px   Inter Medium          — body primary
  md         15px   Inter Regular         — body secondary
  sm         13px   Inter Regular         — captions, labels
  xs         11px   Inter Regular         — metadata, version strings
  label      10px   Space Grotesk Bold    — ALL CAPS tracking-widest labels
```

---

## Spacing & Radius

```
Page padding:     px-6  (24px horizontal)
Card radius:      12px  (rounded-xl)
Button radius:    10px
Pill radius:      9999px (full)
Card gap:         16px
Section gap:      48px
```

---

## Component Patterns

### Primary Button
```
Background:   #00FF87
Text:         #0D0D0D, Inter Bold, uppercase
Height:       56–64px (py-5)
Width:        full-width
Radius:       10px
Active state: scale(0.98) transition
```

### Ghost Button
```
Background:   transparent
Border:       1px solid #2A2A2A
Text:         #FFFFFF, Inter Medium
Radius:       10px
```

### Error / Logout Button
```
Background:   transparent
Border:       1px solid rgba(#FF4444, 0.3)
Text:         #FF4444, bold uppercase
```

### Surface Card
```
Background:   #1A1A1A (surface-container-high)
Radius:       12px
Padding:      p-6 (24px)
No shadow, no outer border unless active
Left border accent: 4px solid [color] for status cards
```

### Score Badge (pill)
```
≥ 90:  bg-[#00FF87]/10  text-[#00FF87]  border-[#00FF87]/20
≥ 70:  bg-[#7ED957]/10  text-[#7ED957]  border-[#7ED957]/20
≥ 50:  bg-[#FFB800]/10  text-[#FFB800]  border-[#FFB800]/20
< 50:  bg-[#FF4444]/10  text-[#FF4444]  border-[#FF4444]/20
```

### Error Banner (Live Session)
```
Critical:  background #FF4444,  text #FFFFFF
Warning:   background #FFB800,  text #0D0D0D
Padding:   p-4, radius 12px
Contents:  [icon] [AI LIVE FEEDBACK label] [message text]
```

### Filter Pills
```
Active:    bg-[#00FF87]  text-[#0D0D0D]  Space Grotesk Bold
Inactive:  bg-[#262626]  text-[#888888]  hover → text-white
Radius:    full, px-6 py-2
```

### Toggle Switch
```
On:  track bg-[#00FF87], thumb bg-[#0D0D0D]
Off: track bg-[#2A2A2A], thumb bg-[#888888]
Size: w-10 h-5
```

---

## Bottom Navigation Bar

```
Height:       80px (h-20)
Background:   #131313
Position:     fixed bottom-0
4 tabs:
  - home icon          → Home
  - fitness_center icon → Workout
  - bar_chart icon     → Stats
  - person icon        → Profile

Active tab:   icon filled (FILL=1), color #00FF87, label #00FF87
Inactive tab: icon outlined (FILL=0), color #888888
Label:        Space Grotesk Bold, 10px, uppercase, tracking-widest
```

---

## Top App Bar

```
Height:       80px (h-20)
Background:   #131313
Left:         RepRight logo — bolt icon + "RepRight" — Space Grotesk Bold, #00FF87
Right:        "STOP SESSION" button — outlined green or ghost depending on screen
```

---

## Skeleton Overlay (Live Session)

```
SVG drawn over camera preview
Lines:        stroke #00FF87, strokeWidth 4, strokeLinecap round
Joints:       fill #00FF87, radius ~6px
Error joint:  fill #FF4444, drop-shadow(0 0 8px #FF4444)
Opacity:      full — no transparency on skeleton
```

---

## Icon Library

Using **Material Symbols Outlined** (Google Fonts CDN).

Key icons used:
```
bolt              — logo accent
home              — Home tab
fitness_center    — Workout tab
bar_chart         — Stats tab
person            — Profile tab
play_arrow        — Start session CTA
arrow_forward     — Start session / Demo CTA
check_circle      — Active exercise selector
lock              — Coming soon exercise
warning           — Warning error banner
info              — Info note / demo footer
local_fire_department — Streak (filled, #FFB800)
verified          — Profile badge (filled, green)
flip_camera_ios   — Camera flip (Live Session)
mic               — Audio toggle (Live Session)
settings          — Settings (Live Session)
chevron_right     — Navigation arrow
clinical_notes    — Study participant card
analytics         — Form adjustments section
notifications     — Settings row
photo_camera      — Camera prefs row
straighten        — Units row
precision_manufacturing — Demo mode icon
```

Filled variant (active states): `font-variation-settings: 'FILL' 1`
Default variant: `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`

---

## HTML Prototype Tech Stack

These screens are built as static HTML prototypes using:
- **Tailwind CSS** (CDN) with custom color config
- **Google Fonts** — Space Grotesk + Inter
- **Material Symbols Outlined** (Google Fonts CDN)
- No JavaScript frameworks — pure HTML/CSS for mockups

The Tailwind config extends with the full RepRight color token system (see `src/theme/colors.ts` for the React Native equivalent).

---

## React Native Equivalents

| HTML/Tailwind | React Native |
|---|---|
| `bg-[#0D0D0D]` | `backgroundColor: colors.bg_primary` |
| `font-['Space_Grotesk']` | `fontFamily: typography.fontFamily.bold` |
| `rounded-xl` | `borderRadius: 12` |
| `text-[#00FF87]` | `color: colors.accent_green` |
| `opacity-40` | `opacity: 0.4` |
| `fixed bottom-0` | `position: 'absolute', bottom: 0` |
| `border-l-4 border-[#FF4444]` | `borderLeftWidth: 4, borderLeftColor: colors.accent_red` |
