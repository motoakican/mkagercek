import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const EMBED_DESCRIPTION_LIMIT = 4096;

export default {
    data: new SlashCommandBuilder()
    .setName("duello")
    .setDescription("Simüle edilmiş 1v1 metin tabanlı bir savaş başlatır.")
    .addUserOption((option) =>
      option
        .setName("rakip")
        .setDescription("Dövüşülecek kullanıcı.")
        .setRequired(true),
    ),
  category: 'Eğlence',

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction);

    const challenger = interaction.user;
    const opponent = interaction.options.getUser("rakip");

    if (challenger.id === opponent.id) {
      const embed = warningEmbed(
        "⚔️ Geçersiz Düello",
        `**${challenger.username}**, kendinle savaşamazsın! Bu başlamadan berabere biter.`
      );
      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    if (opponent.bot) {
      const embed = warningEmbed(
        "⚔️ Geçersiz Rakip",
        "Botlarla savaşamazsın! Bunun yerine gerçek bir kişiye meydan oku."
      );
      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    const winner = rand(0, 1) === 0 ? challenger : opponent;
    const loser = winner.id === challenger.id ? opponent : challenger;
    const rounds = rand(3, 7);
    const damage = rand(10, 50);

    const log = [];
    log.push(
      `💥 **${challenger.username}**, **${opponent.username}** adlı kullanıcıyı bir düelloya davet ediyor! (${rounds} raunt üzerinden)`,
    );

    for (let i = 1; i <= rounds; i++) {
      const attacker = rand(0, 1) === 0 ? challenger : opponent;
      const target = attacker.id === challenger.id ? opponent : challenger;
      const action = [
        "vahşi bir yumruk savuruyor",
        "kritik bir vuruş yapıyor",
        "zayıf bir büyü kullanıyor",
        "savuşturup karşı saldırıya geçiyor",
      ][rand(0, 3)];
      log.push(
        `\n**Raunt ${i}:** ${attacker.username}, ${target.username} üzerine ${action} ve ${rand(1, damage)} hasar veriyor!`,
      );
    }

    const outcomeText = log.join("\n");
    const winnerText = `👑 **${winner.username}**, ${loser.username} adlı kullanıcıyı alt ederek zafer kazandı!`;
    const fullDescription = `${outcomeText}\n\n${winnerText}`;

    const description = fullDescription.length <= EMBED_DESCRIPTION_LIMIT
      ? fullDescription
      : `${fullDescription.slice(0, EMBED_DESCRIPTION_LIMIT - 15)}\n\n...`;

    const embed = successEmbed(
      "🏆 Düello Tamamlandı!",
      description
    );

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    logger.debug(`Düello komutu ${challenger.id} ve ${opponent.id} arasında ${interaction.guildId} sunucusunda çalıştırıldı.`);
  },
};