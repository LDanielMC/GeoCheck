// Spike de geofencing — registra en el alcance global las tareas en segundo plano. App.tsx lo importa SIEMPRE:
// cuando el sistema despierta la app cerrada (evento de geocerca o botón de la notificación) solo se carga el
// bundle de JS, sin montar la UI, y las tareas tienen que estar ya definidas.
import "./geofenceTask"; // define la tarea de geocerca; importa labNotifications, que define la de los marcadores
