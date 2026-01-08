const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const fs = require("fs");
const chalk = require("chalk");
const FormData = require("form-data");
const fetch = require("node-fetch");
const yaml = require("yaml");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM();
const document = dom.window.document;
const config = yaml.parse(fs.readFileSync('./configs/config.yml', 'utf8'));
const language = yaml.parse(fs.readFileSync('./configs/language.yml', 'utf8'));

function formatTime(ms) {
  let roundNumber = ms > 0 ? Math.floor : Math.ceil;
  let days = roundNumber(ms / 86400000),
    hours = roundNumber(ms / 3600000) % 24,
    mins = roundNumber(ms / 60000) % 60,
    secs = roundNumber(ms / 1000) % 60;
  var time = (days > 0) ? `${days}d ` : "";
  time += (hours > 0) ? `${hours}h ` : "";
  time += (mins > 0) ? `${mins}m ` : "";
  time += (secs > 0) ? `${secs}s` : "0s";
  return time;
}



const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);

const updateStats = async(client, guild) => {
  const guildCache = client.otherCache.get("guild");
  const countersCache = client.otherCache.get("counters");
  
  let currentTickets = guildCache?.currentTickets || 0;
  let claimedTickets = guildCache?.claimedTickets || 0;
  let totalTickets = guildCache?.ticketCount || 0;

  let chOpened = countersCache?.openedChannel;
  let chClaimed = countersCache?.claimedChannel;
  let chTotal = countersCache?.totalChannel;

  if(chOpened && guild.channels.cache.get(chOpened)) {
    let ch = guild.channels.cache.get(chOpened);
    ch.setName(ch.name.replace(/[0-9]/g, "") + currentTickets);
  }
  if(chClaimed && guild.channels.cache.get(chClaimed)) {
    let ch = guild.channels.cache.get(chClaimed);
    ch.setName(ch.name.replace(/[0-9]/g, "") + claimedTickets);
  }
  if(chTotal && guild.channels.cache.get(chTotal)) {
    let ch = guild.channels.cache.get(chTotal);
    ch.setName(ch.name.replace(/[0-9]/g, "") + totalTickets);
  }
}

const commandsList = (client, category) => {
  prefix = client.config.general.prefix;
  let commands = client.commands.filter(
    c => c.category == category && c.enabled == true
  );

  let loaded = [...commands.values()];
  let content = "";

  loaded.forEach(
    c => (content += `\`${c.name}\`, `)
  );
  if(content.length == 0) content = client.language.general.no_commands + ", ";

  return content.slice(0, -2);
}

const pushReview = async(client, userId, object) => {
  let history = await client.database.usersData().get(`${userId}.reviews`) || [];
  history.unshift(object);
  await client.database.usersData().set(`${userId}.reviews`, history);
}

const generateId = () => {
  let firstPart = (Math.random() * 46656) | 0;
  let secondPart = (Math.random() * 46656) | 0;
  firstPart = ("000" + firstPart.toString(36)).slice(-3);
  secondPart = ("000" + secondPart.toString(36)).slice(-3);

  return firstPart + secondPart;
}

const sendError = (error) => {
  console.log(chalk.red("[ERROR] ") + chalk.white(error));
  
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  let errorMessage = `[${date.toLocaleString("en-GB")}] [ERROR] ${error}\n`;
  fs.appendFile(`./logs/errors-${dateStr}.txt`, errorMessage, (e) => {
    if(e) console.log(e);
  });
}

const sendWarn = (warn) => {
  console.log(chalk.keyword("orange")("[WARNING] ") + chalk.white(warn));

  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  let warnMessage = `[${date.toLocaleString("en-GB")}] [WARN] ${warn}\n`;
  fs.appendFile(`./logs/info-${dateStr}.txt`, warnMessage, (e) => {
    if(e) console.log(e);
  });
}

const sendInfo = (info) => {
  console.log(chalk.blue("[INFO] ") + chalk.white(info));
}

const findChannel = (guild, channel) => {
  if(channel == "") return undefined;

  return guild.channels.cache.find(ch => ch.name.toLowerCase().includes(`${channel}`.toLowerCase())) || guild.channels.cache.get(channel);
}

const usage = (client, message, validUsage) => {
  let embed = client.embedBuilder(client, message.member.user, client.embeds.title, client.language.general.usage.replace("<usage>", validUsage), client.embeds.error_color);
  return embed;
}

const findRole = (guild, role) => {
  if(role == "") return undefined;

  return guild.roles.cache.find(r => r.name.toLowerCase().includes(`${role}`.toLowerCase())) || guild.roles.cache.get(role);
}

const hasRole = (client, guild, member, roles, checkEmpty = false) => {
  if(checkEmpty == true && roles.length == 0) return true;

  let arr = roles.map((x, i) => {
    let findPerm = client.utils.findRole(guild, `${x}`);
    if(!findPerm) return false;
    if(member.roles.cache.has(findPerm.id)) return true;

    return false;
  });
  if(checkEmpty == true && arr.length == 0) return true;

  return arr.includes(true) ? true : false;
}

const hasPermissions = (message, member, permList) => {
  if(permList.length == 0) return true;
  
  let userPerms = [];
  permList.forEach((perm) => {
    if(!Discord.PermissionFlagsBits[perm]) return userPerms.push(true);
    if(!message.channel.permissionsFor(member).has(perm)) return userPerms.push(false);
    else return userPerms.push(true);
  });

  return userPerms.includes(true) ? true : false;
}

const filesCheck = () => {
  if(!fs.existsSync('./logs')) {
    fs.mkdir('./logs', function(err) {
      if(err) sendError("Couldn't create folder (logs)");
      sendInfo("Folder (logs) doesn't exist, creating it.");
    });
  }
  const dateStr = new Date().toISOString().split('T')[0];
  if(!fs.existsSync(`./logs/info-${dateStr}.txt`)) {
    fs.open(`./logs/info-${dateStr}.txt`, 'w', function(err, file) {
      if(err) sendError(`Couldn't create file (logs/info-${dateStr}.txt)`);
      sendInfo(`File (logs/info-${dateStr}.txt) doesn't exist, creating it.`);
    });
  }
  if(!fs.existsSync(`./logs/errors-${dateStr}.txt`)) {
    fs.open(`./logs/errors-${dateStr}.txt`, 'w', function(err, file) {
      if(err) sendError(`Couldn't create file (logs/errors-${dateStr}.txt)`);
      sendInfo(`File (logs/errors-${dateStr}.txt) doesn't exist, creating it.`);
    });
  }
  if(!fs.existsSync('./transcripts')) {
    fs.mkdir('./transcripts', function(err) {
      if(err) sendError("Couldn't create folder (transcripts)");
      sendInfo("Folder (transcripts) doesn't exist, creating it.");
    })
  }
  if(!fs.existsSync('./products')) {
    fs.mkdir('./products', function(err) {
      if(err) sendError("Couldn't create folder (products)");
      sendInfo("Folder (products) doesn't exist, creating it.");
    })
  }
}

const generateTranscript = async (client, channel, msgs, ticket, save = true) => {
  let attachSize = 0;
  let htmlContainer = "";
  let ticketData = await client.database.ticketsData().get(`${channel.id}.ticketData`);
  let ticketOwner = client.users.cache.get(ticketData?.owner) || "n/a";
  let data = await fs.readFileSync('./data/template.html', {
    encoding: 'utf-8'
  });
  if(save == true) {
    await fs.writeFileSync(`transcripts/ticket-${ticket}.html`, data);
  } else {
    htmlContainer += data;
  }

  let guildElement = document.createElement('div');

  let guildNameEl = document.createElement("span");
  let guildText = document.createTextNode(channel.guild.name);

  let openEl = document.createElement("span");
  let openText = document.createTextNode(language.ticket.creation + '' + new Date(parseInt(ticketData?.openedTimestamp || new Date().getTime())).toLocaleString("en-GB") || 'N/A')
  openEl.appendChild(openText);
  openEl.style = `display: flex; padding-top: 15px; font-size: 15px;`

  let closeEl = document.createElement("span");
  let closeText = document.createTextNode(language.ticket.closing + '' + new Date().toLocaleString("en-GB") || 'N/A');
  if(save == false) closeText = document.createTextNode('Current Time' + new Date().toLocaleString("en-GB") || 'N/A')
  closeEl.appendChild(closeText);
  closeEl.style = `display: flex; padding-top: 5px; font-size: 15px;`

  guildNameEl.appendChild(guildText);
  guildNameEl.appendChild(openEl)
  guildNameEl.appendChild(closeEl)
  guildNameEl.style = `margin-left: 43px`
  guildNameEl.style = `margin-top: 45px`

  let guildImg = document.createElement('img');
  guildImg.setAttribute('src', channel.guild.iconURL());
  guildImg.setAttribute('width', '128');
  guildImg.className = "guild-image";
  guildElement.appendChild(guildImg);
  guildElement.appendChild(guildNameEl);
  guildElement.style = "display: flex";
  guildElement.setAttribute("transcript-user-id", ticketData?.owner);
  guildElement.setAttribute("transcript-user-username", ticketOwner);
  if(save == true) {
    await fs.appendFileSync(`transcripts/ticket-${ticket}.html`, guildElement.outerHTML, (err) => {
      if(err) console.log(err)
    });
  } else {
    htmlContainer += guildElement.outerHTML;
  }

  for(const msg of msgs) {
    let parentContainer = document.createElement("div");
    parentContainer.className = "parent-container";

    let avatarDiv = document.createElement("div");
    avatarDiv.className = "avatar-container";
    let img = document.createElement('img');
    img.setAttribute('src', msg.author.displayAvatarURL());
    img.className = "avatar";
    avatarDiv.appendChild(img);

    parentContainer.appendChild(avatarDiv);

    let messageContainer = document.createElement('div');
    messageContainer.className = "message-container";

    let nameElement = document.createElement("span");
    let name = document.createTextNode(`${msg.author.username} `)
    let dateSpan = document.createElement("span");
    let dateText = document.createTextNode(`${msg.createdAt.toLocaleString("en-GB")}`)
    dateSpan.appendChild(dateText)
    dateSpan.style = `font-size: 12px; color: #c4c4c4;`
    nameElement.appendChild(name);
    nameElement.appendChild(dateSpan)
    nameElement.style = `padding-bottom: 10px`
    messageContainer.append(nameElement);

    let msgNode = document.createElement('span');
    if(msg.content && msg.type != Discord.MessageType.ThreadCreated) 
      msgNode.innerHTML = replaceFormatting(channel.guild, msg.content);

    if(msg.type == Discord.MessageType.ThreadCreated && msg.hasThread) {
      let answersCollapseNode = document.createElement('div');
      let answersListNode = document.createElement('div');
      answersListNode.classList.add("collapse-panel");
      
      let answersToggle = document.createElement('button');
      answersToggle.textContent = language.ticket.answers_thread_name;
      answersToggle.classList.add('collapse-button');
      
      answersToggle.setAttribute("onclick", "toggleAnswers()");

      answersCollapseNode.append(answersToggle);

      let messageCollection = new Discord.Collection();
      let channelMessages = await msg.thread.messages.fetch({ limit: 100 });
    
      messageCollection = messageCollection.concat(channelMessages);
    
      while(channelMessages.size === 100) {
        let lastMessageId = channelMessages.lastKey();
        channelMessages = await msg.thread.messages.fetch({ limit: 100, before: lastMessageId });
        if(channelMessages) messageCollection = messageCollection.concat(channelMessages);
      }
      
      let threadMessages = [...messageCollection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)

      for (const tMsg of threadMessages) {
        const tContainer = document.createElement('div');
        tContainer.style.marginBottom = '8px';

        const tHeader = document.createElement('div');
        tHeader.style.fontSize = '12px';
        tHeader.style.color = '#c4c4c4';
        tHeader.textContent = `${tMsg.author.username} • ${tMsg.createdAt.toLocaleString("en-GB")}`;
        tContainer.appendChild(tHeader);

        if(tMsg.content) {
          const answerText = document.createElement('span');
          answerText.innerHTML = replaceFormatting(msg.guild, tMsg.content);
          answerText.style.marginBottom = 0;
          answerText.style.marginTop = 0;
          tContainer.appendChild(answerText);
        }

        // Render embeds inside thread messages (questions are sent as embeds)
        if(tMsg.embeds && tMsg.embeds[0]) {
          const rawEmbed = tMsg.embeds[0];
          const ed = rawEmbed.data ? rawEmbed.data : rawEmbed;
          let fields = [];
          if(ed.fields && ed.fields.length > 0) {
            for (let i = 0; i < ed.fields.length; i++) {
              fields.push(`
                <b><font size="+1">${ed.fields[i].name}</font></b><br>${replaceFormatting(msg.guild, ed.fields[i].value)}<br>`
              );
            }
          }
          let msgEmbed = ed;
          let embedNode = document.createElement("div");
          embedNode.className = "embed";

          let colorNode = document.createElement("div");
          const dataColor = msgEmbed.color || msgEmbed.embed?.color || 0;
          const formatColor = Number(dataColor || 0).toString(16);

          colorNode.className = "embed-color";
          colorNode.style = `background-color: #${`${dataColor}`.length == 3 ? `0000${formatColor}` : formatColor}`;
          embedNode.appendChild(colorNode);

          let embedContent = document.createElement("div");
          embedContent.className = "embed-content";

          let titleNode = document.createElement("span");
          titleNode.className = "embed-title";
          titleNode.innerHTML = msgEmbed.title || (msgEmbed.author && msgEmbed.author.name) || " ";
          embedContent.appendChild(titleNode);

          if(msgEmbed.fields) {
            if(!msgEmbed.description) msgEmbed.description = "";
            let descNode = document.createElement("span");
            descNode.className = "embed-description";
            descNode.innerHTML = replaceFormatting(channel.guild, msgEmbed.description) + "<br><br>" + fields.join("<br>");
            embedContent.appendChild(descNode);
          } else {
            if(!msgEmbed.description) msgEmbed.description = "";
            let descNode = document.createElement("span");
            descNode.className = "embed-description";
            descNode.innerHTML = replaceFormatting(channel.guild, msgEmbed.description);
            embedContent.appendChild(descNode);
          }

          if(msgEmbed.footer && msgEmbed.footer.text) {
            const footerNode = document.createElement("div");
            footerNode.classList.add("embed-footer");

            if(msgEmbed.footer.icon_url || (msgEmbed.footer && msgEmbed.footer.iconUrl)) {
              const footerIconNode = document.createElement("img");
              footerIconNode.classList.add("embed-footer-icon");
              footerIconNode.src = msgEmbed.footer.proxy_icon_url ?? msgEmbed.footer.icon_url ?? msgEmbed.footer.iconUrl;
              footerIconNode.alt = 'Footer icon';
              footerIconNode.loading = 'lazy';

              footerNode.appendChild(footerIconNode);
            }

            const footerTextNode = document.createElement("span");
            footerTextNode.classList.add("embed-footer-text");
            footerTextNode.textContent = msgEmbed.timestamp ? `${msgEmbed.footer.text} • ${new Date(msgEmbed.timestamp).toLocaleString()}` : msgEmbed.footer.text;
            
            footerNode.appendChild(footerTextNode);
            embedContent.appendChild(footerNode);
          }

          embedNode.appendChild(embedContent);

          if(msgEmbed.thumbnail) {
            const thumbnailNode = document.createElement("div");
            thumbnailNode.classList.add("embed-thumbnail-container");

            const thumbnailNodeLink = document.createElement("a");
            thumbnailNodeLink.classList.add("embed-thumbnail-link");
            thumbnailNodeLink.href = msgEmbed.thumbnail.proxy_url ?? msgEmbed.thumbnail.url ?? msgEmbed.thumbnail;

            const thumbnailNodeImage = document.createElement("img");
            thumbnailNodeImage.classList.add("embed-thumbnail");
            thumbnailNodeImage.src = msgEmbed.thumbnail.proxy_url ?? msgEmbed.thumbnail.url ?? msgEmbed.thumbnail;
            thumbnailNodeImage.loading = "lazy";
            thumbnailNodeImage.alt = "Embed Thumbnail";

            thumbnailNodeLink.appendChild(thumbnailNodeImage);
            thumbnailNode.appendChild(thumbnailNodeLink);

            embedNode.appendChild(thumbnailNode);
          }

          if(msgEmbed.image) {
            const imageNode = document.createElement("div");
            imageNode.classList.add("embed-image-container");

            const imageNodeLink = document.createElement("a");
            imageNodeLink.classList.add("embed-image-link");
            imageNodeLink.href = msgEmbed.image.proxy_url ?? msgEmbed.image.url ?? msgEmbed.image;

            const imageNodeImage = document.createElement("img");
            imageNodeImage.classList.add("embed-image");
            imageNodeImage.src = msgEmbed.image.proxy_url ?? msgEmbed.image.url ?? msgEmbed.image;
            imageNodeImage.alt = "Embed Image";
            imageNodeImage.loading = "lazy";

            imageNodeLink.appendChild(imageNodeImage);
            imageNode.appendChild(imageNodeLink);

            embedContent.appendChild(imageNode);
          }

          tContainer.appendChild(embedNode);
        }

        // Attachments in thread messages
        if(tMsg.attachments && tMsg.attachments.size > 0 && client.ticketsConfig.settings.save_images == true) {
          for (const attachment of Array.from(tMsg.attachments.values())) {
            const attDiv = document.createElement("div");
            attDiv.classList.add("chat-image");

            const attachmentType = (attachment.name ?? 'unknown.png')
              .split('.')
              .pop()
              .toLowerCase();

            const formats = ["png", "jpg", "jpeg", "webp", "gif"];
            if(formats.includes(attachmentType)) {
              const attLink = document.createElement("a");
              const attImg = document.createElement("img");
              attImg.classList.add("chat-media");
              if(client.ticketsConfig?.settings?.embed_images === true) {
                try {
                  const res = await fetch(attachment.proxy_url ?? attachment.url);
                  if(res && res.ok) {
                    const contentType = res.headers.get('content-type') || 'image/png';
                    const arrayBuffer = await res.arrayBuffer();
                    const dataUri = `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
                    attImg.src = dataUri;
                  } else {
                    attImg.src = attachment.proxy_url ?? attachment.url;
                  }
                } catch (e) {
                  attImg.src = attachment.proxy_url ?? attachment.url;
                }
              } else {
                attImg.src = attachment.proxy_url ?? attachment.url;
              }
              attImg.alt = "Transcript Image";
              attLink.appendChild(attImg);
              attDiv.appendChild(attLink);
              tContainer.appendChild(attDiv);
            }
          }
        }

        answersListNode.appendChild(tContainer);
      }

      answersCollapseNode.append(answersListNode);

      messageContainer.appendChild(answersCollapseNode);
    }

    if(msg.attachments && msg.attachments.size > 0 && client.ticketsConfig.settings.save_images == true) {
      for (const attachment of Array.from(msg.attachments.values())) {
        const attDiv = document.createElement("div");
        attDiv.classList.add("chat-image");

        const attachmentType = (attachment.name ?? 'unknown.png')
          .split('.')
          .pop()
          .toLowerCase();

        const formats = ["png", "jpg", "jpeg", "webp", "gif"];
        if(formats.includes(attachmentType)) {
          attachSize += attachment.size;
          const attLink = document.createElement("a");
          const attImg = document.createElement("img");

            attImg.classList.add("chat-media");
            if(client.ticketsConfig?.settings?.embed_images === true) {
              try {
                const res = await fetch(attachment.proxy_url ?? attachment.url);
                if(res && res.ok) {
                  const contentType = res.headers.get('content-type') || 'image/png';
                  const arrayBuffer = await res.arrayBuffer();
                  const dataUri = `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
                  attImg.src = dataUri;
                } else {
                  attImg.src = attachment.proxy_url ?? attachment.url;
                }
              } catch (e) {
                attImg.src = attachment.proxy_url ?? attachment.url;
              }
            } else {
              attImg.src = attachment.proxy_url ?? attachment.url;
            }

          attImg.alt = "Transcript Image";

          attLink.appendChild(attImg);
          attDiv.appendChild(attLink);

          msgNode.appendChild(attDiv)
        }
      }
    } else if(msg.attachments && msg.attachments.size > 0 && client.ticketsConfig.settings.save_images == false) {
      msgNode.append(`[ATTACHMENT]`);
    }

    messageContainer.appendChild(msgNode);
    
    if(msg.embeds && msg.embeds[0]) {
      const rawEmbed = msg.embeds[0];
      const ed = rawEmbed.data ? rawEmbed.data : rawEmbed;
      let fields = [];
      if(ed.fields && ed.fields.length > 0) {
        for (let i = 0; i < ed.fields.length; i++) {
          fields.push(`
            <b><font size="+1">${ed.fields[i].name}</font></b><br>${replaceFormatting(msg.guild, ed.fields[i].value)}<br>`
          );
        }
      }
      let msgEmbed = ed;
      let embedNode = document.createElement("div");
      embedNode.className = "embed";

      let colorNode = document.createElement("div");
      const dataColor = msgEmbed.color || msgEmbed.embed?.color || 0;
      const formatColor = Number(dataColor || 0).toString(16);

      colorNode.className = "embed-color";
      colorNode.style = `background-color: #${`${dataColor}`.length == 3 ? `0000${formatColor}` : formatColor}`;
      embedNode.appendChild(colorNode);

      let embedContent = document.createElement("div");
      embedContent.className = "embed-content";

      let titleNode = document.createElement("span");
      titleNode.className = "embed-title";
      titleNode.innerHTML = msgEmbed.title || (msgEmbed.author && msgEmbed.author.name) || " ";
      embedContent.appendChild(titleNode);

      if(msgEmbed.fields) {
        if(!msgEmbed.description) msgEmbed.description = "";
        let descNode = document.createElement("span");
        descNode.className = "embed-description";
        descNode.innerHTML = replaceFormatting(channel.guild, msgEmbed.description) + "<br><br>" + fields.join("<br>");
        embedContent.appendChild(descNode);
      } else {
        if(!msgEmbed.description) msgEmbed.description = "";
        let descNode = document.createElement("span");
        descNode.className = "embed-description";
        descNode.innerHTML = replaceFormatting(channel.guild, msgEmbed.description);
        embedContent.appendChild(descNode);
      }

      if(msgEmbed.footer && msgEmbed.footer.text) {
        const footerNode = document.createElement("div");
        footerNode.classList.add("embed-footer");

        if(msgEmbed.footer.icon_url || (msgEmbed.footer && msgEmbed.footer.iconUrl)) {
          const footerIconNode = document.createElement("img");
          footerIconNode.classList.add("embed-footer-icon");
          footerIconNode.src = msgEmbed.footer.proxy_icon_url ?? msgEmbed.footer.icon_url ?? msgEmbed.footer.iconUrl;
          footerIconNode.alt = 'Footer icon';
          footerIconNode.loading = 'lazy';

          footerNode.appendChild(footerIconNode);
        }

        const footerTextNode = document.createElement("span");
        footerTextNode.classList.add("embed-footer-text");
        footerTextNode.textContent = msgEmbed.timestamp ? `${msgEmbed.footer.text} • ${new Date(msgEmbed.timestamp).toLocaleString()}` : msgEmbed.footer.text;
        
        footerNode.appendChild(footerTextNode);
        embedContent.appendChild(footerNode);
      }

      embedNode.appendChild(embedContent);
      
      if(msgEmbed.thumbnail) {
        const thumbnailNode = document.createElement("div");
        thumbnailNode.classList.add("embed-thumbnail-container");

        const thumbnailNodeLink = document.createElement("a");
        thumbnailNodeLink.classList.add("embed-thumbnail-link");
        thumbnailNodeLink.href = msgEmbed.thumbnail.proxy_url ?? msgEmbed.thumbnail.url ?? msgEmbed.thumbnail;

        const thumbnailNodeImage = document.createElement("img");
        thumbnailNodeImage.classList.add("embed-thumbnail");
        thumbnailNodeImage.src = msgEmbed.thumbnail.proxy_url ?? msgEmbed.thumbnail.url ?? msgEmbed.thumbnail;
        thumbnailNodeImage.loading = "lazy";
        thumbnailNodeImage.alt = "Embed Thumbnail";

        thumbnailNodeLink.appendChild(thumbnailNodeImage);
        thumbnailNode.appendChild(thumbnailNodeLink);

        embedNode.appendChild(thumbnailNode);
      }

      if(msgEmbed.image) {
        const imageNode = document.createElement("div");
        imageNode.classList.add("embed-image-container");

        const imageNodeLink = document.createElement("a");
        imageNodeLink.classList.add("embed-image-link");
        imageNodeLink.href = msgEmbed.image.proxy_url ?? msgEmbed.image.url ?? msgEmbed.image;

        const imageNodeImage = document.createElement("img");
        imageNodeImage.classList.add("embed-image");
        imageNodeImage.src = msgEmbed.image.proxy_url ?? msgEmbed.image.url ?? msgEmbed.image;
        imageNodeImage.alt = "Embed Image";
        imageNodeImage.loading = "lazy";

        imageNodeLink.appendChild(imageNodeImage);
        imageNode.appendChild(imageNodeLink);

        embedContent.appendChild(imageNode);
    } 

      messageContainer.append(embedNode);
    }

    parentContainer.appendChild(messageContainer);
    if(save == true) {
      await fs.appendFileSync(`transcripts/ticket-${ticket}.html`, parentContainer.outerHTML, (err) => {
        if(err) console.log(err)
      });
    } else {
      htmlContainer += parentContainer.outerHTML;
    };
  };
  if(attachSize >= 6815744) {
    client.ticketsConfig.settings.save_images = false;
    return await generateTranscript(client, channel, msgs, ticket, save).then(() => {
      client.ticketsConfig.settings.save_images = true;
    });
  }
  if(save == false) return htmlContainer;
}

const channelRoleCheck = (client, usedGuild, foundWarn) => {
  const config = client.config;
  if(client.ticketsConfig?.settings?.separate_roles?.enabled == true && client.categories.length > 0) {
    for (let i = 0; i < client.categories.length; i++) {
      if(!client.categories[i].roles) continue;
      if(client.categories[i].roles.length == 0) continue;
      let findRole = client.categories[i].roles.map((x) => client.utils.findRole(usedGuild, x));

      if(findRole.includes("undefined") || findRole.includes(undefined)) {
        client.utils.sendWarn(`One or more Category Roles (categories.${client.categories[i].id}.roles) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Category Role");
        break;
      }
    }
  }
  if(client.config.roles.bypass.cooldown.length > 0) {
    for (let i = 0; i > client.config.roles.bypass.cooldown.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.bypass.cooldown[i]);
      if(!findRole) {
        client.utils.sendWarn(`One or more Cooldown Bypass Roles (roles.bypass.cooldown - ${client.config.roles.bypass.cooldown[i]}) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Cooldown Bypass Role(s)");
        break;
      }
    }
  }
  if(client.config.roles.bypass.permission.length > 0) {
    for (let i = 0; i > client.config.roles.bypass.permission.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.bypass.permission[i]);
      if(!findRole) {
        client.utils.sendWarn(`One or more Permission Bypass Roles (roles.bypass.permission - ${client.config.roles.bypass.permission[i]}) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Permission Bypass Role(s)");
        break;
      }
    }
  }
  // Removed billing-related validation checks (Sellix, Tebex, CraftingStore)
  
  if(config.channels?.transcripts && config.channels.transcripts != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.transcripts);
    if(!findChannel) {
      client.utils.sendWarn("Transcripts Channel Name/ID (transcripts) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Transcripts Channel");
    }
  }
  if(client.autoAnnounceConfig?.channel && client.autoAnnounceConfig.channel != "") {
    let findChannel = client.utils.findChannel(usedGuild, client.autoAnnounceConfig.channel);
    if(!findChannel) {
      client.utils.sendWarn("Auto Announcements Channel Name/ID (announce) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Auto Announcements Channel");
    }
  }
  if(config.channels?.reviews && config.channels.reviews != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.reviews);
    if(!findChannel) {
      client.utils.sendWarn("Reviews Channel Name/ID (reviews) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Reviews Channel");
    }
  }
  if(!Array.isArray(client.config.roles.staff)) {
    client.utils.sendWarn("Config field for Staff Roles (roles.staff) is not of proper type (Array).");
    foundWarn.push("Invalid Staff Roles Config Field Type");
  }
  if(!Array.isArray(client.config.roles.blacklist)) {
    client.utils.sendWarn("Config field for Blacklisted Users (roles.blacklist) is not of proper type (Array).");
    foundWarn.push("Invalid Blacklisted Users Config Field Type");
  }
  if(!Array.isArray(client.config.roles.bypass.cooldown)) {
    client.utils.sendWarn("Config field for Cooldown Bypass (roles.bypass.cooldown) is not of proper type (Array).");
    foundWarn.push("Invalid Cooldown Bypass Config Field Type");
  }
  if(!Array.isArray(client.config.roles.bypass.permission)) {
    client.utils.sendWarn("Config field for Permission Bypass (roles.bypass.permission) is not of proper type (Array).");
    foundWarn.push("Invalid Permission Bypass Config Field Type");
  }
}

const ticketUsername = (user) => {
  const regex = /[^a-z0-9]+/g
  if(!user)
    return 'user';
  const format = user.username.toLowerCase().replace(regex, "");
  return format == "" ? `${user.id}` : format;
}

const ticketPlaceholders = (string, user, ticket) => {
  if(ticket < 10) ticket = "000" + ticket;
  else if(ticket >= 10 && ticket < 100) ticket = "00" + ticket
  else if(ticket >= 100 && ticket < 1000) ticket = "0" + ticket
  else if(ticket >= 1000) ticket = ticket;

  return string.toLowerCase().replace("<username>", ticketUsername(user)).replace("<ticket>", ticket);
}

// Removed downloadProduct function - billing/products system removed

const isTicket = async(client, channel) => {
  const ticketData = await client.database.ticketsData().get(`${channel.id}.ticketData`);
  return ticketData != null && ticketData != undefined ? true : false;
}

const databaseChecks = async(client, guildData) => {
  sendInfo("Doing some database tasks, this is usual and will take few seconds, don't worry.");

  if(client.config.general.database.type == "mongo") {
    //== Add Transcripts to Cache for faster loading on Dashboard ==//
    const allTranscripts = (await client.database.transcriptsData().all());
    if(allTranscripts.length > 0) {
      allTranscripts.forEach((t) => {
        client.transcriptsCache.set(t.id, {
          id: t.id,
          owner: t.owner,
          code: t.value?.code ?? t.code,
          date: t.date
        });
      });
    }

    //== Add Counters to Cache ==//
    client.otherCache.set("counters", {
      openedChannel: guildData?.counters?.openedChannel,
      totalChannel: guildData?.counters?.totalChannel,
      claimedChannel: guildData?.counters?.claimedChannel
    });

    //== Handle invalid Tickets from Database ==//
    // If a ticket entry exists in DB but the channel no longer exists, mark it as closed
    const allTickets = (await client.database.ticketsData().all());
    for (const t of allTickets) {
      try {
        const channel = await client.channels.cache.get(t.id);
        if(!channel) {
          // preserve existing ticketData but mark it as closed to keep historical info
          const existing = t.value?.ticketData || (t.value || {});
          existing.closed = true;
          existing.closedAt = new Date().toISOString();
          existing.closedBy = existing.closedBy || 'system';
          await client.database.ticketsData().set(`${t.id}.ticketData`, existing);
          // log the action
          await client.utils.serverLogs(client, {
            date: new Date().toLocaleString("en-GB"),
            author_id: null,
            author: null,
            user_id: null,
            user: null,
            channel_id: `${t.id}`,
            channel_name: `deleted-channel-${t.id}`,
            ticketId: existing.id || null,
            message: `ticket_marked_closed_missing_channel`
          });
        }
      } catch (e) {
        // ignore single failures
      }
    }

    //== Remove Tickets from User if there is no channel ==//
    const allUsers = (await client.database.usersData().all());

    allUsers.forEach(async(usr) => {
      const usrId = usr.id;
      usr = usr.value ?? usr;

      if(usr.choosingCategory == true)
        await client.database.usersData().set(`${usrId}.choosingCategory`, false);
      
      if(usr?.tickets && usr?.tickets?.length > 0) {
        usr.tickets.forEach(async(u) => {
          const channel = await client.channels.cache.get(u.channel);
          if(!channel) {
            usr.tickets = usr.tickets.filter((x) => x.channel != u.channel);
              await client.database.usersData().set(`${usrId}.tickets`, usr.tickets);
          }
        });
      }
    });
  }
}

const canEditName = async(guild, channel) => {
  let canEdit = true;
  await guild.fetchAuditLogs({ type: Discord.AuditLogEvent.ChannelUpdate }).then((audit) => {
    let aLogs = audit.entries.filter((x) => x.target?.id == channel.id)
      .map((x) => x?.changes.find((c) => c?.key == "name") ? x?.createdTimestamp : undefined).filter(Boolean);
    if(aLogs.length > 0) {
      let passedTen = new Date() - new Date(aLogs[0]);
      if(passedTen > 660_000) canEdit = true;
      else canEdit = false;
    }
  });

  return canEdit;
}

// Removed commissionAccess function - billing functionality removed

// Removed priceWithTax function - billing functionality removed

const getImage = async(url) => {
  return await fetch(url).then(async(res) => {
    const buffer = await res.arrayBuffer();
    const stringifiedBuffer = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type");
    return `data:image/${contentType};base64,${stringifiedBuffer}`;
  }).catch(console.log);
}

const replaceFormatting = (guild, text) => {
  return text.replaceAll(/\*\*(.+)\*\*/g, '<b>$1</b>')
    .replaceAll(/^\*\s(.+)/gm, ' • $1')
    .replaceAll(/^###\s(.+)/g, '<h3 style="margin-bottom: 0;">$1</h3>')
    .replaceAll(/^##\s(.+)/g, '<h2 style="margin-bottom: 0;">$1</h2>')
    .replaceAll(/^#\s(.+)/g, '<h1 style="margin-bottom: 0;">$1</h1>')
    .replaceAll(/\*\*\*(.+)\*\*\*/g, "<i><b>$1</b></i>")
    .replaceAll(/\*(.\n+)\*/g, "<i>$1</i>")
    .replaceAll(/```(.+?)```/gs, (code) => `<div class="codeblock" style="white-space: pre-wrap; font-size: 11px; margin-top: 3px">${code.slice(3, -3)}</div>`)
    .replaceAll(/\n/g, "<br>")
    .replaceAll(/<@[!]?\d{18}>/g, (user) => guild.members.cache.get(user.match(/\d+/) ? user.match(/\d+/)[0] : '')?.user.username || 'invalid-user')
    .replaceAll(/<@&\d{18}>/g, (role) => guild.roles.cache.get(role.match(/\d+/) ? role.match(/\d+/)[0] : '')?.name || 'deleted-role')
    .replaceAll(/<#\d{18}>/g, (channel) => guild.channels.cache.get(channel.match(/\d+/) ? channel.match(/\d+/)[0] : '')?.name || 'deleted-channel')
    .replaceAll(/<:(.+):(\d+)>/g, (a, b, c) => `<img src="https://cdn.discordapp.com/emojis/${c}.webp?size=96&quality=lossless" width="${(/^<:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}" height="${(/^<:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}">`)
    .replaceAll(/<a:(.+):(\d+)>/g, (a, b, c) => `<img src="https://cdn.discordapp.com/emojis/${c}.gif?size=96&quality=lossless" width="${(/^<a:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}" height="${(/^<a:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}">`);
}

const dashboardFormat = (text) => {
  if(!text) text = "";
  return text.replaceAll(/\*{2}(.*?)\*{2}/g, '<span class="fw-bold">$1</span>');
}

const isUnavailable = async(client) => {
  try {
    const timezone = client.config.general.timezone;
    const availability = client.ticketsConfig.settings.availability;
    
    // Create abort controller with 5 second timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const fetchTimezone = await fetch(`https://timeapi.io/api/Time/current/zone?timeZone=${timezone}`, {
      signal: controller.signal
    })
      .then(async(res) => await res.json())
      .catch((err) => {
        console.log("Failed to fetch timezone from timeapi.io:", err.message);
        return null;
      })
      .finally(() => clearTimeout(timeout));
    
    // If API fails, use local time as fallback
    if(!fetchTimezone || !fetchTimezone.time) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const localTime = `${hours}:${minutes}`;
      
      const early = localTime < availability.split("-")[0];
      const late = localTime > availability.split("-")[1];
      
      return {
        unavailable: early || late,
        start: availability.split("-")[0],
        end: availability.split("-")[1] 
      }
    }
    
    const early = fetchTimezone.time < availability.split("-")[0];
    const late = fetchTimezone.time > availability.split("-")[1];

    return {
      unavailable: early || late,
      start: availability.split("-")[0],
      end: availability.split("-")[1] 
    }
  } catch(error) {
    console.log("Error in isUnavailable:", error.message);
    // Return available by default if there's an error
    return {
      unavailable: false,
      start: "00:00",
      end: "23:59" 
    }
  }
}

const serverLogs = async(client, object) => {
  let serverLogs = await client.database.guildData().get(`${client.config.general.guild}.serverLogs`) || [];
  if(config.server.dashboard.save_logs == true) {
    if(serverLogs.length >= 120) {
      serverLogs = serverLogs.slice(0, 120);
      await client.database.guildData().set(`${client.config.general.guild}.serverLogs`, serverLogs);
    }
    await client.database.guildData().push(`${client.config.general.guild}.serverLogs`, object);
  }
}

const dashboardLogs = async(client, object) => {
  let dashboardLogs = await client.database.guildData().get(`${client.config.general.guild}.dashboardLogs`) || [];
  if(config.server.dashboard.save_logs == true) {
    if(dashboardLogs.length >= 120) {
      dashboardLogs = dashboardLogs.slice(0, 120);
      await client.database.guildData().set(`${client.config.general.guild}.dashboardLogs`, dashboardLogs);
    }
    await client.database.guildData().push(`${client.config.general.guild}.dashboardLogs`, object);
  }
}

const colorFormatConvert = (col) => {
  const colors = {
    "Default": "#000000",
    "Aqua": "#1ABC9C",
    "DarkAqua": "#11806A",
    "Green": "#57F287",
    "DarkGreen": "#1F8B4C",
    "Blue": "#3498DB",
    "DarkBlue": "#206694",
    "Purple": "#9B59B6",
    "DarkPurple": "#71368A",
    "LuminousVividPink": "#E91E63",
    "DarkVividPink": "#AD1457",
    "Gold": "#F1C40F",
    "DarkGold": "#C27C0E",
    "Orange": "#E67E22",
    "DarkOrange": "#A84300",
    "Red": "#ED4245",
    "DarkRed": "#992D22",
    "Grey": "#95A5A6",
    "DarkGrey": "#979C9F",
    "DarkerGrey": "#7F8C8D",
    "LightGrey": "#BCC0C0",
    "Navy": "#34495E",
    "DarkNavy": "#2C3E50",
    "Yellow": "#FFFF00"
  };

  return colors[col] ? colors[col] : col;
}

const sendPanelDashboard = (client, channelToSend, category) => {
  let separatedPanel = category.length >= 1 && !category.includes("general");
  const listOfCategories = client.categories;

  if(category.length == 0)
    category = ["general"];

  let findCategory = [];
  for(const arg of category) {
    findCategory.push(listOfCategories.map((c) => {
      return ticketCategoryById(c, arg);
    }).filter(Boolean)?.[0]);
  }

  console.log('typeeee', client.ticketsConfig.settings.panel_type)
  console.log('find cateee', findCategory)


  const chunks = [];
  let componentList = [],
    buttonList = [];
  if(client.ticketsConfig.settings.panel_type == "BUTTONS") {
    for (let i = 0; i < findCategory.length; i += client.ticketsConfig.settings.panel_buttons_line) {
      const chunk = findCategory.slice(i, i + client.ticketsConfig.settings.panel_buttons_line);
      chunks.push(chunk);
    }

    for (let i = 0; i < chunks.length; i++) {
      buttonList.push(
        chunks[i].map((x) => {
          return new Discord.ButtonBuilder()
            .setLabel(separatedPanel == true ? `${x.name}` : client.language.buttons.create)
            .setEmoji(separatedPanel == true ? `${x.emoji || {}}` : config.emojis.create || {})
            .setStyle(separatedPanel == true ? Discord.ButtonStyle[x.button_color] : Discord.ButtonStyle.Primary)
            .setCustomId(separatedPanel == true ? `createTicket_${x.id}` : 'createTicket');
        })
      );
    }
  
    buttonList.forEach((b) => {
      componentList.push(new Discord.ActionRowBuilder().addComponents(b.map((x) => x)));
    });
  }

  const options = [];
  if(separatedPanel == true && client.ticketsConfig.settings.panel_type == "SELECT_MENU") {
    findCategory.forEach((c) => {
      options.push({
        label: c.name,
        value: c.id, 
        emoji: c.emoji || {},
        description: c.placeholder != "" ? c.placeholder : ""
      });
    })
  } else {
    client.categories.forEach(c => {
      options.push({
        label: c.name,
        value: c.id, 
        emoji: c.emoji || {},
        description: c.placeholder != "" ? c.placeholder : ""
      });
    });
  }

  let sMenu = new Discord.StringSelectMenuBuilder()
    .setCustomId("noSelection_panel")
    .setPlaceholder(client.ticketsConfig.settings.select_placeholder)
    .addOptions(options);

  let row = new Discord.ActionRowBuilder()
    .addComponents(sMenu);

  let embed = new Discord.EmbedBuilder();
  if(findCategory.length >= 1 && separatedPanel == true) {
    embed.setTitle(findCategory[0].panel.title || null)
      .setDescription(findCategory[0].panel.description || null)
      .setImage(findCategory[0].panel.image || null)
      .setThumbnail(findCategory[0].panel.thumbnail || null)
      .setColor(`${findCategory[0].panel.color}`);
  } else {
    embed.setTitle(client.embeds.panel_title)
      .setDescription(client.embeds.panel_message)
      .setColor(client.embeds.general_color);

    if(client.embeds.panel.image.enabled == true && client.embeds.panel.image.url != "") embed.setImage(client.embeds.panel.image.url);
    if(client.embeds.panel.thumbnail.enabled == true && client.embeds.panel.thumbnail.url != "") embed.setThumbnail(client.embeds.panel.thumbnail.url);
  }

  if(client.embeds.panel.footer) embed.setFooter({ text: client.embeds.panel.footer, iconURL: client.user.displayAvatarURL() }).setTimestamp();

  const panelChannel = client.channels.cache.get(channelToSend);
  if(panelChannel) panelChannel.send({ embeds: [embed], components: client.ticketsConfig.settings.panel_type == "SELECT_MENU" ? [row] : componentList });
}

const ticketCategoryById = (category, toSearch) => {
  const subSearch = category.subcategories?.find((sc) => sc.id.toLowerCase() == toSearch.toLowerCase());
  if(category.id.toLowerCase() == toSearch.toLowerCase())
    return category;
  else if(subSearch)
    return subSearch;
}

const findTicketParent = (guild, category, fallback = []) => {
  let mainCat = findChannel(guild, category);
  const findFallback = fallback.find((f) => findChannel(guild, f)?.children?.cache?.size < 50);
  if(mainCat && mainCat?.children?.cache?.size < 50)
    return mainCat;
  else if(findFallback) 
    return findFallback;
  else return mainCat;
}

module.exports = {
  formatTime,
  capitalizeFirstLetter,
  commandsList,
  pushReview,
  generateId,
  updateStats,
  sendError,
  sendInfo,
  findChannel,
  usage,
  findRole,
  channelRoleCheck,
  hasRole,
  ticketUsername,
  sendWarn,
  filesCheck,
  isTicket,
  hasPermissions,
  generateTranscript,
  ticketPlaceholders,
  canEditName,
  databaseChecks,
  isUnavailable,
  dashboardFormat,
  serverLogs,
  colorFormatConvert,
  dashboardLogs,
  sendPanelDashboard,
  ticketCategoryById,
  findTicketParent
}