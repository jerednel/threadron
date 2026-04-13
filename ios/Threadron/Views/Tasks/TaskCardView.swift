import SwiftUI

struct TaskCardView: View {
    let task: TaskItem
    @State private var showCopied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
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

            if let state = task.currentState, !state.isEmpty {
                Text(state)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textMuted)
                    .lineLimit(2)
            }

            if let next = task.nextAction, !next.isEmpty {
                Text("→ \(next)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.priorityLow)
                    .lineLimit(1)
            }

            if let blocker = task.blockers.first, !blocker.isEmpty {
                Text("⊘ \(blocker)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.priorityUrgent)
                    .lineLimit(1)
            }

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
