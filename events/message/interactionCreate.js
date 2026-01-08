const Discord = require("discord.js");
const Event = require("../../structures/Events");
const claimCommand = require("../../commands/tickets/claim");
const closeCommand = require("../../commands/tickets/close");
const prevQuestion = new Discord.Collection();

module.exports = class InteractionCreate extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(interaction) {
    const message = interaction.message;
    const user = interaction.user;
    const config = this.client.config;
    const language = this.client.language;

    let modalArr = [];
    let questModal;
    
    if(user.bot) return;
    if (interaction.type == Discord.InteractionType.ApplicationCommand) {
      const cmd = this.client.slashCommands.get(interaction.commandName);
      if (!cmd) return interaction.reply({ content: "> Error occured, please contact Bot Owner.", flags: Discord.MessageFlags.Ephemeral });

      interaction.member = interaction.guild.members.cache.get(interaction.user.id);
      
      if(!this.client.utils.hasPermissions(interaction, interaction.member, cmd.permissions) 
        && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)
        && !interaction.member.permissions.has("Administrator")) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });

      const args = [];
      for (let option of interaction.options.data) {
        if (option.type === Discord.ApplicationCommandOptionType.Subcommand) {
          if (option.name) args.push(option.name);
          option.options?.forEach((x) => {
            if (x.value) args.push(x.value);
          });
        } else if (option.value) args.push(option.value);
      }

      if(this.client.cmdConfig[cmd.name]) {
        let cmdConfig = this.client.cmdConfig[cmd.name];
        if(cmdConfig.enabled == false) {
          if(this.client.language.general.cmd_disabled != "") interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cmd_disabled, this.client.embeds.error_color)] });
          return;
        }
        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission) && !interaction.member.permissions.has("Administrator")) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x)).filter(r => r != undefined);
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles) && !interaction.member.permissions.has("Administrator")) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
        }
        let findCooldown = this.client.cmdCooldowns.find((c) => c.name == cmd.name && c.id == interaction.user.id);
        if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.cooldown, true) && !interaction.member.permissions.has("Administrator")) {
          if(findCooldown) {
            let time = this.client.utils.formatTime(findCooldown.expiring - Date.now());
            return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cooldown.replace("<cooldown>", time), this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
          } else if(!findCooldown && this.client.cmdConfig[cmd.name].cooldown > 0) {
            let cooldown = {
              id: interaction.user.id,
              name: cmd.name,
              expiring: Date.now() + (this.client.cmdConfig[cmd.name].cooldown * 1000),
            };
    
            this.client.cmdCooldowns.push(cooldown);
    
            setTimeout(() => {
              this.client.cmdCooldowns.splice(this.client.cmdCooldowns.indexOf(cooldown), 1);
            }, this.client.cmdConfig[cmd.name].cooldown * 1000);
          }
        }
      }

      cmd.slashRun(interaction, args);
    }
    if (interaction.isButton()) {
      if(interaction.customId.startsWith("createTicket")) {
        await interaction.deferUpdate();
        let blackListed = false;
        let member = interaction.guild.members.cache.get(user.id);
        for(let i = 0; i < config.roles.blacklist.length; i++) {
          if(member.roles.cache.has(config.roles.blacklist[i])) blackListed = true;
        }
        if(blackListed == true) 
          return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_role, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral })
        if(this.client.ticketsConfig?.users?.blacklist?.includes(user.id))
          return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_user, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral })
        const noCategory = new Discord.EmbedBuilder()
          .setTitle(this.client.embeds.title)
          .setDescription(this.client.language.ticket.no_category)
          .setFooter({ text: this.client.embeds.footer, iconURL: user.displayAvatarURL({ dynamic: true }) })
          .setTimestamp()
          .setColor(this.client.embeds.error_color);
  
        if(this.client.ticketsConfig.channels.tickets_category == "") 
          return interaction.followUp({ embeds: [noCategory], flags: Discord.MessageFlags.Ephemeral });

        const catId = interaction.customId.replace("createTicket_", "");

        let isSubCat = false;
        let findCategory = this.client.categories.find((c) => c.id.toLowerCase() == catId.toLowerCase());

        if(!findCategory) {
          findCategory = this.client.categories.map((c) => {
            const subSearch = c.subcategories?.find((sc) => sc.id.toLowerCase() == catId.toLowerCase());
            if(subSearch)
              return subSearch;
          }).filter(Boolean)?.[0];
          if(findCategory) isSubCat = true;
        }

        if(findCategory?.type == "SUBCATEGORY_PARENT") {
          const options = [];
          findCategory.subcategories.forEach(c => {
            options.push({
              label: c.name,
              value: c.id, 
              emoji: c.emoji || {},
              description: c.placeholder != "" ? c.placeholder : ""
            });
          });
          
          let sMenu = new Discord.StringSelectMenuBuilder()
            .setCustomId("instant_subCategory")
            .setPlaceholder(this.client.ticketsConfig.settings.select_placeholder)
            .addOptions(options);
    
          let row = new Discord.ActionRowBuilder()
            .addComponents(sMenu);

          const selSubcategory = new Discord.EmbedBuilder()
            .setTitle(this.client.embeds.title)
            .setColor(this.client.embeds.general_color)

          selSubcategory.setDescription(this.client.embeds.select_subcategory.description
            .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
          let field = this.client.embeds.select_subcategory.fields;
          for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
            selSubcategory.addFields([{ name: field[i].title, value: field[i].description
              .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
          }
          
          if(this.client.embeds.ticket.footer) selSubcategory.setFooter({ text: this.client.embeds.ticket.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
          if(this.client.embeds.ticket.image.enabled == true) selSubcategory.setImage(this.client.embeds.ticket.image.url);
          if(this.client.embeds.ticket.thumbnail.enabled == true) selSubcategory.setThumbnail(this.client.embeds.ticket.thumbnail.url);

          await interaction.followUp({ embeds: [selSubcategory], components: [row], flags: Discord.MessageFlags.Ephemeral, fetchReply: true })
          const filter = (i) => i.customId == "instant_subCategory" && i.user.id == interaction.user.id;
          const collector = await interaction.channel.createMessageComponentCollector({ filter, time: this.client.ticketsConfig.settings.no_select_delete * 1000, componentType: Discord.ComponentType.SelectMenu, max: 1, maxComponents: 1, maxUsers: 1 });

          collector.on("collect", async(i) => {
            collector.stop("collected");
            await i.deferUpdate();
            let selSub = i.values[0];
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: true,
              cat_id: catId,
              subcategory: selSub
            });
          });

          collector.on("end", async(collected, reason) => { });            
        } else {
          if(isSubCat == true) {
            const findParent = this.client.categories.find((c) => c.subcategories?.find((sc) => sc.id.toLowerCase() == catId.toLowerCase()));
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: interaction.customId.includes("_"),
              cat_id: findParent.id,
              subcategory: findCategory.id
            });
          } else {
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: interaction.customId.includes("_"),
              cat_id: interaction.customId.includes("_") ? catId : 'n/a'
            });
          }
        }
      }

      if(interaction.customId == "delete_ticket") {
        await interaction.deferUpdate();
        interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_deleted, this.client.embeds.general_color)] });
        setTimeout(async() => {
          await interaction.channel.delete().catch((err) => {});
        }, this.client.ticketsConfig.settings.delete_after * 1000);
      }
  
      if(interaction.customId == "closeTicket" && interaction.user.bot == false) {
        const cmd = this.client.slashCommands.get("close");
        const cmdConfig = this.client.cmdConfig["close"];
        if(!this.client.utils.hasPermissions(interaction, interaction.member, cmdConfig.permissions) && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });

        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x)).filter(r => r != undefined);
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles) && !interaction.member.permissions.has("Administrator")) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
        }

        let close = new closeCommand(this.client);
        await close.slashRun(interaction);
      }

      if(interaction.customId == "claimTicket" && interaction.user.bot == false) {
        const cmdConfig = this.client.cmdConfig["claim"];
        if(!this.client.utils.hasPermissions(interaction, interaction.member, cmdConfig.permissions) && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });

        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x)).filter(r => r != undefined);
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles) && !interaction.member.permissions.has("Administrator")) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
        }

        let claim = new claimCommand(this.client);
        await claim.slashRun(interaction);
      }

      if(interaction.customId == "ask_noCategory") {
        let catSelected = this.client.categories.find((ct) => ct.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase());
        if(!catSelected) {
          catSelected = this.client.categories.filter((x) => x.type == "SUBCATEGORY_PARENT" && x.subcategories);
          catSelected = catSelected.map((x) => {
            return x.subcategories.find((a) => a.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase())
          })[0];
        }

        let questionsList = this.client.ticketsConfig.settings.questionsList;

        if(questionsList.length == 0) return;
        const chunkSize = 5;
        const arrOfChunks = [];

        for (let i = 0; i < questionsList.length; i += chunkSize) {
          const chunk = questionsList.slice(i, i + chunkSize);
          arrOfChunks.push(chunk)
        }

        for (let i = 0; i < arrOfChunks.length; i++) {
          modalArr.push(arrOfChunks[i].map((x) => {
            let questionIndex = questionsList.indexOf(questionsList.find((q) => q.name == x.name));
            let modalData = new Discord.ActionRowBuilder().addComponents(
              new Discord.TextInputBuilder()
              .setLabel(x.name)
              .setStyle(Discord.TextInputStyle.Paragraph)
              .setMaxLength(2048)
              .setCustomId(`modalQuestion_${questionIndex}`)
              .setPlaceholder(x.question)
              .setRequired(x.required)
            );

            return modalData;
          }))
        }

        await this.client.database.ticketsData().set(`${interaction.channel.id}.listOfQuestions`, {
          list: questionsList,
          ticketCategory: catSelected,
          modalArr
        });

        const channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`);
        let startingPage = channelData.questionPage || 1;
        
        questModal = new Discord.ModalBuilder()
          .setTitle(this.client.language.titles.questions.replace("<page>", startingPage).replace("<max>", modalArr.length))
          .setComponents(modalArr[startingPage - 1])
          .setCustomId("askQuestions_modal");
        
        if (channelData.questionsAnswered == true) {
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Secondary)
              .setLabel(this.client.language.buttons.answered_all)
              .setDisabled(true);
          });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] }).catch((err) => { });
          return;
        }

        interaction.showModal(questModal);
      } else if(interaction.customId.startsWith("ask_") && interaction.customId.split("_")[1] != "noCategory") {
        let catSelected = this.client.categories.find((ct) => ct.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase());
        if(!catSelected) {
          catSelected = this.client.categories.filter((x) => x.type == "SUBCATEGORY_PARENT" && x.subcategories);
          catSelected = catSelected.map((x) => {
            return x.subcategories.find((a) => a.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase())
          }).filter(Boolean)[0];
        }

        let questionsList = catSelected.questionsList;

        if(questionsList.length == 0) return;
        const chunkSize = 5;
        const arrOfChunks = [];

        for (let i = 0; i < questionsList.length; i += chunkSize) {
          const chunk = questionsList.slice(i, i + chunkSize);
          arrOfChunks.push(chunk)
        }

        for (let i = 0; i < arrOfChunks.length; i++) {
          modalArr.push(arrOfChunks[i].map((x) => {
            let questionIndex = questionsList.indexOf(questionsList.find((q) => q.name == x.name));
            let modalData = new Discord.ActionRowBuilder().addComponents(
              new Discord.TextInputBuilder()
              .setLabel(x.name)
              .setStyle(Discord.TextInputStyle.Paragraph)
              .setMaxLength(2048)
              .setCustomId(`modalQuestion_${questionIndex}`)
              .setPlaceholder(x.question)
              .setRequired(x.required)
            );

            return modalData;
          }))
        }

        await this.client.database.ticketsData().set(`${interaction.channel.id}.listOfQuestions`, {
          list: questionsList,
          ticketCategory: catSelected,
          modalArr
        });

        const channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`);
        let startingPage = channelData.questionPage || 1;
        
        questModal = new Discord.ModalBuilder()
          .setTitle(this.client.language.titles.questions.replace("<page>", startingPage).replace("<max>", modalArr.length))
          .setComponents(modalArr[startingPage - 1])
          .setCustomId("askQuestions_modal");

        if (channelData.questionsAnswered == true) {
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Secondary)
              .setLabel(this.client.language.buttons.answered_all)
              .setDisabled(true);
          });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] }).catch((err) => { });
          return;
        }

        interaction.showModal(questModal);
      }
    }

    if(interaction.isStringSelectMenu()) {
      if(interaction.channel.type != Discord.ChannelType.DM) {
        if(interaction.customId == "noSelection_panel") {
          const categoryValue = interaction.values[0];

          await interaction.deferUpdate();
          let blackListed = false;
          let member = interaction.guild.members.cache.get(user.id);
          if(config.roles.blacklist.some((bl) => member.roles.cache.has(bl))) blackListed = true;

          if(blackListed == true) 
            return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_role, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral })
          if(this.client.ticketsConfig?.users?.blacklist?.includes(user.id))
            return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_user, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral })
          const noCategory = new Discord.EmbedBuilder()
            .setTitle(this.client.embeds.title)
            .setDescription(this.client.language.ticket.no_category)
            .setFooter({ text: this.client.embeds.footer, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp()
            .setColor(this.client.embeds.error_color);
    
          if(this.client.ticketsConfig.channels.tickets_category == "") 
            return interaction.followUp({ embeds: [noCategory], flags: Discord.MessageFlags.Ephemeral });

          await interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [interaction.message.components[0]] })
          const findCategory = this.client.categories.find((c) => c.id.toLowerCase() == categoryValue.toLowerCase());
          if(findCategory.type == "SUBCATEGORY_PARENT") {
            const options = [];
            findCategory.subcategories.forEach(c => {
              options.push({
                label: c.name,
                value: c.id, 
                emoji: c.emoji || {},
                description: c.placeholder != "" ? c.placeholder : ""
              });
            });
            
            let sMenu = new Discord.StringSelectMenuBuilder()
              .setCustomId("instant_subCategory")
              .setPlaceholder(this.client.ticketsConfig.settings.select_placeholder)
              .addOptions(options);
      
            let row = new Discord.ActionRowBuilder()
              .addComponents(sMenu);

            const selSubcategory = new Discord.EmbedBuilder()
              .setTitle(this.client.embeds.title)
              .setColor(this.client.embeds.general_color)

            selSubcategory.setDescription(this.client.embeds.select_subcategory.description
              .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
            let field = this.client.embeds.select_subcategory.fields;
            for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
              selSubcategory.addFields([{ name: field[i].title, value: field[i].description
                .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
            }
            
            if(this.client.embeds.ticket.footer.enabled == true) selSubcategory.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
            if(this.client.embeds.ticket.image.enabled == true) selSubcategory.setImage(this.client.embeds.ticket.image.url);
            if(this.client.embeds.ticket.thumbnail.enabled == true) selSubcategory.setThumbnail(this.client.embeds.ticket.thumbnail.url);

            await interaction.followUp({ embeds: [selSubcategory], components: [row], flags: Discord.MessageFlags.Ephemeral, fetchReply: true })
            const filter = (i) => i.customId == "instant_subCategory" && i.user.id == interaction.user.id;
            const collector = await interaction.channel.createMessageComponentCollector({ filter, time: this.client.ticketsConfig.settings.no_select_delete * 1000, componentType: Discord.ComponentType.SelectMenu, max: 1, maxComponents: 1, maxUsers: 1 });

            collector.on("collect", async(i) => {
              collector.stop("collected");
              await i.deferUpdate();
              let selSub = i.values[0];
              this.client.emit("ticketCreate", interaction, member, "No Reason", {
                status: true,
                cat_id: categoryValue,
                subcategory: selSub
              });
            });

            collector.on("end", async(collected, reason) => { });            
          } else {
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: true,
              cat_id: categoryValue
            });
          }
        }
      }
    } 

    if(interaction.type == Discord.InteractionType.ModalSubmit) {
      if(interaction.customId == "askQuestions_modal") {
        let channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`);
        let currPage = channelData.questionPage || 1;
        channelData.listOfAnswers = channelData.listOfAnswers || [];
        const listOfQuestions = channelData.listOfQuestions;

        if (parseInt(currPage + 1) > listOfQuestions.modalArr.length || listOfQuestions.modalArr.length == 1) {
          await interaction.deferUpdate().catch((err) => {});
          
          if(listOfQuestions.modalArr.length <= 5) {
            for(let i = 0; i < interaction.components.length; i++) {
              let questionIndex = interaction.components[i].components[0].customId.split("_")[1];
              channelData.listOfAnswers.push({
                questionName: listOfQuestions.list[questionIndex].name,
                question: listOfQuestions.list[questionIndex].question,
                answer: interaction.components[i].components[0].value || "N/A"
              });
            }

            await this.client.database.ticketsData().set(`${interaction.channel.id}.listOfAnswers`, channelData.listOfAnswers);
          }
          
          await this.client.database.ticketsData().set(`${interaction.channel.id}.questionsAnswered`, true);
    
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Secondary)
              .setLabel(this.client.language.buttons.answered_all)
              .setDisabled(true);
          });
    
          await interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.answered_all, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] });
          let answerData = channelData.listOfAnswers || [];
          
          let submitEmbed = new Discord.EmbedBuilder()
            .setTitle(this.client.embeds.ticket.questions_answers.title)
            .setColor(this.client.embeds.ticket.questions_answers.color);

          let answersEmbeds = [];
          let charLimit = 0;
          for (let i = 0; i < answerData.length; i++) {
            answerData[i].answer = answerData[i].answer == "" 
              || !answerData[i].answer || !answerData[i].answer.trim() ? "N/A" : answerData[i].answer;

            if(submitEmbed.fields?.length >= 25 || charLimit >= 5000) {
              answersEmbeds.push(submitEmbed);
              submitEmbed = new Discord.EmbedBuilder()
                .setTitle(this.client.embeds.ticket.questions_answers.title)
                .setColor(this.client.embeds.ticket.questions_answers.color);
              charLimit = 0;
            }
    
            if(answerData[i].answer.length <= 1024) {
              submitEmbed.addFields([{ name: answerData[i].questionName, value: answerData[i].answer }]);
              charLimit += answerData[i].answer.length;
            } else {
              let maxFieldLength = 1024;
              const regexPattern = new RegExp(`.{1,${maxFieldLength}}|.{1,${maxFieldLength}}$`, 'g');
              const chunks = answerData[i].answer.match(regexPattern);
    
              for(let j = 0; j < chunks.length; j++) {
                if(submitEmbed.fields?.length >= 25 || charLimit >= 5000) {
                  answersEmbeds.push(submitEmbed);
        
                  submitEmbed = new Discord.EmbedBuilder()
                    .setTitle(this.client.embeds.ticket.questions_answers.title)
                    .setColor(this.client.embeds.ticket.questions_answers.color);
                  charLimit = 0;
                }
    
                submitEmbed.addFields([{ name: answerData[i].questionName + ` (${j + 1})`, value: chunks[j] }]);
                charLimit += chunks[j].length;
              }
            }

           /*  submitEmbed.addFields([{ name: answerData[i].questionName, value: answerData[i].answer == "" 
              || !answerData[i].answer || !answerData[i].answer.trim() ? "N/A" : answerData[i].answer }]); */
          }

          answersEmbeds.push(submitEmbed);
    
          interaction.channel.permissionOverwrites.edit(interaction.user, {
            SendMessages: true,
            ViewChannel: true
          });

          await interaction.channel.threads.create({
            name: this.client.language.ticket.answers_thread_name,
            autoArchiveDuration: Discord.ThreadAutoArchiveDuration.OneWeek
          }).then(async(tm) => {
            for(let i = 0; i < answerData.length; i++) {
              const answerToQuestion = answerData[i].answer;
              if(answerToQuestion.length >= 1950) {
                let maxQuestionLength = 1950;
                const regexPattern = new RegExp(`.{1,${maxQuestionLength}}|.{1,${maxQuestionLength}}$`, 'g');
                const chunks = answerData[i].answer.match(regexPattern);
                
                for(let j = 0; j < chunks.length; j++) {
                  await tm.send({ content: this.client.ticketsConfig.settings.question_answer_format
                    .replace("<name>", answerData[i].questionName + ` (${j + 1})`)
                    .replace("<question>", answerData[i].question + ` (${j + 1})`)
                    .replace("<answer>", chunks[j]) });
                }
              } else {
                await tm.send({ content: this.client.ticketsConfig.settings.question_answer_format
                  .replace("<name>", answerData[i].questionName)
                  .replace("<question>", answerData[i].question)
                  .replace("<answer>", answerData[i].answer == "" 
                    || !answerData[i].answer || !answerData[i].answer.trim() ? "N/A" : answerData[i].answer) });
              }
            }
          });
          
        } else {
          let channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`);
          let questionPage = channelData.questionPage || 1;
          questionPage = questionPage += 1
          await this.client.database.ticketsData().set(`${interaction.channel.id}.questionPage`, questionPage);
          channelData.listOfAnswers = channelData.listOfAnswers || [];
    
          for(let i = 0; i < interaction.components.length; i++) {
            let questionIndex = interaction.components[i].components[0].customId.split("_")[1];
            channelData.listOfAnswers.push({
              questionName: listOfQuestions.list[questionIndex].name,
              question: listOfQuestions.list[questionIndex].question,
              answer: interaction.components[i].components[0].value || "N/A"
            });
          }

          await this.client.database.ticketsData().set(`${interaction.channel.id}.listOfAnswers`, channelData.listOfAnswers);
    
          questModal = new Discord.ModalBuilder()
            .setTitle(this.client.language.titles.questions.replace("<page>", parseInt(questionPage)).replace("<max>", listOfQuestions.modalArr.length))
            .setComponents(listOfQuestions.modalArr[parseInt(questionPage - 1)])
            .setCustomId("askQuestions_modal");
    
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setLabel(this.client.language.buttons.answer_questions.replace("<page>", questionPage));
          });
          
          await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.answered_set, this.client.embeds.general_color)], flags: Discord.MessageFlags.Ephemeral });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] })
        }
      }
    }
	}
};


