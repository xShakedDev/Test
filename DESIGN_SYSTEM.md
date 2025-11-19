# Gates Control System - Premium Design System

## Design Philosophy

**Vision**: A premium, handcrafted digital experience that communicates safety, reliability, professionalism, and cutting-edge technology for industrial gate control systems.

**Core Principles**:
- **Intentional Craftsmanship**: Every element feels purposefully designed, not templated
- **Soft Depth**: Subtle shadows, layered composition, meaningful whitespace
- **Fluid Motion**: Smooth transitions, micro-interactions, scroll-linked animations
- **Professional Trust**: Clean, reliable, industrial-grade aesthetic
- **Modern Innovation**: Contemporary patterns without clichés

---

## Color Palette

### Primary Colors
- **Primary Blue**: `#0A5CFF` - Trust, technology, reliability
- **Primary Dark**: `#001A4D` - Depth, professionalism
- **Primary Light**: `#E6F0FF` - Soft backgrounds, subtle highlights

### Secondary Colors
- **Accent Orange**: `#FF6B35` - Energy, action, alerts
- **Accent Teal**: `#00D4AA` - Success, confirmation, positive actions
- **Neutral Gray**: `#1A1F2E` - Text, borders, subtle elements

### Semantic Colors
- **Success**: `#10B981` (Green-500)
- **Warning**: `#F59E0B` (Amber-500)
- **Error**: `#EF4444` (Red-500)
- **Info**: `#3B82F6` (Blue-500)

### Neutral Scale
- **Gray-900**: `#0F172A` - Primary text
- **Gray-800**: `#1E293B` - Secondary text
- **Gray-700**: `#334155` - Tertiary text
- **Gray-600**: `#475569` - Placeholder text
- **Gray-500**: `#64748B` - Disabled text
- **Gray-400**: `#94A3B8` - Borders
- **Gray-300**: `#CBD5E1` - Light borders
- **Gray-200**: `#E2E8F0` - Subtle backgrounds
- **Gray-100**: `#F1F5F9` - Card backgrounds
- **Gray-50**: `#F8FAFC` - Page backgrounds

### Dark Mode Palette
- **Background**: `#0A0E1A` - Deep dark blue-black
- **Surface**: `#151B2E` - Elevated surfaces
- **Surface Elevated**: `#1E2538` - Cards, modals
- **Text Primary**: `#F8FAFC`
- **Text Secondary**: `#CBD5E1`
- **Border**: `#1E293B`

---

## Typography

### Font Stack
**Primary**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
**Monospace**: `'JetBrains Mono', 'Fira Code', monospace` (for code, numbers)

### Type Scale
- **Display 1**: 72px / 80px (1.11) - Hero headlines
- **Display 2**: 56px / 64px (1.14) - Section headlines
- **H1**: 48px / 56px (1.17) - Page titles
- **H2**: 36px / 44px (1.22) - Section titles
- **H3**: 30px / 38px (1.27) - Subsection titles
- **H4**: 24px / 32px (1.33) - Card titles
- **H5**: 20px / 28px (1.4) - Small headings
- **H6**: 18px / 26px (1.44) - Labels
- **Body Large**: 18px / 28px (1.56) - Lead paragraphs
- **Body**: 16px / 24px (1.5) - Default text
- **Body Small**: 14px / 20px (1.43) - Secondary text
- **Caption**: 12px / 16px (1.33) - Labels, metadata

### Font Weights
- **Light**: 300
- **Regular**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700
- **Extrabold**: 800

---

## Spacing System

Based on 8px grid:
- **0**: 0px
- **1**: 4px (0.25rem)
- **2**: 8px (0.5rem)
- **3**: 12px (0.75rem)
- **4**: 16px (1rem)
- **5**: 20px (1.25rem)
- **6**: 24px (1.5rem)
- **8**: 32px (2rem)
- **10**: 40px (2.5rem)
- **12**: 48px (3rem)
- **16**: 64px (4rem)
- **20**: 80px (5rem)
- **24**: 96px (6rem)

---

## Grid System

### Breakpoints
- **Mobile**: 0-767px
- **Tablet**: 768-1023px
- **Desktop**: 1024-1439px
- **Large Desktop**: 1440px+

### Container Widths
- **Mobile**: 100% (with 16px padding)
- **Tablet**: 100% (with 24px padding)
- **Desktop**: 1280px max-width
- **Large Desktop**: 1440px max-width

### Grid Columns
- **Mobile**: 4 columns, 16px gutters
- **Tablet**: 8 columns, 24px gutters
- **Desktop**: 12 columns, 32px gutters

---

## Component Library

### Buttons

#### Primary Button
- **Background**: Primary Blue gradient (`#0A5CFF` to `#0047CC`)
- **Text**: White
- **Padding**: 14px 28px
- **Border Radius**: 12px
- **Font**: 16px, Semibold
- **Shadow**: `0 4px 12px rgba(10, 92, 255, 0.3)`
- **Hover**: Lift 2px, shadow intensifies
- **Active**: Press down 1px
- **Transition**: 200ms cubic-bezier(0.4, 0, 0.2, 1)

#### Secondary Button
- **Background**: Transparent
- **Border**: 2px solid Primary Blue
- **Text**: Primary Blue
- **Hover**: Background fills with Primary Blue at 10% opacity

#### Ghost Button
- **Background**: Transparent
- **Text**: Gray-700
- **Hover**: Background Gray-100

#### Danger Button
- **Background**: Error red gradient
- **Text**: White
- **Shadow**: Red shadow

### Cards

#### Standard Card
- **Background**: White (or Gray-50 in light mode)
- **Border**: 1px solid Gray-200
- **Border Radius**: 16px
- **Padding**: 24px
- **Shadow**: `0 1px 3px rgba(0, 0, 0, 0.1)`
- **Hover**: Shadow elevates to `0 4px 12px rgba(0, 0, 0, 0.15)`

#### Elevated Card
- **Shadow**: `0 8px 24px rgba(0, 0, 0, 0.12)`
- **Border Radius**: 20px
- **Padding**: 32px

#### Interactive Card
- **Hover**: Transform translateY(-4px)
- **Transition**: 300ms ease-out
- **Cursor**: Pointer

### Forms

#### Input Fields
- **Height**: 48px
- **Padding**: 12px 16px
- **Border**: 1px solid Gray-300
- **Border Radius**: 8px
- **Font**: 16px, Regular
- **Focus**: Border Primary Blue, shadow `0 0 0 3px rgba(10, 92, 255, 0.1)`
- **Error**: Border Error red
- **Disabled**: Background Gray-100, text Gray-500

#### Labels
- **Font**: 14px, Semibold
- **Color**: Gray-700
- **Margin Bottom**: 8px

#### Help Text
- **Font**: 12px, Regular
- **Color**: Gray-600
- **Margin Top**: 4px

### Navigation

#### Header
- **Height**: 72px
- **Background**: White with backdrop blur
- **Border Bottom**: 1px solid Gray-200
- **Sticky**: Yes, with smooth hide/show on scroll
- **Z-index**: 1000

#### Nav Links
- **Font**: 15px, Medium
- **Color**: Gray-700
- **Padding**: 8px 16px
- **Border Radius**: 8px
- **Active**: Background Primary Blue, text White
- **Hover**: Background Gray-100

### Icons

#### Style
- **Line weight**: 1.5px (stroke-width)
- **Size**: 20px default, 24px large, 16px small
- **Color**: Inherit from parent or Gray-700
- **Library**: Custom SVG icons or Lucide React

---

## Animation & Motion

### Timing Functions
- **Ease Out**: `cubic-bezier(0.4, 0, 0.2, 1)` - Default
- **Ease In**: `cubic-bezier(0.4, 0, 1, 1)` - Entrances
- **Ease In Out**: `cubic-bezier(0.4, 0, 0.2, 1)` - Complex animations
- **Spring**: `cubic-bezier(0.68, -0.55, 0.265, 1.55)` - Playful

### Durations
- **Instant**: 100ms - Micro-interactions
- **Fast**: 200ms - Hover states, button clicks
- **Normal**: 300ms - Card transitions, modal opens
- **Slow**: 500ms - Page transitions, complex animations

### Animation Patterns

#### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

#### Slide Up
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Scale In
```css
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

#### Stagger Children
Use `animation-delay` with `nth-child()` selectors for staggered reveals.

### Scroll-Linked Animations
- **Parallax**: Subtle background movement (0.5x speed)
- **Fade on Scroll**: Elements fade in as they enter viewport
- **Sticky Sections**: Headers stick, content scrolls underneath

### Micro-Interactions
- **Button Press**: Scale down to 0.98 on active
- **Card Hover**: Lift 4px, shadow intensifies
- **Input Focus**: Border color transition, subtle glow
- **Loading States**: Skeleton screens, spinners with brand colors

---

## Layout Patterns

### Hero Section
- **Height**: 100vh (min 600px, max 900px)
- **Content**: Centered, max-width 800px
- **Background**: Gradient or subtle pattern
- **CTA**: Prominent, below headline
- **Scroll Indicator**: Animated arrow or "scroll" text

### Feature Grid
- **Columns**: 3 on desktop, 2 on tablet, 1 on mobile
- **Gap**: 32px
- **Card Style**: Elevated cards with icons
- **Animation**: Staggered fade-in on scroll

### Pricing Table
- **Layout**: 3 columns (desktop), cards (mobile)
- **Highlighted Plan**: Slightly larger, border Primary Blue
- **Features**: Checkmark list
- **CTA**: Full-width button in each card

### Content Sections
- **Max Width**: 1200px
- **Padding**: 80px vertical, 24px horizontal
- **Spacing**: 64px between sections

---

## Dark Mode

### Implementation
- **Toggle**: In header, icon-based
- **Storage**: localStorage preference
- **System Preference**: Respect `prefers-color-scheme`
- **Transition**: Smooth color transition (300ms)

### Color Adjustments
- All backgrounds shift to dark palette
- Text colors invert
- Borders become more subtle
- Shadows become more pronounced
- Gradients adjust for dark backgrounds

---

## Accessibility

### Requirements
- **WCAG AA** compliance minimum
- **Color Contrast**: 4.5:1 for text, 3:1 for UI elements
- **Focus States**: Visible, high contrast
- **Keyboard Navigation**: Full support
- **Screen Readers**: Semantic HTML, ARIA labels
- **Motion**: Respect `prefers-reduced-motion`

### Focus Indicators
- **Outline**: 2px solid Primary Blue
- **Offset**: 2px from element
- **Border Radius**: Match element radius

---

## Imagery Guidelines

### Photography Style
- **Industrial/IoT**: Clean, modern gate systems
- **Architecture**: Minimal, geometric
- **Technology**: Abstract, circuit-like patterns
- **Tone**: Professional, trustworthy, innovative

### Illustration Style
- **Line Art**: Minimal, 2px stroke weight
- **Geometric**: Abstract shapes, patterns
- **Icons**: Consistent style, 24px grid
- **Color**: Monochrome or brand colors only

### Image Treatment
- **Border Radius**: 12px for photos, 8px for icons
- **Shadows**: Subtle, only when elevated
- **Overlays**: Dark gradient for text readability

---

## Page-Specific Guidelines

### Homepage
- **Hero**: Large headline, value proposition, primary CTA
- **Features Preview**: 3-4 key features with icons
- **Social Proof**: Testimonials or usage stats
- **Final CTA**: Sign up or contact

### Features Page
- **Overview**: What the system does
- **Feature Grid**: Detailed feature cards
- **Integrations**: Logos or icons of supported systems
- **Use Cases**: Real-world scenarios

### Pricing Page
- **Plans**: Clear tier structure
- **Comparison**: Feature matrix
- **FAQ**: Common pricing questions
- **CTA**: "Get Started" buttons

### Support/Documentation
- **Search**: Prominent search bar
- **Categories**: Organized by topic
- **Articles**: Clean, readable layout
- **Contact**: Support form or chat widget

---

## Implementation Notes

### CSS Architecture
- **Methodology**: BEM (Block Element Modifier)
- **Organization**: Component-based, co-located styles
- **Variables**: CSS custom properties for theming
- **Responsive**: Mobile-first approach

### Performance
- **Images**: WebP format, lazy loading
- **Animations**: GPU-accelerated (transform, opacity)
- **Fonts**: Subset, preload critical fonts
- **Code Splitting**: Route-based

### Browser Support
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (last 2 versions)
- **Progressive Enhancement**: Core functionality works without JS
- **Fallbacks**: Graceful degradation for older browsers

---

## Design Tokens

All design decisions are codified as tokens for consistency:

```css
:root {
  /* Colors */
  --color-primary: #0A5CFF;
  --color-primary-dark: #001A4D;
  --color-primary-light: #E6F0FF;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-4: 16px;
  --space-8: 32px;
  
  /* Typography */
  --font-family: 'Inter', sans-serif;
  --font-size-base: 16px;
  --line-height-base: 1.5;
  
  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  
  /* Transitions */
  --transition-fast: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

*This design system is a living document and will evolve with the product.*

