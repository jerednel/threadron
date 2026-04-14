import SwiftUI

struct LoginView: View {
    @Environment(AuthManager.self) private var auth
    @State private var isRegistering = false
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 80)

                    // Branding
                    Text("threadron")
                        .font(.system(size: 32, weight: .heavy))
                        .tracking(-1)
                        .foregroundStyle(Color.textPrimary)
                    Text("agent task orchestration")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Color.textDim)
                        .padding(.bottom, 40)

                    // Form
                    VStack(spacing: 16) {
                        if isRegistering {
                            fieldGroup("NAME") {
                                TextField("Your name", text: $name)
                                    .textContentType(.name)
                                    .autocorrectionDisabled()
                            }
                        }

                        fieldGroup("EMAIL") {
                            TextField("you@example.com", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }

                        fieldGroup("PASSWORD") {
                            SecureField("••••••••", text: $password)
                                .textContentType(isRegistering ? .newPassword : .password)
                        }
                    }
                    .padding(.horizontal, 24)

                    // Error
                    if let error = auth.error {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.priorityUrgent)
                            .padding(.top, 12)
                            .padding(.horizontal, 24)
                    }

                    // Submit button
                    Button {
                        Task { await submit() }
                    } label: {
                        Group {
                            if auth.isLoading {
                                ProgressView().tint(.bgPrimary)
                            } else {
                                Text(isRegistering ? "Create Account" : "Sign In")
                                    .fontWeight(.bold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .foregroundStyle(Color.bgPrimary)
                        .background(Color.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(auth.isLoading || !isValid)
                    .opacity(isValid ? 1 : 0.5)
                    .padding(.horizontal, 24)
                    .padding(.top, 24)

                    // Toggle
                    Button {
                        withAnimation { isRegistering.toggle() }
                    } label: {
                        Group {
                            if isRegistering {
                                Text("Already have an account? ") +
                                Text("Sign In").fontWeight(.semibold).foregroundColor(.textPrimary)
                            } else {
                                Text("Don't have an account? ") +
                                Text("Register").fontWeight(.semibold).foregroundColor(.textPrimary)
                            }
                        }
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textDim)
                    }
                    .padding(.top, 16)

                    // Biometric
                    if !isRegistering && KeychainManager.biometricAvailable && !auth.isLoading {
                        Button {
                            Task { await auth.attemptBiometric() }
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: "faceid")
                                    .font(.system(size: 28))
                                Text("Sign in with Face ID")
                                    .font(.system(size: 11))
                            }
                            .foregroundStyle(Color.textDim)
                        }
                        .padding(.top, 32)
                    }

                    Spacer()
                }
            }
        }
    }

    private var isValid: Bool {
        if isRegistering {
            return !email.isEmpty && !password.isEmpty && !name.isEmpty
        }
        return !email.isEmpty && !password.isEmpty
    }

    private func submit() async {
        if isRegistering {
            await auth.register(email: email, password: password, name: name)
        } else {
            await auth.login(email: email, password: password)
        }
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder field: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase)
                .tracking(1.5)
                .foregroundStyle(Color.textDim)
            field()
                .foregroundStyle(Color.textPrimary)
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1)
                )
        }
    }
}
