const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");

module.exports = class TranscriptCode extends Command {
  constructor(client) {
    const cmdConfig = client.cmdConfig.gettranscript;
    
    super(client, {
      name: "gettranscript",
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
    let id = args[0];
    
    if(!transcript || isNaN(transcript)) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.gettranscript.usage)] });
    const transcriptData = await this.client.database.transcriptsData().get(`${id}`);
    if(!transcriptData) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.gettranscript.usage)] });

    const extension = this.client.ticketsConfig.settings.transcript_type == "HTML" ? "html" : "txt";
    
    let path = `./transcripts/ticket-${id}.${extension}`;
    await message.author.send({ files: [path] });
  }
  async slashRun(interaction, args) {
    await interaction.deferReply({ flags: this.client.cmdConfig.gettranscript.ephemeral ? MessageFlags.Ephemeral : 0 })
    let id = interaction.options.getNumber("id");
    
    const transcriptData = await this.client.database.transcriptsData().get(`${id}`);
    if(!transcriptData) return interaction.followUp({ embeds: [this.client.utils.usage(this.client, interaction, this.client.cmdConfig.gettranscript.usage)], flags: this.client.cmdConfig.gettranscript.ephemeral ? MessageFlags.Ephemeral : 0 });
    
    const extension = this.client.ticketsConfig.settings.transcript_type == "HTML" ? "html" : "txt";

    let path = `./transcripts/ticket-${id}.${extension}`;
    await interaction.followUp({ files: [path], flags: this.client.cmdConfig.gettranscript.ephemeral ? MessageFlags.Ephemeral : 0 });
  }
};
