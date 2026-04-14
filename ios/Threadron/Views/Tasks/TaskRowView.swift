import SwiftUI

struct TaskRowView: View {
    let task: TaskItem

    var body: some View {
        HStack(spacing: 10) {
            Text(task.title)
                .font(.system(size: 14))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)

            Spacer()

            if let agent = task.claimedBy ?? task.assignee, !agent.isEmpty {
                Text(agent)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(Color.ctxDecision.opacity(0.7))
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 10))
                .foregroundStyle(Color.bgBorder)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }
}
