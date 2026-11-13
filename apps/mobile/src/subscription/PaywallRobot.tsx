import { Image, StyleSheet, View, useWindowDimensions } from "react-native";

/** A reusable illustration, with the actual existing V artwork layered on its blank chest plate. */
export function PaywallRobot() {
  const { height } = useWindowDimensions();
  return (
    <View
      testID="paywall-robot"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[s.frame, height < 800 && s.short, height < 700 && s.shorter]}
    >
      <Image source={require("../../assets/paywall-robot.png")} resizeMode="contain" style={s.image} />
      <View testID="paywall-robot-logo" style={s.chest}>
        <Image
          source={require("../../assets/votic-v-stroke.png")}
          tintColor="#242122"
          style={s.image}
          resizeMode="contain"
        />
        <Image
          source={require("../../assets/votic-v-wing-top.png")}
          tintColor="#00A4F5"
          style={s.image}
          resizeMode="contain"
        />
        <Image
          source={require("../../assets/votic-v-wing-middle.png")}
          tintColor="#00A4F5"
          style={s.image}
          resizeMode="contain"
        />
        <Image
          source={require("../../assets/votic-v-wing-bottom.png")}
          tintColor="#00A4F5"
          style={s.image}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Kept small so the plans and purchase button fit on a typical phone screen without scrolling.
  frame: { width: "45%", maxWidth: 156, aspectRatio: 1.5, alignSelf: "center" },
  short: { maxWidth: 110 },
  shorter: { maxWidth: 84 },
  image: { position: "absolute", width: "100%", height: "100%" },
  chest: {
    position: "absolute",
    left: "43.5%",
    top: "73%",
    width: "10.5%",
    height: "10.8%",
    transform: [{ perspective: 400 }, { rotateY: "-14deg" }, { rotateZ: "-8deg" }],
  },
});
