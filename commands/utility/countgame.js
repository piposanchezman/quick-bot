const Command = require("../../structures/Command");
const Discord = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = class CountGame extends Command {
  constructor(client) {
    const cmdConfig = client.cmdConfig.countgame;
    
    super(client, {
      name: "countgame",
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
    const messages = this.client.embeds.countgame.messages;

    if (!action || !["stats", "reset", "help", "channels", "stop"].includes(action)) {
      return message.reply(messages.help_description);
    }

    if (action === "stats") {
      await this.showStats(message, args[1], messages);
    } else if (action === "reset") {
      await this.resetCount(message, messages);
    } else if (action === "help") {
      await this.showHelp(message, messages);
    } else if (action === "channels") {
      await this.showActiveChannels(message);
    } else if (action === "stop") {
      await this.stopCountGame(message, messages);
    }
  }

  async slashRun(interaction, args) {
    await interaction.deferReply({ flags: this.client.cmdConfig.countgame.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    
    const action = interaction.options.getString("action");
    const user = interaction.options.getUser("user");
    const messages = this.client.embeds.countgame.messages;

    if (action === "stats") {
      await this.showStatsSlash(interaction, user, messages);
    } else if (action === "reset") {
      await this.resetCountSlash(interaction, messages);
    } else if (action === "help") {
      await this.showHelpSlash(interaction, messages);
    } else if (action === "channels") {
      await this.showActiveChannelsSlash(interaction);
    } else if (action === "stop") {
      await this.stopCountGameSlash(interaction, messages);
    }
  }

  async showStats(message, userMention, messages) {
    const statePath = path.join(__dirname, '../../data/countGameState.json');
    const channelId = message.channel.id;
    
    if (!fs.existsSync(statePath)) {
      return message.reply(messages.no_data);
    }

    const allStates = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const state = allStates[channelId];
    
    if (!state) {
      return message.reply(messages.no_data);
    }
    
    if (userMention) {
      const userId = userMention.replace(/[<@!>]/g, '');
      const stats = state.userStats?.[userId];
      
      if (!stats) {
        return message.reply(messages.no_data);
      }

      const embed = new Discord.EmbedBuilder()
        .setTitle(messages.user_stats)
        .setDescription(`✅ Aciertos: ${stats.correct}\n❌ Errores: ${stats.wrong}`)
        .setColor(this.client.embeds.info_color);
      
      return message.reply({ embeds: [embed] });
    }

    // Mostrar top 10
    const userStats = Object.entries(state.userStats || {})
      .sort((a, b) => b[1].correct - a[1].correct)
      .slice(0, 10);

    if (userStats.length === 0) {
      return message.reply(messages.no_data);
    }

    let description = messages.current_count
      .replace('{current}', state.currentCount)
      .replace('{next}', state.currentCount + 1) + '\n\n';
    description += messages.total_participants.replace('{count}', Object.keys(state.userStats || {}).length) + '\n\n';
    description += messages.top_players
      .replace('{limit}', userStats.length)
      .replace('{type}', 'participantes') + '\n\n';
    
    userStats.forEach(([userId, stats], index) => {
      description += `${index + 1}. <@${userId}> - ${stats.correct} ✅ / ${stats.wrong} ❌\n`;
    });

    const embed = new Discord.EmbedBuilder()
      .setTitle(messages.stats_title)
      .setDescription(description)
      .setColor(this.client.embeds.info_color);

    message.reply({ embeds: [embed] });
  }

  async showStatsSlash(interaction, user, messages) {
    const statePath = path.join(__dirname, '../../data/countGameState.json');
    const channelId = interaction.channel.id;
    
    if (!fs.existsSync(statePath)) {
      return interaction.editReply({ content: messages.no_data });
    }

    const allStates = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const state = allStates[channelId];
    
    if (!state) {
      return interaction.editReply({ content: messages.no_data });
    }
    
    if (user) {
      const stats = state.userStats?.[user.id];
      
      if (!stats) {
        return interaction.editReply({ content: messages.no_data });
      }

      const embed = new Discord.EmbedBuilder()
        .setTitle(messages.user_stats)
        .setDescription(`✅ Aciertos: ${stats.correct}\n❌ Errores: ${stats.wrong}`)
        .setColor(this.client.embeds.info_color);
      
      return interaction.editReply({ embeds: [embed] });
    }

    // Mostrar top 10
    const userStats = Object.entries(state.userStats || {})
      .sort((a, b) => b[1].correct - a[1].correct)
      .slice(0, 10);

    if (userStats.length === 0) {
      return interaction.editReply({ content: messages.no_data });
    }

    let description = messages.current_count
      .replace('{current}', state.currentCount)
      .replace('{next}', state.currentCount + 1) + '\n\n';
    description += messages.total_participants.replace('{count}', Object.keys(state.userStats || {}).length) + '\n\n';
    description += messages.top_players
      .replace('{limit}', userStats.length)
      .replace('{type}', 'participantes') + '\n\n';
    
    userStats.forEach(([userId, stats], index) => {
      description += `${index + 1}. <@${userId}> - ${stats.correct} ✅ / ${stats.wrong} ❌\n`;
    });

    const embed = new Discord.EmbedBuilder()
      .setTitle(messages.stats_title)
      .setDescription(description)
      .setColor(this.client.embeds.info_color);

    interaction.editReply({ embeds: [embed] });
  }

  async resetCount(message, messages) {
    if (!message.member.permissions.has("ManageGuild")) {
      return message.reply(messages.no_permission);
    }

    const statePath = path.join(__dirname, '../../data/count_game_state.json');
    const channelId = message.channel.id;
    
    // Cargar estados existentes
    let allStates = {};
    if (fs.existsSync(statePath)) {
      allStates = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
    
    // Resetear solo el canal actual
    allStates[channelId] = {
      currentCount: 0,
      lastUserId: "",
      lastTimestamp: Date.now(),
      userStats: {},
      userConsecutives: {},
      userBlockedTimestamps: {}
    };
    
    fs.writeFileSync(statePath, JSON.stringify(allStates, null, 2));
    
    // Emit event to reload count game state
    this.client.emit('countGameReset');

    message.reply(messages.reset_success);
  }

  async resetCountSlash(interaction, messages) {
    if (!interaction.member.permissions.has("ManageGuild")) {
      return interaction.editReply({ content: messages.no_permission });
    }

    const statePath = path.join(__dirname, '../../data/count_game_state.json');
    const channelId = interaction.channel.id;
    
    // Cargar estados existentes
    let allStates = {};
    if (fs.existsSync(statePath)) {
      allStates = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
    
    // Resetear solo el canal actual
    allStates[channelId] = {
      currentCount: 0,
      lastUserId: "",
      lastTimestamp: Date.now(),
      userStats: {},
      userConsecutives: {},
      userBlockedTimestamps: {}
    };
    
    fs.writeFileSync(statePath, JSON.stringify(allStates, null, 2));
    
    // Emit event to reload countgame state
    this.client.emit('countgameReset');

    interaction.editReply({ content: messages.reset_success });
  }

  async showHelp(message, messages) {
    const embed = new Discord.EmbedBuilder()
      .setTitle(messages.help_title)
      .setDescription(messages.help_description)
      .addFields([
        { name: messages.help_stats, value: `\`${this.client.config.general.prefix}countgame stats [usuario]\``, inline: false },
        { name: messages.help_reset, value: `\`${this.client.config.general.prefix}countgame reset\``, inline: false }
      ])
      .setColor(this.client.embeds.info_color);

    message.reply({ embeds: [embed] });
  }

  async showHelpSlash(interaction, messages) {
    const embed = new Discord.EmbedBuilder()
      .setTitle(messages.help_title)
      .setDescription(messages.help_description)
      .addFields([
        { name: messages.help_stats, value: "`/countgame stats [usuario]`", inline: false },
        { name: messages.help_reset, value: "`/countgame reset`", inline: false }
      ])
      .setColor(this.client.embeds.info_color);

    interaction.editReply({ embeds: [embed] });
  }

  async stopCountGame(message, messages) {
    if (!message.member.permissions.has("ManageGuild")) {
      return message.reply(messages.no_permission);
    }

    const statePath = path.join(__dirname, '../../data/countGameState.json');
    const channelId = message.channel.id;
    
    if (!fs.existsSync(statePath)) {
      return message.reply("⚠️ No hay ningún juego de conteo activo en este canal.");
    }

    const allStates = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    
    if (!allStates[channelId]) {
      return message.reply("⚠️ No hay ningún juego de conteo activo en este canal.");
    }

    // Eliminar el estado del canal
    delete allStates[channelId];
    fs.writeFileSync(statePath, JSON.stringify(allStates, null, 2));

    const embed = new Discord.EmbedBuilder()
      .setTitle("🛑 Juego de Conteo Detenido")
      .setDescription("El juego de conteo ha sido completamente detenido y eliminado de este canal.")
      .setColor(this.client.embeds.error_color);

    message.reply({ embeds: [embed] });
  }

  async stopCountGameSlash(interaction, messages) {
    if (!interaction.member.permissions.has("ManageGuild")) {
      return interaction.editReply({ content: messages.no_permission });
    }

    const statePath = path.join(__dirname, '../../data/countGameState.json');
    const channelId = interaction.channel.id;
    
    if (!fs.existsSync(statePath)) {
      return interaction.editReply({ content: "⚠️ No hay ningún juego de conteo activo en este canal." });
    }

    const allStates = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    
    if (!allStates[channelId]) {
      return interaction.editReply({ content: "⚠️ No hay ningún juego de conteo activo en este canal." });
    }

    // Eliminar el estado del canal
    delete allStates[channelId];
    fs.writeFileSync(statePath, JSON.stringify(allStates, null, 2));

    const embed = new Discord.EmbedBuilder()
      .setTitle("🛑 Juego de Conteo Detenido")
      .setDescription("El juego de conteo ha sido completamente detenido y eliminado de este canal.")
      .setColor(this.client.embeds.error_color);

    interaction.editReply({ embeds: [embed] });
  }

  async showActiveChannels(message) {
    const statePath = path.join(__dirname, '../../data/countGameState.json');
    
    if (!fs.existsSync(statePath)) {
      return message.reply("⚠️ No hay canales de conteo registrados.");
    }

    const allStates = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const channelIds = Object.keys(allStates);
    
    if (channelIds.length === 0) {
      return message.reply("⚠️ No hay canales de conteo registrados.");
    }

    const activeChannels = [];
    const deletedChannels = [];

    for (const channelId of channelIds) {
      try {
        const state = allStates[channelId];
        
        // Verificar si el canal existe
        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) {
          deletedChannels.push(channelId);
          continue;
        }

        activeChannels.push({
          channel: `<#${channelId}>`,
          currentCount: state.currentCount || 0,
          participants: Object.keys(state.userStats || {}).length,
          totalCounts: Object.values(state.userStats || {}).reduce((sum, s) => sum + s.correct, 0)
        });
      } catch (error) {
        // Ignorar errores
      }
    }

    // Limpiar canales eliminados
    if (deletedChannels.length > 0) {
      for (const channelId of deletedChannels) {
        delete allStates[channelId];
      }
      fs.writeFileSync(statePath, JSON.stringify(allStates, null, 2));
    }

    const embed = new Discord.EmbedBuilder()
      .setTitle("🔢 Canales de Conteo")
      .setColor(this.client.embeds.info_color);

    if (activeChannels.length > 0) {
      const channelText = activeChannels.map(c => 
        `${c.channel} - Número actual: **${c.currentCount}**, ${c.participants} participantes, ${c.totalCounts} conteos totales`
      ).join('\n');
      embed.setDescription(channelText);
    } else {
      embed.setDescription('⚠️ No hay canales de conteo activos.');
    }

    if (deletedChannels.length > 0) {
      embed.setFooter({ text: `🗑️ ${deletedChannels.length} canales eliminados fueron limpiados.` });
    }

    message.reply({ embeds: [embed] });
  }

  async showActiveChannelsSlash(interaction) {
    const statePath = path.join(__dirname, '../../data/countGameState.json');
    
    if (!fs.existsSync(statePath)) {
      return interaction.editReply({ content: "⚠️ No hay canales de conteo registrados." });
    }

    const allStates = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const channelIds = Object.keys(allStates);
    
    if (channelIds.length === 0) {
      return interaction.editReply({ content: "⚠️ No hay canales de conteo registrados." });
    }

    const activeChannels = [];
    const deletedChannels = [];

    for (const channelId of channelIds) {
      try {
        const state = allStates[channelId];
        
        // Verificar si el canal existe
        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) {
          deletedChannels.push(channelId);
          continue;
        }

        activeChannels.push({
          channel: `<#${channelId}>`,
          currentCount: state.currentCount || 0,
          participants: Object.keys(state.userStats || {}).length,
          totalCounts: Object.values(state.userStats || {}).reduce((sum, s) => sum + s.correct, 0)
        });
      } catch (error) {
        // Ignorar errores
      }
    }

    // Limpiar canales eliminados
    if (deletedChannels.length > 0) {
      for (const channelId of deletedChannels) {
        delete allStates[channelId];
      }
      fs.writeFileSync(statePath, JSON.stringify(allStates, null, 2));
    }

    const embed = new Discord.EmbedBuilder()
      .setTitle("🔢 Canales de Conteo")
      .setColor(this.client.embeds.info_color);

    if (activeChannels.length > 0) {
      const channelText = activeChannels.map(c => 
        `${c.channel} - Número actual: **${c.currentCount}**, ${c.participants} participantes, ${c.totalCounts} conteos totales`
      ).join('\n');
      embed.setDescription(channelText);
    } else {
      embed.setDescription('⚠️ No hay canales de conteo activos.');
    }

    if (deletedChannels.length > 0) {
      embed.setFooter({ text: `🗑️ ${deletedChannels.length} canales eliminados fueron limpiados.` });
    }

    interaction.editReply({ embeds: [embed] });
  }
};
