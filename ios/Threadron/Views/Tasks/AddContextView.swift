import SwiftUI

struct AddContextView: View {
    let taskId: String
    @Environment(\.dismiss) private var dismiss
    @Environment(TaskStore.self) private var taskStore

    @State private var type: ContextType = .observation
    @State private var contextBody = ""
    @State private var author = ""
    @State private var isSubmitting = false

    private var isValid: Bool { !contextBody.isEmpty && !author.isEmpty }

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
                        TextField("Context details...", text: $contextBody, axis: .vertical)
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

    @MainActor
    private func submit() async {
        isSubmitting = true
        if let _ = await taskStore.addContext(taskId: taskId, type: type.rawValue, body: contextBody, author: author) {
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
