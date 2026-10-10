import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import Shell from "./src/navigation/Shell";
import JoinScreen from "./src/screens/JoinScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterOrganizationScreen from "./src/screens/RegisterOrganizationScreen";

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

// Galería de la base visual (EXPO_PUBLIC_DESIGN_GALLERY=1): solo para comprobar el diseño en el teléfono; el build normal
// no la carga.
const DESIGN_GALLERY = process.env.EXPO_PUBLIC_DESIGN_GALLERY === "1";
const DesignGallery: React.ComponentType = DESIGN_GALLERY ? require("./src/design/Gallery").default : () => null;

// Navegación por estado, sin librería. Sin sesión: tres pantallas. Con sesión: la barra de pestañas por rol de
// src/navigation (Shell), que también atiende el botón «atrás».
type SignedOutScreen = "login" | "register" | "join";

function SignedOutFlow() {
  const [screen, setScreen] = useState<SignedOutScreen>("login");

  if (screen === "register") return <RegisterOrganizationScreen onBack={() => setScreen("login")} />;
  if (screen === "join") return <JoinScreen onBack={() => setScreen("login")} />;
  return <LoginScreen onRegister={() => setScreen("register")} onJoin={() => setScreen("join")} />;
}

function Root() {
  const { state } = useAuth();

  if (state.status === "loading") return <ActivityIndicator style={styles.loading} />;
  if (state.status === "signedOut") return <SignedOutFlow />;
  return <Shell user={state.user} offline={state.offline} />;
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
  if (DESIGN_GALLERY) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <DesignGallery />
          <StatusBar style="dark" />
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
