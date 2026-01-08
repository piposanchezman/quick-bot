const Discord = require('discord.js');

module.exports = class Command {
  constructor(client, options) {
    this.client = client;
    this.name = options.name;
    this.usage = options.usage || 'No Usage';
    this.description = options.description || 'N/A';
    this.aliases = options.aliases || 'N/A';
    this.enabled = options.enabled;
    this.permissions = options.permissions || [];
    this.category = options.category || "member";
    this.slash = options.slash || false;
    this.options = options.options || [];
  }

  /**
   * Build slash command options from config
   * @param {Object} cmdConfig - Command configuration from commands.yml
   * @returns {Array} Array of Discord.js ApplicationCommandOptions
   */
  static buildOptionsFromConfig(cmdConfig) {
    if (!cmdConfig.options || !Array.isArray(cmdConfig.options)) {
      return [];
    }

    return cmdConfig.options.map(opt => {
      const option = {
        name: opt.name,
        description: opt.description,
        type: Discord.ApplicationCommandOptionType[opt.type],
        required: opt.required !== undefined ? opt.required : false
      };

      // Add choices if present - name is both the display name and value
      if (opt.choices && Array.isArray(opt.choices)) {
        option.choices = opt.choices.map(choice => {
          // Handle both string and object format
          if (typeof choice === 'string') {
            return { name: choice, value: choice };
          }
          return {
            name: choice.name,
            value: choice.name
          };
        });
      }

      // Add min/max values if present (for Number/Integer types)
      if (opt.min_value !== undefined) option.min_value = opt.min_value;
      if (opt.max_value !== undefined) option.max_value = opt.max_value;

      // Add autocomplete if present
      if (opt.autocomplete !== undefined) option.autocomplete = opt.autocomplete;

      // Add channel types if present
      if (opt.channel_types && Array.isArray(opt.channel_types)) {
        option.channel_types = opt.channel_types.map(type => 
          Discord.ChannelType[type]
        );
      }

      return option;
    });
  }
};