# Frontend Design - Visual Layout

## Main Dashboard Page

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [Sidebar]          🔷 NOS QA Workflow Dashboard                     [User Menu] │
│  ┌────────┐         Welcome back, John Doe! (Admin)                              │
│  │  Home  │                                                                       │
│  ├────────┤         ┌─────────────┬─────────────┬─────────────┬─────────────┐   │
│  │ Stage1 │         │ Active: 3   │ Completed:5 │ Total: 8    │ Releases: 8 │   │
│  │ Stage2 │         │  [Clock]    │  [Check]    │  [Doc]      │  [Calendar] │   │
│  │ Stage3 │         └─────────────┴─────────────┴─────────────┴─────────────┘   │
│  │   ...  │                                                                       │
│  └────────┘         ┌──────────────────────────────────────────────────────┐   │
│  [Admin]            │ 🚀 Start New QA Workflow from Release    [Refresh]   │   │
│  [Profile]          │                                                       │   │
│  [Logout]           │ Select EXOS Release: [EXOS 34.1.1 ▼]                │   │
│                     │                                                       │   │
│                     │ ┌────────┬─────────────────────┬────────┬──────────┐│   │
│                     │ │Story ID│ Title                │ Type   │ Action   ││   │
│                     │ ├────────┼─────────────────────┼────────┼──────────┤│   │
│                     │ │NOS-3411│ BGP Routing API     │🔌 API  │[Start QA]││   │
│                     │ │NOS-3412│ VLAN Feature        │⚙️ Feat│[Start QA]││   │
│                     │ │NOS-3413│ OSPF REST API       │🔌 API  │[Start QA]││   │
│                     │ │NOS-3414│ QoS Policy Engine   │⚙️ Feat│[Start QA]││   │
│                     │ └────────┴─────────────────────┴────────┴──────────┘│   │
│                     └──────────────────────────────────────────────────────┘   │
│                                                                                  │
│                     ┌──────────────────────────────────────────────────────┐   │
│                     │ 🕐 Active Workflows                                   │   │
│                     │ ┌────────────────────┬─────────┬───────┬──────────┐ │   │
│                     │ │ Title              │ Release │ Stage │ Action   │ │   │
│                     │ ├────────────────────┼─────────┼───────┼──────────┤ │   │
│                     │ │ BGP Feature Test   │ 34.1.1  │ St 3  │ [Resume] │ │   │
│                     │ │ VLAN Validation    │ 33.2.0  │ St 7  │ [Resume] │ │   │
│                     │ └────────────────────┴─────────┴───────┴──────────┘ │   │
│                     └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Stage Page Layout (Example: Stage 1)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [Sidebar]          Workflow: BGP Routing Feature - EXOS 34.1.1                  │
│  ┌────────┐         ════════════════════════════════════════════════════════     │
│  │  Home  │         Progress: ▰▰▰▱▱▱▱▱▱  Stage 3 of 9                            │
│  ├────────┤         ════════════════════════════════════════════════════════     │
│  │✓Stage1 │                                                                      │
│  │✓Stage2 │         ┌─────────────────────────────────────────────────────┐    │
│  │●Stage3 │         │ 📄 Stage 3: Test Plan Generation                     │    │
│  │ Stage4 │         │                                                       │    │
│  │ Stage5 │         │  Option 1: Generate with LLM                         │    │
│  │   ...  │         │  ┌────────────────────────────────────────────────┐ │    │
│  └────────┘         │  │ Generate test plan from skill file and story   │ │    │
│                     │  │ details using AI model.                         │ │    │
│                     │  │                                                  │ │    │
│                     │  │ [🤖 Generate Test Plan]  [Loading: 45%...]     │ │    │
│                     │  └────────────────────────────────────────────────┘ │    │
│                     │                                                       │    │
│                     │  Option 2: Upload Existing Plan                      │    │
│                     │  ┌────────────────────────────────────────────────┐ │    │
│                     │  │ [📁 Drop file here or click to upload]          │ │    │
│                     │  │ Supported: .txt, .md, .docx                     │ │    │
│                     │  └────────────────────────────────────────────────┘ │    │
│                     │                                                       │    │
│                     │  Generated Plan Preview:                             │    │
│                     │  ┌────────────────────────────────────────────────┐ │    │
│                     │  │ # Test Plan for BGP Routing API                 │ │    │
│                     │  │                                                  │ │    │
│                     │  │ ## Test Case 1: BGP Neighbor Config            │ │    │
│                     │  │ - Verify neighbor addition via API              │ │    │
│                     │  │ - Verify neighbor removal                       │ │    │
│                     │  │ ...                                             │ │    │
│                     │  │                                                  │ │    │
│                     │  │ [✏️ Edit]  [💾 Save]                            │ │    │
│                     │  └────────────────────────────────────────────────┘ │    │
│                     │                                                       │    │
│                     │  [❌ Reject]  [✅ Approve & Continue to Stage 4]     │    │
│                     └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key UI Elements

### 1. **Sidebar Navigation**
```
┌────────────────┐
│ 🔷 NOS QA      │
│ Workflow       │
│ BGP Test       │ ← Current workflow title
├────────────────┤
│ 🏠 Dashboard   │ ← Always visible
├────────────────┤
│ ✓ Stage 1      │ ← Completed (green checkmark)
│ ✓ Stage 2      │
│ ● Stage 3      │ ← Active (blue dot)
│   Stage 4      │ ← Locked (gray, disabled)
│   Stage 5      │
│   ...          │
└────────────────┘
```

### 2. **Release Selector**
```
┌──────────────────────────────────────────┐
│ Select EXOS Release:                      │
│ ┌────────────────────────────────────┐   │
│ │ EXOS 34.1.1                    [▼] │   │
│ └────────────────────────────────────┘   │
│                                           │
│ Dropdown options:                         │
│  - EXOS 33.1.0                           │
│  - EXOS 33.1.1                           │
│  - EXOS 34.1.0                           │
│  - EXOS 34.1.1  ← Selected              │
│  - EXOS 34.2.0                           │
│  - EXOS 35.1.0                           │
└──────────────────────────────────────────┘
```

### 3. **Story Table**
```
┌──────┬────────────────────────────┬────────────┬────────┬───────────┐
│ ID   │ Title                       │ Type       │ Status │ Action    │
├──────┼────────────────────────────┼────────────┼────────┼───────────┤
│ NOS- │ BGP Routing Configuration  │ 🔌 API     │ Open   │ [Start QA]│
│ 3411 │ API for EXOS 34.1.1        │ Endpoint   │        │           │
├──────┼────────────────────────────┼────────────┼────────┼───────────┤
│ NOS- │ VLAN Tagging Feature       │ ⚙️ Feature │ In     │ [Start QA]│
│ 3412 │ Enhancement                │ Functional │ Progress│           │
├──────┼────────────────────────────┼────────────┼────────┼───────────┤
│ NOS- │ OSPF REST API              │ 🔌 API     │ Open   │ [Start QA]│
│ 3413 │ Implementation             │ Endpoint   │        │           │
└──────┴────────────────────────────┴────────────┴────────┴───────────┘
```

### 4. **Progress Bar**
```
Stage Progress:
════════════════════════════════════════════════════════════
▰▰▰▰▰▱▱▱▱  Stage 5 of 9 (55% Complete)

1✓  2✓  3✓  4✓  5●  6   7   8   9
```

### 5. **Workflow Statistics Cards**
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Active: 3   │  │ Completed:5 │  │ Total: 8    │  │ Releases: 8 │
│   🕐       │  │   ✅        │  │   📁        │  │   📅        │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
   (Blue)          (Green)          (Purple)         (Orange)
```

## Color Scheme

- **Primary Blue**: `#1677ff` - Actions, active items
- **Success Green**: `#52c41a` - Completed, approved items
- **Warning Orange**: `#faad14` - In progress, pending items
- **Error Red**: `#ff4d4f` - Failures, rejections
- **Purple**: `#722ed1` - Statistics, metrics
- **Dark Sidebar**: `#001529` - Sidebar background
- **Light Background**: `#f5f5f5` - Main content area

## Interactive Elements

### Buttons
- **Primary**: Blue background, white text - Main actions
- **Success**: Green background - Approve/Complete
- **Danger**: Red background - Reject/Delete
- **Default**: White background, gray border - Secondary actions
- **Link**: No background, blue text - Navigation links

### States
- **Hover**: Slight opacity change, pointer cursor
- **Active**: Darker shade, pressed appearance
- **Disabled**: Gray, no pointer, 50% opacity
- **Loading**: Spinner icon, "Loading..." text

## Responsive Behavior

- **Desktop (>1200px)**: Full layout with sidebar
- **Tablet (768-1200px)**: Collapsible sidebar, compact tables
- **Mobile (<768px)**: Hidden sidebar (hamburger menu), stacked cards

## Accessibility

- ✅ Keyboard navigation support
- ✅ ARIA labels for screen readers
- ✅ High contrast colors (WCAG AA compliant)
- ✅ Focus indicators on interactive elements
- ✅ Semantic HTML structure
