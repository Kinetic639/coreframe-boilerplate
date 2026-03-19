import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Brand } from "@/constants/theme";

const AMBER = Brand.primary;
const AMBER_DARK = Brand.primaryDark;
const TEXT = "#F7F0E6";
const TEXT_SUB = "#A09278";
const { width: W, height: H } = Dimensions.get("window");

export function WelcomeOverlay({ onDismiss }: { onDismiss: () => void }) {
  const overlayOp = useSharedValue(1);

  // Ambient glow entrance
  const glowOp = useSharedValue(0);
  const glowScale = useSharedValue(0.82);

  // Logo
  const logoScale = useSharedValue(0.55);
  const logoOp = useSharedValue(0);

  // Pulse ring
  const pulseScale = useSharedValue(1);
  const pulseOp = useSharedValue(0.45);

  // "Ambra" letters
  const a_op = useSharedValue(0);
  const a_y = useSharedValue(20);
  const m_op = useSharedValue(0);
  const m_y = useSharedValue(20);
  const b_op = useSharedValue(0);
  const b_y = useSharedValue(20);
  const r_op = useSharedValue(0);
  const r_y = useSharedValue(20);
  const a2_op = useSharedValue(0);
  const a2_y = useSharedValue(20);

  // "system"
  const sysOp = useSharedValue(0);
  const sysY = useSharedValue(10);

  // Tagline
  const tagOp = useSharedValue(0);
  const tagY = useSharedValue(14);

  // Features — fade + scale up (no slide)
  const f1Op = useSharedValue(0);
  const f1S = useSharedValue(0.86);
  const f2Op = useSharedValue(0);
  const f2S = useSharedValue(0.86);
  const f3Op = useSharedValue(0);
  const f3S = useSharedValue(0.86);
  const f4Op = useSharedValue(0);
  const f4S = useSharedValue(0.86);

  // Button
  const btnOp = useSharedValue(0);
  const btnY = useSharedValue(24);

  useEffect(() => {
    const lCfg = { damping: 18, stiffness: 200 };

    // Glow fades + expands in gently before anything else
    glowOp.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.quad),
    });
    glowScale.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.quad),
    });

    // Logo
    logoOp.value = withTiming(1, { duration: 300 });
    logoScale.value = withSpring(1, { damping: 10, stiffness: 220 });

    // Pulse ring — gentle breathing
    pulseScale.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1.12, {
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(1.0, {
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
    pulseOp.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(0.12, {
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0.45, {
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );

    // "Ambra" letter by letter — 65 ms stagger
    a_op.value = withDelay(220, withTiming(1, { duration: 260 }));
    a_y.value = withDelay(220, withSpring(0, lCfg));
    m_op.value = withDelay(285, withTiming(1, { duration: 260 }));
    m_y.value = withDelay(285, withSpring(0, lCfg));
    b_op.value = withDelay(350, withTiming(1, { duration: 260 }));
    b_y.value = withDelay(350, withSpring(0, lCfg));
    r_op.value = withDelay(415, withTiming(1, { duration: 260 }));
    r_y.value = withDelay(415, withSpring(0, lCfg));
    a2_op.value = withDelay(480, withTiming(1, { duration: 260 }));
    a2_y.value = withDelay(480, withSpring(0, lCfg));

    // "system"
    sysOp.value = withDelay(620, withTiming(1, { duration: 340 }));
    sysY.value = withDelay(620, withSpring(0, { damping: 16, stiffness: 160 }));

    // Tagline
    tagOp.value = withDelay(760, withTiming(1, { duration: 360 }));
    tagY.value = withDelay(760, withSpring(0, { damping: 16, stiffness: 140 }));

    // Features — staggered fade + scale in
    const fTiming = { duration: 400, easing: Easing.out(Easing.quad) };
    f1Op.value = withDelay(900, withTiming(1, fTiming));
    f1S.value = withDelay(900, withTiming(1, fTiming));
    f2Op.value = withDelay(1020, withTiming(1, fTiming));
    f2S.value = withDelay(1020, withTiming(1, fTiming));
    f3Op.value = withDelay(1140, withTiming(1, fTiming));
    f3S.value = withDelay(1140, withTiming(1, fTiming));
    f4Op.value = withDelay(1260, withTiming(1, fTiming));
    f4S.value = withDelay(1260, withTiming(1, fTiming));

    // Button — smooth, not bouncy
    btnOp.value = withDelay(
      1420,
      withTiming(1, { duration: 460, easing: Easing.out(Easing.quad) }),
    );
    btnY.value = withDelay(
      1420,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    overlayOp.value = withTiming(
      0,
      { duration: 380, easing: Easing.out(Easing.quad) },
      (done) => {
        if (done) runOnJS(onDismiss)();
      },
    );
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOp.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOp.value,
    transform: [{ scale: glowScale.value }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOp.value,
    transform: [{ scale: logoScale.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOp.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const aStyle = useAnimatedStyle(() => ({
    opacity: a_op.value,
    transform: [{ translateY: a_y.value }],
  }));
  const mStyle = useAnimatedStyle(() => ({
    opacity: m_op.value,
    transform: [{ translateY: m_y.value }],
  }));
  const bStyle = useAnimatedStyle(() => ({
    opacity: b_op.value,
    transform: [{ translateY: b_y.value }],
  }));
  const rStyle = useAnimatedStyle(() => ({
    opacity: r_op.value,
    transform: [{ translateY: r_y.value }],
  }));
  const a2Style = useAnimatedStyle(() => ({
    opacity: a2_op.value,
    transform: [{ translateY: a2_y.value }],
  }));

  const sysStyle = useAnimatedStyle(() => ({
    opacity: sysOp.value,
    transform: [{ translateY: sysY.value }],
  }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOp.value,
    transform: [{ translateY: tagY.value }],
  }));

  const f1Style = useAnimatedStyle(() => ({
    opacity: f1Op.value,
    transform: [{ scale: f1S.value }],
  }));
  const f2Style = useAnimatedStyle(() => ({
    opacity: f2Op.value,
    transform: [{ scale: f2S.value }],
  }));
  const f3Style = useAnimatedStyle(() => ({
    opacity: f3Op.value,
    transform: [{ scale: f3S.value }],
  }));
  const f4Style = useAnimatedStyle(() => ({
    opacity: f4Op.value,
    transform: [{ scale: f4S.value }],
  }));

  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOp.value,
    transform: [{ translateY: btnY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.root, overlayStyle]}>
      <LinearGradient
        colors={["#0D0A04", "#130E05", "#1A1206"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[s.ambientGlow, glowStyle]}>
        <LinearGradient
          colors={[AMBER + "28", AMBER + "00"]}
          style={s.ambientGlowGradient}
        />
      </Animated.View>

      {/* Two equal flex halves — header centred in top, features centred in bottom */}
      <View style={s.outer}>
        {/* ── Top half: logo + wordmark + tagline ── */}
        <View style={s.headerSection}>
          <View style={s.logoArea}>
            <Animated.View style={[s.pulseRing, pulseStyle]} />
            <Animated.View style={logoStyle}>
              <View style={s.logoContainer}>
                <LinearGradient
                  colors={[AMBER, AMBER_DARK]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={s.logoBg}
                >
                  <Text style={s.logoLetter}>A</Text>
                </LinearGradient>
                <View style={s.logoRing} />
              </View>
            </Animated.View>
          </View>

          <View style={s.wordmarkRow}>
            <Animated.Text style={[s.wordmarkAmbra, aStyle]}>A</Animated.Text>
            <Animated.Text style={[s.wordmarkAmbra, mStyle]}>m</Animated.Text>
            <Animated.Text style={[s.wordmarkAmbra, bStyle]}>b</Animated.Text>
            <Animated.Text style={[s.wordmarkAmbra, rStyle]}>r</Animated.Text>
            <Animated.Text style={[s.wordmarkAmbra, a2Style]}>a</Animated.Text>
          </View>

          <Animated.Text style={[s.wordmarkSystem, sysStyle]}>
            system
          </Animated.Text>

          <Animated.Text style={[s.tagline, tagStyle]}>
            Nowoczesne zarządzanie magazynem{"\n"}w Twoich rękach
          </Animated.Text>

          <View style={s.divider} />
        </View>

        {/* ── Bottom half: features ── */}
        <View style={s.featuresSection}>
          <Animated.View style={[s.featureRow, f1Style]}>
            <FeatureIcon icon="warehouse" />
            <View style={s.featureCopy}>
              <Text style={s.featureTitle}>Zarządzaj magazynami</Text>
              <Text style={s.featureSub}>Pełna kontrola nad stanami</Text>
            </View>
          </Animated.View>

          <Animated.View style={[s.featureRow, f2Style]}>
            <FeatureIcon icon="qrcode-scan" />
            <View style={s.featureCopy}>
              <Text style={s.featureTitle}>Skanuj kody QR</Text>
              <Text style={s.featureSub}>
                Błyskawiczna identyfikacja produktów
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={[s.featureRow, f3Style]}>
            <FeatureIcon icon="chart-bar" />
            <View style={s.featureCopy}>
              <Text style={s.featureTitle}>Analizuj dane</Text>
              <Text style={s.featureSub}>Raporty i statystyki na żywo</Text>
            </View>
          </Animated.View>

          <Animated.View style={[s.featureRow, f4Style]}>
            <FeatureIcon icon="bell-outline" />
            <View style={s.featureCopy}>
              <Text style={s.featureTitle}>Powiadomienia</Text>
              <Text style={s.featureSub}>
                Alerty o niskich stanach i zdarzeniach
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* ── Button — absolutely pinned to bottom, outside flex flow ── */}
      <Animated.View style={[s.btnWrap, btnStyle]}>
        <TouchableOpacity onPress={handleDismiss} activeOpacity={0.82}>
          <LinearGradient
            colors={[AMBER, AMBER_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.btn}
          >
            <Text style={s.btnLabel}>Wejdź do aplikacji</Text>
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

function FeatureIcon({
  icon,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}) {
  return (
    <LinearGradient
      colors={[AMBER + "22", AMBER + "00"]}
      style={s.featureIconBg}
    >
      <MaterialCommunityIcons name={icon} size={22} color={AMBER} />
    </LinearGradient>
  );
}

const LOGO_SIZE = 86;
const RING_OFFSET = 5; // ring extends this many px beyond logo on each side

const s = StyleSheet.create({
  root: { zIndex: 999 },

  ambientGlow: {
    position: "absolute",
    // Centre the glow on the logo.
    // Logo sits at: paddingTop(52) + headerSection_height/2
    // headerSection_height = (H - paddingTop - paddingBottom) / 2 = (H - 172) / 2
    // Logo centre ≈ paddingTop(88) + (H - paddingTop - paddingBottom) / 4
    //             = 88 + (H - 208) / 4
    // Glow top = logo centre - glow radius
    top: 88 + (H - 208) / 4 - W * 0.45,
    alignSelf: "center",
    width: W * 0.9,
    height: W * 0.9,
    borderRadius: W * 0.45,
    overflow: "hidden",
  },
  ambientGlowGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: W * 0.45,
  },

  // ── Layout ─────────────────────────────────────────────────────────────────
  // Reserves bottom space so features don't hide behind the button
  outer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 88,
    paddingBottom: 120,
  },
  // Top half — header content vertically centred
  headerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Bottom half — features vertically centred
  featuresSection: {
    flex: 1,
    justifyContent: "center",
    gap: 22,
  },
  // Pinned to bottom, outside the flex flow
  btnWrap: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 52,
  },

  // ── Logo ───────────────────────────────────────────────────────────────────
  logoArea: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  pulseRing: {
    position: "absolute",
    width: LOGO_SIZE + RING_OFFSET * 4,
    height: LOGO_SIZE + RING_OFFSET * 4,
    borderRadius: 26 + RING_OFFSET * 2,
    borderWidth: 1.5,
    borderColor: AMBER + "80",
  },
  // Fixed-size wrapper so absolute logoRing is centred
  logoContainer: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  logoBg: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
  },
  // Sits perfectly around logoBg, offset by RING_OFFSET on all sides
  logoRing: {
    position: "absolute",
    top: -RING_OFFSET,
    left: -RING_OFFSET,
    width: LOGO_SIZE + RING_OFFSET * 2,
    height: LOGO_SIZE + RING_OFFSET * 2,
    borderRadius: 26 + RING_OFFSET,
    borderWidth: 1.5,
    borderColor: AMBER + "55",
  },
  logoLetter: {
    color: "#fff",
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.5,
    lineHeight: 50,
  },

  // ── Wordmark ────────────────────────────────────────────────────────────────
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  wordmarkAmbra: {
    color: AMBER,
    fontSize: 62,
    fontWeight: "800",
    letterSpacing: -2,
    lineHeight: 70,
  },
  wordmarkSystem: {
    color: TEXT_SUB,
    fontSize: 16,
    fontWeight: "300",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  tagline: {
    color: TEXT_SUB,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },

  divider: {
    width: 44,
    height: 1,
    backgroundColor: AMBER + "38",
  },

  // ── Features ────────────────────────────────────────────────────────────────
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIconBg: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1,
    borderColor: AMBER + "22",
  },
  featureCopy: { flex: 1 },
  featureTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  featureSub: {
    color: TEXT_SUB,
    fontSize: 12,
    marginTop: 2,
  },

  // ── Button ──────────────────────────────────────────────────────────────────
  btn: {
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 12,
  },
  btnLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
