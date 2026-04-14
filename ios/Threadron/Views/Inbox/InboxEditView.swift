import SwiftUI

struct InboxEditView: View {
    let item: InboxItem
    let onPromote: (String, String?, String?) -> Void // title, nextAction, owner
    @Environment(\.dismiss) private var dismiss
    @Environment(DomainStore.self) private var domainStore

    @State private var title: String = ""
    @State private var nextAction: String = ""
    @State private var owner: String = ""
    @State private var isPromoting = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Original input
                        VStack(alignment: .leading, spacing: 4) {
                            Text("ORIGINAL")
                                .font(.system(size: 9, design: .monospaced))
                                .textCase(.uppercase)
                                .tracking(1.5)
                                .foregroundStyle(Color.textDim)
                            Text("\"\(item.rawText)\"")
                                .font(.system(size: 13))
                                .foregroundStyle(Color.textMuted)
                                .italic()
                        }

                        // Title
                        VStack(alignment: .leading, spacing: 6) {
                            Text("TITLE")
                                .font(.system(size: 9, design: .monospaced))
                                .textCase(.uppercase)
                                .tracking(1.5)
                                .foregroundStyle(Color.textDim)
                            TextField("Task title", text: $title)
                                .font(.system(size: 15))
                                .foregroundStyle(Color.textPrimary)
                                .padding(12)
                                .background(Color.bgSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                        }

                        // Next Action
                        VStack(alignment: .leading, spacing: 6) {
                            Text("NEXT ACTION")
                                .font(.system(size: 9, design: .monospaced))
                                .textCase(.uppercase)
                                .tracking(1.5)
                                .foregroundStyle(Color.textDim)
                            TextField("What should happen next?", text: $nextAction)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.priorityLow)
                                .padding(12)
                                .background(Color.bgSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                        }

                        // Owner
                        VStack(alignment: .leading, spacing: 6) {
                            Text("OWNER (OPTIONAL)")
                                .font(.system(size: 9, design: .monospaced))
                                .textCase(.uppercase)
                                .tracking(1.5)
                                .foregroundStyle(Color.textDim)
                            TextField("Agent or person", text: $owner)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                                .padding(12)
                                .background(Color.bgSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Edit & Promote")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        isPromoting = true
                        onPromote(
                            title,
                            nextAction.isEmpty ? nil : nextAction,
                            owner.isEmpty ? nil : owner
                        )
                        HapticManager.success()
                        dismiss()
                    } label: {
                        Text("Promote")
                            .fontWeight(.semibold)
                            .foregroundStyle(title.isEmpty ? Color.textDim : Color.priorityLow)
                    }
                    .disabled(title.isEmpty || isPromoting)
                }
            }
            .onAppear {
                title = item.parsed?.title ?? item.rawText
                nextAction = item.parsed?.nextAction ?? ""
                owner = item.parsed?.owner ?? ""
            }
        }
    }
}
