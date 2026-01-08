const Event = require("../../structures/Events.js");
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const yaml = require("yaml");
const path = require("path");

module.exports = class extends Event {
  constructor(client, file) {
    super(client, file, {
      name: "messageCreate"
    });
    
    // Estados por canal (Map con channelId como clave)
    this.channelStates = new Map();
    
    // Cargar estado guardado
    this.loadState();
    
    // Listen for reset events
    client.on('countgameReset', () => {
      this.loadState();
    });
  }

  async run(message) {
    if (message.author.bot) return;
    
    // Cargar configuración
    const config = this.loadCountGameConfig();
    if (!config || !config.enabled) return;
    if (!config.countGameChannels || !Array.isArray(config.countGameChannels)) return;
    
    // Verificar si es un canal de conteo
    if (!config.countGameChannels.includes(message.channel.id)) return;

    // Procesar el mensaje
    await this.processCountingMessage(message, config);
  }

  async processCountingMessage(message, config) {
    const channelId = message.channel.id;
    
    // Obtener o crear estado del canal
    let state = this.channelStates.get(channelId);
    if (!state) {
      state = {
        currentCount: 0,
        lastUserId: "",
        lastTimestamp: Date.now(),
        userStats: new Map(),
        userConsecutives: new Map(),
        userBlockedTimestamps: new Map()
      };
      this.channelStates.set(channelId, state);
    }
    
    const content = message.content.trim();
    const expectedNumber = state.currentCount + 1;
    const number = parseInt(content);
    
    // Obtener mensajes desde embeds.yml
    const messages = this.client.embeds.countgame.messages;
    
    // Verificar si ha pasado 1 hora desde la última participación
    const oneHourInMs = 60 * 60 * 1000;
    const timeSinceLastCount = Date.now() - state.lastTimestamp;
    
    if (timeSinceLastCount >= oneHourInMs) {
      // Resetear todos los consecutivos después de 1 hora de inactividad
      state.userConsecutives.clear();
      state.userBlockedTimestamps.clear();
    }

    // Verificar formato de número
    if (isNaN(number) || content !== number.toString()) {
      await this.handleInvalidMessage(message, config, expectedNumber, messages, state);
      return;
    }

    // Verificar número correcto PRIMERO
    if (number !== expectedNumber) {
      await this.handleWrongNumber(message, config, expectedNumber, messages, state);
      return;
    }

    // Verificar usuario consecutivo DESPUÉS de confirmar que el número es correcto
    if (message.author.id === state.lastUserId) {
      // Obtener límite de consecutivos basado en roles
      let maxConsecutive = config.default_max_consecutive || 3; // Default
      if (config.role_settings && config.role_settings.length > 0) {
        for (const roleSetting of config.role_settings) {
          // Soportar ambos formatos: ["role_id", max] o {role_id: "...", max_consecutive: X}
          let roleId, maxConsec;
          if (Array.isArray(roleSetting)) {
            roleId = roleSetting[0];
            maxConsec = roleSetting[1];
          } else {
            roleId = roleSetting.role_id;
            maxConsec = roleSetting.max_consecutive;
          }
          
          if (message.member.roles.cache.has(roleId)) {
            maxConsecutive = maxConsec;
            break;
          }
        }
      }
      
      // Contar cuántas participaciones consecutivas lleva
      const userConsecutiveCount = (state.userConsecutives.get(message.author.id) || 0);
      
      // Si es 0 (infinito), permitir siempre
      if (maxConsecutive === 0) {
        state.currentCount = number;
        state.lastUserId = message.author.id;
        state.lastTimestamp = Date.now();
        state.userConsecutives.set(message.author.id, userConsecutiveCount + 1);
        
        const stats = state.userStats.get(message.author.id) || { correct: 0, wrong: 0 };
        stats.correct++;
        state.userStats.set(message.author.id, stats);
        await message.react('✅').catch(() => {});
        this.saveState(channelId, state);
        return;
      }
      
      // Si aún no ha alcanzado el límite, permitir el conteo
      if (userConsecutiveCount < maxConsecutive) {
        state.currentCount = number;
        state.lastUserId = message.author.id;
        state.lastTimestamp = Date.now();
        state.userConsecutives.set(message.author.id, userConsecutiveCount + 1);
        
        const stats = state.userStats.get(message.author.id) || { correct: 0, wrong: 0 };
        stats.correct++;
        state.userStats.set(message.author.id, stats);
        this.saveState(channelId, state);
        return;
      }
      
      // Ya alcanzó el límite, eliminar y mostrar mensaje
      await message.delete().catch(() => {});
      
      // Guardar timestamp de bloqueo si no existe
      if (!state.userBlockedTimestamps.has(message.author.id)) {
        state.userBlockedTimestamps.set(message.author.id, Date.now());
        this.saveState(channelId, state);
      }
      
      // Calcular tiempo restante
      const blockedTime = state.userBlockedTimestamps.get(message.author.id);
      const timeElapsed = Date.now() - blockedTime;
      const timeRemaining = oneHourInMs - timeElapsed;
      
      // Convertir a minutos y segundos
      const minutesRemaining = Math.floor(timeRemaining / 60000);
      const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
      
      const msg = messages.consecutive_limit
        .replace('{user}', message.author.toString())
        .replace('{max}', maxConsecutive.toString())
        .replace('{time}', `${minutesRemaining}m ${secondsRemaining}s`);
      await message.channel.send(msg).then(m => setTimeout(() => m.delete().catch(() => {}), config.message_timeout));
      return;
    }

    // Número correcto de un usuario diferente
    state.currentCount = number;
    state.lastUserId = message.author.id;
    state.lastTimestamp = Date.now();
    
    // Resetear TODOS los consecutivos cuando cambia de usuario
    state.userConsecutives.clear();
    state.userBlockedTimestamps.clear();
    state.userConsecutives.set(message.author.id, 1);
    
    // Actualizar estadísticas
    const stats = state.userStats.get(message.author.id) || { correct: 0, wrong: 0 };
    stats.correct++;
    state.userStats.set(message.author.id, stats);
    
    // Guardar estado
    this.saveState(channelId, state);
  }

  async handleInvalidMessage(message, config, expectedNumber, messages, state) {
    await message.delete().catch(() => {});
    const msg = messages.invalid_message
      .replace('{user}', message.author.toString())
      .replace('{expected}', expectedNumber);
    await message.channel.send(msg).then(m => setTimeout(() => m.delete().catch(() => {}), config.message_timeout));
    
    this.updateWrongStats(message.author.id, state);
  }

  async handleWrongNumber(message, config, expectedNumber, messages, state) {
    await message.delete().catch(() => {});
    
    if (config.reset_on_break) {
      state.currentCount = 0;
      state.lastUserId = "";
      const msg = messages.chain_broken
        .replace('{user}', message.author.toString())
        .replace('{expected}', expectedNumber);
      await message.channel.send(msg).then(m => setTimeout(() => m.delete().catch(() => {}), config.message_timeout));
    } else {
      const msg = messages.wrong_number
        .replace('{user}', message.author.toString())
        .replace('{expected}', expectedNumber);
      await message.channel.send(msg).then(m => setTimeout(() => m.delete().catch(() => {}), config.message_timeout));
    }
    
    this.updateWrongStats(message.author.id, state);
    this.saveState(message.channel.id, state);
  }

  updateWrongStats(userId, state) {
    const stats = state.userStats.get(userId) || { correct: 0, wrong: 0 };
    stats.wrong++;
    state.userStats.set(userId, stats);
  }

  loadCountGameConfig() {
    try {
      const configPath = path.join(__dirname, '../../configs/countGame.yml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      return yaml.parse(fileContents);
    } catch (error) {
      return null;
    }
  }

  loadState() {
    try {
      const dir = path.join(__dirname, '../../data/countGame');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return;
      }

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const channelId = file.replace('.json', '');
          const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
          this.channelStates.set(channelId, {
            currentCount: data.currentCount || 0,
            lastUserId: data.lastUserId || "",
            lastTimestamp: data.lastTimestamp || Date.now(),
            userStats: new Map(Object.entries(data.userStats || {})),
            userConsecutives: new Map(Object.entries(data.userConsecutives || {})),
            userBlockedTimestamps: new Map(Object.entries(data.userBlockedTimestamps || {}))
          });
        } catch (e) { }
      }
    } catch (error) {
      // Silenciar errores de carga
    }
  }

  saveState(channelId, state) {
    try {
      const dir = path.join(__dirname, '../../data/countGame');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${channelId}.json`);
      const payload = {
        currentCount: state.currentCount,
        lastUserId: state.lastUserId,
        lastTimestamp: state.lastTimestamp,
        userStats: Object.fromEntries(state.userStats),
        userConsecutives: Object.fromEntries(state.userConsecutives),
        userBlockedTimestamps: Object.fromEntries(state.userBlockedTimestamps)
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    } catch (error) {
      // Silenciar errores de guardado
    }
  }
};
