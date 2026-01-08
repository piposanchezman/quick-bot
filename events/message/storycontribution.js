const Event = require("../../structures/Events.js");
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const yaml = require("yaml");
const path = require("path");

class StoryContributionEvent extends Event {
  constructor(client, file) {
    super(client, file, { name: "messageCreate" });
    this.channelStates = new Map();
    this.cooldowns = new Map();
    this.loadStoryStates();
  }

  async run(message) {
    if (message.author.bot) return;
    const config = this.loadCollaborativeStoryConfig();
    if (!config || !config.enabled) return;
    if (!config.story_channels || !config.story_channels.includes(message.channel.id)) return;
    await this.processStoryContribution(message, config);
  }

  async processStoryContribution(message, config) {
    const channelId = message.channel.id;
    const userId = message.author.id;
    const messages = this.client.embeds.collaborativestory.messages;

    const cooldownKey = `${channelId}-${userId}`;
    if (this.cooldowns.has(cooldownKey)) {
      const expirationTime = this.cooldowns.get(cooldownKey) + config.cooldown;
      if (Date.now() < expirationTime) {
        const timeLeft = (expirationTime - Date.now()) / 1000;
        await message.reply(messages.cooldown_active.replace('{time}', timeLeft.toFixed(1)))
          .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        await message.delete().catch(() => {});
        return;
      }
    }

    let state = this.channelStates.get(channelId);
    if (!state) {
      state = { active: false, story: [], participants: new Map(), lastContributor: null, waitingIA: false, startedAt: null, userCountSinceAI: 0 };
      this.channelStates.set(channelId, state);
    }

    if (!state.active) return;

    const content = message.content.trim();
    if (content.length < (config.users && config.users.min_chars)) {
      const min = (config.users && config.users.min_chars) || 0;
      await message.reply(messages.message_too_short.replace('{min}', min)).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
      await message.delete().catch(() => {});
      return;
    }
    if (content.length > (config.users && config.users.max_chars)) {
      const max = (config.users && config.users.max_chars) || 0;
      await message.reply(messages.message_too_long.replace('{max}', max)).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
      await message.delete().catch(() => {});
      return;
    }

    state.story.push({ author: userId, authorName: message.author.username, content: content, timestamp: Date.now() });

    // Asegurar que el contador sea numérico
    const participantCount = Number(state.participants.get(userId) || 0);
    state.participants.set(userId, participantCount + 1);
    state.lastContributor = userId;

    

    this.cooldowns.set(cooldownKey, Date.now());

    // Contador de contribuciones de usuarios desde la última respuesta de la IA
    state.userCountSinceAI = Number(state.userCountSinceAI || 0) + 1;

    

    // No reactions per user request

    // Si alcanza el umbral, resetear contador y pedir a la IA
    const threshold = config.user_contributions_to_trigger || 3;
    if (config.api_key && config.model && state.userCountSinceAI >= threshold) {
      state.userCountSinceAI = 0;
      this.saveStoryState(channelId, state);
      console.log(`[STORY] threshold reached (${threshold}) — generating AI response`);
      await this.generateAIResponse(message, state, config);
      return;
    }

    this.saveStoryState(channelId, state);
  }

  loadCollaborativeStoryConfig() {
    try {
      const configPath = path.join(__dirname, '../../configs/collaborativeStory.yml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      return yaml.parse(fileContents);
    } catch (error) {
      return null;
    }
  }

  loadStoryStates() {
    try {
      const dir = path.join(__dirname, '../../data/collaborativeStory');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return;
      }

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      files.forEach(file => {
        try {
          const filePath = path.join(dir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const channelId = file.replace('.json', '');
          const participants = new Map(Object.entries(data.participants || {}).map(([k, v]) => [k, Number(v)]));
          this.channelStates.set(channelId, { ...data, participants });
        } catch (error) {
          // ignore
        }
      });
    } catch (error) {
      // ignore
    }
  }

  saveStoryState(channelId, state) {
    try {
      const storiesDir = path.join(__dirname, '../../data/collaborativeStory');
      if (!fs.existsSync(storiesDir)) fs.mkdirSync(storiesDir, { recursive: true });
      const filePath = path.join(storiesDir, `${channelId}.json`);
      const saveData = { ...state, participants: Object.fromEntries(state.participants) };
      fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2));
    } catch (error) {
      // ignore
    }
  }

  async generateAIResponse(message, state, config) {
    const maxRetries = 3; let aiMessage = null;
    // prevent concurrent AI generation
    if (state.waitingIA) return;
    state.waitingIA = true;
    try { await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SEND_MESSAGES: false }); } catch (e) { }
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) await new Promise(r => setTimeout(r, 2000));
          await message.channel.sendTyping();
          const apiUrl = config.api_url || 'https://openrouter.ai/api/v1/chat/completions';
          const contCfg = config.continuation || {};
          const contTone = contCfg.tone || 'neutral';
          const contMaxChars = contCfg.max_chars || (config.users && config.users.max_chars) || 300;
          const contMaxTokens = contCfg.max_tokens || 300;
          const contTemp = typeof contCfg.temperature === 'number' ? contCfg.temperature : 0.8;

          const recentStory = state.story.slice(-(config.max_context_messages || 20));

          // Build chat-style messages so the model can use assistant/user roles for context
          const systemPrompt = `Eres un narrador creativo que continúa historias colaborativas. Estilo: ${contTone}. Lee el contexto provisto y continúa la historia de forma coherente, respetando nombres, hechos y relaciones previas. Mantén la voz narrativa consistente y usa un máximo de ${contMaxChars} caracteres en la continuación. No introduzcas personajes nuevos sin justificación.`;

          const messagesPayload = [{ role: 'system', content: systemPrompt }];
          for (const entry of recentStory) {
            const role = (entry.author === 'AI') ? 'assistant' : 'user';
            messagesPayload.push({ role, content: `${entry.authorName}: ${entry.content}` });
          }
          // Final user prompt asking to continue, with constraints
          messagesPayload.push({ role: 'user', content: `Continúa la historia a partir del contexto anterior. Escribe solo la continuación (sin prefacio), con un máximo de ${contMaxChars} caracteres. Mantén coherencia con personajes, lugares y eventos previos.` });

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.api_key}` },
            body: JSON.stringify({ model: config.model, messages: messagesPayload, max_tokens: contMaxTokens, temperature: contTemp })
          });
          if (!response.ok) { if (response.status === 429 && attempt < maxRetries) continue; break; }
          const data = await response.json();
          aiMessage = data.choices?.[0]?.message?.content?.trim();
          if (aiMessage) {
            // Normalizar espacios y comillas al inicio/fin
            aiMessage = aiMessage.replace(/^['"\s]+|['"\s]+$/g, '').trim();

            // Enforce max characters requested by config (contMaxChars).
            try {
              const maxChars = Number(contMaxChars) || 0;
              if (maxChars > 0 && aiMessage.length > maxChars) {
                let truncated = aiMessage.slice(0, maxChars);
                const lastDot = truncated.lastIndexOf('.');
                const lastEx = truncated.lastIndexOf('!');
                const lastQ = truncated.lastIndexOf('?');
                const lastPunc = Math.max(lastDot, lastEx, lastQ);
                if (lastPunc > -1 && lastPunc > Math.floor(maxChars * 0.25)) {
                  truncated = truncated.slice(0, lastPunc + 1).trim();
                } else {
                  const lastSpace = truncated.lastIndexOf(' ');
                  if (lastSpace > 0) truncated = truncated.slice(0, lastSpace).trim();
                  if (!/[.!?]$/.test(truncated)) truncated = `${truncated}.`;
                }

                aiMessage = truncated;
              } else {
                if (!/[.!?]$/.test(aiMessage)) {
                  const lastDot = aiMessage.lastIndexOf('.');
                  const lastEx = aiMessage.lastIndexOf('!');
                  const lastQ = aiMessage.lastIndexOf('?');
                  const lastPunc = Math.max(lastDot, lastEx, lastQ);
                  if (lastPunc !== -1) aiMessage = aiMessage.slice(0, lastPunc + 1).trim();
                }
              }
            } catch (e) {
              // fallback
            }

            if (aiMessage) break;
          }
        } catch (err) { if (attempt === maxRetries) break; }
      }
    } finally { try { await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SEND_MESSAGES: true }); } catch (e) { } }

    if (!aiMessage) { await message.channel.send('La IA no pudo continuar la historia. ¡Alguien más puede contribuir!').catch(() => {}); state.waitingIA = false; return; }

    await message.channel.send(aiMessage).catch(() => {});
    state.story.push({ author: 'AI', authorName: 'Narrador IA', content: aiMessage, timestamp: Date.now() });
    const aiStats = Number(state.participants.get('AI') || 0); state.participants.set('AI', aiStats + 1);
    state.waitingIA = false;
    this.saveStoryState(message.channel.id, state);
  }
}

module.exports = StoryContributionEvent;
