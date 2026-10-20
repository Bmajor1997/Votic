# Android generated resources

`android-res/drawable-*/votic_textfield_*.9.png` and the text-field inset dimensions
are unmodified copies (apart from resource names) from AndroidX AppCompat 1.7.1.
Copyright The Android Open Source Project. Licensed under Apache-2.0; see
`ANDROID_RESOURCES_LICENSE.txt`.

Source artifact: https://dl.google.com/dl/android/maven2/androidx/appcompat/appcompat/1.7.1/appcompat-1.7.1.aar

Owning these resources avoids private AndroidX identifiers without replacing React
Native's disabled/focused text-field background behavior.

The finalized Expo plugin also normalizes generated PNG extensions, reuses Expo's
round legacy icon for its silhouette, and adds a native vector for themed icons.
The dynamically resolved sharing scheme and development server resources are kept
explicitly so lint and resource shrinking do not mistake them for unused content.

Fresco decoders and core artifacts are aligned on 3.9.0. Android release lint treats
warnings as errors; no lint categories are disabled or baselined.
