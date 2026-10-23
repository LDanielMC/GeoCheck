# Criterios de revisión para Claude Code

## Alcance y proceso
1. No te salgas del plan de rebanadas (`docs/plan-de-rebanadas.md`). Si algo nuevo parece necesario, propónlo y espera aprobación.
2. Antes de un cambio grande, muestra alcance, criterios de aceptación y cambios al modelo de datos, y espera el visto bueno.
3. Haz commit al terminar cada paso o rebanada, con un mensaje que explique qué y por qué. No dejes trabajo grande sin commit antes de empezar otra cosa.
4. No subas secretos, `.env` ni las capturas de `docs/referencias/`. Revisa lo que vas a commitear.
5. Si cambias el plan, las historias o los requisitos, actualiza los documentos en el mismo paso.
6. El laboratorio del spike está congelado: no le agregues nada.

## Honestidad sobre lo verificado
7. Separa siempre lo verificado (pruebas, typecheck, bundle) de lo que **no** viste en el teléfono. No digas que algo funciona en el dispositivo si no se probó ahí.
8. Verifica precios, límites y APIs en la documentación oficial, no de memoria, y cita la fuente y la fecha.
9. No presentes como resultado un resumen que mezcla datos inválidos (por ejemplo, latencias medidas tocando el marcador después del evento o batería con cargas en medio). Si un número no sirve, dilo.
10. Si te equivocas (archivo sobrescrito, base equivocada), dilo y repáralo.

## Calidad técnica
11. No sobrescribas archivos ni pruebas existentes: léelos antes de escribir.
12. Cuidado con ediciones por script en Windows (CRLF, `$` en `replace`, heredocs): prefiere la herramienta de edición.
13. Las reglas importantes llevan pruebas, y verifica que esas pruebas fallen si se rompe la regla.
14. Las claves de API van en el servidor o en variables de EAS, restringidas al mínimo necesario. Nunca en el repositorio ni en la URL.
15. La identidad y la organización salen del token, nunca del body. Recursos de otra organización: 404.
16. Ningún fichaje se paga por defecto si es dudoso; todo ajuste queda auditado con motivo.

## Producto y diseño
17. Debe sentirse como Supercrew en estructura y experiencia, sin copiar su marca, colores, ilustraciones ni textos.
18. Nada de pantallas de prototipo: usa el sistema de diseño (`src/design`) y los textos de `src/texts/es.ts`. No escribas frases sueltas en las pantallas.
19. Respeta los roles: el empleado no edita horas ni ve funciones de administración; el contador solo lee; el administrador también ficha.
20. Piensa en trabajadores que casi no usan tecnología: la app trabaja sola, sin que tengan que hacer nada; textos cortos y claros; botones grandes; sesión que no caduca.
21. Asume que el empleado intentará inflar sus horas: no le des formas de declarar tiempo; el sistema marca y el dueño decide.
22. El dueño hace casi todo desde el teléfono: lo que necesita para pagar debe estar en el móvil.

## Comunicación con el usuario
23. Al terminar cada paso, di exactamente qué revisar en el teléfono y cómo (comandos de PowerShell completos, qué build instalar, qué terminales deben estar abiertas: Docker, backend con `npm run dev` y móvil con `npm run start:dev`).
24. Indica cuándo un cambio requiere un development build nuevo y agrupa en ese build todo lo pendiente.
25. Escribe en español sencillo, sin jerga innecesaria.
26. Cuando algo dependa del cliente, formula la pregunta concreta en vez de suponer la respuesta.