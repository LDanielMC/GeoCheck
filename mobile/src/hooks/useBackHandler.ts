import { useEffect } from "react";
import { BackHandler } from "react-native";

// Botón "atrás" de Android: ejecuta `onBack` en vez de cerrar la app.
export function useBackHandler(onBack: () => void) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);
}
