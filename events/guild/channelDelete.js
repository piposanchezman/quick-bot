const Event = require("../../structures/Events");

module.exports = class ChannelDelete extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(channel) {
    if(!channel.guild) return;
	  if(!channel.guild.members.me.permissions.has("ManageGuild")) return;

		const channelData = await this.client.database.ticketsData().get(`${channel.id}`);
		if(channelData?.ticketData) {
    	await this.client.database.usersData().delete(`${channelData.ticketData.owner}.choosingCategory`);
		}

		if(!channelData) return;

		await this.client.database.ticketsData().delete(`${channel.id}`);
	} 
};