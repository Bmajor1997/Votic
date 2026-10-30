#!/usr/bin/env bash
# Exercise the init script with real Gradle, including a composite build, offline.
set -euo pipefail
repo_root=$(cd "$(dirname "$0")/.." && pwd)
gradle_bin=$(realpath "${1:?Pass the Gradle executable or wrapper}")
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/included" "$fixture/gradle-home/init.d"
cp "$repo_root/security/maven-central-mirror.init.gradle" "$fixture/gradle-home/init.d/votic-maven-central.gradle"
cat > "$fixture/settings.gradle" <<'GRADLE'
pluginManagement { repositories { mavenCentral(); google(); gradlePluginPortal() } }
dependencyResolutionManagement { repositories { mavenCentral() } }
includeBuild('included')
rootProject.name = 'mirror-test'
gradle.settingsEvaluated { settings ->
    assert settings.pluginManagement.repositories.getByName('MavenRepo').url.toString() == 'https://maven-central.storage-download.googleapis.com/maven2/'
    assert settings.pluginManagement.repositories.getByName('Google').url.toString() == 'https://dl.google.com/dl/android/maven2/'
    assert settings.pluginManagement.repositories.getByName('Gradle Central Plugin Repository').url.toString() == 'https://plugins.gradle.org/m2'
    assert settings.dependencyResolutionManagement.repositories.getByName('MavenRepo').url.toString() == 'https://maven-central.storage-download.googleapis.com/maven2/'
}
GRADLE
cp "$fixture/settings.gradle" "$fixture/included/settings.gradle"
# The included build has no further nested builds.
sed -i "/includeBuild('included')/d; s/mirror-test/included-mirror-test/" "$fixture/included/settings.gradle"
cat > "$fixture/build.gradle" <<'GRADLE'
buildscript { repositories { mavenCentral() } }
repositories {
    mavenCentral()
    maven { name = 'LegacyCentral'; url = 'https://repo1.maven.org/maven2' }
    maven { name = 'Private'; url = 'https://example.invalid/maven2/' }
}
assert buildscript.repositories.getByName('MavenRepo').url.toString() == 'https://maven-central.storage-download.googleapis.com/maven2/'
assert repositories.getByName('MavenRepo').url.toString() == 'https://maven-central.storage-download.googleapis.com/maven2/'
assert repositories.getByName('LegacyCentral').url.toString() == 'https://maven-central.storage-download.googleapis.com/maven2/'
assert repositories.getByName('Private').url.toString() == 'https://example.invalid/maven2/'
tasks.register('verifyMirror')
GRADLE
cp "$fixture/build.gradle" "$fixture/included/build.gradle"
cat >> "$fixture/build.gradle" <<'GRADLE'
tasks.named('verifyMirror') { dependsOn gradle.includedBuild('included').task(':verifyMirror') }
GRADLE
# Isolate init scripts and caches from the developer's Gradle home.
# A wrapper downloads its distribution before the offline test if it is not already cached.
GRADLE_USER_HOME="$fixture/gradle-home" "$gradle_bin" -p "$fixture" verifyMirror --offline --no-daemon --max-workers=2
