import Foundation
import SwiftUI

@MainActor
@Observable
final class AuthManager {
    var isAuthenticated = false
    var currentUser: User?
    var isLoading = false
    var error: String?
    var biometricEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "biometric_enabled") }
        set { UserDefaults.standard.set(newValue, forKey: "biometric_enabled") }
    }
    var onboardingComplete: Bool {
        get { UserDefaults.standard.bool(forKey: "onboarding_complete") }
        set { UserDefaults.standard.set(newValue, forKey: "onboarding_complete") }
    }
    var initialApiKey: String?
    var showOnboarding = false

    private let api = APIClient.shared

    func checkExistingSession() async {
        do {
            if let token = try KeychainManager.loadToken() {
                await api.setToken(token)
                let response: MeResponse = try await api.request(.me)
                currentUser = response.user
                isAuthenticated = true
            }
        } catch {
            try? KeychainManager.deleteToken()
            isAuthenticated = false
        }
    }

    func attemptBiometric() async {
        guard biometricEnabled, KeychainManager.biometricAvailable else { return }
        do {
            if let token = try KeychainManager.loadToken(withBiometric: true) {
                await api.setToken(token)
                let response: MeResponse = try await api.request(.me)
                currentUser = response.user
                isAuthenticated = true
            }
        } catch {
            self.error = "Biometric authentication failed"
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        error = nil
        do {
            let response: AuthResponse = try await api.request(.login(email: email, password: password))
            try KeychainManager.saveToken(response.token, withBiometric: biometricEnabled)
            await api.setToken(response.token)
            currentUser = response.user
            isAuthenticated = true
        } catch let err as APIError {
            self.error = err.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func register(email: String, password: String, name: String) async {
        isLoading = true
        error = nil
        do {
            let response: AuthResponse = try await api.request(.register(email: email, password: password, name: name))
            try KeychainManager.saveToken(response.token, withBiometric: false)
            await api.setToken(response.token)
            currentUser = response.user
            initialApiKey = response.apiKey
            isAuthenticated = true
            showOnboarding = true
        } catch let err as APIError {
            self.error = err.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func logout() {
        try? KeychainManager.deleteToken()
        Task { await api.setToken(nil) }
        currentUser = nil
        isAuthenticated = false
        initialApiKey = nil
    }
}
