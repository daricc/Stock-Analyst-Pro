import { Feather, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { usePortfolio } from "@/contexts/portfolio-context";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const { portfolio } = usePortfolio();
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
        <View style={styles.loginContainer}>
          <LinearGradient
            colors={["rgba(0,208,132,0.15)", "rgba(0,208,132,0.05)"]}
            style={styles.loginIconBg}
          >
            <Feather name="user" size={48} color={Colors.light.tint} />
          </LinearGradient>
          <Text style={styles.loginTitle}>Save Your Data</Text>
          <Text style={styles.loginSubtitle}>
            Log in to save your portfolio, watchlist, and trades across devices.
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={login}>
            <Feather name="log-in" size={20} color="#FFFFFF" />
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
          <Text style={styles.loginNote}>
            Your paper trading data is saved locally until you log in.
          </Text>
        </View>
      </View>
    );
  }

  const totalPositions = Object.keys(portfolio.positions).length;
  const totalTrades = portfolio.transactions.length;
  const totalPnl = portfolio.transactions.reduce(
    (sum, tx) => sum + (tx.realizedPnl ?? 0),
    0
  );

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + webTopPad }]}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.headerTitle}>Profile</Text>

      <View style={styles.profileCard}>
        {user?.profileImageUrl ? (
          <Image
            source={{ uri: user.profileImageUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Feather name="user" size={32} color={Colors.light.tint} />
          </View>
        )}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {user?.firstName
              ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
              : "Trader"}
          </Text>
          {user?.email && (
            <Text style={styles.profileEmail}>{user.email}</Text>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalPositions}</Text>
          <Text style={styles.statLabel}>Positions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalTrades}</Text>
          <Text style={styles.statLabel}>Trades</Text>
        </View>
        <View style={styles.statCard}>
          <Text
            style={[
              styles.statValue,
              { color: totalPnl >= 0 ? Colors.light.profit : Colors.light.loss },
            ]}
          >
            ${Math.abs(totalPnl).toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>P&L</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Ionicons name="cloud-upload-outline" size={20} color={Colors.light.tint} />
              <Text style={styles.menuText}>Data synced to cloud</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={Colors.light.profit} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={logout}>
            <View style={styles.menuLeft}>
              <Feather name="log-out" size={20} color={Colors.light.loss} />
              <Text style={[styles.menuText, { color: Colors.light.loss }]}>Log Out</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.light.secondaryText} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 20,
    marginTop: 12,
  },
  loginContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  loginIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  loginTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  loginSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.secondaryText,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
  },
  loginButtonText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  loginNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.secondaryText,
    textAlign: "center",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.navySurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(0,208,132,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    marginLeft: 14,
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.secondaryText,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.navySurface,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.light.secondaryText,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.secondaryText,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  menuCard: {
    backgroundColor: Colors.light.navySurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 16,
  },
});
