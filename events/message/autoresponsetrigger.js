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
  }

  async run(message) {
    if (message.author.bot) return;
    if (message.channel.type === 1) return; // Ignore DMs
    
    // Cargar configuración de autoresponse desde archivo separado
    const config = this.client.autoResponseConfig;
    if (!config || !config.enabled) return;

    const content = message.content.toLowerCase().trim();
    
    // Sistema de respuestas automáticas con cooldown
    if (!this.client.autoResponse) this.client.autoResponse = new Map();
    
    // Buscar respuesta en las réplicas configuradas
    let replyData = null;
    let matchedKey = null;

    // Buscar coincidencia exacta solamente
    if (config.trigger_words) {
      for (const key in this.getReplies()) {
        if (content === key.toLowerCase()) {
          replyData = this.getReplies()[key];
          matchedKey = key;
          break;
        }
      }
    }

    if (!replyData) return;

    // Verificar cooldown
    if (this.client.autoResponse.get(message.channel.id)) return;

    // Aplicar cooldown (5 segundos por defecto)
    this.client.autoResponse.set(message.channel.id, true);
    setTimeout(() => {
      this.client.autoResponse.delete(message.channel.id);
    }, 5000);

    // Crear y enviar embed usando color info global
    const defaultColor = this.client.embeds.info_color;
    const embed = this.createEmbed(replyData, defaultColor);
    if (embed) await message.channel.send({ embeds: [embed] });
  }

  getReplies() {
    // Prefer replies defined in `configs/embeds.yml` under `autoresponse`
    try {
      const cfg = this.client.embeds?.autoresponse;
      if(cfg && Object.keys(cfg).length > 0) return cfg;
    } catch (e) {}

    // Fallback hardcoded replies (preserve previous defaults)
    return {
      "ip": {
        title: "★ Información de Conexión ★",
        description: "Conéctate a nuestro servidor con estos datos:",
        color: "#00FF00",
        fields: [
          { name: "Versiones Java", value: "1.8 hasta la 1.21.10", inline: true },
          { name: "IP Java", value: "Quickland.net", inline: true },
          { name: "Modalidades", value: "Survival 1.12.2, FFa Clans, QuickPvp, Survival SMP, SkyBlock.", inline: false },
          { name: "Versiones Bedrock", value: "+1.21.90", inline: true },
          { name: "IP Bedrock", value: "Quickland.net", inline: true },
          { name: "Puerto Bedrock", value: "19132", inline: true }
        ],
        footer: "¡Esperamos verte en el servidor!"
      },
      "invitar": {
        title: "Invitación al servidor",
        description: "¡Estaremos agradecidos si compartes nuestra invitación!",
        color: "#5865F2",
        fields: [
          { name: "Enlace de invitación", value: "[Invitación (Click Aquí)](https://discord.quickland.net/)", inline: false }
        ],
        footer: "¡Te esperamos en nuestra comunidad!"
      },
      "tienda": {
        title: "★ Quickland Network ★",
        description: "Esta es nuestra tienda oficial donde podrás encontrar rangos y ventajas",
        color: "#FFD700",
        fields: [
          { name: "Enlace de la tienda", value: "[Tienda (Click Aquí)](https://tienda.quickland.net/)", inline: false }
        ],
        footer: "¡Gracias por tu apoyo!"
      },
      "reglas": {
        title: "Reglas del Servidor",
        description: "Por favor lee atentamente nuestras reglas antes de participar",
        color: "#FF0000",
        fields: [
          { name: "Canal de normas", value: "<#703852488477900840>", inline: false },
          { name: "Documento de reglas", value: "[Enlace (Click Aquí)](https://docs.google.com/document/d/1vA839HbBLUjTJafXd9sVLzEeQmiBhjbM-XnvQiw410Q)", inline: false }
        ],
        footer: "El incumplimiento de las reglas puede resultar en sanciones"
      },
      "media": {
        title: "Requisitos para Rango Media",
        description: "Información para creadores de contenido",
        color: "#9147FF",
        fields: [
          { name: "📜 Rango YouTube", value: "● Un video/directo en QuickLand\n● Tener mínimo 200 suscriptores\n● Mantener 100 visitas o 10 espectadores en promedio", inline: true },
          { name: "📜 Rango TikTok", value: "● Un video/directo en QuickLand\n● Tener mínimo 500 seguidores\n● Mantener 1000 visitas o 25 espectadores en promedio", inline: true },
          { name: "📜 Rango Kick", value: "● Un directo en QuickLand\n● Tener mínimo 200 seguidores\n● Mantener 20 espectadores en promedio", inline: true },
          { name: "📜 Rango Twitch", value: "● Un directo en QuickLand\n● Tener mínimo 100 seguidores\n● Mantener 10 espectadores promedio", inline: true },
          { name: " 📃 Procedimiento", value: "● Si cumples los requisitos, abre un ticket en <#721828292981817404> para aplicar", inline: false }
        ],
        footer: "¡Esperamos tu contenido!"
      }
    };
  }

  createEmbed(replyConfig, defaultColor) {
    try {
      const embed = new EmbedBuilder();
      
      if (replyConfig.title) embed.setTitle(replyConfig.title);
      if (replyConfig.description) embed.setDescription(replyConfig.description);
      embed.setColor(replyConfig.color || defaultColor || "#0099FF");
      if (replyConfig.thumbnail) embed.setThumbnail(replyConfig.thumbnail);
      if (replyConfig.fields) embed.addFields(replyConfig.fields);
      if (replyConfig.footer) embed.setFooter({ text: replyConfig.footer });
      
      return embed;
    } catch (error) {
      return null;
    }
  }
};
