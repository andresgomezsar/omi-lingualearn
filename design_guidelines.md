# Design Guidelines: Omi Language Learning App

## Design Approach
**Reference-Based with Playful Gaming Elements**
Drawing inspiration from Duolingo's gamification + Notion's clean data presentation + modern SaaS clarity. The "playful" directive calls for friendly, approachable design that makes language learning feel like progress in a game rather than work.

## Core Design Principles
1. **Gamified Progress**: Visual feedback loops, achievement indicators, streak counters
2. **Approachable Clarity**: Friendly but functional - playful without sacrificing usability
3. **Conversational Warmth**: Round corners, soft shadows, friendly micro-copy throughout

---

## Typography System

**Primary Font**: Inter (Google Fonts) - clean, modern, highly legible
**Accent Font**: Fredoka (Google Fonts) - friendly, rounded for headings and CTAs

**Hierarchy**:
- Hero Headlines: Fredoka, text-5xl to text-7xl, font-bold
- Section Headers: Fredoka, text-3xl to text-4xl, font-semibold  
- Subheadings: Inter, text-xl to text-2xl, font-semibold
- Body Text: Inter, text-base, font-normal, leading-relaxed
- UI Labels: Inter, text-sm, font-medium
- Micro-copy/Stats: Inter, text-xs to text-sm, font-medium

---

## Layout & Spacing System

**Tailwind Spacing Units**: Standardize on 4, 6, 8, 12, 16, 20, 24 for consistent rhythm
- Component padding: p-6 to p-8
- Section spacing: py-16 to py-24 (desktop), py-12 (mobile)
- Card spacing: p-6 internally, gap-6 between cards
- Button padding: px-6 py-3 (primary), px-4 py-2 (secondary)

**Container Strategy**:
- Marketing pages: max-w-6xl or max-w-7xl
- App dashboard: max-w-screen-2xl with sidebar
- Content areas: max-w-4xl for readability

---

## Component Library

### Navigation
**Marketing Header**: 
- Sticky navigation with backdrop-blur effect
- Logo left, nav center, CTA button right
- Mobile: Hamburger menu with slide-in drawer
- Height: h-16 to h-20

**App Dashboard Nav**:
- Persistent left sidebar (w-64) with collapsible mobile drawer
- Top bar showing user streak, daily progress ring, profile
- Quick stats always visible: "23-day streak 🔥", "Today: 4/5 challenges"

### Hero Section (Landing Page)
**Layout**: Full-width section with two-column grid (60/40 split)
- Left: Headline, subheadline, dual CTA buttons (primary + secondary), trust indicators below
- Right: Hero image showing Omi necklace in use with floating UI elements overlay
- Background: Subtle gradient mesh or playful blob shapes (CSS, not image)
- Height: min-h-screen on desktop, natural stacking on mobile

**Images Needed**:
1. **Hero Image**: Person wearing Omi necklace having conversation, candid lifestyle shot, warm natural lighting - place right side of hero
2. **Feature Illustrations**: Playful vector-style illustrations for each feature card
3. **Dashboard Preview**: Screenshot of app showing progress/challenges - use in features section

### Cards & Content Blocks

**Challenge Cards** (App):
- Rounded-2xl with soft shadow (shadow-lg)
- Header area with icon, title, difficulty badge
- Audio waveform visualization placeholder
- "Your words" vs "Better version" comparison layout
- Action buttons at bottom (Listen Again, Mark Complete)
- Size: Full-width mobile, grid-cols-2 on tablet, grid-cols-3 on desktop

**Progress Cards**:
- Circular progress rings for daily goals
- Stat cards with large number + label + trend indicator
- Weekly heatmap calendar showing activity
- Achievement badges in grid layout (unlock animation state)

**Feature Cards** (Landing):
- Icon-first design with playful illustrations
- 3-column grid on desktop (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Hover lift effect (translate-y-1 transform)
- Consistent height with flex layout

### Forms & Inputs

**Input Fields**:
- Rounded-lg borders with focus ring (ring-2 offset-2)
- Floating labels or persistent labels above
- Helper text below in smaller size
- Icon prefixes where appropriate (microphone, globe, user)

**Buttons**:
- Primary: Rounded-full, px-8 py-4, font-semibold, shadow-md
- Secondary: Rounded-full, px-6 py-3, outline style
- Icon buttons: Rounded-full, p-3, for actions
- If placed over images: backdrop-blur-sm with semi-transparent background

### Dashboard Layout

**Three-Column App Structure**:
1. **Left Sidebar** (w-64): Navigation, streak counter, profile
2. **Main Content** (flex-1): Challenge feed, scrollable
3. **Right Panel** (w-80, hidden on mobile): Today's stats, upcoming reviews, quick tips

**Mobile**: Single column with bottom tab navigation

### Data Display

**Audio Playback Widget**:
- Compact player with waveform visualization
- Play/pause, timestamp, playback speed controls
- Rounded-xl container with inner padding p-4

**Comparison View** (Original vs Corrected):
- Side-by-side cards on desktop, stacked on mobile
- Visual diff highlighting with subtle background treatment
- Audio clip associated with each version

**Progress Visualization**:
- Ring charts for completion percentages
- Bar graphs for weekly trends
- Calendar heatmap for activity streaks (GitHub-style)

---

## Landing Page Structure

1. **Hero** (full-width, min-h-screen): Headline, dual CTAs, hero image, floating UI preview
2. **How It Works** (3-step process): Visual timeline with illustrations, 3-column grid
3. **Features** (showcase): 6 feature cards in 2-row grid, icon + title + description
4. **Demo Section**: Large embedded video or interactive preview
5. **Progress Dashboard Preview**: Screenshot with annotations showing key features
6. **Testimonials**: 3-column grid with user photos, quotes, names, language learned
7. **Pricing/CTA**: Simple pricing card with feature list, prominent CTA
8. **Footer**: Newsletter signup, social links, quick navigation, trust badges (app stores)

---

## Icons & Assets

**Icon Library**: Heroicons (outline for navigation, solid for emphasis)
**Key Icons**: microphone, chart-bar, fire (streak), star (achievement), clock, globe, headphones, check-circle

**Illustrations Style**: Playful, flat vector style with rounded shapes - use for feature explanations

**Audio Waveforms**: Use libraries like wavesurfer.js for visualization

---

## Animation Guidelines

**Use Sparingly**:
- Progress ring fill animations on achievement
- Card hover lift (transform translate-y)
- Streak counter increment with confetti burst (on milestone)
- Challenge card flip reveal
- NO scroll-triggered animations on landing page
- Page transitions: Simple fade or slide, 200-300ms duration

---

## Accessibility

- Maintain WCAG AA contrast ratios throughout
- All interactive elements keyboard navigable
- Focus indicators on all inputs/buttons
- Audio players include visual playback indicators
- Form validation with clear error messages
- Screen reader labels for icon-only buttons