# RepRight — Design System v2

> Warm dark mode. Orange primary. Rounded everything.
> Fonts: Plus Jakarta Sans · Be Vietnam Pro · Space Grotesk · DM Mono

---

## Color Tokens

```
Primary orange:       #F08030   ← CTAs, active states, nav FAB, icons
Orange light:         #FFB68B   ← logo "Right", secondary orange
Orange dim:           #C4682A   ← pressed states
Orange subtle bg:     #2D1E0F   ← tinted card backgrounds

Background:           #111010   ← warm dark gray (not pure black)
Surface:              #1A1917   ← cards
Surface elevated:     #222019   ← elevated cards, modal bg
Surface high:         #2A2825
Surface highest:      #323029

Error / Critical:     #E84040   ← critical biomechanical errors ONLY
Error subtle:         #3D0F0F
Warning:              #F0C040   ← warning errors (yellow, not orange)
Warning subtle:       #3D2800

Text primary:         #F0EDE8   ← warm white
Text secondary:       #9A9590   ← warm gray
Text muted:           #5A5550
Text on orange:       #FFFFFF
Text on white card:   #111010   ← for #F0EDE8 bg cards (live session stats)

Score excellent:      #27C34F   ← 90–100
Score good:           #5CB85C   ← 70–89
Score needs work:     #F0C040   ← 50–69
Score poor:           #E84040   ← < 50

Skeleton active:      #F08030   ← pose detected, tracking
Skeleton error:       #E84040   ← error keypoint
Skeleton muted:       #5A5550   ← positioning state (not detected)
```

---

## Typography

```
Plus Jakarta Sans 700/800  → headlines, screen titles, CTA buttons
Be Vietnam Pro 400/500     → body text, descriptions, form labels
Space Grotesk 700          → ALL CAPS labels, nav labels, stat labels
DM Mono 700                → numbers, scores, timers, rep counts
```

Scale:
```
Screen title:   Plus Jakarta Sans 800, 32–40px, tight tracking
Section title:  Plus Jakarta Sans 700, 20px
Card label:     Space Grotesk 700, 11px, ALL CAPS, tracking 0.15em, #9A9590
Card value:     DM Mono 700, 28–52px, #F0EDE8
Body:           Be Vietnam Pro 400, 15px, #9A9590
CTA:            Plus Jakarta Sans 700, 15px, ALL CAPS, tracking 0.1em
Metadata:       DM Mono 400, 11px, #5A5550
```

---

## Border Radius

```
Cards:               20px
Large hero cards:    24px
Primary buttons:     16px
Small buttons:       12px
Input fields:        14px
Pills / tags:        999px
Avatars:             999px (circle)
Bottom nav:          28px top corners only
```

---

## Bottom Navigation Bar

```
Height:     80px
Background: rgba(26,25,23,0.92) + backdrop-blur(20px)
Top radius: 28px 28px 0 0
Shadow:     0px -8px 32px rgba(240,128,48,0.12)

5 positions — CENTER ELEVATED:
  [Home] [Stats] [●WORKOUT●] [History] [Profile]

Icons:
  Home:    home
  Stats:   leaderboard
  Workout: fitness_center (center FAB)
  History: history
  Profile: person

Center FAB:
  Size:       60px circle
  Background: #F08030
  Icon:       fitness_center, white, FILL=1, 28px
  Elevation:  margin-top -20px (lifts above nav)
  Shadow:     0px 8px 24px rgba(240,128,48,0.35)

Active tab (non-center):
  Icon:  FILL=1, #F08030
  Label: Space Grotesk 700, 10px, #F08030, uppercase, visible

Inactive tab:
  Icon:  FILL=0, #5A5550
  Label: hidden
```

---

## Top App Bar Types

**Type A — Home, Stats, Profile:**
```
Height: 72px, bg: #141313
Home: logo left, bell icon right
Stats: "Rep Log" title left
Profile: back arrow left, "Profile" center, settings right
```

**Type B — Configure Session, Session Complete:**
```
Height: 72px, bg: #141313, border-radius bottom 32px
Shadow: 0px 12px 32px rgba(240,128,48,0.12)
Left: back/close arrow in circular #222019 button, 44px, orange icon
Center: screen title, Plus Jakarta Sans 700, 20px, #FFB68B
Right: empty spacer (same width as left button)
```

**Type C — Auth screens (Sign Up, Login, Email Confirmation):**
```
Height: 72px, bg: transparent
Left: back arrow in circular #222019 button, 44px, #F0EDE8 icon
Center: RepRight logo
Right: empty spacer
```

**Live Session (all 4 states):**
```
Background: transparent + backdrop-blur-md
Left: back arrow in circular #1A1917/80% button, 44px, white icon
Center: "DEADLIFT · SET X", Plus Jakarta Sans 600, 14px, #9A9590
Right: audio toggle in circular #1A1917/80% button, 44px, #F08030 icon
```

---

## Logo

```
"Rep"   — Plus Jakarta Sans 800, 22px, #F0EDE8
"Right" — Plus Jakarta Sans 800, 22px, #F08030
No italic. No all-caps. No monogram. No space between words.

BANNED: "KINETIC", "RR", italic treatment, any other color combo.
```

---

## Component Patterns

**Primary button:**
```
Background: #F08030, color: #FFFFFF
Plus Jakarta Sans 700, 15px, uppercase, tracking 0.1em
Height: 56px, full width, radius 16px
Shadow: 0px 12px 32px rgba(240,128,48,0.2)
Active: scale(0.98)
```

**Ghost button:**
```
Border: 1.5px solid #2A2825, color: #F0EDE8, radius 16px
```

**Danger button (Sign Out):**
```
Border: 1.5px solid rgba(232,64,64,0.4), color: #E84040
Space Grotesk 700, 13px, uppercase, tracking 0.2em
Radius: 999px
```

**Input field:**
```
Background: #1A1917, border: 1.5px solid #2A2825
Focus border: #F08030
Radius: 14px, height: 52px, padding: 0 20px
Color: #F0EDE8, placeholder: #5A5550
```

**Surface card:**
```
Background: #1A1917 or #222019, radius: 20px, padding: 20px
Status variant: 4px left border in accent color
```

**Score badge pill:**
```
Radius 999px, Space Grotesk 700, 11px, uppercase
90–100: bg rgba(39,195,79,0.15), text #27C34F, border rgba(39,195,79,0.3)
70–89:  bg rgba(92,184,92,0.15), text #5CB85C, border rgba(92,184,92,0.3)
50–69:  bg rgba(240,192,64,0.15), text #F0C040, border rgba(240,192,64,0.3)
<50:    bg rgba(232,64,64,0.15),  text #E84040, border rgba(232,64,64,0.3)
```

**Live session stat cards (7D only):**
```
Background: #F0EDE8 (warm white, FULLY OPAQUE — no transparency)
Text color:  #111010 (dark for contrast)
TIME value:  #F08030 (orange exception)
Radius: 16px, padding: 16px
```

**Error banner (live session):**
```
Critical: #E84040 solid bg, #FFFFFF text, radius 16px
Warning:  #F0C040 solid bg, #111010 text, radius 16px
No transparency on banners
```

---

## Screens Without Nav Bar

- Welcome / Onboarding
- Sign Up
- Login
- Email Confirmation
- Live Session (all 4 states: 7A, 7B, 7C, 7D)
- Stop Session Modal

## Screens With Nav Bar

- Home (Home tab active)
- Configure Session (center FAB — no tab active, extra glow)
- Stats / Rep Log (Stats tab active)
- Profile (Profile tab active)
- Session Complete (no tab active)

---

## STOP SESSION Button

Appears **ONLY** in Live Session State 7D (Active), at the bottom of the stats panel.
No other screen has this button.
Style: #E84040 bg, white text, Plus Jakarta Sans 700, uppercase, full width, 52px height, radius 16px.
