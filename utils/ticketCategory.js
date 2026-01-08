const { ButtonBuilder, ButtonStyle, MessageFlags, ComponentType, InteractionType, ActionRowBuilder } = require("discord.js");
const { chatAskQuestions } = require("./askQuestions");
const { isUnavailable } = require("./utils");
let haveTicket = false;

const checkIsAvailable = async(client, channel, member) => {
  if(client.ticketsConfig.settings?.availability == "" || !client.ticketsConfig.settings?.availability) return;
  const getAvailability = await isUnavailable(client);
  const startAvailable = `<t:${Math.floor(new Date().setHours(getAvailability.start.split(":")[0], getAvailability.start.split(":")[1], 0) / 1000)}:t>`;
  const endAvailable = `<t:${Math.floor(new Date().setHours(getAvailability.end.split(":")[0], getAvailability.end.split(":")[1], 0) / 1000)}:t>`;

  if(getAvailability.unavailable == true) {
    channel.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.not_available.replace("<user>", member.user)
      .replace("<start>", getAvailability.start)
      .replace("<end>", getAvailability.end)
      .replace("<startFormatted>", startAvailable)
      .replace("<endFormatted>", endAvailable), client.embeds.error_color)] }); 
  }
}

const mentionSupportRoles = async(client, message, category, channel) => {
  const config = client.config;
  if(client.ticketsConfig.settings.mention_support == false) return;

  if(client.ticketsConfig.settings.mention_support_type == "CATEGORY_ROLES") {
    let suppCategory = category.roles.map((r) => {
      let caSupport = client.utils.findRole(message.guild, r);
      
      if(caSupport) return caSupport;
    }).filter(r => r != undefined);
    
    if(suppCategory.length > 0) channel.send({ content: `${suppCategory.join(" ")}` }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
  } else if(client.ticketsConfig.settings.mention_support_type == "SUPPORT_ROLES") {
    let suppRoles = (client.config?.roles?.staff?.map((r) => {
      let findSupport = client.utils.findRole(message.guild, r);
      
      if(findSupport) return findSupport;
    }) || []).filter(r => r != undefined);
    
    if(suppRoles.length > 0) channel.send({ content: `${suppRoles.join(" ")}` }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
  } else {
    let suppRoles = (client.config?.roles?.staff?.map((r) => {
      let findSupport = client.utils.findRole(message.guild, r);
      
      if(findSupport) return findSupport;
    }) || []).filter(r => r != undefined);

    let suppCategory = category.roles.map((r) => {
      let caSupport = client.utils.findRole(message.guild, r);
      
      if(caSupport) return caSupport;
    }).filter(r => r != undefined);

    const bothRoles = suppRoles.concat(suppCategory);

    if(bothRoles.length > 0) channel.send({ content: `${bothRoles.join(" ")}` }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
  }
}

const ticketCategory = async(client, { message, msg, member, embed, interaction },
  componentList, reason, { buttonRow, row }, collector, ca, c, separatedPanel = false) => {
  const config = client.config;
  const ticketId = await client.database.guildData().get(`${client.config.general.guild}.ticketCount`);
  
  let moveCategory = client.utils.findChannel(message.guild, ca.category);
  if(client.ticketsConfig.settings.separate_categories == true && ca.category != "" && moveCategory) {
    let childrenTickets = await client.database.usersData().get(`${member.id}.tickets`) || [];
    let fallbackParents = ca.fallback_categories.map((fb) => client.utils.findChannel(message.guild, fb)?.id);

    let childrenArray = childrenTickets.filter((x) => (x.parent == moveCategory.id || fallbackParents.includes(x.parent)) && x.ticketCategory == ca.id);

    if(childrenArray.length < ca.limit) {
      let moveParent = client.utils.findTicketParent(message.guild, ca.category, ca.fallback_categories);
      let memberTicket = childrenTickets || [];
      memberTicket.find((x) => x.channel == c.id).ticketCategory = ca.id;
      memberTicket.find((x) => x.channel == c.id).parent = moveParent.id;
      await client.database.usersData().set(`${member.id}.tickets`, memberTicket);

      c.edit({ name: client.ticketsConfig.settings.rename_choose == true && ca.channel_name != "" ? client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : c.name, 
      parent: moveParent, lockPermissions: false }).then((ch) => {
        if(client.ticketsConfig.settings.separate_roles.enabled == true && ca.roles.length > 0) {
          let editRole = ca.roles.map((x) => client.utils.findRole(message.guild, x));
          editRole = editRole.filter((r) => r != undefined);
      
          for(const r of editRole) {
            c.permissionOverwrites.edit(r, {
              SendMessages: true,
              ViewChannel: true,
              AttachFiles: true
            }); 
          }
          if(client.config?.roles?.staff?.length > 0 && client.ticketsConfig.settings.separate_roles.both == false) {
            let suppEdit = client.config.roles.staff.map((x) => client.utils.findRole(message.guild, x));
            suppEdit = suppEdit.filter((r) => r != undefined); 
            
            for(const supp of suppEdit) {
              c.permissionOverwrites.edit(supp, {
                SendMessages: false,
                ViewChannel: false
              });
            }
          }
        }

        if(ca.ask_questions == false || client.ticketsConfig.settings.lock_ticket == false) {
          c.permissionOverwrites.edit(member.user, {
            SendMessages: true,
            ViewChannel: true,
            SendMessagesInThreads: false
          });
        }
      });

      embed.setDescription(ca.embed.description.replace("<user>", member)
          .replace("<reason>", `${reason}`)
          .replace("<category>", ca.name))
        .setColor(ca.embed.color);

      if(ca.embed.title)
        embed.setTitle(ca.embed.title.replace("<category>", ca.name))
      if(ca.embed.image)
        embed.setImage(ca.embed.image);
      if(ca.embed.thumbnail)
        embed.setThumbnail(ca.embed.thumbnail);

      msg.edit({ embeds: [embed], components: componentList(buttonRow)});
      let ticketData = await client.database.ticketsData().get(`${c.id}.ticketData`);
      ticketData.category = ca.id;
      await client.database.ticketsData().set(`${c.id}.ticketData`, ticketData);
      haveTicket = false;

      await mentionSupportRoles(client, message, ca, c);
      await checkIsAvailable(client, c, member);

      if(ca.ask_questions == true && client.ticketsConfig.settings.questions_type == "MODAL") {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask_${ca.id}`)
            .setLabel(client.language.buttons.answer_questions.replace("<page>", "1"))
            .setEmoji(config.emojis.answer_questions || {})
            .setStyle(ButtonStyle.Success)
          );
        
        msg.edit({ embeds: [embed], components: componentList(buttonRow) });
        
        startCollector(client, `${ca.id}`, c, msg, member);
        // await categoryCollector(client, member, ca, c);
      } else if(ca.ask_questions == true && client.ticketsConfig.settings.questions_type == "CHAT") {
        await chatAskQuestions(client, message.member, c, ca.questionsList, ca);
      }
    } else {
      msg.edit({ embeds: [embed], components: componentList(buttonRow, row)});
      haveTicket = true;
    }

    if(haveTicket == true) {
      if(interaction.type == InteractionType.ApplicationCommand) {
        interaction.reply({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], flags: MessageFlags.Ephemeral });
        return;
      } else if(interaction.type == InteractionType.MessageComponent) {
        interaction.followUp({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], flags: MessageFlags.Ephemeral });
        return;
      } else {
        c.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
        return;
      }
    } else {
      await client.database.usersData().delete(`${member.id}.choosingCategory`);
      if(collector) collector.stop()
    }
  } else {
    let memberTickets = await client.database.usersData().get(`${member.id}.tickets`);
    let listOfTickets = memberTickets.filter((x) => x.member == member.id && x.ticketCategory == ca.id);

    if(listOfTickets.length < ca.limit) {
      c.setName(client.ticketsConfig.settings.rename_choose == true && ca.channel_name != "" ? client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : c.name);

      memberTickets.find((x) => x.channel == c.id).ticketCategory = ca.id;
      await client.database.usersData().set(`${member.id}.tickets`, memberTickets);

      if(client.ticketsConfig.settings.separate_roles.enabled == true && ca.roles.length > 0) {
        let editRole = ca.roles.map((x) => client.utils.findRole(message.guild, x));
        editRole = editRole.filter((r) => r != undefined);
        
        for(const r of editRole) {
          c.permissionOverwrites.edit(r, {
            SendMessages: true,
            ViewChannel: true,
            AttachFiles: true
          }); 
        }
        if(client.config?.roles?.staff?.length > 0 && client.ticketsConfig.settings.separate_roles.both == false) {
          let suppEdit = client.config.roles.staff.map((x) => client.utils.findRole(message.guild, x));
          suppEdit = suppEdit.filter((r) => r != undefined); 
          
          for(const supp of suppEdit) {
            c.permissionOverwrites.edit(supp, {
              SendMessages: false,
              ViewChannel: false
            });
          }
        }
      }
      if(ca.ask_questions == false || client.ticketsConfig.settings.lock_ticket == false) {
        c.permissionOverwrites.edit(member.user, {
          SendMessages: true,
          ViewChannel: true,
          SendMessagesInThreads: false
        });
      }
      
      embed.setDescription(ca.embed.description.replace("<user>", member)
          .replace("<reason>", `${reason}`)
          .replace("<category>", ca.name))
        .setColor(ca.embed.color);

      if(ca.embed.title)
        embed.setTitle(ca.embed.title.replace("<category>", ca.name))
      if(ca.embed.image)
        embed.setImage(ca.embed.image);
      if(ca.embed.thumbnail)
        embed.setThumbnail(ca.embed.thumbnail);
      
      msg.edit({ embeds: [embed], components: componentList(buttonRow)});
      haveTicket = false;
      await client.database.usersData().delete(`${member.id}.choosingCategory`);
      let ticketData = await client.database.ticketsData().get(`${c.id}.ticketData`);
      ticketData.category = ca.id;
      await client.database.ticketsData().set(`${c.id}.ticketData`, ticketData);

      await mentionSupportRoles(client, message, ca, c);
      await checkIsAvailable(client, c, member);

      if(ca.ask_questions == true && client.ticketsConfig.settings.questions_type == "MODAL") {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask_${ca.id}`)
            .setLabel(client.language.buttons.answer_questions.replace("<page>", "1"))
            .setEmoji(config.emojis.answer_questions || {})
            .setStyle(ButtonStyle.Success)
          );
          
        msg.edit({ embeds: [embed], components: componentList(buttonRow) });
        
        startCollector(client, `${ca.id}`, c, msg, member);
        // await categoryCollector(client, member, ca, c);
      } else if(ca.ask_questions == true && client.ticketsConfig.settings.questions_type == "CHAT") {
        await chatAskQuestions(client, message.member, c, ca.questionsList, ca);
      }
    } else {
      msg.edit({ embeds: [embed], components: componentList(buttonRow, row)});
      haveTicket = true;
    }

    if(haveTicket == true) {
      if(interaction.type == InteractionType.ApplicationCommand) {
        interaction.reply({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], flags: MessageFlags.Ephemeral });
        return;
      } else if(interaction.type == InteractionType.MessageComponent) {
        interaction.followUp({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], flags: MessageFlags.Ephemeral });
        return;
      } else {
        c.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
        return;
      }
    } else {
      await client.database.usersData().delete(`${member.id}.choosingCategory`);
      if(collector) collector.stop()
    }
  }
}

const ticketSubCategory = async(client, { message, msg, member, embed, interaction }, componentList, 
  reason, { buttonRow, subRow }, collector, parentCategory, ca, c) => {
  const config = client.config;
  const ticketId = await client.database.guildData().get(`${client.config.general.guild}.ticketCount`);

  let moveCategory = client.utils.findChannel(message.guild, ca.category);
  if(client.ticketsConfig.settings.separate_categories == true && ca.category != "" && moveCategory) {
    let childrenTickets = await client.database.usersData().get(`${member.id}.tickets`) || [];
    let fallbackParents = ca.fallback_categories.map((fb) => client.utils.findChannel(message.guild, fb)?.id);

    let childrenArray = childrenTickets.filter((x) => (x.parent == moveCategory.id || fallbackParents.includes(x.parent)) && x.ticketCategory == ca.id);

    if(childrenArray.length < ca.limit) {
      let moveParent = client.utils.findTicketParent(message.guild, ca.category, ca.fallback_categories);
      childrenTickets.find((x) => x.channel == c.id).ticketCategory = ca.id;
      childrenTickets.find((x) => x.channel == c.id).parent = moveParent.id;
      await client.database.usersData().set(`${member.id}.tickets`, childrenTickets);

      c.edit({ name: client.ticketsConfig.settings.rename_choose == true && ca.channel_name != "" ? client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : c.name, 
      parent: moveParent, lockPermissions: false }).then((ch) => {
        if(client.ticketsConfig.settings.separate_roles.enabled == true && ca.roles.length > 0) {
          let editRole = ca.roles.map((x) => client.utils.findRole(message.guild, x));
          editRole = editRole.filter((r) => r != undefined);
      
          for(const r of editRole) {
            c.permissionOverwrites.edit(r, {
              SendMessages: true,
              ViewChannel: true,
              AttachFiles: true
            });
          }
          if(client.config?.roles?.staff?.length > 0 && client.ticketsConfig.settings.separate_roles.both == false) {
            let suppEdit = client.config.roles.staff.map((x) => client.utils.findRole(message.guild, x));
            suppEdit = suppEdit.filter((r) => r != undefined); 
            
            for(const supp of suppEdit) {
              c.permissionOverwrites.edit(supp, {
                SendMessages: false,
                ViewChannel: false
              });
            }
          }
        }
        if(ca.ask_questions == false || client.ticketsConfig.settings.lock_ticket == false) {
          ch.permissionOverwrites.edit(member.id, {
            SendMessages: true,
            ViewChannel: true,
            SendMessagesInThreads: false
          });
        }
      });

      embed.setDescription(ca.embed.description.replace("<user>", member)
          .replace("<reason>", `${reason}`)
          .replace("<category>", parentCategory.name)
          .replace("<subcategory>", ca.name))
        .setColor(ca.embed.color);

      if(ca.embed.title)
        embed.setTitle(ca.embed.title.replace("<category>", parentCategory.name).replace("<subcategory>", ca.name));
      if(ca.embed.image)
        embed.setImage(ca.embed.image);
      if(ca.embed.thumbnail)
        embed.setThumbnail(ca.embed.thumbnail);
        
      msg.edit({ embeds: [embed], components: componentList(buttonRow)});
      let ticketData = await client.database.ticketsData().get(`${c.id}.ticketData`);
      ticketData.category = ca.id;
      await client.database.ticketsData().set(`${c.id}.ticketData`, ticketData);
      haveTicket = false;

      await mentionSupportRoles(client, message, ca, c);
      await checkIsAvailable(client, c, member);

      if(ca.ask_questions == true && client.ticketsConfig.settings.questions_type == "MODAL") {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask_${ca.id}`)
            .setLabel(client.language.buttons.answer_questions.replace("<page>", "1"))
            .setEmoji(config.emojis.answer_questions || {})
            .setStyle(ButtonStyle.Success)
          );
        
        msg.edit({ embeds: [embed], components: componentList(buttonRow) });
        
        startCollector(client, `${ca.id}`, c, msg, member);
        // await categoryCollector(client, member, ca, c);
      } else if(ca.ask_questions == true && client.ticketsConfig.settings.questions_type == "CHAT") {
        await chatAskQuestions(client, message.member, c, ca.questionsList, ca);
      }
    } else {
      msg.edit({ embeds: [embed], components: componentList(buttonRow, subRow)});
      haveTicket = true;
    }

    if(haveTicket == true) {
      if(interaction.type == InteractionType.ApplicationCommand) {
        interaction.reply({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], flags: MessageFlags.Ephemeral });
        return;
      } else if(interaction.type == InteractionType.MessageComponent) {
        interaction.followUp({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], flags: MessageFlags.Ephemeral });
        return;
      } else {
        c.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
        return;
      }
    } else {
      await client.database.usersData().delete(`${member.id}.choosingCategory`);
      if(collector) collector.stop()
    }
  } else {
    let memberTickets = await client.database.usersData().get(`${member.id}.tickets`);
    let listOfTickets = memberTickets.filter((x) => x.member == member.id && x.ticketCategory == ca.id);

    if(listOfTickets.length < ca.limit) {
      memberTickets.find((x) => x.channel == c.id).ticketCategory = ca.id;
      await client.database.usersData().set(`${member.id}.tickets`, memberTickets);

      c.edit({ name: client.ticketsConfig.settings.rename_choose == true && ca.channel_name != "" ? client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : c.name, lockPermissions: false }).then((ch) => {
        if(client.ticketsConfig.settings.separate_roles.enabled == true && ca.roles.length > 0) {
          let editRole = ca.roles.map((x) => client.utils.findRole(message.guild, x));
          editRole = editRole.filter((r) => r != undefined);
          
          for(const r of editRole) {
            ch.permissionOverwrites.edit(r, {
              SendMessages: true,
              ViewChannel: true,
              AttachFiles: true
            }); 
          }
          if(client.config?.roles?.staff?.length > 0 && client.ticketsConfig.settings.separate_roles.both == false) {
            let suppEdit = client.config.roles.staff.map((x) => client.utils.findRole(message.guild, x));
            suppEdit = suppEdit.filter((r) => r != undefined); 
            
            for(const supp of suppEdit) {
              ch.permissionOverwrites.edit(supp, {
                SendMessages: false,
                ViewChannel: false
              });
            }
          }
        }
        if(ca.ask_questions == false || client.ticketsConfig.settings.lock_ticket == false) {
          ch.permissionOverwrites.edit(member.user, {
            SendMessages: true,
            ViewChannel: true,
            SendMessagesInThreads: false
          });
        }
      });

      embed.setDescription(ca.embed.description.replace("<user>", member)
          .replace("<reason>", `${reason}`)
          .replace("<category>", parentCategory.name)
          .replace("<subcategory>", ca.name))
        .setColor(ca.embed.color);

      if(ca.embed.title)
        embed.setTitle(ca.embed.title.replace("<category>", parentCategory.name).replace("<subcategory>", ca.name));
      if(ca.embed.image)
        embed.setImage(ca.embed.image);
      if(ca.embed.thumbnail)
        embed.setThumbnail(ca.embed.thumbnail);
      
      msg.edit({ embeds: [embed], components: componentList(buttonRow)});
      haveTicket = false;
      await client.database.ticketsData().delete(`${member.id}.choosingCategory`);
      let ticketData = await client.database.ticketsData().get(`${c.id}.ticketData`);
      ticketData.category = ca.id;
      await client.database.ticketsData().set(`${c.id}.ticketData`, ticketData);

      await mentionSupportRoles(client, message, ca, c);
      /* if(client.ticketsConfig.settings.mention_support == true && ca.roles.length > 0 && client.ticketsConfig.settings.separate_roles.both == false && client.ticketsConfig.settings.separate_roles.enabled == false) {
        let suppMention = ca.roles.map((r) => {
          let caSupport = client.utils.findRole(message.guild, r);
          
          if(caSupport) return caSupport;
        });

        if(suppMention.length > 0) c.send(suppMention.join(" ")).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
      } else if(client.ticketsConfig.settings.mention_support == true && (ca.roles.length == 0 || client.ticketsConfig.settings.separate_roles.both == true || client.ticketsConfig.settings.separate_roles.enabled == false)) {
        let supp = client.config?.roles?.staff?.map((r) => {
          let findSupport = client.utils.findRole(message.guild, r);
          
          if(findSupport) return findSupport;
        }) || [];

        if(supp.length > 0) c.send({ content: `${supp.join(" ")}` }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
      } */

      await checkIsAvailable(client, c, member);

      if(ca.ask_questions == true && client.ticketsConfig.settings.questions_type == "MODAL") {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask_${ca.id}`)
            .setLabel(client.language.buttons.answer_questions.replace("<page>", "1"))
            .setEmoji(config.emojis.answer_questions || {})
            .setStyle(ButtonStyle.Success)
          );
          
        msg.edit({ embeds: [embed], components: componentList(buttonRow) });
        
        startCollector(client, `${ca.id}`, c, msg, member);
        // await categoryCollector(client, member, ca, c);
      } else if(ca.ask_questions == true && client.ticketsConfig.settings.questions_type == "CHAT") {
        await chatAskQuestions(client, message.member, c, ca.questionsList, ca);
      }
    } else {
      msg.edit({ embeds: [embed], components: componentList(buttonRow, subRow)});
      haveTicket = true;
    }

    if(haveTicket == true) {
      if(interaction.type == InteractionType.ApplicationCommand) {
        interaction.reply({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], flags: MessageFlags.Ephemeral });
        return;
      } else if(interaction.type == InteractionType.MessageComponent) {
        interaction.followUp({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], flags: MessageFlags.Ephemeral });
        return;
      } else {
        c.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
        return;
      }
    } else {
      await client.database.usersData().delete(`${member.id}.choosingCategory`);
      if(collector) collector.stop();
    }

    // if(haveTicket == true) c.send.then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000))
  }
}

const startCollector = (client, category, channel, msg, member) => {
  if(client.ticketsConfig.settings.lock_ticket == true) {
    channel.permissionOverwrites.edit(member.id, {
      SendMessages: false,
      ViewChannel: true,
      SendMessagesInThreads: false
    });
  }

  const questFilter = (btn) => btn.customId == `ask_${category}` && btn.user.id == member.id;
  channel.awaitMessageComponent({ questFilter, componentType: ComponentType.Button, time: client.ticketsConfig.settings.question_idle * 1000 })
    .then(interaction => {})
    .catch(() => {
      let editActionRow = ActionRowBuilder.from(msg.components[0]);
      editActionRow.components.forEach((c) => {
        if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setDisabled(true);
      });

      msg.edit({ embeds: [msg.embeds[0]], components: [editActionRow] }).catch((err) => { });
  })
}

module.exports = {
  ticketCategory,
  ticketSubCategory
}






