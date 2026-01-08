const Discord = require("discord.js");
const fetch = require("node-fetch");

const chatAskQuestions = async(client, member, channel, questionsList, ticketCategory = {}) => {
  let config = client.config;
  if(questionsList.length == 0) return;
  let answersList = new Map(), attachmentsList = new Map();
  const filter = msg => msg.author.id === member.id;

  // We'll send each question as a separate message (kept intact during the flow)
  const questionMessages = [];
  const collectedAnswerMessages = [];

  await client.database.ticketsData().set(`${channel.id}.listOfQuestions`, {
    list: questionsList,
    ticketCategory
  });

  const cancelAsk = new Discord.ActionRowBuilder()
    .addComponents(
      new Discord.ButtonBuilder().setCustomId("cancel_ask")
        .setEmoji(client.ticketsConfig.settings.enabled ? client.ticketsConfig.emojis.stop : "❌")
        .setStyle(Discord.ButtonStyle.Danger)
    );

  // Send first question and then proceed sequentially, keeping previous question messages
  let questionNumber = 0;
  const sendQuestionMessage = async (idx) => {
    const q = questionsList[idx];
    const questionEmbed = new Discord.EmbedBuilder()
      .setTitle(`${q.name}`)
      .setDescription(`${q.question}`)
      .setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp()
      .setColor(client.embeds.general_color);

    const components = (idx === 0 && client.config.general.cancel_ask == true) ? [cancelAsk] : [];
    const sent = await channel.send({ embeds: [questionEmbed], components }).catch((err) => {
      console.error("Failed to send question message:", err.message);
      return null;
    });
    if(sent) questionMessages.push(sent);
    return sent;
  }

  // Verify channel still exists
  if(!channel || channel.deleted) {
    console.error("Channel was deleted before questions could be sent");
    return;
  }

  // Send first question
  const firstMsg = await sendQuestionMessage(0);
  if(!firstMsg) return;

  if(client.config.general.cancel_ask == true) {
    const awaitFilter = (i) => i.customId == "cancel_ask" && i.user.id == member.id;
    firstMsg.awaitMessageComponent({ filter: awaitFilter, time: client.ticketsConfig.settings.question_idle * 1000 }).then(async (i) => {
      await i.deferUpdate();
      try { await firstMsg.delete(); } catch(e) {}
      // stop if collector is running by throwing a symbol; we'll rely on end timeout
    }).catch((e) => {});
  }

  const collector = channel.createMessageCollector({ filter, idle: client.ticketsConfig.settings.question_idle * 1000, max: questionsList.length });

  collector.on('collect', async (m) => {
    // Save collected user message to possibly delete later
    collectedAnswerMessages.push(m);

    let content = m.content ?? "";
    if(m.attachments.size > 0) {
      // Store simple attachment descriptors (url + name). Building AttachmentBuilder from URL
      // may fail; we'll pass file options directly to send() when posting to thread.
      let attachList = [];
      for(const [, att] of m.attachments) {
        try {
          attachList.push({ url: att.url, name: att.name });
        } catch (e) {
          // ignore
        }
      }
      attachmentsList.set(questionsList[questionNumber].name, attachList);
      // If user sent only attachments and no text, keep answer content empty
      if((m.content || "").length === 0) content = "";
    }

    answersList.set(questionsList[questionNumber].name, `${content}`);

    // Move to next question (send it) or finalize
    questionNumber++;
    if(questionNumber < questionsList.length) {
      await sendQuestionMessage(questionNumber);
    } else {
      // Finalize: store answers and create thread with Q&A then delete originals
      const answersArray = [...answersList.values()];
      const listOfAnswers = await client.database.ticketsData().get(`${channel.id}.listOfAnswers`) || [];
      for(let i = 0; i < answersArray.length; i++) {
        listOfAnswers.push({
          questionName: questionsList[i].name,
          question: questionsList[i].question,
          answer: answersArray[i]
        });
      }
      await client.database.ticketsData().set(`${channel.id}.listOfAnswers`, listOfAnswers);

      // Create thread and post answers + attachments
      try {
        const tm = await channel.threads.create({ name: client.language.ticket.answers_thread_name, autoArchiveDuration: Discord.ThreadAutoArchiveDuration.OneWeek });
        await tm.send({ content: client.language.ticket.answers_sending }).then((x) => setTimeout(() => x.delete().catch(() => {}), 10000));

        for(let i = 0; i < answersArray.length; i++) {
          const q = questionsList[i];
          const answerToQuestion = answersArray[i] || "";

          // Post question as embed
          const questionEmbed = new Discord.EmbedBuilder()
            .setTitle(`${q.name}`)
            .setDescription(`${q.question}`)
            .setColor(client.embeds.general_color);
          await tm.send({ embeds: [questionEmbed] }).catch(() => {});

          // Post textual answer if present
          if(answerToQuestion.length > 0) {
            if(answerToQuestion.length >= 1950) {
              const regexPattern = new RegExp(`.{1,1950}|.{1,1950}$`, 'g');
              const chunks = answerToQuestion.match(regexPattern) || [answerToQuestion];
              for(const chunk of chunks) {
                await tm.send({ content: chunk }).catch(() => {});
              }
            } else {
              await tm.send({ content: answerToQuestion }).catch(() => {});
            }
          }

          // Post attachments if present (map stored {url,name} -> { attachment, name })
          const answerAttachments = attachmentsList.get(q.name) || [];
          if(answerAttachments.length > 0) {
            const filesToSend = answerAttachments.map(a => ({ attachment: a.url, name: a.name }));
            await tm.send({ files: filesToSend }).catch(() => {});
          }
        }

        // After posting to thread, delete original question messages and user's answers
        try {
          for(const qmsg of questionMessages) {
            if(qmsg && qmsg.deletable) await qmsg.delete().catch(() => {});
          }
          for(const umsg of collectedAnswerMessages) {
            if(umsg && umsg.deletable) await umsg.delete().catch(() => {});
          }
        } catch (e) {}
      } catch (err) {
        console.error('Failed to create answers thread or send answers:', err?.message || err);
      }

      collector.stop();
    }
  });

  collector.on('end', async (collected, reason) => {
    if(reason.toLowerCase() === "idle") {
      let idleEmbed = new Discord.EmbedBuilder()
        .setDescription(client.language.ticket.question_idle)
        .setColor(client.embeds.general_color);
      channel.send({ embeds: [idleEmbed] }).catch(() => {});
    }
  });
}

module.exports = {
  chatAskQuestions
}
