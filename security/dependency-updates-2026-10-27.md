# V1 dependency remediation — October 27, 2026

The pre-change mobile production audit reported one high-severity finding: node-forge 1.4.0, GHSA-86w9-cpqp-85rv. The installed Expo code-signing consumers accept ^1.3.3; npm now provides compatible patch 1.4.1. Only that transitive package's version, URL and integrity changed in apps/mobile/package-lock.json. No Expo/React Native downgrade or broad dependency update was made.

The corresponding node-forge exception was removed from osv-scanner.toml. A regression test now requires the dependency gate to block that advisory again. Other pre-existing advisory exceptions and their expiry dates are unchanged.

The mobile production npm audit reports zero vulnerabilities after the patch. Root audit also reports zero. The compatibility test exercises the installed Expo code-signing consumer with generated ephemeral keys/certificate and checks signatures independently with Node crypto, including rejection of altered data. It stores no key or certificate file. Android prebuild and manifest/resource checks also passed. See the audit report for full suite and CI results.

Source: [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv); version and compatibility constraints were checked against the npm registry and installed Expo consumers. OSV/CodeQL/Semgrep/Gitleaks remain separate CI checks; zero npm findings does not imply those passed.
