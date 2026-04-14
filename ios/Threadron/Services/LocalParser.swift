import Foundation
import NaturalLanguage

struct LocalParseResult {
    let title: String
    let nextAction: String?
    let project: String?
    let confidence: Double
}

enum LocalParser {
    /// Parse raw inbox text into structured fields on-device
    static func parse(_ rawText: String) -> LocalParseResult {
        let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return LocalParseResult(title: trimmed, nextAction: nil, project: nil, confidence: 0.1)
        }

        // Capitalize first letter for title
        let title = capitalizeFirst(trimmed)

        // Attempt to infer a next action
        let nextAction = inferNextAction(from: trimmed)

        // Attempt to detect project from known patterns
        let project = inferProject(from: trimmed)

        // Confidence based on input complexity
        let confidence = estimateConfidence(rawText: trimmed, hasNextAction: nextAction != nil)

        return LocalParseResult(
            title: title,
            nextAction: nextAction,
            project: project,
            confidence: confidence
        )
    }

    // MARK: - Private helpers

    private static func capitalizeFirst(_ text: String) -> String {
        guard let first = text.first else { return text }
        return first.uppercased() + text.dropFirst()
    }

    private static func inferNextAction(from text: String) -> String? {
        let lower = text.lowercased()

        // Action verb patterns — if the input starts with a verb, the whole thing IS the action
        let actionVerbs = ["fix", "buy", "call", "email", "send", "update", "review", "check",
                          "schedule", "book", "cancel", "write", "create", "build", "deploy",
                          "test", "debug", "research", "investigate", "find", "set up", "clean",
                          "organize", "prepare", "submit", "file", "register", "sign up",
                          "renew", "pay", "order", "pick up", "drop off", "return"]

        for verb in actionVerbs {
            if lower.hasPrefix(verb) {
                return capitalizeFirst(text)
            }
        }

        // If it's short (< 6 words) and not a verb, generate a generic next action
        let wordCount = text.split(separator: " ").count
        if wordCount <= 5 {
            return "Look into: \(text)"
        }

        return nil
    }

    private static func inferProject(from text: String) -> String? {
        // Simple keyword-based project inference
        let lower = text.lowercased()
        let projectHints: [(keywords: [String], project: String)] = [
            (["deploy", "server", "api", "database", "backend", "frontend", "bug", "pr", "merge"], "Engineering"),
            (["doctor", "dentist", "prescription", "health", "insurance", "medical"], "Health"),
            (["school", "preschool", "daycare", "homework", "teacher"], "Family"),
            (["invoice", "client", "contract", "proposal", "sales"], "Business"),
        ]

        for hint in projectHints {
            if hint.keywords.contains(where: { lower.contains($0) }) {
                return hint.project
            }
        }
        return nil
    }

    private static func estimateConfidence(rawText: String, hasNextAction: Bool) -> Double {
        let wordCount = rawText.split(separator: " ").count

        // Very short inputs = higher confidence (less ambiguity)
        if wordCount <= 3 {
            return hasNextAction ? 0.7 : 0.5
        }

        // Medium inputs
        if wordCount <= 8 {
            return hasNextAction ? 0.65 : 0.45
        }

        // Long inputs = lower confidence (more complex, harder to parse locally)
        return 0.3
    }
}
