import Foundation

func check(_ condition: Bool, _ message: String) {
  guard condition else { fatalError(message) }
}

let encoded = try JSONEncoder().encode(VoticSnapshot.preview)
let decoded = try JSONDecoder().decode(VoticSnapshot.self, from: encoded)
check(decoded.current?.id == "preview", "Continue document did not survive JSON round trip")
check(decoded.current?.progress == 0.42, "Document progress changed")
check(decoded.upNext.count == 3, "Up-next documents changed")
let raw = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
check(raw["continue"] != nil && raw["current"] == nil, "Continue JSON key differs from the app protocol")
do {
  _ = try JSONDecoder().decode(VoticSnapshot.self, from: Data("{broken".utf8))
  fatalError("Malformed snapshot was accepted")
} catch { /* Expected: damaged snapshots cannot become widget data. */ }
print("Widget snapshot round-trip, protocol keys, and damaged-input checks passed.")
