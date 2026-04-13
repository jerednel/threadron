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
