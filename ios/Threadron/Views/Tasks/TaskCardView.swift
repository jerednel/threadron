import SwiftUI

struct TaskCardView: View {
    let task: TaskItem
    @State private var showCopied = false

    /// Strip agent prefixes like "agentname to do X:" from next action text
    private var cleanNextAction: String? {
        guard let raw = task.nextAction, !raw.isEmpty else { return nil }
        // Pattern: "agent_name to verb: actual action" → keep "actual action"
        if let colonRange = raw.range(of: " to ", options: .caseInsensitive),
           let actionStart = raw[colonRange.upperBound...].firstIndex(of: ":") {
            let after = raw[raw.index(after: actionStart)...].trimmingCharacters(in: .whitespaces)
            if !after.isEmpty { return after }
        }
        return raw
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Title
            Text(task.title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Blocker dominates when blocked
            if task.status == .blocked, let blocker = task.blockers.first, !blocker.isEmpty {
                Text("⊘ \(blocker)")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.priorityUrgent)
                    .lineLimit(2)
                    .padding(.top, 1)
            }

            // Next action — clean, no agent name mixed in
            if let next = cleanNextAction {
                Text("→ \(next)")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(task.status == .blocked ? Color.textDim : Color.priorityLow)
                    .lineLimit(2)
                    .padding(.top, task.status == .blocked ? 0 : 1)
            }

            // Footer — agent badge + time (compact)
            HStack(spacing: 6) {
                if let agent = task.claimedBy ?? task.assignee, !agent.isEmpty {
                    Text(agent)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Color.ctxDecision)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.ctxDecision.opacity(0.12))
                        .clipShape(Capsule())
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
                    .opacity(0.5)
            }
            .padding(.top, 3)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
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
