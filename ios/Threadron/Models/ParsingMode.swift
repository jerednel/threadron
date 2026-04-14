import Foundation

enum ParsingMode: String, CaseIterable, Identifiable {
    case cloud = "cloud"
    case onDevice = "on_device"
    case hybrid = "hybrid"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .cloud: "Cloud"
        case .onDevice: "On-device"
        case .hybrid: "Hybrid"
        }
    }

    var description: String {
        switch self {
        case .cloud: "All parsing by Threadron agents"
        case .onDevice: "Parse locally using Apple Intelligence"
        case .hybrid: "Try locally first, fall back to cloud"
        }
    }

    static var stored: ParsingMode {
        get {
            let raw = UserDefaults.standard.string(forKey: "parsing_mode") ?? "cloud"
            return ParsingMode(rawValue: raw) ?? .cloud
        }
        set {
            UserDefaults.standard.set(newValue.rawValue, forKey: "parsing_mode")
        }
    }
}
