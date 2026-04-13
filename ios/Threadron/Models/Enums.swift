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
