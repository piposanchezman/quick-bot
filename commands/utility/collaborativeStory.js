const Command = require("../../structures/Command");
const Discord = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = class CollaborativeStory extends Command {
  constructor(client) {
    const cmdConfig = client.cmdConfig.collaborativestory;
    
    super(client, {
      name: "collaborativestory",
      description: cmdConfig.description,
      usage: cmdConfig.usage,
      permissions: cmdConfig.permissions,
      aliases: cmdConfig.aliases,
      category: "utility",
      enabled: cmdConfig.enabled,
      slash: true,
      options: Command.buildOptionsFromConfig(cmdConfig)
    });
  }

  async run(message, args) {
    const action = args[0]?.toLowerCase();
    const messages = this.client.embeds.collaborativestory.messages;
    const config = this.client.collaborativeStoryConfig;

    // Permitir 'channels' y 'stop' sin restricción de canal
    if (action === "channels") {
      return await this.showActiveChannels(message);
    }

    if (action === "stop") {
      return await this.stopStory(message, messages);
    }

    if (!config || !config.story_channels.includes(message.channel.id)) {
      return message.reply("❌ Este comando solo funciona en canales de historias.");
    }

    if (!action || !["start", "pause", "resume", "status", "export", "channels", "stop"].includes(action)) {
      return message.reply("Usa: `story <start|pause|resume|status|export|channels|stop>`");
    }

    if (action === "start") {
      await this.startStory(message, messages);
    } else if (action === "pause") {
      await this.pauseStory(message, messages);
    } else if (action === "resume") {
      await this.resumeStory(message, messages);
    } else if (action === "status") {
      await this.showStatus(message, messages);
    } else if (action === "export") {
      await this.exportStory(message, messages);
    }
  }

  async slashRun(interaction, args) {
    await interaction.deferReply({ flags: this.client.cmdConfig.collaborativestory.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    
    const action = interaction.options.getString("action");
    const messages = this.client.embeds.collaborativestory.messages;
    const config = this.client.collaborativeStoryConfig;

    // Permitir 'channels' y 'stop' sin restricción de canal
    if (action === "channels") {
      return await this.showActiveChannelsSlash(interaction);
    }

    if (action === "stop") {
      return await this.stopStorySlash(interaction, messages);
    }

    if (!config || !config.story_channels.includes(interaction.channel.id)) {
      return interaction.editReply({ content: "❌ Este comando solo funciona en canales de historias." });
    }

    if (action === "start") {
      await this.startStorySlash(interaction, messages);
    } else if (action === "pause") {
      await this.pauseStorySlash(interaction, messages);
    } else if (action === "resume") {
      await this.resumeStorySlash(interaction, messages);
    } else if (action === "status") {
      await this.showStatusSlash(interaction, messages);
    } else if (action === "export") {
      await this.exportStorySlash(interaction, messages);
    }
  }

  getStoryState(channelId) {
    const storiesDir = path.join(__dirname, '../../data/stories_data');
    const filePath = path.join(storiesDir, `story_${channelId}.json`);
    
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // Asegurar que los contadores de participantes sean números
      if (data.participants && typeof data.participants === 'object' && !Array.isArray(data.participants)) {
        data.participants = Object.fromEntries(Object.entries(data.participants).map(([k, v]) => [k, Number(v)]));
      }
      return data;
    }
    
    return null;
  }

  saveStoryState(channelId, state) {
    const storiesDir = path.join(__dirname, '../../data/stories_data');
    if (!fs.existsSync(storiesDir)) {
      fs.mkdirSync(storiesDir, { recursive: true });
    }

    const filePath = path.join(storiesDir, `story_${channelId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  async startStory(message, messages) {
    if (!message.member.permissions.has("ManageMessages")) {
      return message.reply(messages.no_permission || "❌ No tienes permiso para iniciar historias.");
    }

    const state = this.getStoryState(message.channel.id);
    
    if (state && state.active) {
      return message.reply("⚠️ Ya hay una historia activa en este canal.");
    }

    const newState = {
      active: true,
      story: [],
      participants: {},
      lastContributor: null,
      waitingIA: false,
      startedAt: Date.now()
    };

    this.saveStoryState(message.channel.id, newState);

    const embed = new Discord.EmbedBuilder()
      .setTitle("📖 Historia Iniciada")
      .setDescription("¡Comienza la historia colaborativa!\n\n📜 **Normas:**\n• Escribe un mensaje para continuar la historia\n• Espera tu turno (la IA responderá cada 3 contribuciones)\n• Mantén el contenido apropiado\n\n⏳ *Generando inicio de la historia...*")
      .setColor(this.client.embeds.success_color);

    const initMsg = await message.reply({ embeds: [embed] });

    // Generar inicio de historia con IA
    await this.generateInitialStory(message.channel, newState, initMsg);
  }

  async startStorySlash(interaction, messages) {
    if (!interaction.member.permissions.has("ManageMessages")) {
      return interaction.editReply({ content: messages.no_permission || "❌ No tienes permiso para iniciar historias." });
    }

    const state = this.getStoryState(interaction.channel.id);
    
    if (state && state.active) {
      return interaction.editReply({ content: "⚠️ Ya hay una historia activa en este canal." });
    }

    const newState = {
      active: true,
      story: [],
      participants: {},
      lastContributor: null,
      waitingIA: false,
      startedAt: Date.now()
    };

    this.saveStoryState(interaction.channel.id, newState);

    const embed = new Discord.EmbedBuilder()
      .setTitle("📖 Historia Iniciada")
      .setDescription("¡Comienza la historia colaborativa!\n\n📜 **Normas:**\n• Escribe un mensaje para continuar la historia\n• Espera tu turno (la IA responderá cada 3 contribuciones)\n• Mantén el contenido apropiado\n\n⏳ *Generando inicio de la historia...*")
      .setColor(this.client.embeds.success_color);

    await interaction.editReply({ embeds: [embed] });

    // Generar inicio de historia con IA
    await this.generateInitialStory(interaction.channel, newState, null, interaction);
  }

  async pauseStory(message, messages) {
    if (!message.member.permissions.has("ManageMessages")) {
      return message.reply(messages.no_permission || "❌ No tienes permiso para pausar historias.");
    }

    const state = this.getStoryState(message.channel.id);
    
    if (!state || !state.active) {
      return message.reply("⚠️ No hay una historia activa en este canal.");
    }

    state.active = false;
    this.saveStoryState(message.channel.id, state);

    message.reply("⏸️ Historia pausada.");
  }

  async pauseStorySlash(interaction, messages) {
    if (!interaction.member.permissions.has("ManageMessages")) {
      return interaction.editReply({ content: messages.no_permission || "❌ No tienes permiso para pausar historias." });
    }

    const state = this.getStoryState(interaction.channel.id);
    
    if (!state || !state.active) {
      return interaction.editReply({ content: "⚠️ No hay una historia activa en este canal." });
    }

    state.active = false;
    this.saveStoryState(interaction.channel.id, state);

    interaction.editReply({ content: "⏸️ Historia pausada." });
  }

  async resumeStory(message, messages) {
    if (!message.member.permissions.has("ManageMessages")) {
      return message.reply(messages.no_permission || "❌ No tienes permiso para reanudar historias.");
    }

    const state = this.getStoryState(message.channel.id);
    
    if (!state) {
      return message.reply("⚠️ No hay ninguna historia en este canal. Usa `story start` para comenzar una.");
    }

    if (state.active) {
      return message.reply("⚠️ La historia ya está activa.");
    }

    state.active = true;
    this.saveStoryState(message.channel.id, state);

    const embed = new Discord.EmbedBuilder()
      .setTitle("▶️ Historia Reanudada")
      .setDescription(messages.story_resumed || "La historia ha sido reanudada. ¡Continúa contribuyendo!")
      .setColor(this.client.embeds.success_color);

    message.reply({ embeds: [embed] });
  }

  async resumeStorySlash(interaction, messages) {
    if (!interaction.member.permissions.has("ManageMessages")) {
      return interaction.editReply({ content: messages.no_permission || "❌ No tienes permiso para reanudar historias." });
    }

    const state = this.getStoryState(interaction.channel.id);
    
    if (!state) {
      return interaction.editReply({ content: "⚠️ No hay ninguna historia en este canal. Usa `/story start` para comenzar una." });
    }

    if (state.active) {
      return interaction.editReply({ content: "⚠️ La historia ya está activa." });
    }

    state.active = true;
    this.saveStoryState(interaction.channel.id, state);

    const embed = new Discord.EmbedBuilder()
      .setTitle("▶️ Historia Reanudada")
      .setDescription(messages.story_resumed || "La historia ha sido reanudada. ¡Continúa contribuyendo!")
      .setColor(this.client.embeds.success_color);

    interaction.editReply({ embeds: [embed] });
  }

  async showStatus(message, messages) {
    const state = this.getStoryState(message.channel.id);
    
    if (!state) {
      return message.reply("⚠️ No hay ninguna historia en este canal.");
    }

    const participants = Object.entries(state.participants).sort((a, b) => b[1] - a[1]);
    const topParticipants = participants.slice(0, 5)
      .map(([userId, count], index) => `${index + 1}. <@${userId}> - ${count} contribuciones`)
      .join('\n');

    const embed = new Discord.EmbedBuilder()
      .setTitle("📊 Estado de la Historia")
      .addFields([
        { name: "Estado", value: state.active ? "✅ Activa" : "⏸️ Pausada", inline: true },
        { name: "Contribuciones", value: state.story.length.toString(), inline: true },
        { name: "Participantes", value: Object.keys(state.participants).length.toString(), inline: true },
        { name: "Top Contribuidores", value: topParticipants || "Ninguno aún", inline: false }
      ])
      .setColor(this.client.embeds.info_color);

    message.reply({ embeds: [embed] });
  }

  async showStatusSlash(interaction, messages) {
    const state = this.getStoryState(interaction.channel.id);
    
    if (!state) {
      return interaction.editReply({ content: "⚠️ No hay ninguna historia en este canal." });
    }

    const participants = Object.entries(state.participants).sort((a, b) => b[1] - a[1]);
    const topParticipants = participants.slice(0, 5)
      .map(([userId, count], index) => `${index + 1}. <@${userId}> - ${count} contribuciones`)
      .join('\n');

    const embed = new Discord.EmbedBuilder()
      .setTitle("📊 Estado de la Historia")
      .addFields([
        { name: "Estado", value: state.active ? "✅ Activa" : "⏸️ Pausada", inline: true },
        { name: "Contribuciones", value: state.story.length.toString(), inline: true },
        { name: "Participantes", value: Object.keys(state.participants).length.toString(), inline: true },
        { name: "Top Contribuidores", value: topParticipants || "Ninguno aún", inline: false }
      ])
      .setColor(this.client.embeds.info_color);

    interaction.editReply({ embeds: [embed] });
  }

  async exportStory(message, messages) {
    const state = this.getStoryState(message.channel.id);
    
    if (!state || state.story.length === 0) {
      return message.reply("⚠️ No hay ninguna historia para exportar.");
    }

    const storyText = state.story.map((entry, index) => {
      return `${index + 1}. ${entry.authorName}: ${entry.content}`;
    }).join('\n\n');

    const buffer = Buffer.from(storyText, 'utf-8');
    const attachment = new Discord.AttachmentBuilder(buffer, { name: `story_${message.channel.id}_${Date.now()}.txt` });

    const participantCount = state.participants && typeof state.participants === 'object' ? Object.keys(state.participants).length : 0;
    const embed = new Discord.EmbedBuilder()
      .setTitle("📄 Historia Exportada")
      .setDescription(`Historia con ${state.story.length} contribuciones de ${participantCount} participantes.`)
      .setColor(this.client.embeds.success_color);

    message.reply({ embeds: [embed], files: [attachment] });
  }

  async exportStorySlash(interaction, messages) {
    const state = this.getStoryState(interaction.channel.id);
    
    if (!state || state.story.length === 0) {
      return interaction.editReply({ content: "⚠️ No hay ninguna historia para exportar." });
    }

    const storyText = state.story.map((entry, index) => {
      return `${index + 1}. ${entry.authorName}: ${entry.content}`;
    }).join('\n\n');

    const buffer = Buffer.from(storyText, 'utf-8');
    const attachment = new Discord.AttachmentBuilder(buffer, { name: `story_${interaction.channel.id}_${Date.now()}.txt` });

    const participantCount = state.participants && typeof state.participants === 'object' ? Object.keys(state.participants).length : 0;
    const embed = new Discord.EmbedBuilder()
      .setTitle("📄 Historia Exportada")
      .setDescription(`Historia con ${state.story.length} contribuciones de ${participantCount} participantes.`)
      .setColor(this.client.embeds.success_color);

    interaction.editReply({ embeds: [embed], files: [attachment] });
  }

  async generateInitialStory(channel, state, initMsg, interaction) {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const config = this.client.collaborativeStoryConfig;
        
        if (attempt > 1) {
          // esperar 2 segundos entre reintentos
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!config.api_key || !config.model) {
          // Si no hay IA configurada, solo actualizar el mensaje
          const embed = new Discord.EmbedBuilder()
            .setTitle("📖 Historia Iniciada")
            .setDescription("¡Comienza la historia colaborativa!\n\n📜 **Normas:**\n\n• Escribe un mensaje para continuar la historia\n\n• Espera tu turno (la IA responderá cada 3 contribuciones)\n\n• Mantén el contenido apropiado\n\n**La historia comienza ahora. ¡Escribe la primera línea!**")
            .setColor(this.client.embeds.success_color);
          
          if (initMsg) {
            await initMsg.edit({ embeds: [embed] });
          } else if (interaction) {
            await interaction.editReply({ embeds: [embed] });
          }
          return;
        }

        // Bloquear envío en el canal mientras la IA genera
        try { await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SEND_MESSAGES: false }); } catch (e) { }
        // Indicar que la IA está escribiendo
        await channel.sendTyping();
        const apiUrl = config.api_url || 'https://openrouter.ai/api/v1/chat/completions';
        const initialCfg = config.initial || {};
        const initialTone = initialCfg.tone || 'misterioso';
        const initialMaxChars = initialCfg.max_chars || 100;
        const initialMaxTokens = initialCfg.max_tokens || 150;
        const initialTemp = typeof initialCfg.temperature === 'number' ? initialCfg.temperature : 0.9;

        const systemPrompt = `Escribe UNA frase corta para iniciar una historia. Estilo: ${initialTone}. MÁXIMO ${initialMaxChars} caracteres. Debe ser concisa y directa. Ejemplos: "Hace mucho tiempo, en un reino olvidado...", "Una vez, bajo la luna llena...", "Cuenta la leyenda que...". SOLO escribe la frase, nada más.`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.api_key}`,
            'HTTP-Referer': 'https://github.com/quickbot',
            'X-Title': 'QuickBot Story'
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Escribe la primera frase (máximo 100 caracteres):' }
            ],
            // Usar configuración específica para inicio
            max_tokens: initialMaxTokens,
            temperature: initialTemp
          })
        });

        if (!response.ok) {
          // Si es rate limit y no es el último intento, reintentar
          if (response.status === 429 && attempt < maxRetries) {
            lastError = new Error('Rate limit');
            continue;
          }
          throw new Error('API error');
        }

        const data = await response.json();
        // Solo tomar content, no reasoning
        let aiMessage = data.choices?.[0]?.message?.content?.trim();

        if (!aiMessage) throw new Error('No AI response');

        // Limpiar comillas y espacios alrededor
        aiMessage = aiMessage.replace(/^['"\s]+|['"\s]+$/g, '').trim();
        // Asegurar que termine en un punto o signo final; si no, truncar hasta el último signo de puntuación terminal
        if (!/[.!?]$/.test(aiMessage)) {
          const lastDot = aiMessage.lastIndexOf('.');
          const lastEx = aiMessage.lastIndexOf('!');
          const lastQ = aiMessage.lastIndexOf('?');
          const lastPunc = Math.max(lastDot, lastEx, lastQ);
          if (lastPunc !== -1) aiMessage = aiMessage.slice(0, lastPunc + 1).trim();
        }

        // Enviar inicio de la historia
        const storyMsg = await channel.send(aiMessage);

        // Agregar al estado
        state.story.push({
          author: 'AI',
          authorName: 'Narrador IA',
          content: aiMessage,
          timestamp: Date.now()
        });
        // Guardar participante IA correctamente como número
        state.participants['AI'] = Number(state.participants['AI'] || 0) + 1;
        this.saveStoryState(channel.id, state);

        // Actualizar mensaje inicial
        const embed = new Discord.EmbedBuilder()
          .setTitle("📖 Historia Iniciada")
          .setDescription(`¡Comienza la historia colaborativa!\n\n📜 **Normas:**\n• Escribe un mensaje para continuar la historia\n• Espera tu turno (la IA responderá cada 3 contribuciones)\n• Mantén el contenido apropiado\n\n**La historia comienza así:**\n> ${aiMessage}`)
          .setColor(this.client.embeds.success_color);
        
        if (initMsg) {
          await initMsg.edit({ embeds: [embed] });
        } else if (interaction) {
          await interaction.editReply({ embeds: [embed] });
        }
        
        // Éxito, restaurar permisos y salir
        try { await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SEND_MESSAGES: true }); } catch (e) { }
        return;

      } catch (error) {
        lastError = error;
        // Si es el último intento, fallar
        if (attempt === maxRetries) break;
      }
    }

    // Restaurar permisos al fallar
    try { await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SEND_MESSAGES: true }); } catch (e) { }

    // Si llegamos aquí, fallaron todos los intentos
    const embed = new Discord.EmbedBuilder()
      .setTitle("📖 Historia Iniciada")
      .setDescription("¡Comienza la historia colaborativa!\n\n📜 **Normas:**\n• Escribe un mensaje para continuar la historia\n• Espera tu turno (la IA responderá cada 3 contribuciones)\n• Mantén el contenido apropiado\n\n⚠️ *La IA no está disponible temporalmente. ¡Escribe tú la primera línea!*")
      .setColor(this.client.embeds.warning_color || this.client.embeds.info_color);

    if (initMsg) {
      await initMsg.edit({ embeds: [embed] }).catch(() => {});
    } else if (interaction) {
      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }

    // Mensaje amigable en canal para que un usuario escriba la primera línea
    await channel.send('La IA no pudo generar la frase inicial. ¡Alguien más puede escribir la primera línea!').catch(() => {});
  }

  async stopStory(message, messages) {
    if (!message.member.permissions.has("ManageMessages")) {
      return message.reply(messages.no_permission || "❌ No tienes permiso para detener historias.");
    }

    const state = this.getStoryState(message.channel.id);
    
    if (!state) {
      return message.reply("⚠️ No hay ninguna historia en este canal.");
    }

    // Exportar historia antes de eliminarla
    if (state.story && state.story.length > 0) {
      const storyText = state.story.map((entry, index) => {
        return `${index + 1}. ${entry.authorName}: ${entry.content}`;
      }).join('\n\n');

      const buffer = Buffer.from(storyText, 'utf-8');
      const attachment = new Discord.AttachmentBuilder(buffer, { 
        name: `historia_${message.channel.name}_${Date.now()}.txt` 
      });

      const exportEmbed = new Discord.EmbedBuilder()
        .setTitle("📄 Historia Exportada y Finalizada")
        .setDescription(`Historia con ${state.story.length} contribuciones de ${Object.keys(state.participants || {}).length} participantes.\n\n✅ La historia ha sido detenida. Puedes iniciar una nueva con \`story start\`.`)
        .setColor(this.client.embeds.success_color);

      await message.reply({ embeds: [exportEmbed], files: [attachment] });
    } else {
      await message.reply("✅ Historia detenida (no había contribuciones para exportar).");
    }

    // Eliminar archivo de estado
    const storiesDir = path.join(__dirname, '../../data/stories_data');
    const filePath = path.join(storiesDir, `story_${message.channel.id}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async stopStorySlash(interaction, messages) {
    if (!interaction.member.permissions.has("ManageMessages")) {
      return interaction.editReply({ content: messages.no_permission || "❌ No tienes permiso para detener historias." });
    }

    const state = this.getStoryState(interaction.channel.id);
    
    if (!state) {
      return interaction.editReply({ content: "⚠️ No hay ninguna historia en este canal." });
    }

    // Exportar historia antes de eliminarla
    if (state.story && state.story.length > 0) {
      const storyText = state.story.map((entry, index) => {
        return `${index + 1}. ${entry.authorName}: ${entry.content}`;
      }).join('\n\n');

      const buffer = Buffer.from(storyText, 'utf-8');
      const attachment = new Discord.AttachmentBuilder(buffer, { 
        name: `historia_${interaction.channel.name}_${Date.now()}.txt` 
      });

      const exportEmbed = new Discord.EmbedBuilder()
        .setTitle("📄 Historia Exportada y Finalizada")
        .setDescription(`Historia con ${state.story.length} contribuciones de ${Object.keys(state.participants || {}).length} participantes.\n\n✅ La historia ha sido detenida. Puedes iniciar una nueva con \`/story start\`.`)
        .setColor(this.client.embeds.success_color);

      await interaction.editReply({ embeds: [exportEmbed], files: [attachment] });
    } else {
      await interaction.editReply({ content: "✅ Historia detenida (no había contribuciones para exportar)." });
    }

    // Eliminar archivo de estado
    const storiesDir = path.join(__dirname, '../../data/stories_data');
    const filePath = path.join(storiesDir, `story_${interaction.channel.id}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async showActiveChannels(message) {
    const storiesDir = path.join(__dirname, '../../data/stories_data');
    
    if (!fs.existsSync(storiesDir)) {
      return message.reply("⚠️ No hay historias registradas.");
    }

    const files = fs.readdirSync(storiesDir).filter(f => f.startsWith('story_') && f.endsWith('.json'));
    
    if (files.length === 0) {
      return message.reply("⚠️ No hay historias registradas.");
    }

    const activeStories = [];
    const inactiveStories = [];
    const deletedChannels = [];

    for (const file of files) {
      try {
        const filePath = path.join(storiesDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const channelId = file.replace('story_', '').replace('.json', '');
        
        // Verificar si el canal existe
        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) {
          deletedChannels.push({ channelId, file: filePath });
          continue;
        }

        const storyInfo = {
          channel: `<#${channelId}>`,
          status: data.active ? '✅ Activa' : '⏸️ Pausada',
          contributions: data.story?.length || 0,
          participants: Object.keys(data.participants || {}).length
        };

        if (data.active) {
          activeStories.push(storyInfo);
        } else {
          inactiveStories.push(storyInfo);
        }
      } catch (error) {
        // Ignorar errores de lectura
      }
    }

    // Limpiar canales eliminados
    if (deletedChannels.length > 0) {
      for (const { file } of deletedChannels) {
        fs.unlinkSync(file);
      }
    }

    const embed = new Discord.EmbedBuilder()
      .setTitle("📚 Canales de Historias")
      .setColor(this.client.embeds.info_color);

    if (activeStories.length > 0) {
      const activeText = activeStories.map(s => 
        `${s.channel} - ${s.contributions} contribuciones, ${s.participants} participantes`
      ).join('\n');
      embed.addFields({ name: '✅ Historias Activas', value: activeText });
    }

    if (inactiveStories.length > 0) {
      const inactiveText = inactiveStories.map(s => 
        `${s.channel} - ${s.contributions} contribuciones, ${s.participants} participantes`
      ).join('\n');
      embed.addFields({ name: '⏸️ Historias Pausadas', value: inactiveText });
    }

    if (activeStories.length === 0 && inactiveStories.length === 0) {
      embed.setDescription('⚠️ No hay historias activas o pausadas.');
    }

    if (deletedChannels.length > 0) {
      embed.setFooter({ text: `🗑️ ${deletedChannels.length} historias de canales eliminados fueron limpiadas.` });
    }

    message.reply({ embeds: [embed] });
  }

  async showActiveChannelsSlash(interaction) {
    const storiesDir = path.join(__dirname, '../../data/stories_data');
    
    if (!fs.existsSync(storiesDir)) {
      return interaction.editReply({ content: "⚠️ No hay historias registradas." });
    }

    const files = fs.readdirSync(storiesDir).filter(f => f.startsWith('story_') && f.endsWith('.json'));
    
    if (files.length === 0) {
      return interaction.editReply({ content: "⚠️ No hay historias registradas." });
    }

    const activeStories = [];
    const inactiveStories = [];
    const deletedChannels = [];

    for (const file of files) {
      try {
        const filePath = path.join(storiesDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const channelId = file.replace('story_', '').replace('.json', '');
        
        // Verificar si el canal existe
        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) {
          deletedChannels.push({ channelId, file: filePath });
          continue;
        }

        const storyInfo = {
          channel: `<#${channelId}>`,
          status: data.active ? '✅ Activa' : '⏸️ Pausada',
          contributions: data.story?.length || 0,
          participants: Object.keys(data.participants || {}).length
        };

        if (data.active) {
          activeStories.push(storyInfo);
        } else {
          inactiveStories.push(storyInfo);
        }
      } catch (error) {
        // Ignorar errores de lectura
      }
    }

    // Limpiar canales eliminados
    if (deletedChannels.length > 0) {
      for (const { file } of deletedChannels) {
        fs.unlinkSync(file);
      }
    }

    const embed = new Discord.EmbedBuilder()
      .setTitle("📚 Canales de Historias")
      .setColor(this.client.embeds.info_color);

    if (activeStories.length > 0) {
      const activeText = activeStories.map(s => 
        `${s.channel} - ${s.contributions} contribuciones, ${s.participants} participantes`
      ).join('\n');
      embed.addFields({ name: '✅ Historias Activas', value: activeText });
    }

    if (inactiveStories.length > 0) {
      const inactiveText = inactiveStories.map(s => 
        `${s.channel} - ${s.contributions} contribuciones, ${s.participants} participantes`
      ).join('\n');
      embed.addFields({ name: '⏸️ Historias Pausadas', value: inactiveText });
    }

    if (activeStories.length === 0 && inactiveStories.length === 0) {
      embed.setDescription('⚠️ No hay historias activas o pausadas.');
    }

    if (deletedChannels.length > 0) {
      embed.setFooter({ text: `🗑️ ${deletedChannels.length} historias de canales eliminados fueron limpiadas.` });
    }

    interaction.editReply({ embeds: [embed] });
  }
};
