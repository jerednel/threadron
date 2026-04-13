# Threadron iOS App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native SwiftUI iPhone app providing feature parity with the Threadron web dashboard — dark theme, tab-based navigation, full task/agent/settings management.

**Architecture:** MVVM with `@Observable` (iOS 17), `async/await` networking via `URLSession` actor, Keychain + Face ID auth. Zero third-party dependencies. All JSON uses snake_case from the API; the `JSONDecoder` uses `.convertFromSnakeCase` key strategy.

**Tech Stack:** Swift 6.1, SwiftUI, iOS 17+, Xcode 16.4, XcodeGen for project generation

**Spec:** `docs/superpowers/specs/2026-04-13-threadron-ios-design.md`

**API Base URL:** `https://api-production-ca21c.up.railway.app/v1`

---

## File Structure

```
ios/
├── project.yml                         # XcodeGen project definition
└── Threadron/
    ├── ThreadronApp.swift
    ├── Info.plist
    ├── Assets.xcassets/
    │   └── AccentColor.colorset/
    │       └── Contents.json
    ├── Models/
    │   ├── Enums.swift
    │   ├── User.swift
    │   ├── Domain.swift
    │   ├── Project.swift
    │   ├── TaskModel.swift
    │   ├── ContextEntry.swift
    │   ├── Artifact.swift
    │   ├── Agent.swift
    │   └── APIKeyModel.swift
    ├── Services/
    │   ├── Endpoint.swift
    │   ├── APIClient.swift
    │   ├── KeychainManager.swift
    │   └── HapticManager.swift
    ├── ViewModels/
    │   ├── AuthManager.swift
    │   ├── DomainStore.swift
    │   ├── TaskStore.swift
    │   ├── AgentStore.swift
    │   └── SettingsStore.swift
    ├── Views/
    │   ├── Auth/
    │   │   └── LoginView.swift
    │   ├── Onboarding/
    │   │   └── OnboardingView.swift
    │   ├── Tasks/
    │   │   ├── TaskBoardView.swift
    │   │   ├── TaskCardView.swift
    │   │   ├── TaskRowView.swift
    │   │   ├── TaskDetailView.swift
    │   │   ├── NewTaskView.swift
    │   │   ├── AddContextView.swift
    │   │   └── AddArtifactView.swift
    │   ├── Agents/
    │   │   └── AgentListView.swift
    │   ├── Settings/
    │   │   ├── SettingsView.swift
    │   │   ├── NewDomainView.swift
    │   │   └── NewAPIKeyView.swift
    │   └── Shared/
    │       ├── FilterPillsView.swift
    │       ├── BadgeView.swift
    │       ├── SectionHeaderView.swift
    │       └── TimeAgoText.swift
    └── Extensions/
        ├── Color+Hex.swift
        ├── Color+Theme.swift
        └── Date+Relative.swift
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `ios/project.yml`
- Create: `ios/Threadron/Info.plist`
- Create: `ios/Threadron/Assets.xcassets/AccentColor.colorset/Contents.json`
- Create: `ios/Threadron/Assets.xcassets/Contents.json`

- [ ] **Step 1: Install XcodeGen**

```bash
brew install xcodegen
```

Expected: xcodegen binary available at `$(which xcodegen)`.

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p ios/Threadron/{Models,Services,ViewModels,Views/{Auth,Onboarding,Tasks,Agents,Settings,Shared},Extensions,Assets.xcassets/AccentColor.colorset}
```

- [ ] **Step 3: Create project.yml**

Create `ios/project.yml`:

```yaml
name: Threadron
options:
  bundleIdPrefix: com.threadron
  deploymentTarget:
    iOS: "17.0"
  xcodeVersion: "16.4"
settings:
  base:
    SWIFT_VERSION: "6.0"
    IPHONEOS_DEPLOYMENT_TARGET: "17.0"
    TARGETED_DEVICE_FAMILY: "1"
    INFOPLIST_FILE: Threadron/Info.plist
    ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
targets:
  Threadron:
    type: application
    platform: iOS
    sources:
      - path: Threadron
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.threadron.app
        MARKETING_VERSION: "1.0.0"
        CURRENT_PROJECT_VERSION: "1"
        SWIFT_STRICT_CONCURRENCY: complete
    info:
      path: Threadron/Info.plist
      properties:
        CFBundleDisplayName: Threadron
        NSFaceIDUsageDescription: "Sign in with Face ID for quick access"
        UILaunchScreen: {}
        UIUserInterfaceStyle: Dark
```

- [ ] **Step 4: Create Info.plist**

Create `ios/Threadron/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Threadron</string>
    <key>NSFaceIDUsageDescription</key>
    <string>Sign in with Face ID for quick access</string>
    <key>UILaunchScreen</key>
    <dict/>
    <key>UIUserInterfaceStyle</key>
    <string>Dark</string>
</dict>
</plist>
```

- [ ] **Step 5: Create asset catalog files**

Create `ios/Threadron/Assets.xcassets/Contents.json`:

```json
{
  "info": {
    "version": 1,
    "author": "xcode"
  }
}
```

Create `ios/Threadron/Assets.xcassets/AccentColor.colorset/Contents.json`:

```json
{
  "colors": [
    {
      "color": {
        "color-space": "srgb",
        "components": {
          "red": "0.941",
          "green": "0.941",
          "blue": "0.941",
          "alpha": "1.000"
        }
      },
      "idiom": "universal"
    }
  ],
  "info": {
    "version": 1,
    "author": "xcode"
  }
}
```

- [ ] **Step 6: Create a stub app entry point so the project compiles**

Create `ios/Threadron/ThreadronApp.swift`:

```swift
import SwiftUI

@main
struct ThreadronApp: App {
    var body: some Scene {
        WindowGroup {
            Text("Threadron")
                .preferredColorScheme(.dark)
        }
    }
}
```

- [ ] **Step 7: Generate Xcode project and verify build**

```bash
cd ios && xcodegen generate
xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 8: Commit**

```bash
git add ios/
git commit -m "feat(ios): scaffold Threadron Xcode project with XcodeGen"
```

---

### Task 2: Extensions — Color + Date

**Files:**
- Create: `ios/Threadron/Extensions/Color+Hex.swift`
- Create: `ios/Threadron/Extensions/Color+Theme.swift`
- Create: `ios/Threadron/Extensions/Date+Relative.swift`

- [ ] **Step 1: Create Color+Hex.swift**

```swift
import SwiftUI

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = Double(rgbValue & 0x0000FF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}
```

- [ ] **Step 2: Create Color+Theme.swift**

```swift
import SwiftUI

extension Color {
    // Backgrounds
    static let bgPrimary = Color(hex: "0a0a0a")
    static let bgSurface = Color(hex: "1a1a1a")
    static let bgBorder = Color(hex: "2a2a2a")

    // Text
    static let textPrimary = Color(hex: "f0f0f0")
    static let textMuted = Color(hex: "8a8a8a")
    static let textDim = Color(hex: "4a4a4a")

    // Priority
    static let priorityLow = Color(hex: "22c55e")
    static let priorityMedium = Color(hex: "eab308")
    static let priorityHigh = Color(hex: "f97316")
    static let priorityUrgent = Color(hex: "ef4444")

    // Context types
    static let ctxObservation = Color(hex: "3b82f6")
    static let ctxAction = Color(hex: "22c55e")
    static let ctxDecision = Color(hex: "a855f7")
    static let ctxBlocker = Color(hex: "ef4444")
    static let ctxHandoff = Color(hex: "f97316")
    static let ctxProposal = Color(hex: "06b6d4")
    static let ctxApprovalReq = Color(hex: "eab308")
    static let ctxApprovalRcvd = Color(hex: "22c55e")
    static let ctxDim = Color(hex: "6b7280")

    // Interactive
    static let linkBlue = Color(hex: "6aadff")
}
```

- [ ] **Step 3: Create Date+Relative.swift**

```swift
import Foundation

extension Date {
    var timeAgo: String {
        let seconds = Int(-timeIntervalSinceNow)
        if seconds < 60 { return "just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h ago" }
        let days = hours / 24
        return "\(days)d ago"
    }
}
```

- [ ] **Step 4: Build to verify**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 5: Commit**

```bash
git add ios/Threadron/Extensions/
git commit -m "feat(ios): add Color+Hex, Color+Theme, Date+Relative extensions"
```

---

### Task 3: Models & Enums

**Files:**
- Create: `ios/Threadron/Models/Enums.swift`
- Create: `ios/Threadron/Models/User.swift`
- Create: `ios/Threadron/Models/Domain.swift`
- Create: `ios/Threadron/Models/Project.swift`
- Create: `ios/Threadron/Models/TaskModel.swift`
- Create: `ios/Threadron/Models/ContextEntry.swift`
- Create: `ios/Threadron/Models/Artifact.swift`
- Create: `ios/Threadron/Models/Agent.swift`
- Create: `ios/Threadron/Models/APIKeyModel.swift`

- [ ] **Step 1: Create Enums.swift**

```swift
import SwiftUI

enum TaskStatus: String, Codable, CaseIterable, Identifiable {
    case pending, inProgress = "in_progress", completed, cancelled, blocked
    var id: String { rawValue }

    var label: String {
        switch self {
        case .pending: "pending"
        case .inProgress: "in_progress"
        case .completed: "completed"
        case .cancelled: "cancelled"
        case .blocked: "blocked"
        }
    }

    var color: Color {
        switch self {
        case .pending: .textDim
        case .inProgress: .priorityMedium
        case .completed: .priorityLow
        case .cancelled: .textDim
        case .blocked: .priorityUrgent
        }
    }
}

enum Priority: String, Codable, CaseIterable, Identifiable {
    case low, medium, high, urgent
    var id: String { rawValue }

    var color: Color {
        switch self {
        case .low: .priorityLow
        case .medium: .priorityMedium
        case .high: .priorityHigh
        case .urgent: .priorityUrgent
        }
    }
}

enum Guardrail: String, Codable, CaseIterable, Identifiable {
    case autonomous, notify, approvalRequired = "approval_required"
    var id: String { rawValue }

    var label: String {
        switch self {
        case .autonomous: "autonomous"
        case .notify: "notify"
        case .approvalRequired: "approval_required"
        }
    }
}

enum Confidence: String, Codable {
    case low, medium, high

    var color: Color {
        switch self {
        case .low: .priorityUrgent
        case .medium: .priorityMedium
        case .high: .priorityLow
        }
    }
}

enum ContextType: String, Codable, CaseIterable, Identifiable {
    case observation, actionTaken = "action_taken", decision, blocker
    case stateTransition = "state_transition", handoff, proposal
    case approvalRequested = "approval_requested"
    case approvalReceived = "approval_received"
    case artifactCreated = "artifact_created"
    case claim, release
    var id: String { rawValue }

    var label: String { rawValue }

    var color: Color {
        switch self {
        case .observation: .ctxObservation
        case .actionTaken: .ctxAction
        case .decision: .ctxDecision
        case .blocker: .ctxBlocker
        case .stateTransition, .artifactCreated: .ctxDim
        case .handoff: .ctxHandoff
        case .proposal: .ctxProposal
        case .approvalRequested: .ctxApprovalReq
        case .approvalReceived: .ctxApprovalRcvd
        case .claim: .ctxDim
        case .release: .ctxDim
        }
    }
}

enum ArtifactType: String, Codable, CaseIterable, Identifiable {
    case file, branch, commit, pullRequest = "pull_request"
    case patch, plan, doc, terminalOutput = "terminal_output"
    var id: String { rawValue }

    var icon: String {
        switch self {
        case .file: "doc.fill"
        case .branch: "arrow.triangle.branch"
        case .commit: "smallcircle.filled.circle"
        case .pullRequest: "arrow.triangle.pull"
        case .patch: "doc.badge.gearshape"
        case .plan: "list.bullet.clipboard"
        case .doc: "doc.text"
        case .terminalOutput: "terminal"
        }
    }
}

enum ActorType: String, Codable {
    case system, agent, human
}
```

- [ ] **Step 2: Create User.swift**

```swift
import Foundation

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let name: String?
    let createdAt: Date?
}

struct AuthResponse: Codable {
    let user: User
    let token: String
    let apiKey: String?
    let apiKeyPrefix: String?
}

struct MeResponse: Codable {
    let user: User
    let apiKeys: [APIKeyInfo]
    let domains: [DomainSummary]

    struct APIKeyInfo: Codable, Identifiable {
        let id: String
        let name: String
        let keyPrefix: String
        let createdAt: Date?
    }

    struct DomainSummary: Codable, Identifiable {
        let id: String
        let name: String
        let createdAt: Date?
    }
}
```

- [ ] **Step 3: Create Domain.swift and Project.swift**

Create `ios/Threadron/Models/Domain.swift`:

```swift
import Foundation

struct Domain: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let userId: String?
    let defaultGuardrail: String?
    let createdAt: Date?
    let updatedAt: Date?
}

struct DomainsResponse: Codable {
    let domains: [Domain]
}
```

Create `ios/Threadron/Models/Project.swift`:

```swift
import Foundation

struct Project: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let domainId: String
    let description: String?
    let createdAt: Date?
    let updatedAt: Date?
}

struct ProjectsResponse: Codable {
    let projects: [Project]
}
```

- [ ] **Step 4: Create TaskModel.swift**

Named `TaskModel` to avoid conflict with Swift's `Task` type.

```swift
import Foundation

struct TaskItem: Codable, Identifiable {
    let id: String
    var title: String
    var status: TaskStatus
    let domainId: String
    var projectId: String?
    var assignee: String?
    let createdBy: String
    var priority: Priority
    var guardrail: Guardrail?
    var dependencies: [String]?
    var dueDate: Date?
    var tags: [String]?
    var metadata: [String: String]?
    var goal: String?
    var currentState: String?
    var nextAction: String?
    var blockers: [String]
    var outcomeDefinition: String?
    var confidence: Confidence?
    var claimedBy: String?
    var claimExpiresAt: Date?
    let createdAt: Date?
    let updatedAt: Date?

    // Included in GET /tasks/:id
    var context: [ContextEntry]?
    var artifacts: [Artifact]?
}

struct TasksResponse: Codable {
    let tasks: [TaskItem]
}
```

- [ ] **Step 5: Create ContextEntry.swift and Artifact.swift**

Create `ios/Threadron/Models/ContextEntry.swift`:

```swift
import Foundation

struct ContextEntry: Codable, Identifiable {
    let id: String
    let taskId: String
    let type: ContextType
    let body: String
    let author: String
    let actorType: ActorType?
    let createdAt: Date?
    let updatedAt: Date?
}

struct ContextResponse: Codable {
    let context: [ContextEntry]
}
```

Create `ios/Threadron/Models/Artifact.swift`:

```swift
import Foundation

struct Artifact: Codable, Identifiable {
    let id: String
    let taskId: String
    let type: ArtifactType
    let uri: String?
    let body: String?
    let title: String?
    let createdBy: String
    let metadata: [String: String]?
    let createdAt: Date?
}

struct ArtifactsResponse: Codable {
    let artifacts: [Artifact]
}
```

- [ ] **Step 6: Create Agent.swift and APIKeyModel.swift**

Create `ios/Threadron/Models/Agent.swift`:

```swift
import Foundation

struct Agent: Codable, Identifiable {
    let id: String
    let name: String
    let type: String
    let userId: String?
    let capabilities: [String]?
    let lastSeen: Date?
    let createdAt: Date?
    let updatedAt: Date?
}

struct AgentsResponse: Codable {
    let agents: [Agent]
}
```

Create `ios/Threadron/Models/APIKeyModel.swift`:

```swift
import Foundation

struct APIKeyItem: Codable, Identifiable {
    let id: String
    let name: String
    let agentId: String?
    let keyPrefix: String?
    let createdAt: Date?
}

struct APIKeysResponse: Codable {
    let keys: [APIKeyItem]
}

struct APIKeyCreateResponse: Codable {
    let id: String
    let apiKey: String
    let name: String
    let agentId: String?
}
```

- [ ] **Step 7: Build to verify all models compile**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 8: Commit**

```bash
git add ios/Threadron/Models/
git commit -m "feat(ios): add all Codable models and enums"
```

---

### Task 4: Endpoint Enum

**Files:**
- Create: `ios/Threadron/Services/Endpoint.swift`

- [ ] **Step 1: Create Endpoint.swift**

```swift
import Foundation

enum HTTPMethod: String {
    case GET, POST, PATCH, DELETE
}

struct Endpoint {
    let path: String
    let method: HTTPMethod
    let body: [String: Any]?
    let queryItems: [URLQueryItem]?

    private init(_ path: String, _ method: HTTPMethod, body: [String: Any]? = nil, query: [URLQueryItem]? = nil) {
        self.path = path
        self.method = method
        self.body = body
        self.queryItems = query
    }

    // MARK: - Auth
    static func register(email: String, password: String, name: String) -> Endpoint {
        Endpoint("/users/register", .POST, body: ["email": email, "password": password, "name": name])
    }
    static func login(email: String, password: String) -> Endpoint {
        Endpoint("/users/login", .POST, body: ["email": email, "password": password])
    }
    static var me: Endpoint { Endpoint("/users/me", .GET) }

    // MARK: - Domains
    static var listDomains: Endpoint { Endpoint("/domains", .GET) }
    static func createDomain(name: String, guardrail: String? = nil) -> Endpoint {
        var body: [String: Any] = ["name": name]
        if let g = guardrail { body["default_guardrail"] = g }
        return Endpoint("/domains", .POST, body: body)
    }
    static func deleteDomain(id: String) -> Endpoint { Endpoint("/domains/\(id)", .DELETE) }

    // MARK: - Projects
    static func listProjects(domainId: String? = nil) -> Endpoint {
        var query: [URLQueryItem]? = nil
        if let d = domainId { query = [URLQueryItem(name: "domain_id", value: d)] }
        return Endpoint("/projects", .GET, query: query)
    }
    static func createProject(name: String, domainId: String, description: String? = nil) -> Endpoint {
        var body: [String: Any] = ["name": name, "domain_id": domainId]
        if let d = description { body["description"] = d }
        return Endpoint("/projects", .POST, body: body)
    }
    static func deleteProject(id: String) -> Endpoint { Endpoint("/projects/\(id)", .DELETE) }

    // MARK: - Tasks
    static var listTasks: Endpoint { Endpoint("/tasks", .GET) }
    static func getTask(id: String) -> Endpoint { Endpoint("/tasks/\(id)", .GET) }
    static func createTask(_ fields: [String: Any]) -> Endpoint {
        Endpoint("/tasks", .POST, body: fields)
    }
    static func updateTask(id: String, fields: [String: Any]) -> Endpoint {
        Endpoint("/tasks/\(id)", .PATCH, body: fields)
    }
    static func deleteTask(id: String) -> Endpoint { Endpoint("/tasks/\(id)", .DELETE) }

    // MARK: - Context
    static func addContext(taskId: String, type: String, body: String, author: String, actorType: String = "human") -> Endpoint {
        Endpoint("/tasks/\(taskId)/context", .POST, body: [
            "type": type, "body": body, "author": author, "actor_type": actorType
        ])
    }

    // MARK: - Artifacts
    static func addArtifact(taskId: String, fields: [String: Any]) -> Endpoint {
        Endpoint("/tasks/\(taskId)/artifacts", .POST, body: fields)
    }

    // MARK: - Agents
    static var listAgents: Endpoint { Endpoint("/agents", .GET) }

    // MARK: - API Keys
    static var listKeys: Endpoint { Endpoint("/auth/keys", .GET) }
    static func createKey(name: String?, agentId: String? = nil) -> Endpoint {
        var body: [String: Any] = [:]
        if let n = name { body["name"] = n }
        if let a = agentId { body["agent_id"] = a }
        return Endpoint("/auth/keys", .POST, body: body)
    }
    static func deleteKey(id: String) -> Endpoint { Endpoint("/auth/keys/\(id)", .DELETE) }

    // MARK: - Config
    static var listConfig: Endpoint { Endpoint("/config", .GET) }
    static func upsertConfig(key: String, value: Any) -> Endpoint {
        Endpoint("/config", .POST, body: ["key": key, "value": value])
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add ios/Threadron/Services/Endpoint.swift
git commit -m "feat(ios): add type-safe Endpoint definitions"
```

---

### Task 5: APIClient Actor

**Files:**
- Create: `ios/Threadron/Services/APIClient.swift`

- [ ] **Step 1: Create APIClient.swift**

```swift
import Foundation

actor APIClient {
    static let shared = APIClient()

    private let baseURL = URL(string: "https://api-production-ca21c.up.railway.app/v1")!
    private let session = URLSession.shared
    private var token: String?

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoNoFrac = ISO8601DateFormatter()
        isoNoFrac.formatOptions = [.withInternetDateTime]
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = iso.date(from: string) { return date }
            if let date = isoNoFrac.date(from: string) { return date }
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Invalid date: \(string)")
            )
        }
        return d
    }()

    func setToken(_ token: String?) {
        self.token = token
    }

    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        var url = baseURL.appendingPathComponent(endpoint.path)
        if let queryItems = endpoint.queryItems {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = queryItems
            url = components.url!
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = endpoint.body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.serverError(httpResponse.statusCode, message)
        }

        return try decoder.decode(T.self, from: data)
    }

    /// Fire-and-forget requests (DELETE, etc.) where we don't need a typed response
    func requestVoid(_ endpoint: Endpoint) async throws {
        var url = baseURL.appendingPathComponent(endpoint.path)
        if let queryItems = endpoint.queryItems {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            components.queryItems = queryItems
            url = components.url!
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = endpoint.body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (_, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(httpResponse.statusCode, "Request failed")
        }
    }
}

enum APIError: LocalizedError {
    case invalidResponse
    case unauthorized
    case serverError(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Invalid server response"
        case .unauthorized: "Session expired. Please sign in again."
        case .serverError(let code, let msg): "Error \(code): \(msg)"
        }
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add ios/Threadron/Services/APIClient.swift
git commit -m "feat(ios): add APIClient actor with URLSession networking"
```

---

### Task 6: KeychainManager

**Files:**
- Create: `ios/Threadron/Services/KeychainManager.swift`

- [ ] **Step 1: Create KeychainManager.swift**

```swift
import Foundation
import Security
import LocalAuthentication

struct KeychainManager {
    private static let service = "com.threadron.app"
    private static let tokenKey = "jwt_token"

    static func saveToken(_ token: String, withBiometric: Bool = false) throws {
        try deleteToken()

        guard let data = token.data(using: .utf8) else { return }

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey,
            kSecValueData as String: data,
        ]

        if withBiometric {
            let access = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
                .biometryCurrentSet,
                nil
            )
            if let access { query[kSecAttrAccessControl as String] = access }
        } else {
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    static func loadToken(withBiometric: Bool = false) throws -> String? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        if withBiometric {
            let context = LAContext()
            context.localizedReason = "Access your Threadron account"
            query[kSecUseAuthenticationContext as String] = context
        }

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            if status == errSecItemNotFound { return nil }
            throw KeychainError.loadFailed(status)
        }

        return String(data: data, encoding: .utf8)
    }

    static func deleteToken() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }

    static var biometricAvailable: Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }
}

enum KeychainError: LocalizedError {
    case saveFailed(OSStatus)
    case loadFailed(OSStatus)
    case deleteFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .saveFailed(let s): "Keychain save failed: \(s)"
        case .loadFailed(let s): "Keychain load failed: \(s)"
        case .deleteFailed(let s): "Keychain delete failed: \(s)"
        }
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add ios/Threadron/Services/KeychainManager.swift
git commit -m "feat(ios): add KeychainManager with biometric support"
```

---

### Task 7: HapticManager

**Files:**
- Create: `ios/Threadron/Services/HapticManager.swift`

- [ ] **Step 1: Create HapticManager.swift**

```swift
import UIKit

enum HapticManager {
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    static func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }

    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    static func medium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
}
```

- [ ] **Step 2: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Services/HapticManager.swift
git commit -m "feat(ios): add HapticManager"
```

---

### Task 8: AuthManager ViewModel

**Files:**
- Create: `ios/Threadron/ViewModels/AuthManager.swift`

- [ ] **Step 1: Create AuthManager.swift**

```swift
import Foundation
import SwiftUI

@Observable
final class AuthManager {
    var isAuthenticated = false
    var currentUser: User?
    var isLoading = false
    var error: String?
    var biometricEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "biometric_enabled") }
        set { UserDefaults.standard.set(newValue, forKey: "biometric_enabled") }
    }
    var onboardingComplete: Bool {
        get { UserDefaults.standard.bool(forKey: "onboarding_complete") }
        set { UserDefaults.standard.set(newValue, forKey: "onboarding_complete") }
    }
    var initialApiKey: String?
    var showOnboarding = false

    private let api = APIClient.shared

    func checkExistingSession() async {
        do {
            if let token = try KeychainManager.loadToken() {
                await api.setToken(token)
                let response: MeResponse = try await api.request(.me)
                currentUser = response.user
                isAuthenticated = true
            }
        } catch {
            try? KeychainManager.deleteToken()
            isAuthenticated = false
        }
    }

    func attemptBiometric() async {
        guard biometricEnabled, KeychainManager.biometricAvailable else { return }
        do {
            if let token = try KeychainManager.loadToken(withBiometric: true) {
                await api.setToken(token)
                let response: MeResponse = try await api.request(.me)
                currentUser = response.user
                isAuthenticated = true
            }
        } catch {
            self.error = "Biometric authentication failed"
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        error = nil
        do {
            let response: AuthResponse = try await api.request(.login(email: email, password: password))
            try KeychainManager.saveToken(response.token, withBiometric: biometricEnabled)
            await api.setToken(response.token)
            currentUser = response.user
            isAuthenticated = true
        } catch let err as APIError {
            self.error = err.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func register(email: String, password: String, name: String) async {
        isLoading = true
        error = nil
        do {
            let response: AuthResponse = try await api.request(.register(email: email, password: password, name: name))
            try KeychainManager.saveToken(response.token, withBiometric: false)
            await api.setToken(response.token)
            currentUser = response.user
            initialApiKey = response.apiKey
            isAuthenticated = true
            showOnboarding = true
        } catch let err as APIError {
            self.error = err.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func logout() {
        try? KeychainManager.deleteToken()
        Task { await api.setToken(nil) }
        currentUser = nil
        isAuthenticated = false
        initialApiKey = nil
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add ios/Threadron/ViewModels/AuthManager.swift
git commit -m "feat(ios): add AuthManager with login, register, biometric"
```

---

### Task 9: DomainStore ViewModel

**Files:**
- Create: `ios/Threadron/ViewModels/DomainStore.swift`

- [ ] **Step 1: Create DomainStore.swift**

```swift
import Foundation

@Observable
final class DomainStore {
    var domains: [Domain] = []
    var projects: [Project] = []
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    func fetchDomains() async {
        isLoading = true
        do {
            let response: DomainsResponse = try await api.request(.listDomains)
            domains = response.domains
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func fetchProjects() async {
        do {
            let response: ProjectsResponse = try await api.request(.listProjects())
            projects = response.projects
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createDomain(name: String, guardrail: String?) async -> Domain? {
        do {
            let domain: Domain = try await api.request(.createDomain(name: name, guardrail: guardrail))
            domains.append(domain)
            return domain
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func deleteDomain(id: String) async {
        do {
            try await api.requestVoid(.deleteDomain(id: id))
            domains.removeAll { $0.id == id }
            projects.removeAll { $0.domainId == id }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createProject(name: String, domainId: String, description: String? = nil) async -> Project? {
        do {
            let project: Project = try await api.request(.createProject(name: name, domainId: domainId, description: description))
            projects.append(project)
            return project
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func projectsForDomain(_ domainId: String) -> [Project] {
        projects.filter { $0.domainId == domainId }
    }
}
```

- [ ] **Step 2: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/ViewModels/DomainStore.swift
git commit -m "feat(ios): add DomainStore with domains and projects"
```

---

### Task 10: TaskStore ViewModel

**Files:**
- Create: `ios/Threadron/ViewModels/TaskStore.swift`

- [ ] **Step 1: Create TaskStore.swift**

```swift
import Foundation

@Observable
final class TaskStore {
    var tasks: [TaskItem] = []
    var selectedDomain: Domain?
    var selectedProject: Project?
    var selectedTags: Set<String> = []
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    // MARK: - Filtered views

    private var filtered: [TaskItem] {
        tasks.filter { task in
            if let domain = selectedDomain, task.domainId != domain.id { return false }
            if let project = selectedProject, task.projectId != project.id { return false }
            if !selectedTags.isEmpty {
                let taskTags = Set(task.tags ?? [])
                if selectedTags.isDisjoint(with: taskTags) { return false }
            }
            return true
        }
    }

    var activeTasks: [TaskItem] {
        filtered.filter { $0.status == .inProgress || $0.status == .blocked }
    }

    var queueTasks: [TaskItem] {
        filtered.filter { $0.status == .pending }
    }

    var doneTasks: [TaskItem] {
        filtered.filter { $0.status == .completed || $0.status == .cancelled }
    }

    var allTags: [String] {
        let tagSets = tasks.compactMap(\.tags).flatMap { $0 }
        return Array(Set(tagSets)).sorted()
    }

    /// Groups tasks by project name, alphabetical, ungrouped last
    func grouped(_ tasks: [TaskItem], projects: [Project]) -> [(String?, [TaskItem])] {
        let projectMap = Dictionary(uniqueKeysWithValues: projects.map { ($0.id, $0.name) })
        let grouped = Dictionary(grouping: tasks) { task -> String? in
            task.projectId.flatMap { projectMap[$0] }
        }
        return grouped.sorted { a, b in
            switch (a.key, b.key) {
            case (nil, _): return false
            case (_, nil): return true
            case let (a?, b?): return a < b
            }
        }
    }

    // MARK: - CRUD

    func fetchTasks() async {
        isLoading = true
        do {
            let response: TasksResponse = try await api.request(.listTasks)
            tasks = response.tasks
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func fetchTaskDetail(id: String) async -> TaskItem? {
        do {
            let task: TaskItem = try await api.request(.getTask(id: id))
            if let idx = tasks.firstIndex(where: { $0.id == id }) {
                tasks[idx] = task
            }
            return task
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func createTask(_ fields: [String: Any]) async -> TaskItem? {
        do {
            let task: TaskItem = try await api.request(.createTask(fields))
            tasks.append(task)
            return task
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func updateTask(id: String, fields: [String: Any]) async -> TaskItem? {
        do {
            let updated: TaskItem = try await api.request(.updateTask(id: id, fields: fields))
            if let idx = tasks.firstIndex(where: { $0.id == id }) {
                // Preserve context/artifacts from detail fetch
                var merged = updated
                merged.context = tasks[idx].context
                merged.artifacts = tasks[idx].artifacts
                tasks[idx] = merged
            }
            return updated
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func deleteTask(id: String) async {
        do {
            try await api.requestVoid(.deleteTask(id: id))
            tasks.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func addContext(taskId: String, type: String, body: String, author: String) async -> ContextEntry? {
        do {
            let entry: ContextEntry = try await api.request(.addContext(taskId: taskId, type: type, body: body, author: author))
            if let idx = tasks.firstIndex(where: { $0.id == taskId }) {
                if tasks[idx].context == nil { tasks[idx].context = [] }
                tasks[idx].context?.append(entry)
            }
            return entry
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func addArtifact(taskId: String, fields: [String: Any]) async -> Artifact? {
        do {
            let artifact: Artifact = try await api.request(.addArtifact(taskId: taskId, fields: fields))
            if let idx = tasks.firstIndex(where: { $0.id == taskId }) {
                if tasks[idx].artifacts == nil { tasks[idx].artifacts = [] }
                tasks[idx].artifacts?.append(artifact)
            }
            return artifact
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add ios/Threadron/ViewModels/TaskStore.swift
git commit -m "feat(ios): add TaskStore with filtering, grouping, CRUD"
```

---

### Task 11: AgentStore + SettingsStore

**Files:**
- Create: `ios/Threadron/ViewModels/AgentStore.swift`
- Create: `ios/Threadron/ViewModels/SettingsStore.swift`

- [ ] **Step 1: Create AgentStore.swift**

```swift
import Foundation

@Observable
final class AgentStore {
    var agents: [Agent] = []
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    func fetchAgents() async {
        isLoading = true
        do {
            let response: AgentsResponse = try await api.request(.listAgents)
            agents = response.agents
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
```

- [ ] **Step 2: Create SettingsStore.swift**

```swift
import Foundation

@Observable
final class SettingsStore {
    var apiKeys: [APIKeyItem] = []
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    func fetchKeys() async {
        do {
            let response: APIKeysResponse = try await api.request(.listKeys)
            apiKeys = response.keys
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createKey(name: String?, agentId: String? = nil) async -> APIKeyCreateResponse? {
        do {
            let response: APIKeyCreateResponse = try await api.request(.createKey(name: name ?? "ios-key", agentId: agentId))
            await fetchKeys()
            return response
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func deleteKey(id: String) async {
        do {
            try await api.requestVoid(.deleteKey(id: id))
            apiKeys.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
```

- [ ] **Step 3: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/ViewModels/AgentStore.swift ios/Threadron/ViewModels/SettingsStore.swift
git commit -m "feat(ios): add AgentStore and SettingsStore"
```

---

### Task 12: Shared Components

**Files:**
- Create: `ios/Threadron/Views/Shared/SectionHeaderView.swift`
- Create: `ios/Threadron/Views/Shared/BadgeView.swift`
- Create: `ios/Threadron/Views/Shared/TimeAgoText.swift`
- Create: `ios/Threadron/Views/Shared/FilterPillsView.swift`

- [ ] **Step 1: Create SectionHeaderView.swift**

```swift
import SwiftUI

struct SectionHeaderView: View {
    let title: String
    var count: Int?

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 10, design: .monospaced))
                .fontWeight(.semibold)
                .textCase(.uppercase)
                .tracking(2)
                .foregroundStyle(Color.textMuted)
            Spacer()
            if let count {
                Text("\(count) tasks")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.textDim)
            }
        }
    }
}
```

- [ ] **Step 2: Create BadgeView.swift**

```swift
import SwiftUI

struct BadgeView: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(color.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
```

- [ ] **Step 3: Create TimeAgoText.swift**

```swift
import SwiftUI

struct TimeAgoText: View {
    let date: Date?

    var body: some View {
        Text(date?.timeAgo ?? "")
            .font(.system(size: 10))
            .foregroundStyle(Color.textDim)
    }
}
```

- [ ] **Step 4: Create FilterPillsView.swift**

```swift
import SwiftUI

struct FilterPillsView<Item: Identifiable & Hashable>: View {
    let items: [Item]
    let label: (Item) -> String
    let count: ((Item) -> Int)?
    @Binding var selected: Item?
    let allLabel: String

    init(
        items: [Item],
        label: @escaping (Item) -> String,
        count: ((Item) -> Int)? = nil,
        selected: Binding<Item?>,
        allLabel: String = "All"
    ) {
        self.items = items
        self.label = label
        self.count = count
        self._selected = selected
        self.allLabel = allLabel
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                pillButton(isSelected: selected == nil) {
                    selected = nil
                } label: {
                    Text(allLabel).fontWeight(.semibold)
                }

                ForEach(items) { item in
                    pillButton(isSelected: selected == item) {
                        selected = (selected == item) ? nil : item
                    } label: {
                        HStack(spacing: 4) {
                            Text(label(item))
                            if let count, count(item) > 0 {
                                Text("\(count(item))")
                                    .foregroundStyle(Color.textDim)
                                    .font(.system(size: 10))
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    @ViewBuilder
    private func pillButton(isSelected: Bool, action: @escaping () -> Void, @ViewBuilder label: () -> some View) -> some View {
        Button(action: action) {
            label()
                .font(.system(size: 12))
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .foregroundStyle(isSelected ? Color.bgPrimary : Color.textMuted)
                .background(isSelected ? Color.textPrimary : Color.bgSurface)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(isSelected ? Color.clear : Color.bgBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
```

- [ ] **Step 5: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Views/Shared/
git commit -m "feat(ios): add shared components — badges, pills, section headers"
```

---

### Task 13: LoginView

**Files:**
- Create: `ios/Threadron/Views/Auth/LoginView.swift`

- [ ] **Step 1: Create LoginView.swift**

```swift
import SwiftUI

struct LoginView: View {
    @Environment(AuthManager.self) private var auth
    @State private var isRegistering = false
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 80)

                    // Branding
                    Text("threadron")
                        .font(.system(size: 32, weight: .heavy))
                        .tracking(-1)
                        .foregroundStyle(Color.textPrimary)
                    Text("agent task orchestration")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Color.textDim)
                        .padding(.bottom, 40)

                    // Form
                    VStack(spacing: 16) {
                        if isRegistering {
                            fieldGroup("NAME") {
                                TextField("Your name", text: $name)
                                    .textContentType(.name)
                                    .autocorrectionDisabled()
                            }
                        }

                        fieldGroup("EMAIL") {
                            TextField("you@example.com", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }

                        fieldGroup("PASSWORD") {
                            SecureField("••••••••", text: $password)
                                .textContentType(isRegistering ? .newPassword : .password)
                        }
                    }
                    .padding(.horizontal, 24)

                    // Error
                    if let error = auth.error {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.priorityUrgent)
                            .padding(.top, 12)
                            .padding(.horizontal, 24)
                    }

                    // Submit button
                    Button {
                        Task { await submit() }
                    } label: {
                        Group {
                            if auth.isLoading {
                                ProgressView().tint(.bgPrimary)
                            } else {
                                Text(isRegistering ? "Create Account" : "Sign In")
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .foregroundStyle(Color.bgPrimary)
                        .background(Color.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(auth.isLoading || !isValid)
                    .opacity(isValid ? 1 : 0.5)
                    .padding(.horizontal, 24)
                    .padding(.top, 24)

                    // Toggle
                    Button {
                        withAnimation { isRegistering.toggle() }
                    } label: {
                        Group {
                            if isRegistering {
                                Text("Already have an account? ") +
                                Text("Sign In").fontWeight(.semibold).foregroundColor(.textPrimary)
                            } else {
                                Text("Don't have an account? ") +
                                Text("Register").fontWeight(.semibold).foregroundColor(.textPrimary)
                            }
                        }
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textDim)
                    }
                    .padding(.top, 16)

                    // Biometric
                    if !isRegistering && KeychainManager.biometricAvailable && !auth.isLoading {
                        Button {
                            Task { await auth.attemptBiometric() }
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: "faceid")
                                    .font(.system(size: 28))
                                Text("Sign in with Face ID")
                                    .font(.system(size: 11))
                            }
                            .foregroundStyle(Color.textDim)
                        }
                        .padding(.top, 32)
                    }

                    Spacer()
                }
            }
        }
    }

    private var isValid: Bool {
        if isRegistering {
            return !email.isEmpty && !password.isEmpty && !name.isEmpty
        }
        return !email.isEmpty && !password.isEmpty
    }

    private func submit() async {
        if isRegistering {
            await auth.register(email: email, password: password, name: name)
        } else {
            await auth.login(email: email, password: password)
        }
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder field: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase)
                .tracking(1.5)
                .foregroundStyle(Color.textDim)
            field()
                .foregroundStyle(Color.textPrimary)
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1)
                )
        }
    }
}
```

- [ ] **Step 2: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Views/Auth/
git commit -m "feat(ios): add LoginView with register toggle and Face ID"
```

---

### Task 14: TaskCardView + TaskRowView

**Files:**
- Create: `ios/Threadron/Views/Tasks/TaskCardView.swift`
- Create: `ios/Threadron/Views/Tasks/TaskRowView.swift`

- [ ] **Step 1: Create TaskCardView.swift**

```swift
import SwiftUI

struct TaskCardView: View {
    let task: TaskItem
    @State private var showCopied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Title + priority dot
            HStack(alignment: .top) {
                Text(task.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(2)
                Spacer()
                Circle()
                    .fill(task.priority.color)
                    .frame(width: 8, height: 8)
                    .padding(.top, 5)
            }

            // Current state
            if let state = task.currentState, !state.isEmpty {
                Text(state)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
                    .lineLimit(2)
            }

            // Next action
            if let next = task.nextAction, !next.isEmpty {
                Text("→ \(next)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.priorityLow)
                    .lineLimit(1)
            }

            // First blocker
            if let blocker = task.blockers.first, !blocker.isEmpty {
                Text("⊘ \(blocker)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.priorityUrgent)
                    .lineLimit(1)
            }

            // Footer
            HStack {
                if let claimed = task.claimedBy, !claimed.isEmpty {
                    Label(claimed, systemImage: "lock.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.textDim)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.bgPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.bgBorder, lineWidth: 1))
                } else if let assignee = task.assignee, !assignee.isEmpty {
                    Text(assignee)
                        .font(.system(size: 10))
                        .foregroundStyle(Color.textDim)
                }

                if task.guardrail == .approvalRequired {
                    Text("approval")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.ctxApprovalReq)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.ctxApprovalReq.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }

                Spacer()

                TimeAgoText(date: task.updatedAt ?? task.createdAt)
            }
        }
        .padding(14)
        .background(Color.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(task.status == .blocked ? Color.priorityUrgent : Color.bgBorder, lineWidth: 1)
        )
        .onLongPressGesture {
            UIPasteboard.general.string = task.id
            HapticManager.light()
            showCopied = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { showCopied = false }
        }
        .overlay(alignment: .topLeading) {
            if showCopied {
                Text("Copied!")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.textPrimary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.bgBorder)
                    .clipShape(Capsule())
                    .offset(x: 8, y: -12)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showCopied)
    }
}
```

- [ ] **Step 2: Create TaskRowView.swift**

```swift
import SwiftUI

struct TaskRowView: View {
    let task: TaskItem

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(task.priority.color)
                .frame(width: 7, height: 7)

            Text(task.title)
                .font(.system(size: 14))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12))
                .foregroundStyle(Color.bgBorder)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }
}
```

- [ ] **Step 3: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Views/Tasks/TaskCardView.swift ios/Threadron/Views/Tasks/TaskRowView.swift
git commit -m "feat(ios): add TaskCardView and TaskRowView"
```

---

### Task 15: TaskBoardView

**Files:**
- Create: `ios/Threadron/Views/Tasks/TaskBoardView.swift`

- [ ] **Step 1: Create TaskBoardView.swift**

```swift
import SwiftUI

struct TaskBoardView: View {
    @Environment(TaskStore.self) private var taskStore
    @Environment(DomainStore.self) private var domainStore
    @State private var showNewTask = false
    @State private var selectedTaskId: String?
    @State private var doneExpanded = false

    var body: some View {
        @Bindable var store = taskStore
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        // Domain filter pills
                        FilterPillsView(
                            items: domainStore.domains,
                            label: \.name,
                            count: { domain in taskStore.tasks.filter { $0.domainId == domain.id }.count },
                            selected: $store.selectedDomain,
                            allLabel: "All"
                        )
                        .padding(.vertical, 8)

                        // Project filter pills
                        let relevantProjects = domainStore.projects.filter { p in
                            store.selectedDomain == nil || p.domainId == store.selectedDomain?.id
                        }
                        if !relevantProjects.isEmpty {
                            FilterPillsView(
                                items: relevantProjects,
                                label: \.name,
                                selected: $store.selectedProject,
                                allLabel: "All Projects"
                            )
                            .padding(.bottom, 4)
                        }

                        // Tag filter pills
                        if !taskStore.allTags.isEmpty {
                            tagPills
                                .padding(.bottom, 4)
                        }

                        Divider().background(Color.bgBorder).padding(.bottom, 8)

                        // Active section
                        activeSection

                        // Queue section
                        queueSection

                        // Done section
                        doneSection
                    }
                    .padding(.bottom, 32)
                }
                .refreshable { await refresh() }
            }
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNewTask = true
                    } label: {
                        Text("+ New Task")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.bgPrimary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Color.textPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $showNewTask) {
                NewTaskView()
            }
            .navigationDestination(item: $selectedTaskId) { taskId in
                TaskDetailView(taskId: taskId)
            }
            .task { await refresh() }
        }
    }

    // MARK: - Tag pills (multi-select)
    private var tagPills: some View {
        @Bindable var store = taskStore
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(taskStore.allTags, id: \.self) { tag in
                    Button {
                        if store.selectedTags.contains(tag) {
                            store.selectedTags.remove(tag)
                        } else {
                            store.selectedTags.insert(tag)
                        }
                    } label: {
                        Text("#\(tag)")
                            .font(.system(size: 12))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .foregroundStyle(store.selectedTags.contains(tag) ? Color.bgPrimary : Color.textMuted)
                            .background(store.selectedTags.contains(tag) ? Color.textPrimary : Color.bgSurface)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(Color.bgBorder, lineWidth: store.selectedTags.contains(tag) ? 0 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Active Section
    private var activeSection: some View {
        let active = taskStore.activeTasks
        let groups = taskStore.grouped(active, projects: domainStore.projects)

        return VStack(alignment: .leading, spacing: 8) {
            SectionHeaderView(title: "ACTIVE", count: active.count)
                .padding(.horizontal, 16)

            if active.isEmpty {
                emptyState("No active tasks")
            } else {
                ForEach(groups, id: \.0) { projectName, tasks in
                    if let name = projectName {
                        Text(name)
                            .font(.system(size: 10, design: .monospaced))
                            .textCase(.uppercase)
                            .tracking(1)
                            .foregroundStyle(Color.textDim)
                            .padding(.horizontal, 18)
                            .padding(.top, 4)
                    }
                    ForEach(tasks) { task in
                        Button { selectedTaskId = task.id } label: {
                            TaskCardView(task: task)
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 16)
                    }
                }
            }
        }
        .padding(.bottom, 16)
    }

    // MARK: - Queue Section
    private var queueSection: some View {
        let queue = taskStore.queueTasks
        let groups = taskStore.grouped(queue, projects: domainStore.projects)

        return VStack(alignment: .leading, spacing: 8) {
            SectionHeaderView(title: "QUEUE", count: queue.count)
                .padding(.horizontal, 16)

            if queue.isEmpty {
                emptyState("Queue is empty")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(groups.enumerated()), id: \.offset) { _, group in
                        let (projectName, tasks) = group
                        if let name = projectName {
                            HStack {
                                Text(name)
                                    .font(.system(size: 10, design: .monospaced))
                                    .textCase(.uppercase)
                                    .tracking(1)
                                    .foregroundStyle(Color.textDim)
                                Spacer()
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 6)
                            .background(Color.bgPrimary)
                        }
                        ForEach(tasks) { task in
                            Button { selectedTaskId = task.id } label: {
                                TaskRowView(task: task)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { await taskStore.deleteTask(id: task.id) }
                                    HapticManager.warning()
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            if task.id != tasks.last?.id {
                                Divider().background(Color.bgBorder).padding(.leading, 14)
                            }
                        }
                    }
                }
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.bgBorder, lineWidth: 1))
                .padding(.horizontal, 16)
            }
        }
        .padding(.bottom, 16)
    }

    // MARK: - Done Section
    private var doneSection: some View {
        let done = taskStore.doneTasks

        return VStack(alignment: .leading, spacing: 8) {
            Button { withAnimation { doneExpanded.toggle() } } label: {
                HStack {
                    SectionHeaderView(title: "DONE", count: done.count)
                    Image(systemName: doneExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textDim)
                }
                .padding(.horizontal, 16)
            }
            .buttonStyle(.plain)

            if doneExpanded {
                ForEach(done) { task in
                    Button { selectedTaskId = task.id } label: {
                        HStack(spacing: 10) {
                            Text(task.title)
                                .font(.system(size: 14))
                                .strikethrough(task.status == .completed)
                                .foregroundStyle(Color.textPrimary)
                                .lineLimit(1)
                            Spacer()
                            BadgeView(text: task.status.label, color: task.status.color)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    .opacity(0.5)
                }
            }
        }
    }

    // MARK: - Helpers
    private func emptyState(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(Color.textDim)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [6]))
                    .foregroundStyle(Color.bgBorder)
            )
            .padding(.horizontal, 16)
    }

    private func refresh() async {
        async let t: () = taskStore.fetchTasks()
        async let d: () = domainStore.fetchDomains()
        async let p: () = domainStore.fetchProjects()
        _ = await (t, d, p)
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add ios/Threadron/Views/Tasks/TaskBoardView.swift
git commit -m "feat(ios): add TaskBoardView with Active/Queue/Done sections"
```

---

### Task 16: TaskDetailView

**Files:**
- Create: `ios/Threadron/Views/Tasks/TaskDetailView.swift`

- [ ] **Step 1: Create TaskDetailView.swift**

```swift
import SwiftUI

struct TaskDetailView: View {
    let taskId: String
    @Environment(TaskStore.self) private var taskStore
    @Environment(DomainStore.self) private var domainStore
    @State private var isEditing = false
    @State private var editTitle = ""
    @State private var editStatus: TaskStatus = .pending
    @State private var editGoal = ""
    @State private var editCurrentState = ""
    @State private var editNextAction = ""
    @State private var editOutcome = ""
    @State private var editProjectId: String?
    @State private var editBlockers: [String] = []
    @State private var editTags: [String] = []
    @State private var newBlocker = ""
    @State private var newTag = ""
    @State private var showAddContext = false
    @State private var showAddArtifact = false
    @State private var isSaving = false
    @State private var showCopied = false

    private var task: TaskItem? {
        taskStore.tasks.first { $0.id == taskId }
    }

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            if let task {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        headerSection(task)
                        statusRow(task)
                        fieldCards(task)
                        tagsSection(task)
                        metadataRow(task)
                        blockersSection(task)
                        contextTimeline(task)
                        artifactsSection(task)
                    }
                    .padding(16)
                    .padding(.bottom, 32)
                }
            } else {
                ProgressView()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(isEditing ? "Done" : "Edit") {
                    if isEditing { Task { await save() } }
                    else { enterEditMode() }
                }
                .foregroundStyle(Color.linkBlue)
            }
        }
        .sheet(isPresented: $showAddContext) {
            AddContextView(taskId: taskId)
        }
        .sheet(isPresented: $showAddArtifact) {
            AddArtifactView(taskId: taskId)
        }
        .task {
            _ = await taskStore.fetchTaskDetail(id: taskId)
        }
    }

    // MARK: - Header
    @ViewBuilder
    private func headerSection(_ task: TaskItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if isEditing {
                TextField("Title", text: $editTitle)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.textPrimary)
            } else {
                Text(task.title)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.textPrimary)
            }

            HStack(spacing: 8) {
                Button {
                    UIPasteboard.general.string = task.id
                    HapticManager.light()
                    showCopied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { showCopied = false }
                } label: {
                    Text(showCopied ? "Copied!" : "ID: \(task.id)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Color.textDim)
                }

                if let pid = task.projectId, let project = domainStore.projects.first(where: { $0.id == pid }) {
                    Text("· \(project.name)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Color.textDim)
                }
            }
        }
    }

    // MARK: - Status Row
    @ViewBuilder
    private func statusRow(_ task: TaskItem) -> some View {
        HStack(spacing: 8) {
            if isEditing {
                Menu {
                    ForEach(TaskStatus.allCases) { status in
                        Button(status.label) { editStatus = status }
                    }
                } label: {
                    BadgeView(text: editStatus.label, color: editStatus.color)
                }
            } else {
                BadgeView(text: task.status.label, color: task.status.color)
            }
            BadgeView(text: task.priority.rawValue, color: task.priority.color)
            if let conf = task.confidence {
                BadgeView(text: "confidence: \(conf.rawValue)", color: conf.color)
            }
        }
    }

    // MARK: - Field Cards
    @ViewBuilder
    private func fieldCards(_ task: TaskItem) -> some View {
        if isEditing {
            editableFieldCard("GOAL", text: $editGoal)
            editableFieldCard("CURRENT STATE", text: $editCurrentState)
            editableFieldCard("NEXT ACTION", text: $editNextAction, textColor: .priorityLow)
            editableFieldCard("OUTCOME DEFINITION", text: $editOutcome)

            // Project picker
            fieldCard("PROJECT") {
                Picker("Project", selection: $editProjectId) {
                    Text("None").tag(nil as String?)
                    ForEach(domainStore.projects.filter { $0.domainId == task.domainId }) { p in
                        Text(p.name).tag(p.id as String?)
                    }
                }
                .pickerStyle(.menu)
                .foregroundStyle(Color.textPrimary)
            }
        } else {
            readonlyFieldCard("GOAL", value: task.goal)
            readonlyFieldCard("CURRENT STATE", value: task.currentState, color: .textMuted)
            readonlyFieldCard("NEXT ACTION", value: task.nextAction, color: .priorityLow)
            readonlyFieldCard("OUTCOME DEFINITION", value: task.outcomeDefinition)
        }
    }

    // MARK: - Tags
    @ViewBuilder
    private func tagsSection(_ task: TaskItem) -> some View {
        let tags = isEditing ? editTags : (task.tags ?? [])
        if !tags.isEmpty || isEditing {
            VStack(alignment: .leading, spacing: 8) {
                FlowLayout(spacing: 6) {
                    ForEach(tags, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text("#\(tag)")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.textMuted)
                            if isEditing {
                                Button {
                                    editTags.removeAll { $0 == tag }
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundStyle(Color.textDim)
                                }
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.bgSurface)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color.bgBorder, lineWidth: 1))
                    }
                }

                if isEditing {
                    HStack {
                        TextField("Add tag", text: $newTag)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.textPrimary)
                            .textInputAutocapitalization(.never)
                        Button("Add") {
                            let tag = newTag.trimmingCharacters(in: .whitespaces)
                            if !tag.isEmpty && !editTags.contains(tag) {
                                editTags.append(tag)
                                newTag = ""
                            }
                        }
                        .foregroundStyle(Color.linkBlue)
                        .font(.system(size: 13, weight: .semibold))
                    }
                    .padding(10)
                    .background(Color.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                }
            }
        }
    }

    // MARK: - Metadata
    @ViewBuilder
    private func metadataRow(_ task: TaskItem) -> some View {
        HStack(spacing: 16) {
            if let assignee = task.assignee, !assignee.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("ASSIGNEE")
                        .font(.system(size: 9, design: .monospaced))
                        .textCase(.uppercase).tracking(1.5)
                        .foregroundStyle(Color.textDim)
                    Text(assignee)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textPrimary)
                }
            }
            if let claimed = task.claimedBy, !claimed.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("CLAIMED BY")
                        .font(.system(size: 9, design: .monospaced))
                        .textCase(.uppercase).tracking(1.5)
                        .foregroundStyle(Color.textDim)
                    Label(claimed, systemImage: "lock.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textPrimary)
                }
            }
            Spacer()
        }
    }

    // MARK: - Blockers
    @ViewBuilder
    private func blockersSection(_ task: TaskItem) -> some View {
        let blockers = isEditing ? editBlockers : task.blockers
        if !blockers.isEmpty || isEditing {
            VStack(alignment: .leading, spacing: 8) {
                SectionHeaderView(title: "BLOCKERS")

                ForEach(Array(blockers.enumerated()), id: \.offset) { idx, blocker in
                    HStack {
                        Text("⊘ \(blocker)")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.priorityUrgent)
                        Spacer()
                        if isEditing {
                            Button {
                                editBlockers.remove(at: idx)
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(Color.textDim)
                            }
                        }
                    }
                }

                if isEditing {
                    HStack {
                        TextField("Add blocker", text: $newBlocker)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.textPrimary)
                        Button("Add") {
                            let b = newBlocker.trimmingCharacters(in: .whitespaces)
                            if !b.isEmpty {
                                editBlockers.append(b)
                                newBlocker = ""
                            }
                        }
                        .foregroundStyle(Color.linkBlue)
                        .font(.system(size: 13, weight: .semibold))
                    }
                    .padding(10)
                    .background(Color.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                }
            }
        }
    }

    // MARK: - Context Timeline
    @ViewBuilder
    private func contextTimeline(_ task: TaskItem) -> some View {
        let entries = (task.context ?? []).sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }

        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeaderView(title: "CONTEXT TIMELINE")
                Spacer()
                Button {
                    showAddContext = true
                } label: {
                    Text("+ Add")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.linkBlue)
                }
            }

            if entries.isEmpty {
                Text("No context entries yet")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textDim)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(entries) { entry in
                        HStack(alignment: .top, spacing: 14) {
                            // Timeline line
                            Rectangle()
                                .fill(Color.bgBorder)
                                .frame(width: 2)

                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    BadgeView(text: entry.type.label, color: entry.type.color)
                                    Text("\(entry.actorType?.rawValue ?? "agent") · \(entry.createdAt?.timeAgo ?? "")")
                                        .font(.system(size: 10))
                                        .foregroundStyle(Color.textDim)
                                }
                                Text(entry.body)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color.textMuted)
                                    .lineSpacing(4)
                            }
                            .padding(.bottom, 14)
                        }
                    }
                }
                .padding(.leading, 4)
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Artifacts
    @ViewBuilder
    private func artifactsSection(_ task: TaskItem) -> some View {
        let artifacts = task.artifacts ?? []

        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeaderView(title: "ARTIFACTS")
                Spacer()
                Button {
                    showAddArtifact = true
                } label: {
                    Text("+ Add")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.linkBlue)
                }
            }

            if artifacts.isEmpty {
                Text("No artifacts yet")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textDim)
            } else {
                VStack(spacing: 0) {
                    ForEach(artifacts) { artifact in
                        HStack(spacing: 10) {
                            Image(systemName: artifact.type.icon)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.textMuted)
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(artifact.title ?? artifact.uri ?? "Untitled")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Color.textPrimary)
                                Text(artifact.type.rawValue)
                                    .font(.system(size: 10))
                                    .foregroundStyle(Color.textDim)
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)

                        if artifact.id != artifacts.last?.id {
                            Divider().background(Color.bgBorder).padding(.leading, 48)
                        }
                    }
                }
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Helpers

    private func enterEditMode() {
        guard let task else { return }
        editTitle = task.title
        editStatus = task.status
        editGoal = task.goal ?? ""
        editCurrentState = task.currentState ?? ""
        editNextAction = task.nextAction ?? ""
        editOutcome = task.outcomeDefinition ?? ""
        editProjectId = task.projectId
        editBlockers = task.blockers
        editTags = task.tags ?? []
        isEditing = true
    }

    private func save() async {
        isSaving = true
        var fields: [String: Any] = [
            "title": editTitle,
            "status": editStatus.rawValue,
            "goal": editGoal,
            "current_state": editCurrentState,
            "next_action": editNextAction,
            "outcome_definition": editOutcome,
            "blockers": editBlockers,
            "tags": editTags,
            "_actor": "ios-user",
            "_actor_type": "human",
        ]
        if let pid = editProjectId { fields["project_id"] = pid }
        _ = await taskStore.updateTask(id: taskId, fields: fields)
        HapticManager.success()
        isEditing = false
        isSaving = false
    }

    @ViewBuilder
    private func readonlyFieldCard(_ label: String, value: String?, color: Color = .textPrimary) -> some View {
        if let value, !value.isEmpty {
            fieldCard(label) {
                Text(value)
                    .font(.system(size: 13))
                    .foregroundStyle(color)
                    .lineSpacing(4)
            }
        }
    }

    private func editableFieldCard(_ label: String, text: Binding<String>, textColor: Color = .textPrimary) -> some View {
        fieldCard(label) {
            TextField(label, text: text, axis: .vertical)
                .font(.system(size: 13))
                .foregroundStyle(textColor)
                .lineLimit(1...6)
        }
    }

    private func fieldCard(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase)
                .tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.bgBorder, lineWidth: 1))
    }
}

// MARK: - FlowLayout for tags

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, subview) in subviews.enumerated() {
            let point = CGPoint(x: bounds.minX + result.positions[index].x, y: bounds.minY + result.positions[index].y)
            subview.place(at: point, anchor: .topLeading, proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (positions: [CGPoint], size: CGSize) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        return (positions, CGSize(width: maxWidth, height: y + rowHeight))
    }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add ios/Threadron/Views/Tasks/TaskDetailView.swift
git commit -m "feat(ios): add TaskDetailView with edit mode, timeline, artifacts"
```

---

### Task 17: NewTaskView

**Files:**
- Create: `ios/Threadron/Views/Tasks/NewTaskView.swift`

- [ ] **Step 1: Create NewTaskView.swift**

```swift
import SwiftUI

struct NewTaskView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(TaskStore.self) private var taskStore
    @Environment(DomainStore.self) private var domainStore

    @State private var title = ""
    @State private var selectedDomain: Domain?
    @State private var selectedProject: Project?
    @State private var priority: Priority = .medium
    @State private var guardrail: Guardrail = .autonomous
    @State private var goal = ""
    @State private var assignee = ""
    @State private var tags = ""
    @State private var isCreating = false
    @State private var error: String?

    private var isValid: Bool {
        !title.isEmpty && selectedDomain != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // Title
                        fieldGroup("TITLE *") {
                            TextField("Task title", text: $title)
                                .foregroundStyle(Color.textPrimary)
                        }

                        // Domain
                        fieldGroup("DOMAIN *") {
                            Picker("Domain", selection: $selectedDomain) {
                                Text("Select domain").tag(nil as Domain?)
                                ForEach(domainStore.domains) { d in
                                    Text(d.name).tag(d as Domain?)
                                }
                            }
                            .foregroundStyle(Color.textPrimary)
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        // Project + Priority
                        HStack(spacing: 12) {
                            fieldGroup("PROJECT") {
                                let projects = domainStore.projects.filter { $0.domainId == selectedDomain?.id }
                                Picker("Project", selection: $selectedProject) {
                                    Text("None").tag(nil as Project?)
                                    ForEach(projects) { p in
                                        Text(p.name).tag(p as Project?)
                                    }
                                }
                                .foregroundStyle(Color.textPrimary)
                                .pickerStyle(.menu)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            fieldGroup("PRIORITY") {
                                Picker("Priority", selection: $priority) {
                                    ForEach(Priority.allCases) { p in
                                        Text(p.rawValue).tag(p)
                                    }
                                }
                                .foregroundStyle(Color.textPrimary)
                                .pickerStyle(.menu)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }

                        // Guardrail
                        fieldGroup("GUARDRAIL") {
                            Picker("Guardrail", selection: $guardrail) {
                                ForEach(Guardrail.allCases) { g in
                                    Text(g.label).tag(g)
                                }
                            }
                            .foregroundStyle(Color.textPrimary)
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        // Goal
                        fieldGroup("GOAL") {
                            TextField("What should be achieved?", text: $goal, axis: .vertical)
                                .foregroundStyle(Color.textPrimary)
                                .lineLimit(2...5)
                        }

                        // Assignee
                        fieldGroup("ASSIGNEE") {
                            TextField("Agent or person", text: $assignee)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                        }

                        // Tags
                        fieldGroup("TAGS") {
                            TextField("Comma-separated tags", text: $tags)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                        }

                        if let error {
                            Text(error)
                                .font(.system(size: 13))
                                .foregroundStyle(Color.priorityUrgent)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await create() }
                    }
                    .foregroundStyle(isValid ? Color.linkBlue : Color.textDim)
                    .fontWeight(.semibold)
                    .disabled(!isValid || isCreating)
                }
            }
        }
    }

    private func create() async {
        guard let domain = selectedDomain else { return }
        isCreating = true
        var fields: [String: Any] = [
            "title": title,
            "domain_id": domain.id,
            "status": "pending",
            "priority": priority.rawValue,
            "guardrail": guardrail.rawValue,
            "created_by": "ios-user",
        ]
        if let project = selectedProject { fields["project_id"] = project.id }
        if !goal.isEmpty { fields["goal"] = goal }
        if !assignee.isEmpty { fields["assignee"] = assignee }
        let tagList = tags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if !tagList.isEmpty { fields["tags"] = tagList }

        if let _ = await taskStore.createTask(fields) {
            HapticManager.success()
            dismiss()
        } else {
            error = taskStore.error ?? "Failed to create task"
        }
        isCreating = false
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase)
                .tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
        }
    }
}
```

- [ ] **Step 2: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Views/Tasks/NewTaskView.swift
git commit -m "feat(ios): add NewTaskView creation sheet"
```

---

### Task 18: AddContextView + AddArtifactView

**Files:**
- Create: `ios/Threadron/Views/Tasks/AddContextView.swift`
- Create: `ios/Threadron/Views/Tasks/AddArtifactView.swift`

- [ ] **Step 1: Create AddContextView.swift**

```swift
import SwiftUI

struct AddContextView: View {
    let taskId: String
    @Environment(\.dismiss) private var dismiss
    @Environment(TaskStore.self) private var taskStore

    @State private var type: ContextType = .observation
    @State private var body = ""
    @State private var author = ""
    @State private var isSubmitting = false

    private var isValid: Bool { !body.isEmpty && !author.isEmpty }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    fieldGroup("TYPE") {
                        Picker("Type", selection: $type) {
                            ForEach(ContextType.allCases) { t in
                                Text(t.label).tag(t)
                            }
                        }
                        .foregroundStyle(Color.textPrimary)
                        .pickerStyle(.menu)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    fieldGroup("BODY *") {
                        TextField("Context details...", text: $body, axis: .vertical)
                            .foregroundStyle(Color.textPrimary)
                            .lineLimit(3...8)
                    }

                    fieldGroup("AUTHOR *") {
                        TextField("Your name", text: $author)
                            .foregroundStyle(Color.textPrimary)
                            .textInputAutocapitalization(.never)
                    }

                    Spacer()
                }
                .padding(16)
            }
            .navigationTitle("Add Context")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { Task { await submit() } }
                        .foregroundStyle(isValid ? Color.linkBlue : Color.textDim)
                        .fontWeight(.semibold)
                        .disabled(!isValid || isSubmitting)
                }
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        if let _ = await taskStore.addContext(taskId: taskId, type: type.rawValue, body: body, author: author) {
            HapticManager.success()
            dismiss()
        }
        isSubmitting = false
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase).tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
        }
    }
}
```

- [ ] **Step 2: Create AddArtifactView.swift**

```swift
import SwiftUI

struct AddArtifactView: View {
    let taskId: String
    @Environment(\.dismiss) private var dismiss
    @Environment(TaskStore.self) private var taskStore

    @State private var type: ArtifactType = .doc
    @State private var title = ""
    @State private var uri = ""
    @State private var bodyText = ""
    @State private var createdBy = ""
    @State private var isSubmitting = false

    private var isValid: Bool { !createdBy.isEmpty && (!title.isEmpty || !uri.isEmpty) }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        fieldGroup("TYPE") {
                            Picker("Type", selection: $type) {
                                ForEach(ArtifactType.allCases) { t in
                                    Label(t.rawValue, systemImage: t.icon).tag(t)
                                }
                            }
                            .foregroundStyle(Color.textPrimary)
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        fieldGroup("TITLE") {
                            TextField("Artifact title", text: $title)
                                .foregroundStyle(Color.textPrimary)
                        }

                        fieldGroup("URI") {
                            TextField("URL or path", text: $uri)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                        }

                        fieldGroup("BODY") {
                            TextField("Content...", text: $bodyText, axis: .vertical)
                                .foregroundStyle(Color.textPrimary)
                                .lineLimit(2...6)
                        }

                        fieldGroup("CREATED BY *") {
                            TextField("Your name", text: $createdBy)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Add Artifact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { Task { await submit() } }
                        .foregroundStyle(isValid ? Color.linkBlue : Color.textDim)
                        .fontWeight(.semibold)
                        .disabled(!isValid || isSubmitting)
                }
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        var fields: [String: Any] = [
            "type": type.rawValue,
            "created_by": createdBy,
        ]
        if !title.isEmpty { fields["title"] = title }
        if !uri.isEmpty { fields["uri"] = uri }
        if !bodyText.isEmpty { fields["body"] = bodyText }

        if let _ = await taskStore.addArtifact(taskId: taskId, fields: fields) {
            HapticManager.success()
            dismiss()
        }
        isSubmitting = false
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase).tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
        }
    }
}
```

- [ ] **Step 3: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Views/Tasks/AddContextView.swift ios/Threadron/Views/Tasks/AddArtifactView.swift
git commit -m "feat(ios): add AddContextView and AddArtifactView sheets"
```

---

### Task 19: AgentListView

**Files:**
- Create: `ios/Threadron/Views/Agents/AgentListView.swift`

- [ ] **Step 1: Create AgentListView.swift**

```swift
import SwiftUI

struct AgentListView: View {
    @Environment(AgentStore.self) private var agentStore

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                if agentStore.agents.isEmpty && !agentStore.isLoading {
                    VStack(spacing: 8) {
                        Image(systemName: "cpu")
                            .font(.system(size: 32))
                            .foregroundStyle(Color.textDim)
                        Text("No agents registered")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.textDim)
                        Text("Agents register automatically when they connect")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.textDim)
                    }
                } else {
                    List {
                        ForEach(agentStore.agents) { agent in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(agent.name)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Color.textPrimary)
                                    HStack(spacing: 4) {
                                        Text(agent.type)
                                            .font(.system(size: 11))
                                            .foregroundStyle(Color.textDim)
                                        if let lastSeen = agent.lastSeen {
                                            Text("· Last seen \(lastSeen.timeAgo)")
                                                .font(.system(size: 11))
                                                .foregroundStyle(Color.textDim)
                                        }
                                    }
                                }
                                Spacer()
                                Circle()
                                    .fill(statusColor(for: agent))
                                    .frame(width: 8, height: 8)
                            }
                            .listRowBackground(Color.bgSurface)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Agents")
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .refreshable {
                await agentStore.fetchAgents()
            }
            .task {
                await agentStore.fetchAgents()
            }
        }
    }

    private func statusColor(for agent: Agent) -> Color {
        guard let lastSeen = agent.lastSeen else { return .textDim }
        let seconds = -lastSeen.timeIntervalSinceNow
        if seconds < 300 { return .priorityLow }       // < 5 min = green
        if seconds < 3600 { return .priorityMedium }    // < 1 hour = yellow
        return .textDim                                  // older = gray
    }
}
```

- [ ] **Step 2: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Views/Agents/
git commit -m "feat(ios): add AgentListView with status indicators"
```

---

### Task 20: SettingsView

**Files:**
- Create: `ios/Threadron/Views/Settings/SettingsView.swift`

- [ ] **Step 1: Create SettingsView.swift**

```swift
import SwiftUI

struct SettingsView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(DomainStore.self) private var domainStore
    @Environment(SettingsStore.self) private var settingsStore
    @State private var showNewDomain = false
    @State private var showNewKey = false
    @State private var showLogoutConfirm = false
    @State private var domainToDelete: Domain?
    @State private var keyToDelete: APIKeyItem?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                List {
                    // Account
                    Section {
                        HStack {
                            Text("Email")
                                .foregroundStyle(Color.textPrimary)
                            Spacer()
                            Text(auth.currentUser?.email ?? "")
                                .foregroundStyle(Color.textDim)
                        }
                        .listRowBackground(Color.bgSurface)

                        HStack {
                            Text("Face ID")
                                .foregroundStyle(Color.textPrimary)
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { auth.biometricEnabled },
                                set: { auth.biometricEnabled = $0 }
                            ))
                            .labelsHidden()
                        }
                        .listRowBackground(Color.bgSurface)
                    } header: {
                        Text("ACCOUNT")
                            .font(.system(size: 10, design: .monospaced))
                            .tracking(1.5)
                    }

                    // Domains
                    Section {
                        ForEach(domainStore.domains) { domain in
                            HStack {
                                Text(domain.name)
                                    .foregroundStyle(Color.textPrimary)
                                Spacer()
                                Text(domain.defaultGuardrail ?? "autonomous")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.textDim)
                            }
                            .listRowBackground(Color.bgSurface)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    domainToDelete = domain
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }

                        Button {
                            showNewDomain = true
                        } label: {
                            Text("+ Add Domain")
                                .foregroundStyle(Color.linkBlue)
                        }
                        .listRowBackground(Color.bgSurface)
                    } header: {
                        Text("DOMAINS")
                            .font(.system(size: 10, design: .monospaced))
                            .tracking(1.5)
                    }

                    // API Keys
                    Section {
                        ForEach(settingsStore.apiKeys) { key in
                            HStack {
                                Text(key.name)
                                    .foregroundStyle(Color.textPrimary)
                                Spacer()
                                Text(key.keyPrefix ?? "...")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(Color.textDim)
                            }
                            .listRowBackground(Color.bgSurface)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    keyToDelete = key
                                } label: {
                                    Label("Revoke", systemImage: "trash")
                                }
                            }
                        }

                        Button {
                            showNewKey = true
                        } label: {
                            Text("+ Create Key")
                                .foregroundStyle(Color.linkBlue)
                        }
                        .listRowBackground(Color.bgSurface)
                    } header: {
                        Text("API KEYS")
                            .font(.system(size: 10, design: .monospaced))
                            .tracking(1.5)
                    }

                    // Sign Out
                    Section {
                        Button {
                            showLogoutConfirm = true
                        } label: {
                            Text("Sign Out")
                                .foregroundStyle(Color.priorityUrgent)
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                        .listRowBackground(Color.bgSurface)
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Settings")
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $showNewDomain) {
                NewDomainView()
            }
            .sheet(isPresented: $showNewKey) {
                NewAPIKeyView()
            }
            .alert("Delete Domain?", isPresented: Binding(
                get: { domainToDelete != nil },
                set: { if !$0 { domainToDelete = nil } }
            )) {
                Button("Cancel", role: .cancel) { domainToDelete = nil }
                Button("Delete", role: .destructive) {
                    if let domain = domainToDelete {
                        Task { await domainStore.deleteDomain(id: domain.id) }
                        HapticManager.warning()
                    }
                    domainToDelete = nil
                }
            } message: {
                Text("This will also delete all projects and tasks in this domain.")
            }
            .alert("Revoke API Key?", isPresented: Binding(
                get: { keyToDelete != nil },
                set: { if !$0 { keyToDelete = nil } }
            )) {
                Button("Cancel", role: .cancel) { keyToDelete = nil }
                Button("Revoke", role: .destructive) {
                    if let key = keyToDelete {
                        Task { await settingsStore.deleteKey(id: key.id) }
                        HapticManager.warning()
                    }
                    keyToDelete = nil
                }
            } message: {
                Text("Any agents using this key will lose access.")
            }
            .alert("Sign Out?", isPresented: $showLogoutConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Sign Out", role: .destructive) { auth.logout() }
            }
            .task {
                await settingsStore.fetchKeys()
            }
        }
    }
}
```

- [ ] **Step 2: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Views/Settings/SettingsView.swift
git commit -m "feat(ios): add SettingsView with domains, API keys, sign out"
```

---

### Task 21: NewDomainView + NewAPIKeyView

**Files:**
- Create: `ios/Threadron/Views/Settings/NewDomainView.swift`
- Create: `ios/Threadron/Views/Settings/NewAPIKeyView.swift`

- [ ] **Step 1: Create NewDomainView.swift**

```swift
import SwiftUI

struct NewDomainView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(DomainStore.self) private var domainStore

    @State private var name = ""
    @State private var guardrail: Guardrail = .autonomous
    @State private var isCreating = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    fieldGroup("NAME *") {
                        TextField("Domain name", text: $name)
                            .foregroundStyle(Color.textPrimary)
                            .textInputAutocapitalization(.never)
                    }

                    fieldGroup("DEFAULT GUARDRAIL") {
                        Picker("Guardrail", selection: $guardrail) {
                            ForEach(Guardrail.allCases) { g in
                                Text(g.label).tag(g)
                            }
                        }
                        .foregroundStyle(Color.textPrimary)
                        .pickerStyle(.menu)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Spacer()
                }
                .padding(16)
            }
            .navigationTitle("New Domain")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await create() } }
                        .foregroundStyle(!name.isEmpty ? Color.linkBlue : Color.textDim)
                        .fontWeight(.semibold)
                        .disabled(name.isEmpty || isCreating)
                }
            }
        }
    }

    private func create() async {
        isCreating = true
        if let _ = await domainStore.createDomain(name: name, guardrail: guardrail.rawValue) {
            HapticManager.success()
            dismiss()
        }
        isCreating = false
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase).tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
        }
    }
}
```

- [ ] **Step 2: Create NewAPIKeyView.swift**

```swift
import SwiftUI

struct NewAPIKeyView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(AgentStore.self) private var agentStore

    @State private var name = ""
    @State private var selectedAgentId: String?
    @State private var isCreating = false
    @State private var createdKey: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    if let key = createdKey {
                        // Key reveal
                        VStack(spacing: 16) {
                            Image(systemName: "key.fill")
                                .font(.system(size: 32))
                                .foregroundStyle(Color.priorityLow)

                            Text("API Key Created")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundStyle(Color.textPrimary)

                            Text("Copy this key now. It won't be shown again.")
                                .font(.system(size: 13))
                                .foregroundStyle(Color.textMuted)
                                .multilineTextAlignment(.center)

                            Text(key)
                                .font(.system(size: 13, design: .monospaced))
                                .foregroundStyle(Color.textPrimary)
                                .padding(14)
                                .background(Color.bgSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                                .textSelection(.enabled)

                            Button {
                                UIPasteboard.general.string = key
                                HapticManager.light()
                            } label: {
                                Label("Copy to Clipboard", systemImage: "doc.on.doc")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.bgPrimary)
                                    .padding(.horizontal, 20)
                                    .padding(.vertical, 12)
                                    .background(Color.textPrimary)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                        .padding(24)
                    } else {
                        fieldGroup("NAME") {
                            TextField("Key name", text: $name)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                        }

                        fieldGroup("AGENT (OPTIONAL)") {
                            Picker("Agent", selection: $selectedAgentId) {
                                Text("None").tag(nil as String?)
                                ForEach(agentStore.agents) { agent in
                                    Text(agent.name).tag(agent.id as String?)
                                }
                            }
                            .foregroundStyle(Color.textPrimary)
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Spacer()
                    }
                }
                .padding(16)
            }
            .navigationTitle(createdKey != nil ? "" : "New API Key")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(createdKey != nil ? "Done" : "Cancel") { dismiss() }
                        .foregroundStyle(Color.textDim)
                }
                if createdKey == nil {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Create") { Task { await create() } }
                            .foregroundStyle(Color.linkBlue)
                            .fontWeight(.semibold)
                            .disabled(isCreating)
                    }
                }
            }
        }
    }

    private func create() async {
        isCreating = true
        let keyName = name.isEmpty ? nil : name
        if let response = await settingsStore.createKey(name: keyName, agentId: selectedAgentId) {
            createdKey = response.apiKey
            HapticManager.success()
        }
        isCreating = false
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase).tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
        }
    }
}
```

- [ ] **Step 3: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Views/Settings/NewDomainView.swift ios/Threadron/Views/Settings/NewAPIKeyView.swift
git commit -m "feat(ios): add NewDomainView and NewAPIKeyView sheets"
```

---

### Task 22: OnboardingView

**Files:**
- Create: `ios/Threadron/Views/Onboarding/OnboardingView.swift`

- [ ] **Step 1: Create OnboardingView.swift**

```swift
import SwiftUI

struct OnboardingView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(DomainStore.self) private var domainStore
    @State private var step = 0
    @State private var domainName = ""
    @State private var guardrail: Guardrail = .autonomous
    @State private var isCreating = false

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress dots
                HStack(spacing: 8) {
                    ForEach(0..<4, id: \.self) { i in
                        Circle()
                            .fill(i <= step ? Color.textPrimary : Color.bgBorder)
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.top, 24)

                Spacer()

                switch step {
                case 0: welcomeStep
                case 1: domainStep
                case 2: apiKeyStep
                case 3: readyStep
                default: EmptyView()
                }

                Spacer()

                // Skip button
                if step < 3 {
                    Button("Skip Setup") {
                        finishOnboarding()
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textDim)
                    .padding(.bottom, 32)
                }
            }
            .padding(.horizontal, 24)
        }
    }

    // MARK: - Steps

    private var welcomeStep: some View {
        VStack(spacing: 16) {
            Text("threadron")
                .font(.system(size: 36, weight: .heavy))
                .tracking(-1)
                .foregroundStyle(Color.textPrimary)

            Text("Orchestrate AI agent tasks with clarity and control.")
                .font(.system(size: 15))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            Text("Let's set up your workspace.")
                .font(.system(size: 13))
                .foregroundStyle(Color.textDim)
                .padding(.top, 8)

            primaryButton("Get Started") { step = 1 }
                .padding(.top, 24)
        }
    }

    private var domainStep: some View {
        VStack(spacing: 16) {
            Text("Create a Domain")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.textPrimary)

            Text("Domains organize your tasks by area (e.g., backend, infra, mobile).")
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 6) {
                Text("NAME")
                    .font(.system(size: 9, design: .monospaced))
                    .textCase(.uppercase).tracking(1.5)
                    .foregroundStyle(Color.textDim)
                TextField("e.g., backend", text: $domainName)
                    .foregroundStyle(Color.textPrimary)
                    .textInputAutocapitalization(.never)
                    .padding(14)
                    .background(Color.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("DEFAULT GUARDRAIL")
                    .font(.system(size: 9, design: .monospaced))
                    .textCase(.uppercase).tracking(1.5)
                    .foregroundStyle(Color.textDim)
                Picker("Guardrail", selection: $guardrail) {
                    ForEach(Guardrail.allCases) { g in
                        Text(g.label).tag(g)
                    }
                }
                .pickerStyle(.segmented)
            }

            primaryButton(isCreating ? "Creating..." : "Create Domain") {
                Task {
                    isCreating = true
                    if let _ = await domainStore.createDomain(name: domainName, guardrail: guardrail.rawValue) {
                        step = 2
                    }
                    isCreating = false
                }
            }
            .disabled(domainName.isEmpty || isCreating)
            .opacity(domainName.isEmpty ? 0.5 : 1)
            .padding(.top, 8)
        }
    }

    private var apiKeyStep: some View {
        VStack(spacing: 16) {
            Image(systemName: "key.fill")
                .font(.system(size: 32))
                .foregroundStyle(Color.priorityLow)

            Text("Your API Key")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.textPrimary)

            Text("Use this key to connect agents to Threadron.")
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)

            if let key = auth.initialApiKey {
                Text(key)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Color.textPrimary)
                    .padding(14)
                    .frame(maxWidth: .infinity)
                    .background(Color.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                    .textSelection(.enabled)

                Button {
                    UIPasteboard.general.string = key
                    HapticManager.light()
                } label: {
                    Label("Copy Key", systemImage: "doc.on.doc")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.textPrimary)
                }
            }

            primaryButton("Next") { step = 3 }
                .padding(.top, 16)
        }
    }

    private var readyStep: some View {
        VStack(spacing: 16) {
            Text("You're All Set")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.textPrimary)

            VStack(alignment: .leading, spacing: 12) {
                tip("Create tasks from the Tasks tab or via the API")
                tip("Connect agents using your API key")
                tip("Monitor agent activity from the Agents tab")
            }
            .padding(.horizontal, 8)

            primaryButton("Start Using Threadron") {
                finishOnboarding()
            }
            .padding(.top, 16)
        }
    }

    // MARK: - Helpers

    private func finishOnboarding() {
        auth.onboardingComplete = true
        auth.showOnboarding = false
    }

    @ViewBuilder
    private func primaryButton(_ text: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .fontWeight(.bold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .foregroundStyle(Color.bgPrimary)
                .background(Color.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    @ViewBuilder
    private func tip(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("→")
                .foregroundStyle(Color.priorityLow)
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
        }
    }
}
```

- [ ] **Step 2: Build and commit**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
git add ios/Threadron/Views/Onboarding/
git commit -m "feat(ios): add OnboardingView with 4-step post-registration flow"
```

---

### Task 23: App Entry Point — ThreadronApp.swift

**Files:**
- Modify: `ios/Threadron/ThreadronApp.swift` (replace stub from Task 1)

- [ ] **Step 1: Replace ThreadronApp.swift with full implementation**

```swift
import SwiftUI

@main
struct ThreadronApp: App {
    @State private var authManager = AuthManager()
    @State private var taskStore = TaskStore()
    @State private var domainStore = DomainStore()
    @State private var agentStore = AgentStore()
    @State private var settingsStore = SettingsStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    if authManager.showOnboarding {
                        OnboardingView()
                    } else {
                        MainTabView()
                    }
                } else {
                    LoginView()
                }
            }
            .preferredColorScheme(.dark)
            .environment(authManager)
            .environment(taskStore)
            .environment(domainStore)
            .environment(agentStore)
            .environment(settingsStore)
            .task {
                await authManager.checkExistingSession()
            }
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            TaskBoardView()
                .tabItem {
                    Label("Tasks", systemImage: "checklist")
                }

            AgentListView()
                .tabItem {
                    Label("Agents", systemImage: "cpu")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
        }
        .tint(.textPrimary)
    }
}
```

- [ ] **Step 2: Build to verify the full app compiles**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add ios/Threadron/ThreadronApp.swift
git commit -m "feat(ios): wire up ThreadronApp with auth routing and tab view"
```

---

### Task 24: Final Build & Verification

- [ ] **Step 1: Regenerate Xcode project (picks up all new files)**

```bash
cd ios && xcodegen generate
```

- [ ] **Step 2: Full clean build**

```bash
cd ios && xcodebuild clean build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -10
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: List all Swift files to verify nothing is missing**

```bash
find ios/Threadron -name "*.swift" | sort
```

Expected output should list all 30+ Swift files from the file structure above.

- [ ] **Step 4: Run in simulator to smoke-test**

```bash
cd ios && xcodebuild build -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO && xcrun simctl boot 'iPhone 16' 2>/dev/null; xcrun simctl install 'iPhone 16' $(xcodebuild -project Threadron.xcodeproj -scheme Threadron -destination 'platform=iOS Simulator,name=iPhone 16' -showBuildSettings CODE_SIGNING_ALLOWED=NO 2>/dev/null | grep -m1 BUILT_PRODUCTS_DIR | awk '{print $3}')/Threadron.app && xcrun simctl launch 'iPhone 16' com.threadron.app
```

Expected: App launches in simulator showing the login screen with dark theme.

- [ ] **Step 5: Final commit**

```bash
git add -A ios/
git commit -m "feat(ios): complete Threadron iOS app — all screens, API integration, biometric auth"
```
