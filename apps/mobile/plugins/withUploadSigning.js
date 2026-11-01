const { withAppBuildGradle } = require("@expo/config-plugins");
const GUARD = `
// Votic release signing: public debug keys are allowed only in explicitly marked local preview builds.
def voticLocalDebug = System.getenv('EAS_BUILD_PROFILE') == 'preview' && System.getenv('VOTIC_LOCAL_DEBUG_SIGNING') == '1'
def voticSigningNames = ['VOTIC_UPLOAD_STORE_FILE', 'VOTIC_UPLOAD_STORE_PASSWORD', 'VOTIC_UPLOAD_KEY_ALIAS', 'VOTIC_UPLOAD_KEY_PASSWORD']
def voticHasUploadSigning = voticSigningNames.every { System.getenv(it)?.trim() }
// Inspect the resolved graph, so aggregate tasks such as 'build', 'assemble' and 'bundle' cannot bypass this.
gradle.taskGraph.whenReady { graph ->
    if (!voticLocalDebug && !voticHasUploadSigning && graph.allTasks.any { it.name.toLowerCase().contains('release') }) {
        throw new GradleException('Private upload signing is required for Play release builds. Configure VOTIC_UPLOAD_* secrets; local preview builds may explicitly opt into debug signing.')
    }
}
if (!voticLocalDebug && voticHasUploadSigning) {
    def uploadFile = file(System.getenv('VOTIC_UPLOAD_STORE_FILE'))
    def uploadAlias = System.getenv('VOTIC_UPLOAD_KEY_ALIAS')
    if (!uploadFile.isFile() || uploadAlias.toLowerCase() == 'androiddebugkey') {
        throw new GradleException('A private upload keystore and non-debug alias are required.')
    }
    def uploadStore = java.security.KeyStore.getInstance(uploadFile, System.getenv('VOTIC_UPLOAD_STORE_PASSWORD').toCharArray())
    def uploadCert = uploadStore.getCertificate(uploadAlias)
    if (uploadCert == null || !uploadStore.isKeyEntry(uploadAlias)) throw new GradleException('Upload signing alias is invalid.')
    def debugFile = file('debug.keystore')
    if (debugFile.isFile()) {
        def debugStore = java.security.KeyStore.getInstance(debugFile, 'android'.toCharArray())
        if (uploadCert == debugStore.getCertificate('androiddebugkey')) throw new GradleException('Public React Native debug signing is forbidden for Play builds.')
    }
    android.signingConfigs.create('voticUpload') {
        storeFile uploadFile
        storePassword System.getenv('VOTIC_UPLOAD_STORE_PASSWORD')
        keyAlias uploadAlias
        keyPassword System.getenv('VOTIC_UPLOAD_KEY_PASSWORD')
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.voticUpload
}
`;
module.exports = (config) =>
  withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("// Votic release signing:"))
      config.modResults.contents += GUARD;
    return config;
  });
module.exports.GUARD = GUARD;
