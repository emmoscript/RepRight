# RepRight — Design System v3 FINAL

> Dark mode. Green primary #27C34F. Space Grotesk headlines. Inter body.
> This is the definitive design system. v1 (green neon) and v2 (orange) are deprecated.

---

## Color Tokens

```
Primary green:      #27C34F   ← CTAs, active states, nav, icons, skeleton
Green light:        #5FF075   ← hover, secondary green
Green dim:          #1FBF4B   ← pressed state
Green subtle bg:    #002F0B   ← tinted backgrounds
Green glow:         rgba(39,195,79,0.2)

Background:         #0D0D0D   ← base (warm dark, not pure black)
Surface:            #0E0E0E
Surface elevated:   #1A1919   ← cards, containers
Surface high:       #201F1F
Surface highest:    #262626   ← elevated cards, dropdowns
Surface low:        #131313   ← nav bar, header

Error / Critical:   #FF4444   ← STOP SESSION button, critical error banners,
                               error keypoints — also seen as #FF716C
Error container:    #9F0519
Warning:            #FFB800   ← warning error banners (amber)

Text primary:       #FFFFFF
Text secondary:     #ADAAAA
Text muted:         #767575
Text on green:      #000000   ← black text on green backgrounds
Text on error:      #FFFFFF

Score excellent:    #27C34F   ← 90–100
Score good:         #5FF075   ← 70–89
Score needs work:   #FFB800   ← 50–69
Score poor:         #FF4444   ← <50

Skeleton active:    #27C34F   ← tracking / detected (green)
Skeleton error:     #FF4444   ← error keypoint (red)
Skeleton muted:     #484847   ← positioning state (not detected)

Border subtle:      #484847
Border active:      #27C34F
```

---

## Typography

```
Headline: Space Grotesk Bold (700)
Body:     Inter Regular (400) / Medium (500) / SemiBold (600)
Labels:   Inter SemiBold (600), ALL CAPS, letter-spacing widest
Numbers:  Inter Bold (700) — scores, rep counts, timers
```

Scale:
```
10px  — ALL CAPS labels, tracking-widest (uppercase meta)
12px  — captions, secondary labels
14px  — body secondary
16px  — body primary
18px  — body emphasis
24px  — section titles
32px  — card headings, screen subtitles
40px  — screen titles (Space Grotesk)
48px+ — hero numbers (reps, score)
```

---

## Border Radius

```
Default:   4px  (rounded-DEFAULT in Tailwind config)
lg:        8px
xl:        12px  ← cards
full:      9999px ← pills, avatars, FAB

Note: The design uses moderate rounding — NOT the extreme 20–24px of v2.
Tailwind config: DEFAULT=0.25rem, lg=0.5rem, xl=0.75rem, full=9999px
```

---

## Bottom Navigation Bar

```
Height: 80px (h-20)
Background: #131313
4 tabs — NO center FAB in final version:

  [Home] [Workout] [Stats] [Profile]

Icons: Material Symbols Outlined
  Home:    home
  Workout: fitness_center
  Stats:   bar_chart
  Profile: person

Active tab:   icon FILL=1, color #27C34F + label visible in #27C34F
Inactive tab: icon FILL=0, color #888888, label visible

Label: Space Grotesk Bold, 10px, uppercase, tracking-widest
```

---

## Top App Bar

**Standard (Home, Configure, Live Analysis):**
```
Background: #131313
Left: bolt icon (#27C34F) + "REPRIGHT" Space Grotesk Bold #27C34F
OR: back arrow + "REPRIGHT" wordmark
Height: ~72–80px
```

**Auth screens (Login, Signup, Email Confirmation):**
```
Background: #0E0E0E
Left: back arrow OR "RepRight" wordmark (fitness_center icon + text)
```

**Live Analysis:**
```
Background: #131313
Left: back arrow + "REPRIGHT" green
Right: nothing (STOP SESSION is in the stats panel, NOT the header)
```

---

## Logo Treatment

```
In nav/header: bolt icon (⚡) + "REPRIGHT" — Space Grotesk Bold, #27C34F
In auth screens: fitness_center icon + "RepRight" — Space Grotesk Bold, #27C34F
```

---

## Component Patterns

**Primary button:**
```
Background: #27C34F, text: #000000 (black), Space Grotesk Bold
Height: ~56px, full width, rounded-xl (12px)
Active: scale(0.98)
```

**Error/Stop button:**
```
Background: error_container (#9F0519) or #FF4444
Text: white, uppercase, Space Grotesk Bold
```

**Input field (Login/Signup):**
```
Background: #131313 (surface-container-low)
Border: none, bottom border 2px solid #484847
Focus bottom border: #27C34F
No border-radius on the field itself (flat bottom border style)
```

**Surface card:**
```
Background: #201F1F (surface-container-high) or #1A1919
Border-radius: xl (12px)
Padding: ~24px
Status variant: 4px left border in accent color
```

**Score badge pill:**
```
Rounded-full, 10px font, uppercase, Space Grotesk Bold
90–100: bg #27C34F/10, text #27C34F, border #27C34F/20
70–89:  bg #5FF075/10, text #5FF075
50–69:  bg #FFB800/10, text #FFB800
<50:    bg #FF4444/10, text #FF4444
```

**Score ring (Session Complete):**
```
conic-gradient(#27C34F {score}%, #1A1919 0)
Inner circle: #0D0D0D bg
Score number: Space Grotesk Bold, large
```

**Error banner (Live Session):**
```
Critical: #FFB800 bg (amber), #0D0D0D text — matches actual HTML
Warning: same pattern
Icon: warning (Material Symbols)
Label: "AI LIVE FEEDBACK" uppercase 10px
```

**Stat cards (Live Session):**
```
Background: surface-container-high/80 + backdrop-blur
Text: white
REP / SERIES: Space Grotesk Bold 4xl white
TIME: Space Grotesk Bold 4xl #27C34F
```

---

## Screen Inventory (v3 Final)

| # | Screen | Nav Bar | Header |
|---|---|---|---|
| 1 | Demo Mode / Onboarding | None (fixed footer CTAs) | Centered logo only |
| 2 | Home | 4-tab bottom nav | bolt + REPRIGHT |
| 3 | Email Confirmation | 4-tab bottom nav | logo + nav links |
| 4 | Login | None | back + REPRIGHT |
| 5 | Sign Up | None | back + REPRIGHT + icon |
| 6 | Session Complete | 4-tab bottom nav | centered logo |
| 7 | Configure Session | 4-tab bottom nav | bolt + REPRIGHT |
| 8 | Live Analysis (Active) | 4-tab bottom nav | back + REPRIGHT |

---

## STOP SESSION

Appears in Live Analysis stats panel (bottom area), NOT in the header.
Style: error_container background, white text, uppercase.

---

## Skeleton Overlay Colors

```
Tracking (active):  stroke/fill #27C34F
Error keypoint:     fill #FF4444 + drop-shadow(0 0 8px #FF4444)
Positioning (muted): stroke #484847 or not rendered yet
```

---

## React Native ↔ Tailwind

| Tailwind | React Native |
|---|---|
| `bg-background (#0E0E0E)` | `backgroundColor: colors.bg_surface` |
| `bg-surface-container (#1A1919)` | `backgroundColor: colors.bg_elevated` |
| `bg-surface-container-high (#201F1F)` | `backgroundColor: colors.bg_high` |
| `text-primary (#27C34F)` | `color: colors.accent_green` |
| `bg-primary (#27C34F)` | `backgroundColor: colors.accent_green` |
| `text-on-primary (#000000)` | `color: colors.text_on_green` |
| `text-error (#FF4444)` | `color: colors.error` |
| `text-on-surface-variant (#ADAAAA)` | `color: colors.text_secondary` |
| `rounded-xl` | `borderRadius: 12` |
| `rounded-full` | `borderRadius: 9999` |
| `border-l-4 border-primary` | `borderLeftWidth: 4, borderLeftColor: colors.accent_green` |
