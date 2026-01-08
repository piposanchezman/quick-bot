const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class StaffReply extends Command {
  constructor(client) {
    super(client, {
      name: "staffreply",
      description: client.cmdConfig.staffreply.description,
      usage: client.cmdConfig.staffreply.usage,
      permissions: client.cmdConfig.staffreply.permissions,
      aliases: client.cmdConfig.staffreply.aliases,
      category: "tickets",
      enabled: client.cmdConfig.staffreply.enabled,
      slash: true,
      options: []
    });
  }

  async run(message, args) {
    const key = args[0]?.toString()?.toLowerCase();
    if(!key) {
      const keys = Object.keys(this.client.embeds?.staff_replies || {});
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, `Claves disponibles: ${keys.join(', ') || 'Ninguna'}`, this.client.embeds.info_color)] });
    }

    // Permission check
    if(!message.member.permissions.has(Discord.PermissionFlagsBits.ManageMessages))
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.no_permission || "No tienes permiso.", this.client.embeds.error_color)] });

    // Optional channel param
    let target = message.channel;
    if(args[1]) {
      const ch = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]) || message.guild.channels.cache.find(c => c.name && c.name.includes(args[1]));
      if(ch) target = ch;
    }

    const template = this.client.embeds?.staff_replies?.[key];
    if(!template) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, `Plantilla \`${key}\` no encontrada.`, this.client.embeds.error_color)] });

    // Build an embed from the template (if present) or fall back to plain text
    const buildEmbedFromTemplate = (tpl) => {
      try {
        const e = new Discord.EmbedBuilder();
        if(tpl.title) e.setTitle(tpl.title);
        // prefer explicit description, otherwise fallback to template.text
        e.setDescription(tpl.description || tpl.text || "");
        if(tpl.color) e.setColor(tpl.color);
        if(tpl.thumbnail) e.setThumbnail(tpl.thumbnail);
        if(tpl.image) e.setImage(tpl.image);
        if(tpl.footer) e.setFooter({ text: tpl.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) });
        if(Array.isArray(tpl.fields)) {
          const fields = tpl.fields.map(f => ({ name: f.name || f.title || f.title, value: f.value || f.description || f.description || ' ', inline: !!f.inline }));
          if(fields.length > 0) e.addFields(fields);
        }
        return e.setTimestamp();
      } catch (err) {
        return null;
      }
    }

    const embedToSend = buildEmbedFromTemplate(template) || null;
    try {
      if(embedToSend) await target.send({ embeds: [embedToSend] });
      else await target.send({ content: template.text });
    } catch (e) {
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, `No se pudo enviar el mensaje al canal especificado.`, this.client.embeds.error_color)] });
    }

    // Prepend to ticket's listOfAnswers if target is a ticket channel
    try {
      if(await this.client.utils.isTicket(this.client, target)) {
        const listKey = `${target.id}.listOfAnswers`;
        let list = await this.client.database.ticketsData().get(listKey) || [];
        list.unshift({ questionName: `staff:${key}`, question: template.description || key, answer: template.text, answerEmbed: template });
        await this.client.database.ticketsData().set(listKey, list);
      }
    } catch (e) {
      // ignore DB errors
    }

    return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, `Plantilla \`${key}\` enviada en ${target.name || target.id}.`, this.client.embeds.success_color)] }).then(() => message.delete().catch(() => {}));
  }

  async slashRun(interaction, args) {
    const key = args[0]?.toString()?.toLowerCase();
    if(!key) {
      const keys = Object.keys(this.client.embeds?.staff_replies || {});
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, `Claves disponibles: ${keys.join(', ') || 'Ninguna'}`, this.client.embeds.info_color)], flags: 64 });
    }

    if(!interaction.member.permissions.has(Discord.PermissionFlagsBits.ManageMessages))
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.no_permission || "No tienes permiso.", this.client.embeds.error_color)], flags: 64 });

    let target = interaction.channel;
    if(args[1]) {
      const ch = interaction.options.getChannel('channel') || interaction.guild.channels.cache.get(args[1]);
      if(ch) target = ch;
    }

    const template = this.client.embeds?.staff_replies?.[key];
    if(!template) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, `Plantilla \`${key}\` no encontrada.`, this.client.embeds.error_color)], flags: 64 });

    const buildEmbedFromTemplate = (tpl) => {
      try {
        const e = new Discord.EmbedBuilder();
        if(tpl.title) e.setTitle(tpl.title);
        e.setDescription(tpl.description || tpl.text || "");
        if(tpl.color) e.setColor(tpl.color);
        if(tpl.thumbnail) e.setThumbnail(tpl.thumbnail);
        if(tpl.image) e.setImage(tpl.image);
        if(tpl.footer) e.setFooter({ text: tpl.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) });
        if(Array.isArray(tpl.fields)) {
          const fields = tpl.fields.map(f => ({ name: f.name || f.title || f.title, value: f.value || f.description || f.description || ' ', inline: !!f.inline }));
          if(fields.length > 0) e.addFields(fields);
        }
        return e.setTimestamp();
      } catch (err) {
        return null;
      }
    }

    const embedToSend2 = buildEmbedFromTemplate(template) || null;
    try {
      if(embedToSend2) await target.send({ embeds: [embedToSend2] });
      else await target.send({ content: template.text });
    } catch (e) {
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, `No se pudo enviar el mensaje al canal especificado.`, this.client.embeds.error_color)], flags: 64 });
    }

    try {
      if(await this.client.utils.isTicket(this.client, target)) {
        const listKey = `${target.id}.listOfAnswers`;
        let list = await this.client.database.ticketsData().get(listKey) || [];
        list.unshift({ questionName: `staff:${key}`, question: template.description || key, answer: template.text, answerEmbed: template });
        await this.client.database.ticketsData().set(listKey, list);
      }
    } catch (e) {}

    return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, `Plantilla \`${key}\` enviada en ${target.name || target.id}.`, this.client.embeds.success_color)], flags: 64 });
  }
};

