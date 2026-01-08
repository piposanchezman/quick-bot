const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");

module.exports = class SetPriority extends Command {
  constructor(client) {
    const cmdConfig = client.cmdConfig.setpriority;
    
    super(client, {
      name: "setpriority",
      description: cmdConfig.description,
      usage: cmdConfig.usage,
      permissions: cmdConfig.permissions,
      aliases: cmdConfig.aliases,
      category: "tickets",
      enabled: cmdConfig.enabled,
      slash: true,
      options: Command.buildOptionsFromConfig(cmdConfig)
    });
  }

  async run(message, args) {
    let config = this.client.config;
    let channel = message.mentions.channels.first() || this.client.channels.cache.get(args[0]);
    let priority = args[1];
    
    let priorityEmojis = config.emojis.priority;
    let priorityList = ["low", "normal", "high", "urgent"];
    
    if(!priority || !channel) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.setpriority.usage)] });
    if(!priorityList.some((x) => x == priority.toLowerCase())) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.priority.invalid, this.client.embeds.error_color)] });
    
    let ticketData = await this.client.database.ticketsData().get(`${channel.id}.ticketData`);
    let ticketOwner = this.client.users.cache.get(ticketData?.owner);
    
    let currentPriority = await this.client.database.ticketsData().get(`${channel.id}.priority`);
    
    if(priority == "normal") {
      if(currentPriority) {
        channel.setName(this.client.utils.ticketPlaceholders(config.channels.channel_name, ticketOwner, ticketData?.id)).catch((e) => this.client.utils.sendError("Bot doesn't have required permission to rename channel."));
        await this.client.database.ticketsData().delete(`${channel.id}.priority`);
      }
    } else {
      channel.setName(config.channels.priority_name.replace("<priority>", priorityEmojis[priority.toLowerCase()]).replace("<username>", ticketOwner?.username).replace("<ticket>", ticketData?.id)).catch((e) => this.client.utils.sendError("Bot doesn't have required permission to rename channel."));
      await this.client.database.ticketsData().set(`${channel.id}.priority`, priority);
    }

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.priority.changed.replace("<channel>", `${channel}`)
      .replace("<priority>", `${config.priority[priority.toLowerCase()]}`), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let channel = interaction.options.getChannel("channel");
    let priority = interaction.options.getString("priority");
    
    let priorityEmojis = config.emojis.priority;
    let priorityList = ["low", "normal", "high", "urgent"];
    
    if(!priorityList.some((x) => x == priority.toLowerCase())) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.priority.invalid, this.client.embeds.error_color)], flags: this.client.cmdConfig.setpriority.ephemeral ? MessageFlags.Ephemeral : 0 });
    
    let ticketData = await this.client.database.ticketsData().get(`${channel.id}.ticketData`);
    let ticketOwner = this.client.users.cache.get(ticketData?.owner);
    
    let currentPriority = await this.client.database.ticketsData().get(`${channel.id}.priority`);
    
    if(priority == "normal") {
      if(currentPriority) {
        channel.setName(this.client.utils.ticketPlaceholders(config.channels.channel_name, ticketOwner, ticketData?.id)).catch((e) => this.client.utils.sendError("Bot doesn't have required permission to rename channel."));
        await this.client.database.ticketsData().delete(`${channel.id}.priority`);
      }
    } else {
      channel.setName(config.channels.priority_name.replace("<priority>", priorityEmojis[priority.toLowerCase()]).replace("<username>", ticketOwner?.username).replace("<ticket>", ticketData?.id)).catch((e) => this.client.utils.sendError("Bot doesn't have required permission to rename channel."));
      await this.client.database.ticketsData().set(`${channel.id}.priority`, priority);
    }

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.priority.changed.replace("<channel>", `${channel}`)
      .replace("<priority>", `${config.priority[priority.toLowerCase()]}`), this.client.embeds.success_color)], flags: this.client.cmdConfig.setpriority.ephemeral ? MessageFlags.Ephemeral : 0 });
  }
};
