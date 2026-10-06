// Spike de geofencing — comprobaciones antes de iniciar una sesión. Código puro, para probarlo en Node.
//
// Un dato mal etiquetado (por ejemplo "perfil sin restricciones" con la optimización de batería activa) vale
// menos que ningún dato: tira días de pruebas de campo. Por eso hay condiciones que bloquean el inicio.

export interface PreflightInput {
  scenario: string;
  batteryProfile: string;
  foreground: string; // estado del permiso de ubicación en primer plano
  foregroundAccuracy: string; // "fine" | "coarse" | "none" | "—"
  background: string; // estado de "Permitir todo el tiempo"
  servicesEnabled: boolean;
  batteryOptimization: boolean | null; // true = Android puede restringir la app (lista blanca de Doze)
  lowPowerMode: boolean | null;
  notifications: string;
}

export interface Check {
  id: string;
  message: string;
  // Un bloqueo "forzable" puede saltarse con confirmación explícita; el motivo queda registrado en el log.
  // Es para cuando la comprobación misma pueda estar equivocada (p. ej. ajustes propios de MIUI).
  overridable?: boolean;
}

export interface Preflight {
  blockers: Check[];
  warnings: Check[];
}

// El escenario 8 prueba justamente los permisos reducidos: ahí se deja registrar con lo que haya.
const REDUCED_PERMISSIONS_SCENARIO = "8";
const LOW_POWER_SCENARIO = "5";

export function preflight(i: PreflightInput): Preflight {
  const blockers: Check[] = [];
  const warnings: Check[] = [];

  if (!i.servicesEnabled) {
    blockers.push({ id: "services_off", message: "Los servicios de ubicación del teléfono están apagados. Actívalos en el panel rápido o en Ajustes › Ubicación." });
  }
  if (i.scenario !== REDUCED_PERMISSIONS_SCENARIO) {
    if (i.foreground !== "granted") {
      blockers.push({ id: "foreground_permission", message: "Falta el permiso de ubicación. Toca «Pedir permisos de ubicación»." });
    } else if (i.background !== "granted") {
      blockers.push({ id: "background_permission", message: 'Falta «Permitir todo el tiempo» en el permiso de ubicación. Sin él la geocerca no funciona con la app cerrada.' });
    }
  }

  if (i.batteryOptimization === true && i.batteryProfile === "unrestricted") {
    blockers.push({
      id: "battery_profile_mismatch",
      overridable: true,
      message:
        'Declaraste el perfil «Sin restricciones» pero Android reporta la optimización de batería ACTIVA para esta app: los datos saldrían mal etiquetados. Usa «Pedir exclusión (diálogo del sistema)». ' +
        "Ojo: el «Sin restricciones» de MIUI es otro interruptor y esta comprobación no lo ve.",
    });
  } else if (i.batteryOptimization === false && i.batteryProfile === "default") {
    blockers.push({
      id: "battery_profile_mismatch",
      overridable: true,
      message: "Android ya NO restringe la batería de esta app, pero el perfil declarado es «Ajustes por defecto». Cambia el perfil a «Sin restricciones» para no mezclar datos.",
    });
  }

  if (i.notifications !== "granted") {
    warnings.push({ id: "notifications_denied", message: "Las notificaciones están desactivadas: no sabrás en el momento si se detectó un evento. Toca «Pedir permisos de ubicación» (también pide este)." });
  }
  if (i.lowPowerMode != null) {
    if (i.scenario === LOW_POWER_SCENARIO && !i.lowPowerMode) {
      warnings.push({ id: "low_power_off", message: "El escenario 5 es con el ahorro de batería del sistema ACTIVO y ahora está apagado." });
    } else if (i.scenario !== LOW_POWER_SCENARIO && i.lowPowerMode) {
      warnings.push({ id: "low_power_on", message: "El ahorro de batería del sistema está ACTIVO y este escenario no lo pide: puede alterar los resultados." });
    }
  }
  if (i.foregroundAccuracy === "coarse" && i.scenario !== REDUCED_PERMISSIONS_SCENARIO) {
    warnings.push({ id: "coarse_location", message: "El permiso es de ubicación APROXIMADA: el geofencing será mucho peor. Cámbialo a «Precisa» en Ajustes." });
  }
  return { blockers, warnings };
}

// ¿Se puede iniciar la sesión? `override` solo salta los bloqueos marcados como forzables.
export function canStart(result: Preflight, override: boolean): boolean {
  return result.blockers.every((b) => b.overridable === true && override);
}
