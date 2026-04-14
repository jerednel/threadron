import Foundation
import NaturalLanguage

struct LocalParseResult {
    let title: String
    let nextAction: String
    let project: String?
    let confidence: Double
}

enum LocalParser {
    /// Parse raw inbox text into structured fields on-device.
    /// The title should be a clean, actionable task name.
    /// The next action should be a concrete first step — never the same as the title.
    static func parse(_ rawText: String) -> LocalParseResult {
        let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return LocalParseResult(title: trimmed, nextAction: "Clarify what this means", project: nil, confidence: 0.1)
        }

        let lower = trimmed.lowercased()
        let words = trimmed.split(separator: " ").map(String.init)

        // Try pattern matching for common input types
        if let matched = matchPattern(lower: lower, words: words, raw: trimmed) {
            return matched
        }

        // Fallback: clean up the title and generate a reasonable next action
        let title = buildTitle(from: words, raw: trimmed)
        let nextAction = buildNextAction(from: lower, title: title)
        let project = inferProject(from: lower)
        let confidence = words.count <= 4 ? 0.5 : 0.35

        return LocalParseResult(title: title, nextAction: nextAction, project: project, confidence: confidence)
    }

    // MARK: - Pattern matching

    private static func matchPattern(lower: String, words: [String], raw: String) -> LocalParseResult? {
        // "buy X" → title: "Buy X", next: "Go to store and purchase X"
        if lower.hasPrefix("buy ") || lower.hasPrefix("get ") || lower.hasPrefix("pick up ") || lower.hasPrefix("order ") {
            let item = stripPrefix(raw, prefixes: ["buy ", "get ", "pick up ", "order "])
            return LocalParseResult(
                title: "Buy \(item)",
                nextAction: "Purchase \(item) — check if anything else is needed",
                project: nil,
                confidence: 0.75
            )
        }

        // "call/email/text X" → title: "Contact X", next: "Call/email X to discuss"
        if lower.hasPrefix("call ") || lower.hasPrefix("email ") || lower.hasPrefix("text ") || lower.hasPrefix("message ") {
            let verb = String(words[0]).lowercased()
            let target = words.dropFirst().joined(separator: " ")
            return LocalParseResult(
                title: "Contact \(capitalize(target))",
                nextAction: "\(capitalize(verb)) \(target)",
                project: nil,
                confidence: 0.7
            )
        }

        // "fix X" → title: "Fix X", next: "Investigate root cause of X"
        if lower.hasPrefix("fix ") || lower.hasPrefix("debug ") || lower.hasPrefix("repair ") {
            let issue = stripPrefix(raw, prefixes: ["fix ", "debug ", "repair "])
            return LocalParseResult(
                title: "Fix \(issue)",
                nextAction: "Investigate root cause of \(issue.lowercased())",
                project: inferProject(from: lower),
                confidence: 0.65
            )
        }

        // "schedule/book X" → title: "Schedule X", next: "Find available times and book X"
        if lower.hasPrefix("schedule ") || lower.hasPrefix("book ") {
            let what = stripPrefix(raw, prefixes: ["schedule ", "book "])
            return LocalParseResult(
                title: "Schedule \(what)",
                nextAction: "Find available times and book \(what.lowercased())",
                project: inferProject(from: lower),
                confidence: 0.7
            )
        }

        // "research/look into/investigate X"
        if lower.hasPrefix("research ") || lower.hasPrefix("look into ") || lower.hasPrefix("investigate ") {
            let topic = stripPrefix(raw, prefixes: ["research ", "look into ", "investigate "])
            return LocalParseResult(
                title: "Research \(topic)",
                nextAction: "Gather information about \(topic.lowercased()) and summarize findings",
                project: inferProject(from: lower),
                confidence: 0.65
            )
        }

        // "send/submit/file X"
        if lower.hasPrefix("send ") || lower.hasPrefix("submit ") || lower.hasPrefix("file ") {
            let what = stripPrefix(raw, prefixes: ["send ", "submit ", "file "])
            return LocalParseResult(
                title: "Submit \(what)",
                nextAction: "Prepare and send \(what.lowercased())",
                project: inferProject(from: lower),
                confidence: 0.65
            )
        }

        // "set up/create/build X"
        if lower.hasPrefix("set up ") || lower.hasPrefix("setup ") || lower.hasPrefix("create ") || lower.hasPrefix("build ") {
            let what = stripPrefix(raw, prefixes: ["set up ", "setup ", "create ", "build "])
            return LocalParseResult(
                title: "Set up \(what)",
                nextAction: "Define requirements for \(what.lowercased()) and begin setup",
                project: inferProject(from: lower),
                confidence: 0.6
            )
        }

        // "review/check X"
        if lower.hasPrefix("review ") || lower.hasPrefix("check ") {
            let what = stripPrefix(raw, prefixes: ["review ", "check "])
            return LocalParseResult(
                title: "Review \(what)",
                nextAction: "Open and review \(what.lowercased()), note any issues",
                project: inferProject(from: lower),
                confidence: 0.65
            )
        }

        // "update/change X"
        if lower.hasPrefix("update ") || lower.hasPrefix("change ") || lower.hasPrefix("modify ") {
            let what = stripPrefix(raw, prefixes: ["update ", "change ", "modify "])
            return LocalParseResult(
                title: "Update \(what)",
                nextAction: "Identify what needs to change in \(what.lowercased()) and make updates",
                project: inferProject(from: lower),
                confidence: 0.6
            )
        }

        // "pay/renew X"
        if lower.hasPrefix("pay ") || lower.hasPrefix("renew ") {
            let what = stripPrefix(raw, prefixes: ["pay ", "renew "])
            return LocalParseResult(
                title: "\(capitalize(String(words[0]))) \(what)",
                nextAction: "Find account details and complete payment for \(what.lowercased())",
                project: nil,
                confidence: 0.7
            )
        }

        // "clean/organize X"
        if lower.hasPrefix("clean ") || lower.hasPrefix("organize ") || lower.hasPrefix("tidy ") || lower.hasPrefix("sort ") {
            let what = stripPrefix(raw, prefixes: ["clean ", "organize ", "tidy ", "sort "])
            return LocalParseResult(
                title: "Organize \(what)",
                nextAction: "Set aside time and work through \(what.lowercased())",
                project: nil,
                confidence: 0.65
            )
        }

        // Noun-phrase inputs (no verb): "rowan park west papers", "dentist appointment", "milk"
        // These need the most transformation
        if words.count <= 5 && !startsWithVerb(lower) {
            return parseNounPhrase(words: words, lower: lower, raw: raw)
        }

        return nil
    }

    // MARK: - Noun phrase parsing (no verb detected)

    private static func parseNounPhrase(words: [String], lower: String, raw: String) -> LocalParseResult {
        let project = inferProject(from: lower)

        // Single word
        if words.count == 1 {
            let word = capitalize(words[0])
            return LocalParseResult(
                title: "Handle \(word.lowercased())",
                nextAction: "Figure out what needs to happen with \(word.lowercased()) and take first step",
                project: project,
                confidence: 0.4
            )
        }

        // Detect if it contains words suggesting paperwork/forms
        if lower.contains("form") || lower.contains("paper") || lower.contains("document") || lower.contains("application") {
            let topic = capitalize(raw)
            return LocalParseResult(
                title: "Complete \(topic.lowercased()) paperwork",
                nextAction: "Gather all required forms and documents for \(topic.lowercased())",
                project: project,
                confidence: 0.6
            )
        }

        // Detect appointment-like inputs
        if lower.contains("appointment") || lower.contains("meeting") || lower.contains("visit") {
            let topic = capitalize(raw)
            return LocalParseResult(
                title: "Schedule \(topic.lowercased())",
                nextAction: "Find available times and book \(topic.lowercased())",
                project: project,
                confidence: 0.6
            )
        }

        // Generic noun phrase — make title descriptive, next action exploratory
        let topic = capitalize(raw)
        return LocalParseResult(
            title: "Handle \(topic.lowercased())",
            nextAction: "Determine what's needed for \(topic.lowercased()) and take first step",
            project: project,
            confidence: 0.4
        )
    }

    // MARK: - Helpers

    private static func startsWithVerb(_ lower: String) -> Bool {
        let verbs = ["fix", "buy", "get", "call", "email", "send", "update", "review", "check",
                     "schedule", "book", "cancel", "write", "create", "build", "deploy",
                     "test", "debug", "research", "investigate", "find", "set up", "setup",
                     "clean", "organize", "prepare", "submit", "file", "register", "sign",
                     "renew", "pay", "order", "pick", "drop", "return", "look", "text",
                     "message", "repair", "change", "modify", "tidy", "sort"]
        return verbs.contains(where: { lower.hasPrefix($0 + " ") || lower == $0 })
    }

    private static func stripPrefix(_ raw: String, prefixes: [String]) -> String {
        let lower = raw.lowercased()
        for prefix in prefixes {
            if lower.hasPrefix(prefix) {
                let stripped = String(raw.dropFirst(prefix.count)).trimmingCharacters(in: .whitespaces)
                return stripped.isEmpty ? raw : stripped
            }
        }
        return raw
    }

    private static func capitalize(_ text: String) -> String {
        guard let first = text.first else { return text }
        return first.uppercased() + text.dropFirst()
    }

    private static func buildTitle(from words: [String], raw: String) -> String {
        // For longer inputs, just clean up capitalization
        capitalize(raw)
    }

    private static func buildNextAction(from lower: String, title: String) -> String {
        "Break down \(title.lowercased()) into concrete steps and start with the first one"
    }

    private static func inferProject(from lower: String) -> String? {
        let projectHints: [(keywords: [String], project: String)] = [
            (["deploy", "server", "api", "database", "backend", "frontend", "bug", "pr", "merge", "code", "repo"], "Engineering"),
            (["doctor", "dentist", "prescription", "health", "insurance", "medical", "therapy", "pharmacy"], "Health"),
            (["school", "preschool", "daycare", "homework", "teacher", "rowan", "tuition", "enrollment"], "Family"),
            (["invoice", "client", "contract", "proposal", "sales", "revenue", "marketing", "pitch"], "Business"),
            (["grocery", "milk", "store", "shopping", "laundry", "dishes", "vacuum", "trash"], "Home"),
        ]

        for hint in projectHints {
            if hint.keywords.contains(where: { lower.contains($0) }) {
                return hint.project
            }
        }
        return nil
    }
}
