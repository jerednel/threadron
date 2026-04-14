import SwiftUI

struct InboxCaptureView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(InboxStore.self) private var inboxStore

    @State private var rawText = ""
    @State private var isSubmitting = false
    @FocusState private var isFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    Text("Capture anything. Structure comes later.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textDim)
                        .padding(.top, 8)

                    TextField("What's on your mind?", text: $rawText, axis: .vertical)
                        .font(.system(size: 17))
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(3...10)
                        .padding(16)
                        .background(Color.bgSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.bgBorder, lineWidth: 1))
                        .focused($isFocused)

                    Spacer()
                }
                .padding(16)
            }
            .navigationTitle("Capture")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .foregroundStyle(!rawText.trimmingCharacters(in: .whitespaces).isEmpty ? Color.linkBlue : Color.textDim)
                        .fontWeight(.semibold)
                        .disabled(rawText.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
                }
            }
            .onAppear { isFocused = true }
        }
    }

    private func save() async {
        isSubmitting = true
        if let _ = await inboxStore.capture(rawText: rawText) {
            HapticManager.success()
            dismiss()
        }
        isSubmitting = false
    }
}
