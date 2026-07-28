# Plan — Migrar el video de JaaS → P2P sin romper las 4 Salas

## Por qué migrar
JaaS es gratis hasta **25 usuarios activos/mes**; al pasar salta a **~€90/mes fijo**
(plan Basic, 300 MAU). Con multicoach cruzás los 25 enseguida. **P2P (1:1)** baja
eso a **~€5/mes fijo, sin tope de usuarios**.

## El principio que hace la migración SEGURA
Las 4 Salas (demo_pathway / sesion / primera_llamada / personal) **comparten un
solo motor de video**. O sea, el video ya está aislado. Se cambia SOLO el
transporte; todo lo que conecta a las salas queda intacto.

### Lo que NO se toca (garantías)
- **Los links ya enviados** (invitaciones de calendario con `sala.html?room=Pathway-<coachId>-<ms>`):
  el formato del room NO cambia → los links viejos siguen funcionando.
- **Los 4 kind**, la lógica que decide el tipo, el gate por horario.
- **Feedback del cliente** (sala_feedback), **chat = registro**, **insights** (tarjeta
  "Llamadas de la Sala"), **CTA de conversión**, **autocompletado en Sesiones**.
- **PR #1085** (feedback + chat-registro + insights): es independiente del transporte →
  se mergea PRIMERO, sin conflicto con la migración.

## Cómo anda P2P sin montar un servidor grande
- **Signaling** (el "apretón de manos" entre los 2 navegadores para conectarse):
  **Supabase Realtime** (ya lo tenés) — canal = el `room` de la cita. Sin servidor nuevo.
- **Media** (el video/audio): va **directo entre los 2 navegadores**. Costo ~€0.
- **Fallback TURN** (~10-20% de casos con firewall/NAT que bloquean la conexión directa):
  un `coturn` en un VPS de **~€5/mes**. Uno solo para TODA la plataforma.

## La pieza técnica: un adaptador `PWVideo`
Se define UNA interfaz estable que `sala.html` llama, y detrás hay implementaciones
intercambiables:

```
PWVideo = {
  join(room, {name, moderator, video, audio}),
  leave(),
  toggleScreenShare(),
  toggleMute() / toggleCam(),
  onRemoteJoin(cb) / onRemoteLeave(cb),
  sendChat(txt) / onChat(cb),   // chat por data-channel o Supabase
}
```
- Hoy: `PWVideo.jaas` (envuelve el `JitsiMeetExternalAPI` actual, sin cambiar nada).
- Mañana: `PWVideo.p2p` (WebRTC + Supabase signaling + TURN).
- (Futuro grupales: `PWVideo.sfu` con LiveKit self-host — mismo adaptador.)

`sala.html` no sabe cuál usa: solo llama a `PWVideo`. Cambiar el motor = cambiar
una línea (o un feature flag).

## Fases (sin big-bang, con vuelta atrás)
1. **Adaptador sobre JaaS.** Envolver el JaaS actual detrás de `PWVideo` sin cambiar
   comportamiento. Deploy → verificar que las 4 Salas siguen IDÉNTICAS. (Riesgo casi cero.)
2. **Implementar `PWVideo.p2p`.** WebRTC 1:1 + signaling por Supabase Realtime + TURN.
   Paridad: pantalla compartida (`getDisplayMedia`), mute/cam, chat, gate.
3. **Feature flag** `video_engine = jaas | p2p`. Arrancar P2P en el kind de **menor
   riesgo**: `personal` (llamada rápida) y `demo_pathway` (solo vos/Gonzalo).
4. **Probar en serio:** 2 dispositivos, redes distintas, móvil, wifi de oficina.
   Medir % de conexión directa vs TURN.
5. **Flip progresivo:** `primera_llamada` → `sesion`. Durante la transición, si P2P
   falla, **cae a JaaS** automáticamente (doble red de seguridad).
6. **Apagar JaaS** cuando P2P esté sólido. Chau €90 de piso.

## Clases grupales (decisión aparte)
P2P **no escala** a 1 coach : muchos clientes. Si hacés clases grupales (gimnasios),
ese caso usa un **SFU** (LiveKit self-host, ~€20-40/mes fijo compartido). Se enchufa
al MISMO adaptador (`PWVideo.sfu`), sin tocar las otras 4 salas.

## Riesgos y cómo se cubren
| Riesgo | Cobertura |
|---|---|
| Calidad P2P en red mala | TURN de respaldo + botón "abrir directo" (ya existe) |
| Screen-share / chat no iguales | Se replican en P2P ANTES del flip; test de paridad |
| Links viejos de calendario | Mismo `room` id → cero ruptura |
| Algo falla en producción | Feature flag + fallback a JaaS → rollback instantáneo |

## Costo final
| Escenario | Costo |
|---|---|
| Hoy (JaaS) | €0 hasta 25 usuarios → **€90/mes** después |
| Post-migración (1:1 P2P) | **~€5/mes fijo**, sin tope de usuarios |
| + Clases grupales (opcional) | +€20-40/mes fijo, compartido entre todas las redes |

---

# Fase 2 — Multicoach WOW (después de la migración)
Ideas para que la red se sienta premium y se venda sola:
- **White-label total** (ya arrancado): la Sala con el color/logo de la red, no Pathway.
- **Dashboard de red "en vivo":** sesiones ocurriendo ahora, conversión por coach
  (de las 4 salas), valoración promedio del cliente.
- **Clases grupales** con la estética de la red (video + cupo + reto).
- **Ranking/insights por coach:** quién convierte más en primeras llamadas.
- **Onboarding WOW del dueño:** de cero a red armada en 3 pasos.

Se detalla cuando el transporte de video esté resuelto.
