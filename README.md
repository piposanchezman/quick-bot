# QuickBot Multipurpose

Bot multifuncional modular para Discord con sistema de tickets, autorrespuesta, conteo de mensajes, historias y más funcionalidades integradas de forma nativa.

## 📋 Características

### Funcionalidades Nativas

- **🎫 Sistema de Tickets**: Sistema completo de gestión de tickets de soporte
  - Creación y gestión de tickets
  - Transcripciones automáticas
  - Sistema de reclamación (claim)
  - Sistema de reviews
  - Panel de administración

- **🤖 Auto-Respuesta**: Respuestas automáticas a mensajes específicos
  - Configuración flexible de triggers
  - Respuestas personalizables
  - Sistema de palabras clave
  - Comandos de información
  - Sistema para staff con webhooks

- **🔢 Conteo**: Sistema de conteo de mensajes
  - Canal de conteo secuencial
  - Validación automática
  - Estadísticas de participación
  - Sistema anti-trampa
  - Comandos de estadísticas

- **📚 Historias**: Sistema de historias interactivas colaborativas
  - Creación de historias personalizadas
  - Sistema de turnos
  - Almacenamiento de progreso
  - Integración con IA (opcional)
  - Exportación de historias

### Comandos Organizados

#### General
- `help` - Muestra ayuda sobre los comandos
- `ping` - Verifica la latencia del bot
- `id` - Muestra IDs de usuarios/canales/roles
- `suggest` - Sistema de sugerencias

#### Tickets
- Comandos completos de gestión de tickets
- Sistema de categorías
- Transcripciones automáticas

#### Utility
- `calculate` - Calculadora integrada
- `counters` - Gestión de contadores
- `gettranscript` - Obtener transcripciones de tickets

#### Owner
- `eval` - Evaluar código JavaScript (solo propietarios)

## 🚀 Instalación

### Requisitos Previos

- Node.js v19.9.0 o superior
- Base de datos MySQL, MongoDB o SQLite
- Token de Discord Bot

### Pasos de Instalación

1. Clona el repositorio o descarga los archivos

2. Instala las dependencias:
```bash
npm install
```

3. Configura el bot editando `configs/config.yml`:
```yaml
general:
  name: "Tu Bot"
  token: "TU_TOKEN_AQUÍ"
  guild: "ID_DE_TU_SERVIDOR"
  database:
    type: "mysql" # o "sqlite" o "mongo"
    # Configura según tu tipo de base de datos
```

4. Inicia el bot:
```bash
npm start
```

## 📁 Estructura del Proyecto

```
📦 QuickBot Multipurpose
├── 📂 commands/              # Comandos del bot
│   ├── 📂 general/           # Comandos generales
│   ├── 📂 tickets/           # Comandos de tickets
│   ├── 📂 utility/           # Comandos de utilidad
│   └── 📂 owner/             # Comandos de propietario
├── 📂 configs/               # Archivos de configuración
│   ├── config.yml            # Configuración principal
│   ├── autoreply.yml         # Configuración de auto-respuestas ⭐
│   ├── counting.yml          # Configuración de conteo ⭐
│   ├── stories.yml           # Configuración de historias ⭐
│   ├── commands.yml          # Configuración de comandos
│   ├── language.yml          # Mensajes del bot
│   ├── embeds.yml            # Configuración de embeds
│   └── categories.yml        # Categorías de tickets
├── 📂 events/                # Manejadores de eventos
│   ├── 📂 client/            # Eventos del cliente
│   ├── 📂 guild/             # Eventos del servidor
│   ├── 📂 message/           # Eventos de mensajes
│   │   ├── autoreplytrigger.js  # Auto-respuesta nativa ⭐
│   │   ├── counting.js          # Sistema de conteo nativo ⭐
│   │   └── storycontribution.js # Sistema de historias nativo ⭐
│   └── 📂 custom/            # Eventos personalizados
├── 📂 handlers/              # Manejadores de sistema
│   ├── commands.js           # Cargador de comandos
│   └── events.js             # Cargador de eventos
├── 📂 structures/            # Estructuras base
│   ├── Client.js             # Cliente principal del bot
│   ├── Command.js            # Clase base de comandos
│   ├── Events.js             # Clase base de eventos
│   └── 📂 database/          # Sistema de base de datos
├── 📂 dashboard/             # Panel de control web
├── 📂 transcripts/           # Transcripciones de tickets
├── 📂 data/                  # Datos persistentes
│   ├── counting_state.json   # Estado del conteo ⭐
│   └── 📂 stories_data/      # Datos de historias ⭐
├── 📂 utils/                 # Utilidades y helpers
├── 📂 embeds/                # Constructores de embeds
├── index.js                  # Punto de entrada
└── package.json              # Dependencias del proyecto
```

## ⚙️ Configuración

### Funcionalidades Nativas

Las funcionalidades principales se activan/desactivan en `configs/config.yml`:

```yaml
# Auto-Reply System
autoreply:
  enabled: true  # Configuración detallada en configs/autoreply.yml

# Counting System
counting:
  enabled: true  # Configuración detallada en configs/counting.yml

# Stories System
stories:
  enabled: true  # Configuración detallada en configs/stories.yml
```

Cada funcionalidad tiene su propio archivo de configuración en `configs/`:
- `configs/autoreply.yml` - Respuestas automáticas, triggers, comandos
- `configs/counting.yml` - Canal de conteo, reglas, mensajes
- `configs/stories.yml` - Canales de historias, IA, límites

### Sistema de Tickets

Configuración específica de tickets en `config.yml`:

```yaml
tickets:
  enabled: true
  review:
    ask_review: true
    review_limit: 256
  buttons:
    close: true
    claim: true
```

### Base de Datos

Soporta tres tipos de bases de datos:

**MySQL:**
```yaml
database:
  type: "mysql"
  mysql:
    host: "localhost"
    port: 3306
    user: "usuario"
    password: "contraseña"
    database: "nombre_bd"
```

**MongoDB:**
```yaml
database:
  type: "mongo"
  mongo:
    uri: "mongodb://localhost:27017/database"
```

**SQLite:**
```yaml
database:
  type: "sqlite"
```

### Dashboard Web

El bot incluye un dashboard web opcional:

```yaml
server:
  enabled: true
  url: "http://localhost:3000"
  port: 3000
  dashboard:
    enabled: true
    client_id: "TU_CLIENT_ID"
    client_secret: "TU_CLIENT_SECRET"
```

## 🔧 Crear Nuevos Eventos

Para extender las funcionalidades del bot, crea eventos personalizados:

1. Crea un archivo en la carpeta apropiada dentro de `events/`
2. Usa la siguiente plantilla:

```javascript
const Event = require("../../structures/Events.js");

module.exports = class extends Event {
  constructor() {
    super("messageCreate"); // Nombre del evento
  }

  async run(client, message) {
    // Tu lógica aquí
    if (message.content === "!hola") {
      message.reply("¡Hola!");
    }
  }
};
```

### Eventos Nativos Integrados

El bot incluye eventos nativos para:
- **Auto-Respuesta** (`events/message/autoreplytrigger.js`)
- **Conteo** (`events/message/counting.js`)  
- **Historias** (`events/message/storycontribution.js`)

Estos se cargan automáticamente con el sistema de eventos.

## 📝 Crear Nuevos Comandos

Para crear un nuevo comando:

1. Crea un archivo en la carpeta apropiada dentro de `commands/`
2. Usa la siguiente plantilla:

```javascript
const Command = require("../../structures/Command.js");

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: "nombrecomando",
      description: "Descripción del comando",
      category: "general",
      cooldown: 3,
      slash: true,
      options: []
    });
  }

  async run(message, args) {
    // Lógica para comandos de texto
  }

  async slashRun(interaction, args) {
    // Lógica para slash commands
  }
};
```

## 🛠️ Tecnologías Utilizadas

- **Discord.js v14** - Librería principal de Discord
- **Express.js** - Servidor web y dashboard
- **EJS** - Motor de plantillas
- **Better-SQLite3** - Base de datos SQLite
- **MySQL2** - Conector MySQL
- **Mongoose** - ODM para MongoDB
- **YAML** - Archivos de configuración
- **Chalk** - Logs con colores
- **OpenAI** - Integración IA para historias (opcional)

## 🏗️ Arquitectura

El bot utiliza una arquitectura basada en eventos con componentes nativos:

- **Sistema de Eventos**: Carga automática de eventos desde `events/`
- **Sistema de Comandos**: Carga automática de comandos desde `commands/`
- **Funcionalidades Nativas**: Auto-respuesta, Conteo y Historias integradas
- **Configuración Modular**: Cada funcionalidad con su archivo de configuración
- **Base de Datos**: Soporte multi-motor (SQLite/MySQL/MongoDB)

## 📊 Comandos Disponibles

### Comandos Generales
- `/help` - Muestra la lista de comandos
- `/ping` - Muestra la latencia del bot
- `/id` - Obtiene IDs de Discord
- `/suggest` - Envía una sugerencia

### Comandos de Utilidad
- `/calculate` - Realiza cálculos matemáticos
- `/counters` - Gestiona contadores del servidor
- `/gettranscript` - Obtiene transcripciones de tickets

### Comandos de Tickets
(Múltiples comandos disponibles para gestión completa de tickets)

## 🔐 Seguridad

- No compartas tu archivo `config.yml` con tokens o contraseñas
- Usa variables de entorno para información sensible en producción
- El comando `eval` está restringido solo a propietarios configurados

## 📄 Licencia

Este proyecto es privado. Todos los derechos reservados.

## 🤝 Soporte

Para problemas o preguntas, contacta al equipo de desarrollo.

---

**Versión:** 2.0.0  
**Última actualización:** Enero 2026
