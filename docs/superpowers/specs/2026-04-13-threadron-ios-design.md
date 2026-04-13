# Threadron iOS App — Design Spec

## Overview

Native SwiftUI iPhone app providing feature parity with the Threadron web dashboard. Dark theme faithful to the existing design language. Zero third-party dependencies.

**Target:** iOS 17+ (iPhone only)
**Language:** Swift, SwiftUI
**Architecture:** MVVM with `@Observable` macro, `async/await` networking
**Backend:** REST API at `https://api-production-ca21c.up.railway.app/v1`

## Authentication

### Flow
1. **First launch:** Email/password login or registration form
2. **Registration:** POST `/users/register` returns `{user, token, api_key}`. Store JWT in Keychain. Show onboarding (create domain, reveal API key).
3. **Login:** POST `/users/login` returns `{user, token}`. Store JWT in Keychain with biometric protection flag.
4. **Returning sessions:** Prompt Face ID / Touch ID to unlock Keychain-stored JWT. Fall back to email/password if biometric fails or is unavailable.
5. **Token expiry:** JWT is 7-day. On 401 response, clear Keychain, route to login screen.

### Implementation
- `KeychainManager` — wraps Security framework. Stores JWT with `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` + `kSecAccessControlBiometryCurrentSet`.
- `AuthManager` (@Observable) — holds `isAuthenticated`, `currentUser`, `token`. Manages login/register/logout/biometric flows.

## Navigation

### Structure
```
TabView (3 tabs)
├── Tab 1: Tasks
│   └── NavigationStack
│       ├── TaskBoardView (root)
│       │   ├── .sheet → NewTaskView
│       │   └── NavigationLink → TaskDetailView
│       │       └── .sheet → AddContextView / AddArtifactView
│       └── (domain/project/tag filters inline)
├── Tab 2: Agents
│   └── NavigationStack
│       └── AgentListView (root)
└── Tab 3: Settings
    └── NavigationStack
        ├── SettingsView (root)
        │   ├── .sheet → NewDomainView
        │   └── .sheet → NewAPIKeyView
        └── (account, domains, API keys, sign out)
```

### Tab Bar
- Tasks (SF Symbol: `checklist`)
- Agents (SF Symbol: `cpu`)
- Settings (SF Symbol: `gearshape`)

## Screens

### 1. Login / Register

Two-mode screen toggled by "Don't have an account?" / "Already have an account?" link.

**Login mode:**
- Email field (`.textContentType(.emailAddress)`, `.keyboardType(.emailAddress)`)
- Password field (`.textContentType(.password)`, `SecureField`)
- "Sign In" button (full-width, white on black)
- Face ID button (shown only if biometric is available AND a token exists in Keychain)
- Toggle to Register

**Register mode:**
- Name field
- Email field
- Password field
- "Create Account" button
- Toggle to Login

**Branding:** "threadron" in bold 32pt, "agent task orchestration" subtitle in monospace.

**Error handling:** Inline error text below form in red (#ef4444).

### 2. Tasks Board (Tab 1 Root)

Single scrollable view with three zones, matching the web dashboard's Active / Queue / Done layout.

**Header:**
- Large title "Tasks"
- "+ New Task" button (top-right, white pill)

**Filter Strip:**
- Domain pills: Horizontal `ScrollView` of capsule buttons. "All" selected by default (white fill). Others show name + task count badge. Tapping filters client-side.
- Project pills: Second row below domains. "All Projects" default. Only show projects for selected domain.
- Tag pills (if any tags exist): Third row, multi-select toggle with `#` prefix.

**Active Section:**
- Section header: "ACTIVE" in uppercase monospace + task count
- Grouped by project (project name as sub-header in dim monospace, alphabetical, ungrouped last)
- Each task is a `TaskCardView`:
  - Title (15pt, semibold)
  - `current_state` (13pt, muted)
  - `next_action` (12pt, green)
  - First blocker if any (12pt, red with `⊘` prefix)
  - Footer: claimed_by with lock icon OR assignee, relative timestamp
  - Priority dot (colored, top-right corner)
  - Red border (`#ef4444`) if status == `blocked`
  - Tap → push `TaskDetailView`
  - Long-press → copy task ID with haptic

**Queue Section:**
- Section header: "QUEUE" + count
- Grouped by project (collapsible with chevron)
- Compact list rows in a single card:
  - Priority dot (left)
  - Title (14pt)
  - Chevron (right)
  - Swipe-left to delete (with confirmation)
  - Tap → push `TaskDetailView`

**Done Section:**
- Collapsed by default (tap header to expand)
- Section header: "DONE" + count + expand chevron
- When expanded: list of completed/cancelled tasks at 50% opacity
  - Strikethrough title for completed
  - Status badge (completed = green, cancelled = gray)
  - Tap → push `TaskDetailView`

**Interactions:**
- Pull-to-refresh (re-fetches all tasks)
- All filtering is client-side (fetch once, filter in view model)

### 3. Task Detail (Push from Board)

Full-screen push navigation from any task card/row.

**Navigation bar:**
- Back button "Tasks"
- "Edit" button (toggles inline editing mode)

**Content (ScrollView):**

**Header:**
- Title (22pt, bold) — editable in edit mode
- Task ID + project name in monospace dim text
- Copy ID button (tap to copy, haptic feedback)

**Status Row:**
- Status badge (colored background pill) — tappable picker in edit mode
  - pending: gray, in_progress: yellow, completed: green, cancelled: gray, blocked: red
- Priority badge (colored pill) — read-only display
- Confidence badge (colored pill) — read-only display

**Field Cards** (each is a rounded card with label + value):
- Goal — editable `TextEditor` in edit mode
- Current State — editable
- Next Action — editable (green text)
- Outcome Definition — editable

**Tags:** Horizontal flow of capsule pills. In edit mode: add/remove tags.

**Metadata Row:**
- Assignee (read-only display)
- Claimed By (read-only, lock icon if claimed)

**Blockers Section:**
- List of blocker strings
- In edit mode: add blocker text field, remove via swipe

**Context Timeline:**
- Section header: "CONTEXT TIMELINE"
- Vertical timeline with left border line
- Each entry:
  - Type badge (colored: decision=purple, action_taken=green, blocker=red, observation=blue, state_transition=gray, handoff=orange, proposal=cyan, approval_requested=yellow, approval_received=green, artifact_created=gray)
  - Actor type + relative timestamp
  - Body text
- "Add Context" button → sheet with type picker, body text area, author field

**Artifacts Section:**
- Section header: "ARTIFACTS"
- Grouped list of artifacts with type icons:
  - file: `doc.fill`, branch: `arrow.triangle.branch`, commit: `smallcircle.filled.circle`, pull_request: `arrow.triangle.pull`, patch: `doc.badge.gearshape`, plan: `list.bullet.clipboard`, doc: `doc.text`, terminal_output: `terminal`
- Title + type label per row
- "Add Artifact" button → sheet with type picker, title, URI, body, created_by

### 4. New Task (Sheet Modal)

Presented as `.sheet` from Tasks board.

**Header:** "Cancel" (left), "New Task" (center), "Create" (right, blue, disabled until valid)

**Form fields:**
- Title (required) — text field
- Domain (required) — picker from user's domains
- Project — optional picker (filtered by selected domain)
- Priority — picker: low, medium, high, urgent (default: medium)
- Guardrail — picker: autonomous, notify, approval_required
- Goal — multi-line text
- Assignee — text field
- Tags — text field (comma-separated)

**Behavior:**
- "Create" sends POST `/tasks` with fields
- On success: dismiss sheet, haptic success, refresh task list
- On error: show inline error

### 5. Agents List (Tab 2 Root)

**Header:** Large title "Agents"

**List:** Grouped card with one row per agent:
- Agent name (15pt, semibold)
- Type + "Last seen X ago" (11pt, dim)
- Status dot (right):
  - Green: last_seen < 5 minutes
  - Yellow: last_seen < 1 hour
  - Gray: older

**Interactions:**
- Pull-to-refresh
- Tap agent row → could show detail (capabilities list) but not required for v1

### 6. Settings (Tab 3 Root)

iOS-native grouped list style (`Form` or `List` with `.listStyle(.insetGrouped)`).

**Sections:**

**Account:**
- Email (read-only)
- Face ID toggle (enable/disable biometric)

**Domains:**
- Row per domain: name + default guardrail
- Swipe-to-delete (with confirmation alert)
- "+ Add Domain" row → sheet with name field + guardrail picker

**API Keys:**
- Row per key: name + redacted prefix (monospace)
- Swipe-to-delete (revoke, with confirmation)
- "+ Create Key" row → sheet with name field + optional agent picker
- On creation: full key shown once with copy button

**Danger Zone:**
- "Sign Out" button (red text, centered)
- Confirmation alert before signing out

## Design System

### Colors (matching web dashboard exactly)
```swift
extension Color {
    static let bgPrimary = Color(hex: "#0a0a0a")       // app background
    static let bgSurface = Color(hex: "#1a1a1a")       // cards, inputs
    static let border = Color(hex: "#2a2a2a")           // dividers, borders
    static let textPrimary = Color(hex: "#f0f0f0")      // main text
    static let textMuted = Color(hex: "#8a8a8a")        // secondary text
    static let textDim = Color(hex: "#4a4a4a")          // tertiary text
    
    // Priority
    static let priorityLow = Color(hex: "#22c55e")      // green
    static let priorityMedium = Color(hex: "#eab308")    // yellow
    static let priorityHigh = Color(hex: "#f97316")      // orange
    static let priorityUrgent = Color(hex: "#ef4444")    // red
    
    // Status
    static let statusBlocked = Color(hex: "#ef4444")     // red border
    
    // Context types
    static let ctxObservation = Color(hex: "#3b82f6")    // blue
    static let ctxAction = Color(hex: "#22c55e")         // green
    static let ctxDecision = Color(hex: "#a855f7")       // purple
    static let ctxBlocker = Color(hex: "#ef4444")        // red
    static let ctxHandoff = Color(hex: "#f97316")        // orange
    static let ctxProposal = Color(hex: "#06b6d4")       // cyan
    static let ctxApprovalReq = Color(hex: "#eab308")    // yellow
    static let ctxApprovalRcvd = Color(hex: "#22c55e")   // green
    static let ctxDim = Color(hex: "#6b7280")            // gray (state_transition, artifact_created)
}
```

### Typography
- Large titles: 28pt, bold, -0.5pt tracking (Inter equivalent: SF Pro Display)
- Card titles: 15pt, semibold
- Body: 13-14pt
- Labels: 9-10pt, uppercase, monospace (SF Mono), 1.5-2pt letter spacing
- Monospace content: SF Mono

### Spacing
- Card padding: 14-16pt
- Section gaps: 16pt
- Element gaps: 8-12pt
- Filter pill padding: 6pt vertical, 14pt horizontal

### Components
- **Card:** `bgSurface` background, 1pt `border` stroke, 10pt corner radius
- **Badge/Pill:** Colored background at 15% opacity, colored text, 6pt corner radius, 5pt vertical / 12pt horizontal padding
- **Filter Pill:** Capsule shape. Selected: white fill, black text. Unselected: `bgSurface` fill, `border` stroke, muted text.
- **Section Header:** Uppercase monospace, `textMuted` color, 2pt letter spacing
- **Timeline Line:** 2pt wide `border` color, left edge
- **Priority Dot:** 7-8pt circle, priority color fill

### Dark Theme
The app is dark-only, matching the web dashboard. No light mode support needed — the `bgPrimary` (#0a0a0a) is the app's identity.

## Data Layer

### API Client
```
APIClient (actor)
├── baseURL: URL
├── token: String? (from AuthManager)
├── request<T: Decodable>(_ endpoint: Endpoint) async throws -> T
├── Automatic 401 handling → triggers AuthManager.logout()
└── All responses decoded through JSONDecoder with .iso8601 date strategy
```

### Endpoint Enum
Type-safe endpoint definitions:
```
enum Endpoint {
    // Auth
    case register(email, password, name)
    case login(email, password)
    case me
    
    // Domains
    case listDomains
    case createDomain(name, guardrail?)
    case deleteDomain(id)
    
    // Projects
    case listProjects(domainId?)
    case createProject(name, domainId, description?)
    case deleteProject(id)
    
    // Tasks
    case listTasks(filters...)
    case getTask(id)
    case createTask(fields...)
    case updateTask(id, fields...)
    case deleteTask(id)
    case claimTask(id, agentId, duration?, allowParallel?)
    case releaseTask(id, agentId?)
    
    // Context
    case listContext(taskId)
    case addContext(taskId, type, body, author, actorType?)
    
    // Artifacts
    case listArtifacts(taskId)
    case addArtifact(taskId, type, uri?, body?, title?, createdBy, metadata?)
    
    // Agents
    case listAgents
    
    // Config
    case listConfig
    case upsertConfig(key, value)
    
    // API Keys
    case listKeys
    case createKey(name?, agentId?)
    case deleteKey(id)
}
```

### Models
Swift structs conforming to `Codable`, matching the database schema:

- `User` (id, email, name, createdAt)
- `Domain` (id, name, userId, defaultGuardrail, createdAt, updatedAt)
- `Project` (id, name, domainId, description, createdAt, updatedAt)
- `Task` (id, title, status, domainId, projectId, assignee, createdBy, priority, guardrail, dependencies, dueDate, tags, metadata, goal, currentState, nextAction, blockers, outcomeDefinition, confidence, claimedBy, claimExpiresAt, createdAt, updatedAt)
- `ContextEntry` (id, taskId, type, body, author, actorType, createdAt, updatedAt)
- `Artifact` (id, taskId, type, uri, body, title, createdBy, metadata, createdAt)
- `Agent` (id, name, type, userId, capabilities, lastSeen, createdAt, updatedAt)
- `APIKey` (id, keyPrefix, name, agentId, userId, createdAt) — note: full key only on creation response
- `Config` (id, key, userId, value, updatedAt)

All date fields use ISO 8601 decoding. Enum types (`TaskStatus`, `Priority`, `Guardrail`, `Confidence`, `ContextType`, `ArtifactType`, `ActorType`) as Swift enums with `String` raw values for Codable.

### View Models (all @Observable)

**AuthManager:**
- `isAuthenticated: Bool`
- `currentUser: User?`
- `login(email:password:)`, `register(email:password:name:)`, `logout()`
- `attemptBiometric()` — LAContext Face ID/Touch ID
- Publishes auth state for root view switching

**TaskStore:**
- `tasks: [Task]`
- `selectedDomain: Domain?`, `selectedProject: Project?`, `selectedTags: Set<String>`
- `filteredActiveTasks`, `filteredQueueTasks`, `filteredDoneTasks` (computed)
- `fetchTasks()`, `createTask(...)`, `updateTask(...)`, `deleteTask(...)`
- Groups active tasks by project for display

**DomainStore:**
- `domains: [Domain]`, `projects: [Project]`
- `fetchDomains()`, `createDomain(...)`, `deleteDomain(...)`
- `fetchProjects(domainId:)`, `createProject(...)`, `deleteProject(...)`

**AgentStore:**
- `agents: [Agent]`
- `fetchAgents()`

**SettingsStore:**
- `apiKeys: [APIKey]`
- `config: [Config]`
- `createKey(...)`, `deleteKey(...)`, `fetchKeys()`
- `upsertConfig(...)`, `fetchConfig()`

## Native Touches

### Pull-to-Refresh
- Tasks board: `.refreshable { await taskStore.fetchTasks() }`
- Agents list: `.refreshable { await agentStore.fetchAgents() }`

### Haptic Feedback
- Task created: `UINotificationFeedbackGenerator().notificationOccurred(.success)`
- Task status changed: `.success`
- Copy to clipboard: `UIImpactFeedbackGenerator(style: .light).impactOccurred()`
- Delete action: `UINotificationFeedbackGenerator().notificationOccurred(.warning)`

### Swipe Actions
- Queue tasks: swipe-left to delete (`.swipeActions(edge: .trailing)`)
- Domains in settings: swipe-left to delete
- API keys in settings: swipe-left to revoke
- All destructive swipes show confirmation alert

### Long Press
- Task card: long-press to copy task ID to clipboard

### Face ID / Touch ID
- `LAContext` with `.deviceOwnerAuthenticationWithBiometrics`
- Triggered automatically on app launch if token exists in Keychain
- "Sign in with Face ID" button on login screen as manual trigger

## Project Structure
```
ThreadronApp/
├── ThreadronApp.swift              // @main, root view switching on auth state
├── Info.plist                      // NSFaceIDUsageDescription
├── Assets.xcassets/                // App icon, accent color
├── Models/
│   ├── User.swift
│   ├── Domain.swift
│   ├── Project.swift
│   ├── Task.swift
│   ├── ContextEntry.swift
│   ├── Artifact.swift
│   ├── Agent.swift
│   ├── APIKey.swift
│   └── Enums.swift                 // TaskStatus, Priority, Guardrail, etc.
├── Services/
│   ├── APIClient.swift             // Actor, URLSession, endpoint dispatch
│   ├── Endpoint.swift              // Type-safe endpoint enum
│   ├── KeychainManager.swift       // Security framework wrapper
│   └── HapticManager.swift         // Centralized haptic triggers
├── ViewModels/
│   ├── AuthManager.swift
│   ├── TaskStore.swift
│   ├── DomainStore.swift
│   ├── AgentStore.swift
│   └── SettingsStore.swift
├── Views/
│   ├── Auth/
│   │   └── LoginView.swift         // Login + Register toggle
│   ├── Tasks/
│   │   ├── TaskBoardView.swift     // Main board with filters
│   │   ├── TaskCardView.swift      // Active task card
│   │   ├── TaskRowView.swift       // Queue compact row
│   │   ├── TaskDetailView.swift    // Full detail + edit
│   │   ├── NewTaskView.swift       // Creation sheet
│   │   ├── AddContextView.swift    // Add context entry sheet
│   │   └── AddArtifactView.swift   // Add artifact sheet
│   ├── Agents/
│   │   └── AgentListView.swift
│   ├── Settings/
│   │   ├── SettingsView.swift      // Grouped list
│   │   ├── NewDomainView.swift     // Domain creation sheet
│   │   └── NewAPIKeyView.swift     // Key creation sheet
│   └── Shared/
│       ├── FilterPillsView.swift   // Reusable horizontal pill strip
│       ├── BadgeView.swift         // Status/priority/context type badges
│       ├── SectionHeaderView.swift // Uppercase monospace label
│       └── TimeAgoText.swift       // Relative timestamp display
└── Extensions/
    ├── Color+Hex.swift             // Color(hex:) initializer
    ├── Color+Theme.swift           // Design system colors
    └── Date+Relative.swift         // "2h ago" formatting
```

## Onboarding Flow

Shown after first registration (not after login):

1. **Welcome screen:** App description + "Get Started" button
2. **Create Domain:** Name field + guardrail picker (autonomous/notify/approval_required)
3. **API Key Reveal:** Full key shown once + copy button + usage snippet
4. **Ready:** Tips on connecting agents, dismiss to main app

State tracked via `UserDefaults` key `onboarding_complete`. Initial API key stored temporarily for display.

## Error Handling

- Network errors: Show inline error text or alert depending on context
- 401 responses: Auto-logout, clear Keychain, show login
- Form validation: Disable submit button until required fields filled
- Empty states: Dashed-border placeholder views with helpful text ("No tasks yet", "No agents registered")
- Loading states: `ProgressView()` spinners, disabled buttons during async operations

## Out of Scope (v1)

- iPad support (can be added later with `NavigationSplitView`)
- Push notifications (requires APNs backend integration)
- Widgets
- Offline caching
- Real-time updates / WebSocket
- Dark/light theme toggle (dark only)
- Task reordering / drag-and-drop
- Search bar (filter pills handle discovery for v1)
