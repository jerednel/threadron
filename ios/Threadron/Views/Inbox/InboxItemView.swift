import SwiftUI

struct InboxItemView: View {
    let item: InboxItem
    let onPromote: () -> Void
    let onEdit: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Raw text — always shown
            Text(item.rawText)
                .font(.system(size: 15))
                .foregroundStyle(Color.textPrimary)

            // Status indicator
            switch item.status {
            case .unprocessed:
                EmptyView()

            case .processing:
                HStack(spacing: 6) {
                    ProgressView().scaleEffect(0.7)
                    Text("Processing...")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textDim)
                }

            case .parsed:
                if let parsed = item.parsed {
                    VStack(alignment: .leading, spacing: 6) {
                        Divider().background(Color.bgBorder)

                        if let title = parsed.title {
                            HStack(spacing: 4) {
                                Text("→")
                                    .foregroundStyle(Color.priorityLow)
                                Text(title)
                                    .fontWeight(.medium)
                            }
                            .font(.system(size: 13))
                            .foregroundStyle(Color.textPrimary)
                        }

                        if let next = parsed.nextAction {
                            HStack(spacing: 4) {
                                Text("Next:")
                                    .foregroundStyle(Color.textDim)
                                Text(next)
                                    .foregroundStyle(Color.priorityLow)
                            }
                            .font(.system(size: 12))
                        }

                        if let project = parsed.project {
                            Text(project)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(Color.textDim)
                        }

                        if let confidence = parsed.confidence {
                            HStack(spacing: 4) {
                                Text("Confidence:")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Color.textDim)
                                Text(String(format: "%.0f%%", confidence * 100))
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(confidence > 0.7 ? Color.priorityLow : confidence > 0.4 ? Color.priorityMedium : Color.priorityUrgent)
                            }
                        }
                    }

                    // Action buttons
                    HStack(spacing: 10) {
                        Button(action: onPromote) {
                            Text("Promote")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.bgPrimary)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Color.priorityLow)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }

                        Button(action: onEdit) {
                            Text("Edit")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.textMuted)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Color.bgSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.bgBorder, lineWidth: 1))
                        }

                        Button(action: onReject) {
                            Text("Reject")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.textDim)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                        }

                        Spacer()
                    }
                    .padding(.top, 4)
                }

            case .promoted:
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.priorityLow)
                    Text("Promoted to task")
                        .foregroundStyle(Color.textDim)
                }
                .font(.system(size: 12))

            case .rejected:
                HStack(spacing: 4) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.textDim)
                    Text("Rejected")
                        .foregroundStyle(Color.textDim)
                }
                .font(.system(size: 12))

            case .error:
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.priorityUrgent)
                    Text(item.error ?? "Parse error")
                        .foregroundStyle(Color.priorityUrgent)
                }
                .font(.system(size: 12))
            }

            // Source + time
            HStack {
                Text(item.source)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Color.textDim)
                Spacer()
                TimeAgoText(date: item.createdAt)
            }
        }
        .padding(14)
        .background(Color.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(item.status == .error ? Color.priorityUrgent : Color.bgBorder, lineWidth: 1)
        )
        .opacity(item.status == .promoted || item.status == .rejected ? 0.5 : 1)
    }
}
