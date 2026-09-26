# Análisis de Requisitos — App de Control de Horas para Construcción
### Basado en información pública de "ConstructionClock Time Tracker"

---

## 0. Nota metodológica y de alcance

Este documento se elaboró a partir de **información pública**: la ficha de la app en App Store y Google Play, el sitio web oficial (constructionclock.com) y reseñas de usuarios. No tuve acceso al código fuente, arquitectura interna, base de datos ni documentos de diseño de ConstructionClock (esa información es privada de la empresa), así que lo que sigue es una **ingeniería de requisitos inversa a nivel de producto** (qué hace la app, no cómo está construida por dentro).

Puntos a tener en cuenta antes de empezar el diseño:

- **No repliques marca ni assets**: nombre "ConstructionClock", logo, paleta de marca, textos de marketing e íconos son propiedad de la empresa. Puedes construir una app con **funcionalidad equivalente** bajo tu propia marca sin problema — es una práctica normal de análisis competitivo — pero copiar su identidad visual o código sí sería un problema legal.
- Este es un mercado con competidores establecidos (ConstructionClock, Busybusy, Raken, HCSS, Workyard, ClockShark, etc.), todos con el mismo patrón funcional central: geofencing + clock in/out + reportes de nómina. Te conviene diferenciarte en algo (UX, precio, nicho, integración local, etc.).

---

## 1. Visión general del producto

Es una app de **control de asistencia automatizado por geolocalización (geofencing)** dirigida a empresas de construcción y cuadrillas de campo. Su propuesta de valor central: **el trabajador no necesita abrir la app ni tocar nada** — el sistema detecta cuándo entra y sale del radio de un proyecto y registra las horas automáticamente. Existe también modo manual/delegado para supervisores.

**Roles de usuario identificados:**
1. **Owner/Admin** (dueño de la empresa o encargado de nómina) — crea proyectos, invita empleados, ve reportes, exporta nómina.
2. **Supervisor/Foreman** (capataz de cuadrilla) — puede fichar por otros miembros de su cuadrilla.
3. **Employee/Crew member** (trabajador de campo) — su tiempo se registra automáticamente; puede ver sus propias horas.
4. **Bookkeeper/Contador** — acceso de solo lectura orientado a exportar nómina (mencionado como "acceso gratuito para el contador").

---

## 2. Requisitos funcionales (RF)

### 2.1 Registro de tiempo (Time Tracking)
| ID | Requisito |
|---|---|
| RF-01 | El sistema debe permitir crear un "proyecto" definiendo su ubicación geográfica en un mapa (pin/dirección). |
| RF-02 | El sistema debe permitir configurar un **radio geográfico ajustable** por proyecto (geofence), para sitios grandes o pequeños. |
| RF-03 | El sistema debe detectar automáticamente cuando un usuario entra al geofence de un proyecto y generar un evento de **clock-in** sin acción manual. |
| RF-04 | El sistema debe detectar automáticamente cuando un usuario sale del geofence y generar un evento de **clock-out**. |
| RF-05 | El sistema debe permitir clock-in/out manual como alternativa al automático (para casos sin GPS confiable o preferencia del usuario). |
| RF-06 | Un supervisor debe poder fichar (clock in/out) en nombre de otros miembros de su cuadrilla. |
| RF-07 | El sistema debe registrar y diferenciar **tiempo de viaje** (traslado entre sitios / a comprar materiales) del tiempo trabajado en sitio. |
| RF-08 | El sistema debe permitir **editar manualmente** horas ya registradas (corrección de errores de GPS, olvidos, etc.), con registro de auditoría de quién editó y cuándo. |
| RF-09 | El sistema debe soportar **pausas/almuerzo (breaks)**, registrables automática o manualmente, y descontables del total de horas. |
| RF-10 | El sistema debe mostrar en tiempo real qué empleados están activos ("clocked in") y en qué proyecto. |
| RF-11 | El sistema debe agrupar y reportar horas por **empleado, por cuadrilla (crew) y por proyecto**. |
| RF-12 | El sistema debe soportar múltiples **cuadrillas (crews)**, agrupando empleados dentro de una organización. |
| RF-13 | El sistema debe calcular automáticamente **horas extra (overtime)** según reglas configurables (diarias/semanales, según jurisdicción). |

### 2.2 Ubicación y mapa
| ID | Requisito |
|---|---|
| RF-14 | El sistema debe mostrar un **mapa en vivo** con la ubicación de cada miembro de la cuadrilla y en qué sitio se encuentra. |
| RF-15 | El sistema debe registrar la ubicación **solo** en los momentos de clock-in/clock-out (según la política de privacidad declarada), no tracking continuo indiscriminado — esto es tanto un requisito funcional como un compromiso de privacidad a comunicar al usuario final. |
| RF-16 | El sistema debe funcionar con la app en segundo plano (background location) para poder detectar entradas/salidas sin que el usuario tenga la app abierta. |

### 2.3 Gestión de proyectos
| ID | Requisito |
|---|---|
| RF-17 | El admin debe poder crear, editar y archivar proyectos. |
| RF-18 | El sistema debe permitir agregar **notas, fotos y tareas** a un proyecto para dar seguimiento al avance. |
| RF-19 | El sistema debe permitir asignar **tareas** a empleados o cuadrillas dentro de un proyecto. |
| RF-20 | El sistema debe permitir definir **horas de labor presupuestadas** por proyecto y mostrar el avance real vs. presupuesto (costo de mano de obra en vivo). |
| RF-21 | El sistema debe soportar **creación automática de proyectos** (plan superior) — probablemente basada en detección de nuevas ubicaciones frecuentadas por la cuadrilla. |

### 2.4 Nómina y reportes
| ID | Requisito |
|---|---|
| RF-22 | El sistema debe generar **timesheets automáticos** por período de pago. |
| RF-23 | El admin debe poder configurar el **ciclo de pago** (semanal, quincenal, etc.). |
| RF-24 | El sistema debe permitir **exportar** reportes de horas/nómina en formatos XLSX y PDF. |
| RF-25 *(no prioritario por ahora)* | El sistema debe integrarse con **QuickBooks** y **Xero** (exportación/sincronización contable). |
| RF-26 *(no prioritario por ahora)* | El sistema debe integrarse con **Payworks** (procesador de nómina). |
| RF-27 | El sistema debe soportar **descuentos automáticos** en horarios de trabajo (ej. descuento automático de almuerzo). |
| RF-28 | (Roadmap del producto original, no confirmado como ya lanzado) **Aprobación de timesheets** por parte de un supervisor antes de enviarlos a nómina. |

### 2.5 Horarios de trabajo
| ID | Requisito |
|---|---|
| RF-29 | El sistema debe permitir crear **horarios/turnos (work schedules)** por empleado o cuadrilla. |
| RF-30 | El sistema debe soportar distintos estilos de jornada (turnos fijos, flexibles). |

### 2.6 Equipo e invitaciones
| ID | Requisito |
|---|---|
| RF-31 | El admin debe poder **invitar empleados** mediante un link/código asociado a la empresa. |
| RF-32 | El sistema debe soportar **onboarding sin fricción** (sin requerir capacitación) — relevante para el diseño de UX, no solo backend. |
| RF-33 | El sistema debe permitir gestionar (agregar/quitar) usuarios en cualquier momento, reflejándose en la facturación (modelo por usuario activo). |

### 2.7 Integraciones adicionales
| ID | Requisito |
|---|---|
| RF-34 *(reemplazado)* | ~~Integración con CompanyCam~~ — **descartado por costo**: CompanyCam y alternativas similares (SiteCam, CrewCam, Fieldwire) cobran por usuario/mes ($20-39+ USD/usuario), lo cual no es viable para este proyecto. En su lugar: **construir documentación fotográfica nativa dentro de la propia app** (fotos ligadas a Project/Task, subidas a almacenamiento en la nube económico — ej. Firebase Storage, Supabase Storage o Amazon S3, todos con capa gratuita generosa y costo marginal muy bajo por GB). Esto evita depender de un tercero de pago y da control total sobre datos y precio. |

### 2.8 Multiplataforma
| ID | Requisito |
|---|---|
| RF-35 | La solución debe ofrecerse en **iOS, Android y una aplicación web completa** (no solo apps móviles), para que administradores/contadores trabajen desde escritorio. |

### 2.9 Funcionalidades futuras mencionadas por el producto original (roadmap, no confirmadas como live)
- Chat interno con la cuadrilla dentro de la app.
- Certificaciones de empleados (ej. certificados de seguridad, licencias).

---

## 3. Requisitos no funcionales (RNF)

### 3.1 Rendimiento y consumo de recursos
| ID | Requisito |
|---|---|
| RNF-01 | **Batería**: el tracking en segundo plano debe optimizarse para minimizar el consumo de batería (es una objeción explícita y frecuente de usuarios en apps de este tipo; usar geofencing nativo del SO en vez de polling GPS constante). |
| RNF-02 | **Datos móviles**: el uso de datos debe ser bajo — sincronizar eventos de forma eficiente (batch/delta), no streaming continuo de ubicación. |
| RNF-03 | **Precisión de GPS**: la detección de entrada/salida del geofence debe minimizar falsos positivos/negativos (rebote en el borde del radio — "debounce" con tiempo mínimo de permanencia). |
| RNF-04 | El tamaño del binario/APK debe mantenerse liviano (referencia: la app original pesa ~22 MB). |

### 3.2 Disponibilidad y modo offline
| ID | Requisito |
|---|---|
| RNF-05 | La app debe soportar **registro de tiempo sin conexión a internet**, guardando eventos localmente y sincronizando cuando vuelva la conectividad — crítico en sitios de construcción con mala señal. |
| RNF-06 | El sistema backend debe tener alta disponibilidad durante horarios laborales (picos de clock-in en la mañana y clock-out en la tarde). |

### 3.3 Seguridad y privacidad
| ID | Requisito |
|---|---|
| RNF-07 | Los datos de ubicación deben capturarse **únicamente con el propósito declarado** (control de horas) y comunicarse claramente en política de privacidad — es un punto que la app original destaca explícitamente. |
| RNF-08 | Cumplimiento de **permisos de ubicación en segundo plano** exigidos por Google Play y App Store (declaraciones de privacidad, "Always Allow Location", App Tracking Transparency en iOS si aplica). |
| RNF-09 | Cifrado de datos en tránsito (HTTPS/TLS) y en reposo. |
| RNF-10 | Control de acceso basado en roles (RBAC): admin, supervisor, empleado, contador con permisos distintos. |
| RNF-11 | Cumplimiento normativo según mercado objetivo (ej. leyes laborales de horas extra, retención de registros de nómina, GDPR/CCPA si aplica, leyes locales de privacidad de geolocalización de empleados — en algunos estados de EE. UU. es obligatorio notificar/consentir el tracking). |

### 3.4 Usabilidad
| ID | Requisito |
|---|---|
| RNF-12 | La app debe ser usable por trabajadores **no necesariamente familiarizados con tecnología** — UI simple, mínima fricción, sin necesidad de capacitación. |
| RNF-13 | Soporte **multi-idioma** (la app original al menos ofrece inglés y español). |
| RNF-14 | Accesibilidad básica (tamaños de fuente legibles, contraste, soporte de lectores de pantalla) recomendable aunque no confirmado en la app original. |

### 3.5 Escalabilidad
| ID | Requisito |
|---|---|
| RNF-15 | El backend debe soportar múltiples organizaciones (multi-tenant) con aislamiento de datos entre empresas clientes. |
| RNF-16 | Debe escalar desde 1 usuario ("Solo") hasta equipos grandes multi-departamento ("Pro"), sin degradar rendimiento en mapas en vivo con muchos usuarios simultáneos. |

### 3.6 Compatibilidad
| ID | Requisito |
|---|---|
| RNF-17 | Debe funcionar en un rango razonable de versiones de iOS y Android (definir mínimo soportado, ej. últimas 3-4 versiones mayores). |
| RNF-18 | Debe soportar distintos tamaños de pantalla (teléfonos gama media/baja, comunes entre trabajadores de campo). |

### 3.7 Mantenibilidad / arquitectura (recomendaciones propias, no observadas en el original)
| ID | Requisito |
|---|---|
| RNF-19 | Arquitectura de integraciones desacoplada (adaptadores) para poder agregar QuickBooks/Xero/Payworks/CompanyCam sin acoplar el core. |
| RNF-20 | Logs y trazabilidad de cada evento de clock-in/out (auditoría) para disputas de nómina. |

---

## 4. Modelo de datos — entidades principales (inferido)

- **Organization** (empresa cliente)
- **User** (con rol: admin / supervisor / employee / bookkeeper)
- **Crew** (cuadrilla, pertenece a una Organization, contiene Users)
- **Project** (pertenece a una Organization; tiene ubicación, radio de geofence, presupuesto de horas, estado)
- **TimeEntry** (clock-in, clock-out, tipo: automático/manual/delegado, usuario, proyecto, ubicación GPS, editado_por/editado_en si aplica)
- **Break** (pausa asociada a un TimeEntry o jornada)
- **Schedule** (horario planificado por usuario/cuadrilla)
- **Task / Note** (asociado a un Project)
- **PayPeriod** (ciclo de pago configurado por la Organization)
- **Integration** (config de conexión a QuickBooks/Xero/Payworks/CompanyCam por Organization)

---

## 5. Modelo de negocio observado (referencia para tu propio pricing)

| Plan | Precio | Público | Incluye |
|---|---|---|---|
| Solo | Gratis | Un solo usuario | Clock in/out automático, fotos/notas/tareas, horario, horas y costos |
| Team | $12/usuario/mes | Equipos en crecimiento | Todo Solo + tracking automático de equipo, creación automática de proyectos, integraciones de nómina, acceso web, acceso gratis para contador |
| Pro | $18/usuario/mes | Multi-departamento | Todo Team + almacenamiento ilimitado, integraciones custom, soporte prioritario |

Modelo: **freemium + precio por usuario activo**, con descuento ~17% en plan anual.

---

## 6. Siguientes pasos sugeridos para tu diseño

1. **Definir tu diferenciador** — igualar 1:1 a un competidor establecido rara vez gana mercado; identifica qué haces distinto (¿nicho geográfico, integración con software local, precio, UX más simple, feature que ellos no tienen como chat interno ya lanzado en vez de "coming soon"?).
2. **Priorizar el MVP**: con lo anterior, el núcleo mínimo viable sería RF-01 a RF-11 (proyectos, geofencing, clock in/out automático y manual, edición de horas) + RNF-01, 05, 07, 12 (batería, offline, privacidad, usabilidad). El resto (integraciones contables, mapa en vivo, tareas/notas) puede ir en iteraciones posteriores.
3. **Definir la pila técnica** según si quieres nativo (Swift/Kotlin) o multiplataforma (React Native/Flutter) — dado que el diferenciador no está en el rendimiento gráfico sino en geofencing confiable y batería, Flutter o React Native con buenos plugins de geolocalización en background es viable.
4. **Validar requisitos legales locales** de geolocalización de empleados antes de lanzar (varía mucho por país/estado).

---

*Documento generado a partir de fuentes públicas: App Store, Google Play, constructionclock.com y reseñas de usuarios (agosto 2026). No incluye información propietaria ni código de la aplicación original.*
