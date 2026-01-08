const Command = require("../../structures/Command");
const Discord = require("discord.js");
const math = require("mathjs");

module.exports = class Calculate extends Command {
  constructor(client) {
    const cmdConfig = client.cmdConfig.calculate;
    
    super(client, {
      name: "calculate",
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
    let config = this.client.config;
    let expression = args.join(" ");
    
    if(!args[0]) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.calculate.usage)] });

    try {
      let result = math.evaluate(expression);
      
      let embed = new Discord.EmbedBuilder()
        .setColor(this.client.embeds.calculate.color);
        
      if(this.client.embeds.calculate.title) embed.setTitle(this.client.embeds.calculate.title);
        
      if(this.client.embeds.calculate.description) embed.setDescription(this.client.embeds.calculate.description.replace("<expression>", `${expression}`)
       .replace("<result>", `${result}`));
        
      let field = this.client.embeds.calculate.fields;
      for(let i = 0; i < this.client.embeds.calculate.fields.length; i++) {
        embed.addFields([{ name: field[i].title, value: field[i].description.replace("<expression>", `${expression}`)
          .replace("<result>", `${result}`), inline: this.client.embeds.calculate.inline }])
        }

      if(this.client.embeds.calculate.footer == true) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
      if(this.client.embeds.calculate.thumbnail == true) embed.setThumbnail(user.displayAvatarURL());
      
      message.channel.send({ embeds: [embed] });
    } catch(err) {
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.utility.math_error, this.client.embeds.error_color)] });
    }
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let expression = interaction.options.getString("expression");

    try {
      let result = math.evaluate(expression);

      let embed = new Discord.EmbedBuilder()
        .setColor(this.client.embeds.calculate.color);

      if (this.client.embeds.calculate.title) embed.setTitle(this.client.embeds.calculate.title);

      if (this.client.embeds.calculate.description) embed.setDescription(this.client.embeds.calculate.description.replace("<expression>", `${expression}`)
        .replace("<result>", `${result}`));

      let field = this.client.embeds.calculate.fields;
      for (let i = 0; i < this.client.embeds.calculate.fields.length; i++) {
        embed.addFields([{ name: field[i].title, value: field[i].description.replace("<expression>", `${expression}`)
          .replace("<result>", `${result}`), inline: this.client.embeds.calculate.inline }])
      }

      if (this.client.embeds.calculate.footer == true) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
      if (this.client.embeds.calculate.thumbnail == true) embed.setThumbnail(interaction.user.displayAvatarURL());

      interaction.reply({ embeds: [embed], flags: this.client.cmdConfig.calculate.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    } catch(err) {
      interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.utility.math_error, this.client.embeds.error_color)],  flags: this.client.cmdConfig.calculate.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    }
  }
};