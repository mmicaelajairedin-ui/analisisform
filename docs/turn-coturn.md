# TURN propio con coturn (~€5/mes) — guía paso a paso

El TURN es el "puente" para el ~15% de llamadas que no conectan directo (P2P).
Montarlo vos misma en un VPS barato es lo que baja el costo de verdad (vs los
$99/mes de Metered o JaaS). Es una configuración de UNA vez.

> No hace falta ser técnica: es crear un servidor y pegar unos comandos. Cualquier
> paso, preguntámelo.

## Paso 1 — Crear el servidor (VPS)
- Recomendado: **Hetzner Cloud** (https://www.hetzner.com/cloud) — el más barato/bueno (~€4/mes). Alternativas: DigitalOcean, Contabo.
- Cuenta → **New Project** → **Add Server**:
  - Imagen: **Ubuntu 24.04**
  - Tipo: el **más chico** (CX22 / CPX11 alcanza y sobra)
  - Ubicación: la más cercana a tus clientes
- Cuando esté, anotá la **IP pública** del servidor (la vas a necesitar).

## Paso 2 — Entrar al servidor
- Desde el panel de Hetzner: botón **">_ Console"** (consola web, la forma más fácil).
- O por SSH si sabés: `ssh root@LA_IP`.

## Paso 3 — Instalar coturn
Pegá esto y Enter:
```
sudo apt update && sudo apt install -y coturn
```

## Paso 4 — Configurar coturn
Abrí el archivo de config:
```
sudo nano /etc/turnserver.conf
```
Borrá todo y pegá esto (cambiá `IP_DEL_SERVIDOR` por tu IP real y `UNA_CLAVE_LARGA`
por una clave inventada larga, sin espacios):
```
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=pathway:UNA_CLAVE_LARGA
realm=pathwaycareercoach.com
external-ip=IP_DEL_SERVIDOR
min-port=49152
max-port=65535
no-cli
```
Guardá con **Ctrl+O**, Enter, y salí con **Ctrl+X**.

Habilitá el servicio:
```
echo 'TURNSERVER_ENABLED=1' | sudo tee /etc/default/coturn
```

## Paso 5 — Abrir los puertos (firewall de Hetzner)
En el panel de Hetzner → tu servidor → **Firewalls** (o Cloud Firewalls), permití
ENTRADA en:
- **3478** TCP y UDP
- **5349** TCP y UDP
- **49152–65535** UDP (el rango de relay)

(Si no configuraste firewall en Hetzner, por defecto está abierto — igual conviene.)

## Paso 6 — Arrancar
```
sudo systemctl enable coturn && sudo systemctl restart coturn
```
Comprobar que quedó andando:
```
sudo systemctl status coturn
```
Tiene que decir **active (running)** en verde.

## Paso 7 — Pasarme los datos
Mandame:
- La **IP** del servidor
- El **user:clave** que pusiste (ej. `pathway:UNA_CLAVE_LARGA`)

Y yo lo pongo en `pw-turn.js` así:
```js
window.PW_TURN = [
  { urls: "stun:IP:3478" },
  { urls: "turn:IP:3478",  username: "pathway", credential: "UNA_CLAVE_LARGA" },
  { urls: "turn:IP:3478?transport=tcp", username: "pathway", credential: "UNA_CLAVE_LARGA" }
];
```

## (Opcional, más adelante) — TURN sobre TLS (443)
Algunas redes MUY estrictas (oficinas) solo dejan salir por el puerto 443. Para
cubrir el 100%, se agrega `turns:` sobre TLS en el 443 — necesita un dominio y un
certificado (Let's Encrypt). Es un paso extra que hacemos si aparece esa necesidad;
para la mayoría, lo de arriba alcanza.

## Costo
- VPS Hetzner: **~€4/mes** (fijo, cubre TODA la plataforma).
- Ancho de banda: incluido (Hetzner da 20 TB/mes) → en la práctica, **gratis** para
  el uso de TURN (que además es solo el ~15% de las llamadas).
- **Total: ~€4-5/mes** sin importar cuántos coaches/clientes tengas. Chau €90 de JaaS.
