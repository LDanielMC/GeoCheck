import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import HomeScreen from "./src/screens/HomeScreen";
import InvitationsScreen from "./src/screens/InvitationsScreen";
import ProjectFormScreen from "./src/screens/ProjectFormScreen";
import ProjectsScreen from "./src/screens/ProjectsScreen";
import JoinScreen from "./src/screens/JoinScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterOrganizationScreen from "./src/screens/RegisterOrganizationScreen";
import type { Project, SessionUser } from "./src/types";

// Modo spike (perfil "spike" de eas.json, o desarrollo con EXPO_PUBLIC_SPIKE=1): solo el laboratorio de geofencing,
// que no usa sesión ni servidor. Todo lo del spike se carga ÚNICAMENTE en este modo: el build normal no incluye el
// laboratorio ni sus módulos nativos (notificaciones, diálogo de batería…) ni en Expo Go da errores por ellos.
const SPIKE_MODE = process.env.EXPO_PUBLIC_SPIKE === "1";

if (SPIKE_MODE) {
  // Debe cargarse aquí, en el alcance global: cuando el sistema despierta la app cerrada (evento de geocerca o
  // botón de la notificación) solo se carga este bundle, sin montar la UI, y las tareas tienen que estar ya definidas.
  require("./src/spike/register");
}
const GeofenceLabScreen: React.ComponentType = SPIKE_MODE ? require("./src/screens/GeofenceLabScreen").default : () => null;

// Navegación por estado: pocas pantallas y sin dependencias extra. Se cambiará por una
// librería de navegación cuando haya más pantallas (proyectos, reportes, mapa).
type SignedOutScreen = "login" | "register" | "join";
type SignedInScreen =
  | { name: "home" }
  | { name: "invitations" }
  | { name: "projects" }
  // project = null: proyecto nuevo
  | { name: "project"; project: Project | null };

function SignedOutFlow() {
  const [screen, setScreen] = useState<SignedOutScreen>("login");

  if (screen === "register") return <RegisterOrganizationScreen onBack={() => setScreen("login")} />;
  if (screen === "join") return <JoinScreen onBack={() => setScreen("login")} />;
  return <LoginScreen onRegister={() => setScreen("register")} onJoin={() => setScreen("join")} />;
}

function SignedInFlow({ user, offline }: { user: SessionUser; offline: boolean }) {
  const [screen, setScreen] = useState<SignedInScreen>({ name: "home" });
  const goHome = () => setScreen({ name: "home" });

  // Solo el ADMIN llega a invitaciones; el servidor lo exige igualmente (403 para los demás roles).
  if (screen.name === "invitations" && user.role === "ADMIN") {
    return <InvitationsScreen user={user} onBack={goHome} />;
  }
  if (screen.name === "projects") {
    return <ProjectsScreen user={user} onBack={goHome} onOpenProject={(project) => setScreen({ name: "project", project })} />;
  }
  // Los demás roles ven el proyecto en solo lectura; crear o editar lo exige también el servidor (403).
  if (screen.name === "project") {
    return <ProjectFormScreen user={user} project={screen.project} onBack={() => setScreen({ name: "projects" })} />;
  }
  return (
    <HomeScreen
      user={user}
      offline={offline}
      onOpenProjects={() => setScreen({ name: "projects" })}
      onOpenInvitations={() => setScreen({ name: "invitations" })}
    />
  );
}

function Root() {
  const { state } = useAuth();

  if (state.status === "loading") return <ActivityIndicator style={styles.loading} />;
  if (state.status === "signedOut") return <SignedOutFlow />;
  return <SignedInFlow user={state.user} offline={state.offline} />;
}

export default function App() {
  if (SPIKE_MODE) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <GeofenceLabScreen />
          <StatusBar style="auto" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafeAreaView style={styles.container}>
          <Root />
          <StatusBar style="auto" />
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loading: {
    flex: 1,
  },
});
