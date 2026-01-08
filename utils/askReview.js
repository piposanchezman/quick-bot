const Discord = require("discord.js");

module.exports = async(client, channel, guild) => {
  const config = client.config;
  const ticketsConfig = client.ticketsConfig;
  const language = client.language;
  
  // Check if reviews are enabled globally
  if(ticketsConfig.settings.ask_review == false) return;
  
  const channelData = await client.database.ticketsData().get(`${channel.id}`);
  const ticketData = channelData.ticketData;
  const claimedBy = channelData.ticketClaimed || channelData.autoClaim || null;
  const user = client.users.cache.get(ticketData?.owner);
  if(!user) return;

  let dataReview = {
    user,
    comment: "",
    stars: 0
  }
  
  let selectRow = new Discord.ActionRowBuilder().addComponents(
    new Discord.StringSelectMenuBuilder()
      .setCustomId("rate_select_menu")
      .setPlaceholder(language.service.reviews.placeholder)
      .addOptions([{
        label: language.service.reviews.stars.one,
        value: "1",
        emoji: ticketsConfig.emojis.review.one
      }, {
        label: language.service.reviews.stars.two,
        value: "2",
        emoji: ticketsConfig.emojis.review.two
      }, {
        label: language.service.reviews.stars.three,
        value: "3",
        emoji: ticketsConfig.emojis.review.three
    }, {
       label: language.service.reviews.stars.four,
       value: "4",
       emoji: ticketsConfig.emojis.review.four
    }, {
       label: language.service.reviews.stars.five,
       value: "5",
       emoji: ticketsConfig.emojis.review.five
    }])
  );

  let cancelRow = new Discord.ActionRowBuilder()
    .addComponents(
      new Discord.ButtonBuilder()
        .setCustomId("review_cancel")
        .setStyle(Discord.ButtonStyle.Secondary)
        .setLabel("Cancelar")
        .setEmoji(client.ticketsConfig.emojis.stop)
    );
  
  // Determine message based on if ticket was claimed
  const staffMember = claimedBy ? client.users.cache.get(claimedBy) : null;
  const reviewMessage = claimedBy 
    ? client.language.service.reviews.rating_dm_claimed.replace("<staff>", staffMember?.username || "Staff")
    : client.language.service.reviews.rating_dm_unclaimed;
  
  let rateMsg;
  setTimeout(async() => {
    rateMsg = await user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, reviewMessage, client.embeds.general_color)], components: [selectRow, cancelRow] }).catch((err) => {
      return console.error("User's DM Closed");
    });
  }, 2500);
  
  const dm = await user.createDM();
  
  let rateFilter = (i) => i.channel.type == Discord.ChannelType.DM && i.user.id == user.id;
  let rateCollector = await dm.createMessageComponentCollector({ filter: rateFilter, time: 300_000 });
  
  rateCollector.on("collect", async(i) => {
    if(i.type == Discord.InteractionType.MessageComponent && i.customId == "rate_select_menu") {
      let value = i.values[0];
      if(!isNaN(value)) {
        selectRow.components[0].setDisabled(true);

        await rateMsg.edit({ embeds: [client.embedBuilder(client, user, client.embeds.title, reviewMessage, client.embeds.general_color)], components: [selectRow] });
        
        dataReview.stars = value;
        let commentInput = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.TextInputBuilder()
            .setCustomId("review_comment")
            .setLabel(language.modals.labels.comment)
            .setPlaceholder(language.modals.placeholders.comment)
            .setMinLength(6)
            .setRequired(true)
            .setStyle(Discord.TextInputStyle.Paragraph)
          );
        
        let commentModal = new Discord.ModalBuilder()
          .setTitle(language.titles.review)
          .setCustomId("comment_modal")
          .addComponents(commentInput);
          
        i.showModal(commentModal);
        
        // Don't stop collector yet, wait for modal submission
      
        const filter = (i) => i.customId == 'comment_modal' && i.user.id == user.id;
        i.awaitModalSubmit({ filter, time: 120_000 }).then(async(md) => {
          let commentValue = md.fields.getTextInputValue("review_comment").split(/\r?\n/)
            .filter(line => line.trim() !== "")
            .join("\n");
          
          dataReview.comment = commentValue || "";
          
          // Reply to modal with success message
          let successEmbed = new Discord.EmbedBuilder()
            .setTitle(client.embeds.title || "QuickBot")
            .setDescription(client.language.service.reviews.sent || "¡Gracias! Revisión enviada.")
            .setColor(client.embeds.success_color || "Green")
            .setFooter({ text: client.embeds.footer || "QuickBot", iconURL: client.user.displayAvatarURL({ size: 1024, dynamic: true }) })
            .setTimestamp();
          
          await md.reply({ embeds: [successEmbed] }).catch(err => {
            console.log("Failed to reply to modal:", err.message);
          });
          
          // Update the original message to remove components
          await rateMsg.edit({ components: [] }).catch(() => {});
          
          let rId = client.utils.generateId();
          
          let rObject = {
            id: rId,
            author: user.id,
            user: claimedBy,
            rating: dataReview.stars,
            comment: dataReview.comment,
            date: new Date()
          }

          const review = ticketsConfig.emojis.review.star.repeat(Math.floor(dataReview.stars));
          
          client.utils.pushReview(client, claimedBy, rObject);
          
          // Create review announcement embed
          const staffInfo = claimedBy ? client.users.cache.get(claimedBy)?.username || "Desconocido" : null;
          
          let announceEmbed = new Discord.EmbedBuilder()
            .setColor(client.embeds.service.review_announce.color);
          
          if (client.embeds.service.review_announce.title) announceEmbed.setTitle(client.embeds.service.review_announce.title);
          
          if (client.embeds.service.review_announce.description) announceEmbed.setDescription(client.embeds.service.review_announce.description
            .replace("<author>", user.username)
            .replace("<staff>", staffInfo || "Soporte General")
            .replace("<review>", review)
            .replace("<numRating>", dataReview.stars)
            .replace("<comment>", dataReview.comment));
          
          if (client.embeds.service.review_announce.fields && client.embeds.service.review_announce.fields.length > 0) {
            let field = client.embeds.service.review_announce.fields;
            for (let i = 0; i < field.length; i++) {
              // Skip Staff field if ticket was not claimed
              if (field[i].title === "Staff" && !claimedBy) continue;
              
              announceEmbed.addFields([{ 
                name: field[i].title, 
                value: field[i].description
                  .replace("<author>", user.username)
                  .replace("<staff>", staffInfo || "Soporte General")
                  .replace("<review>", review)
                  .replace("<numRating>", dataReview.stars)
                  .replace("<comment>", dataReview.comment),
                inline: false
              }])
            }
          }
          
          if (client.embeds.service.review_announce.footer == true) announceEmbed.setFooter({ text: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
          if (client.embeds.service.review_announce.thumbnail == true) announceEmbed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
          
          let reviewCh = client.utils.findChannel(guild, client.ticketsConfig.channels.reviews);
          if(reviewCh) {
            reviewCh.send({ embeds: [announceEmbed] }).catch(err => {
              console.log("Failed to send review to channel:", err.message);
            });
          } else {
            console.log("Review channel not found");
          }
        
          // Stop collector AFTER everything is done
          rateCollector.stop("collected");
        }).catch(async(err) => {
          console.log("Modal submit timeout or error:", err.message);
          rateCollector.stop("modalTimeout");
        });
      }
    } else if(i.type == Discord.InteractionType.MessageComponent && i.customId == "review_cancel") {
      await i.deferUpdate();

      selectRow.components[0].setDisabled(true);

      await rateMsg.edit({ embeds: [client.embedBuilder(client, user, client.embeds.title, reviewMessage, client.embeds.general_color)], components: [selectRow] });
        
      user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.cancel, client.embeds.success_color)] });
      rateCollector.stop("canceled");
    }
  });

  rateCollector.on("end", async(collected, reason) => {
    if(reason != "collected" && reason != "canceled") {
      selectRow.components[0].setDisabled(true);
      if(rateMsg) await rateMsg.edit({ embeds: [client.embedBuilder(client, user, client.embeds.title, reviewMessage, client.embeds.general_color)], components: [selectRow] }).catch(() => {});
      
      await user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.time, client.embeds.success_color)] }).catch((err) => console.log("User's DM Closed"));
    }
  });
}


